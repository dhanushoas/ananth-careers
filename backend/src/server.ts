import type { Server } from 'node:http';
import { env } from './config/env';
import { connectDatabase, disconnectDatabase } from './config/db';
import { logger } from './common/logger';
import { createApp } from './app';
import { startEmailWorker, stopEmailWorker } from './services/email/email.service';
import { startScheduler, stopScheduler } from './services/scheduler.service';

export async function start(): Promise<Server> {
  await connectDatabase();
  const app = createApp();
  const server = app.listen(env.PORT, () => logger.info(`Veejee Services API listening on :${env.PORT} (${env.NODE_ENV}) – docs at /api/docs`));
  server.requestTimeout = 60_000;
  server.headersTimeout = 65_000;
  server.keepAliveTimeout = 61_000;
  startEmailWorker();
  startScheduler();

  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`${signal} received – shutting down gracefully`);
    stopEmailWorker();
    stopScheduler();
    const force = setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 15_000);
    force.unref();
    server.close(async () => {
      await disconnectDatabase().catch(() => undefined);
      logger.info('Shutdown complete');
      process.exit(0);
    });
    server.closeAllConnections?.();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => logger.error({ reason }, 'Unhandled promise rejection'));
  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'Uncaught exception – exiting');
    shutdown('uncaughtException');
  });
  return server;
}

if (require.main === module) {
  start().catch((err) => {
    logger.fatal({ err }, 'Failed to start server');
    process.exit(1);
  });
}
