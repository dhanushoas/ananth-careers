import { decryptBuffer, encryptBuffer } from '../src/common/crypto';
import { MongoDriver } from '../src/services/storage/storage.service';
import { useDatabase } from './helpers';

useDatabase();

describe('free-hosting adapters', () => {
  it('stores, reads and deletes encrypted files in MongoDB GridFS (multi-chunk)', async () => {
    const driver = new MongoDriver();
    const data = Buffer.from('%PDF-1.4 gridfs test '.repeat(20000)); // ~420 KB → several chunks
    await driver.put('resumes/test/one.pdf.enc', encryptBuffer(data));
    expect(decryptBuffer(await driver.get('resumes/test/one.pdf.enc')).equals(data)).toBe(true);
    await driver.remove('resumes/test/one.pdf.enc');
    expect((await driver.get('resumes/test/one.pdf.enc').catch(() => Buffer.alloc(0))).length).toBe(0);
  });
});
