import express, { Router } from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import { randomUUID } from 'node:crypto';
import pinoHttp from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env';
import { isDatabaseUp } from './config/db';
import { logger } from './common/logger';
import { sendSuccess } from './common/http';
import { buildOpenApi } from './docs/openapi';
import { errorHandler, notFoundHandler } from './middleware/error';
import { globalLimiter, requestTimeout, sanitizeRequest } from './middleware/security';
import { apiRouters } from './modules';

const VERSION = '1.0.0';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY);
  app.set('query parser', 'simple'); // flat query strings only – no nested objects from ?a[b]=c

  app.use(
    pinoHttp({
      logger,
      genReqId: (req, res) => {
        const id = (req.headers['x-request-id'] as string) || randomUUID();
        res.setHeader('x-request-id', id);
        return id;
      },
      customLogLevel: (_req, res, err) => (err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info'),
      serializers: { req: (req) => ({ id: req.id, method: req.method, url: req.url }), res: (res) => ({ statusCode: res.statusCode }) },
    }),
  );

  // API documentation (relaxed CSP only for the Swagger UI page).
  const spec = buildOpenApi(VERSION);
  app.get('/api/docs/openapi.json', (_req, res) => res.json(spec));
  app.use(
    '/api/docs',
    helmet({ contentSecurityPolicy: { directives: { 'script-src': ["'self'"], 'style-src': ["'self'", "'unsafe-inline'"], 'img-src': ["'self'", 'data:'] } } }),
    swaggerUi.serve,
    swaggerUi.setup(spec, { customSiteTitle: 'Veejee Services API Docs' }),
  );

  app.use(
    helmet({
      contentSecurityPolicy: { directives: { 'default-src': ["'none'"], 'frame-ancestors': ["'none'"] } },
      crossOriginResourcePolicy: { policy: 'same-site' },
      hsts: env.isProd ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
    }),
  );
  app.use(
    cors({
      origin: (origin, cb) => cb(null, !origin || env.corsOrigins.includes(origin)),
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Request-Id'],
      maxAge: 600,
    }),
  );
  app.use(express.json({ limit: '200kb' }));
  app.use(express.urlencoded({ extended: false, limit: '50kb' }));
  app.use(cookieParser());
  app.use(sanitizeRequest);

  const health = (_req: express.Request, res: express.Response) => {
    const db = isDatabaseUp() ? 'up' : 'down';
    res.status(db === 'up' ? 200 : 503);
    sendSuccess(res, { status: db === 'up' ? 'ok' : 'degraded', db, uptime: Math.round(process.uptime()), version: VERSION }, 'Health check', db === 'up' ? 200 : 503);
  };
  app.get('/health', health);

  const api = Router();
  api.get('/health', health);
  api.use(globalLimiter, requestTimeout(30_000));
  for (const r of apiRouters) api.use(r.basePath, r.router);
  app.use('/api/v1', api);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
