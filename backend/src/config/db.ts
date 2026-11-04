import mongoose from 'mongoose';
import { env } from './env';
import { logger } from '../common/logger';

let listenersAttached = false;

export async function connectDatabase(uri = env.MONGODB_URI) {
  if (!listenersAttached) {
    listenersAttached = true;
    mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected – driver will retry automatically'));
    mongoose.connection.on('reconnected', () => logger.info('MongoDB reconnected'));
    mongoose.connection.on('error', (err) => logger.error({ err }, 'MongoDB connection error'));
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
      logger.error({ err, attempt }, `MongoDB connection failed, retrying in ${delay}ms`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
}

export const isDatabaseUp = () => mongoose.connection.readyState === 1;
