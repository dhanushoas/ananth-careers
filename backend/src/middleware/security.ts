import type { NextFunction, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env';
import { sendError } from '../common/http';
import { ForbiddenError } from '../common/errors';

/** Recursively removes keys that could be interpreted as MongoDB operators or dotted paths. */
function strip(value: unknown, depth = 0): unknown {
  if (depth > 20 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => strip(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    if (k.startsWith('$') || k.includes('.') || k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
    out[k] = strip(v, depth + 1);
  }
  return out;
}

export function sanitizeRequest(req: Request, _res: Response, next: NextFunction) {
  if (req.body && typeof req.body === 'object') req.body = strip(req.body);
  next();
}

const limiter = (max: number, windowMs = env.RATE_LIMIT_WINDOW_MS, message = 'Too many requests. Please try again later.') =>
  rateLimit({
    windowMs,
    limit: max,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, res) => sendError(res, 429, 'RATE_LIMITED', message),
  });

export const globalLimiter = limiter(env.RATE_LIMIT_MAX);
export const authLimiter = limiter(env.AUTH_RATE_LIMIT_MAX, env.RATE_LIMIT_WINDOW_MS, 'Too many attempts. Please wait a few minutes and try again.');
export const contactLimiter = limiter(env.CONTACT_RATE_LIMIT_MAX, 60 * 60 * 1000, 'You have sent several enquiries recently. Please try again later.');

/**
 * CSRF defence for cookie-authenticated endpoints (refresh/logout): the refresh cookie is
 * SameSite=Strict, and we additionally require a custom header (not sendable cross-site
 * without a CORS pre-flight) and an allow-listed Origin when the browser supplies one.
 */
export function requireSameOriginRequest(req: Request, _res: Response, next: NextFunction) {
  if (req.get('x-requested-with') !== 'XMLHttpRequest') return next(new ForbiddenError('Request blocked by CSRF protection', 'CSRF_REJECTED'));
  const origin = req.get('origin');
  if (origin && !env.corsOrigins.includes(origin)) return next(new ForbiddenError('Request blocked by CSRF protection', 'CSRF_REJECTED'));
  next();
}

export function requestTimeout(ms: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const t = setTimeout(() => {
      if (!res.headersSent) sendError(res, 503, 'REQUEST_TIMEOUT', 'The server took too long to respond. Please try again.');
    }, ms);
    res.on('finish', () => clearTimeout(t));
    res.on('close', () => clearTimeout(t));
    next();
  };
}
