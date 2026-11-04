import mongoose from 'mongoose';
import { env } from './env';
import { logger } from '../common/logger';

let listenersAttached = false;

/** One-line error summary – driver errors embed huge topology dumps that flood hosted logs. */
const summarize = (err: unknown) => String((err as Error)?.message ?? err).split('\n')[0]!.slice(0, 300);
const HINT = 'Check MONGODB_URI (user, password, /veejee database) and Atlas Network Access – hosts without fixed IPs (e.g. Render free) need 0.0.0.0/0';

export async function connectDatabase(uri = env.MONGODB_URI) {
  if (!listenersAttached) {
    listenersAttached = true;
    mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected – driver will retry automatically'));
    mongoose.connection.on('reconnected', () => logger.info('MongoDB reconnected'));
    mongoose.connection.on('error', (err) => logger.error({ error: summarize(err) }, 'MongoDB connection error'));
  }
  const maxAttempts = env.isTest ? 1 : 10;
  for (let attempt = 1; ; attempt++) {
    try {
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 10_000,
        maxPoolSize: 20,
        retryWrites: true,
        autoIndex: !env.isProd, // build indexes in dev/test; use `npm run seed -- --indexes` (syncIndexes) for prod
      });
      logger.info('MongoDB connected');
      return mongoose.connection;
    } catch (err) {
      if (attempt >= maxAttempts) throw err;
      const delay = Math.min(30_000, 1000 * 2 ** attempt);
      logger.error({ error: summarize(err), attempt, hint: HINT }, `MongoDB connection failed, retrying in ${delay}ms`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
}

export const isDatabaseUp = () => mongoose.connection.readyState === 1;
