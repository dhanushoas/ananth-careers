import multer from 'multer';
import { LIMITS } from '../common/constants';
import { AppError, FileError } from '../common/errors';

export type UploadKind = 'resume' | 'image';

const ALLOWED: Record<UploadKind, string[]> = {
  resume: ['application/pdf'],
  image: ['image/jpeg', 'image/png', 'image/webp'],
};

export function uploadMiddleware(kind: UploadKind) {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: kind === 'resume' ? LIMITS.resumeBytes : LIMITS.imageBytes, files: 1, fields: 5 },
    fileFilter: (_req, file, cb) => {
      if (!ALLOWED[kind].includes(file.mimetype)) {
        return cb(new FileError(415, 'UNSUPPORTED_FILE_TYPE', kind === 'resume' ? 'Only PDF resumes are accepted' : 'Only JPEG, PNG or WebP images are accepted'));
      }
      cb(null, true);
    },
  }).single('file');
}

/**
 * Verifies the real file type from its magic bytes – the client-supplied MIME type is not trusted.
 * Returns the canonical extension.
 */
export function verifyFileSignature(file: Express.Multer.File | undefined, kind: UploadKind): { ext: string; mime: string } {
  if (!file || !file.buffer?.length) throw new AppError(400, 'VALIDATION_ERROR', 'Please choose a file to upload', [{ field: 'file', message: 'File is required' }]);
  const b = file.buffer;
  if (kind === 'resume') {
    if (b.subarray(0, 5).toString('latin1') === '%PDF-') return { ext: 'pdf', mime: 'application/pdf' };
  } else {
    if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: 'jpg', mime: 'image/jpeg' };
    if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { ext: 'png', mime: 'image/png' };
    if (b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP') return { ext: 'webp', mime: 'image/webp' };
  }
  throw new FileError(415, 'UNSUPPORTED_FILE_TYPE', 'The file content does not match an accepted file type');
}
