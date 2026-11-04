import type { Request, Response } from 'express';
import type { ErrorDetail } from './errors';

export function sendSuccess(res: Response, data: unknown, message = 'Request completed successfully', status = 200) {
  return res.status(status).json({ success: true, message, data: data ?? null, timestamp: new Date().toISOString() });
}

export function sendError(res: Response, status: number, errorCode: string, message: string, details: ErrorDetail[] = []) {
  return res.status(status).json({ success: false, message, errorCode, details, timestamp: new Date().toISOString() });
}

export type Paginated<T> = { items: T[]; page: number; limit: number; total: number; totalPages: number };

export function paginated<T>(items: T[], total: number, page: number, limit: number): Paginated<T> {
  return { items, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

export function clientInfo(req: Request) {
  return { ip: req.ip ?? '', userAgent: String(req.headers['user-agent'] ?? '').slice(0, 300) };
}

/** Escape user input before using it inside a RegExp. */
export function escapeRegex(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
