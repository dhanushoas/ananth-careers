import type { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import { ZodError } from 'zod';
import { AppError } from '../common/errors';
import { sendError } from '../common/http';
import { logger } from '../common/logger';

export function notFoundHandler(req: Request, res: Response) {
  sendError(res, 404, 'NOT_FOUND', `Route ${req.method} ${req.path} not found`);
}

/** Centralised error handler – maps every error to the standard envelope and never leaks internals. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (res.headersSent) return;

  if (err instanceof AppError) {
    if (err.statusCode >= 500) logger.error({ err, path: req.path }, err.message);
    return sendError(res, err.statusCode, err.errorCode, err.message, err.details);
  }
  if (err instanceof ZodError) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'Some fields are invalid', err.issues.map((i) => ({ field: i.path.join('.'), message: i.message })));
  }
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') return sendError(res, 413, 'PAYLOAD_TOO_LARGE', 'The file is too large');
    return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid file upload', [{ field: err.field, message: err.message }]);
  }
  if (err instanceof mongoose.Error.ValidationError) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'Some fields are invalid', Object.values(err.errors).map((e) => ({ field: e.path, message: e.message })));
  }
  if (err instanceof mongoose.Error.CastError) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid identifier or value', [{ field: err.path, message: 'Invalid value' }]);
  }
  const e = err as { code?: number; type?: string; status?: number; name?: string; keyValue?: Record<string, unknown> };
  if (e?.code === 11000) {
    const field = Object.keys(e.keyValue ?? {})[0];
    return sendError(res, 409, 'DUPLICATE_RESOURCE', field === 'email' ? 'An account with this email already exists' : 'This record already exists', field ? [{ field, message: 'Already exists' }] : []);
  }
  if (e?.type === 'entity.parse.failed') return sendError(res, 400, 'VALIDATION_ERROR', 'Malformed JSON body');
  if (e?.type === 'entity.too.large') return sendError(res, 413, 'PAYLOAD_TOO_LARGE', 'Request body is too large');
  if (e?.name === 'MongooseServerSelectionError' || e?.name === 'MongoNetworkError' || e?.name === 'MongoServerSelectionError' || e?.name === 'MongoNotConnectedError') {
    logger.error({ err }, 'Database unavailable');
    return sendError(res, 503, 'SERVICE_UNAVAILABLE', 'Service temporarily unavailable. Please try again shortly.');
  }
  logger.error({ err, path: req.path, method: req.method }, 'Unhandled error');
  return sendError(res, 500, 'INTERNAL_ERROR', 'Something went wrong on our side. Please try again.');
}
