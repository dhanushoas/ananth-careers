import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

export default async function globalSetup() {
  const repl = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' }, instanceOpts: [{ launchTimeout: 60_000 }] });
  (globalThis as unknown as { __MONGO__: MongoMemoryReplSet }).__MONGO__ = repl;
  writeFileSync(path.join(__dirname, '.mongo-uri'), repl.getUri());
}
