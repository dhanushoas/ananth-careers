import type { MongoMemoryReplSet } from 'mongodb-memory-server';

export default async function globalTeardown() {
  await (globalThis as unknown as { __MONGO__?: MongoMemoryReplSet }).__MONGO__?.stop();
}
