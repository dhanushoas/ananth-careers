import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import mongoose from 'mongoose';
import { env } from '../../config/env';
import { decryptBuffer, encryptBuffer } from '../../common/crypto';
import { AppError } from '../../common/errors';
import { logger } from '../../common/logger';

interface StorageDriver {
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
}

class LocalDriver implements StorageDriver {
  private readonly root = path.resolve(env.STORAGE_LOCAL_DIR, 'files');
  private resolve(key: string) {
    const full = path.resolve(this.root, key);
    if (!full.startsWith(this.root + path.sep)) throw new AppError(400, 'VALIDATION_ERROR', 'Invalid storage key');
    return full;
  }
  async put(key: string, data: Buffer) {
    const full = this.resolve(key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, data);
  }
  async get(key: string) {
    return readFile(this.resolve(key));
  }
  async remove(key: string) {
    await rm(this.resolve(key), { force: true });
  }
}

/** Any S3-compatible object store (AWS S3, Cloudflare R2, DigitalOcean Spaces, MinIO). */
class S3Driver implements StorageDriver {
  private readonly client = new S3Client({
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    credentials:
      env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY
        ? { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY }
        : undefined,
  });
  async put(key: string, data: Buffer) {
    await this.client.send(
      new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: key, Body: data, ContentType: 'application/octet-stream', ServerSideEncryption: 'AES256' }),
    );
  }
  async get(key: string) {
    const out = await this.client.send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
    return Buffer.from(await out.Body!.transformToByteArray());
  }
  async remove(key: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
  }
}

/**
 * Stores files inside MongoDB using GridFS (bucket "files"). Free-hosting friendly:
 * no separate object store or persistent disk is needed. Data is already AES-256-GCM
 * encrypted by `storage.save` before it reaches this driver.
 */
export class MongoDriver implements StorageDriver {
  private bucket() {
    const db = mongoose.connection.db;
    if (!db) throw new AppError(503, 'SERVICE_UNAVAILABLE', 'Database not connected');
    return new mongoose.mongo.GridFSBucket(db, { bucketName: 'files', chunkSizeBytes: 255 * 1024 });
  }
  async put(key: string, data: Buffer) {
    await new Promise<void>((resolve, reject) => {
      const up = this.bucket().openUploadStream(key, { metadata: { size: data.length } });
      up.once('finish', () => resolve());
      up.once('error', reject);
      up.end(data);
    });
  }
  async get(key: string) {
    const chunks: Buffer[] = [];
    for await (const chunk of this.bucket().openDownloadStreamByName(key)) chunks.push(chunk as Buffer);
    return Buffer.concat(chunks);
  }
  async remove(key: string) {
    const bucket = this.bucket();
    for (const f of await bucket.find({ filename: key }).toArray()) await bucket.delete(f._id);
  }
}

const driver: StorageDriver = env.STORAGE_DRIVER === 's3' ? new S3Driver() : env.STORAGE_DRIVER === 'mongo' ? new MongoDriver() : new LocalDriver();

/**
 * All uploaded files are encrypted with AES-256-GCM before they leave the process,
 * so resumes and photos are protected at rest regardless of the storage backend.
 */
export const storage = {
  async save(folder: 'resumes' | 'avatars' | 'logos', data: Buffer, ext: string) {
    const key = `${folder}/${new Date().toISOString().slice(0, 7)}/${randomUUID()}.${ext}.enc`;
    try {
      await driver.put(key, encryptBuffer(data));
    } catch (err) {
      logger.error({ err }, 'File storage write failed');
      throw new AppError(502, 'FILE_STORAGE_ERROR', 'We could not store your file. Please try again.');
    }
    return key;
  },
  async read(key: string) {
    try {
      return decryptBuffer(await driver.get(key));
    } catch (err) {
      logger.error({ err, key }, 'File storage read failed');
      throw new AppError(404, 'NOT_FOUND', 'File not found');
    }
  },
  async remove(key: string | undefined) {
    if (!key) return;
    try {
      await driver.remove(key);
    } catch (err) {
      logger.warn({ err, key }, 'File storage delete failed');
    }
  },
};
