import pino from 'pino';
import { env } from '../config/env';

/**
 * Structured logger. Sensitive values are redacted at the logger level so that
 * passwords, tokens and cookies can never reach log storage by accident.
 */
export const logger = pino({
  level: env.isTest ? 'silent' : env.LOG_LEVEL,
  base: { service: 'veejee-api' },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      '*.password',
      '*.currentPassword',
      '*.newPassword',
      '*.token',
      '*.refreshToken',
      '*.accessToken',
      '*.passwordHash',
    ],
    censor: '[REDACTED]',
  },
  transport:
    env.NODE_ENV === 'development' ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard' } } : undefined,
});
