/**
 * Zero-setup local development: starts an in-memory MongoDB replica set
 * (transactions supported), loads demo data and runs the API.
 * Data is lost when the process stops – use a real MONGODB_URI for persistence.
 */
import { MongoMemoryReplSet } from 'mongodb-memory-server';

async function main() {
  const repl = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' }, instanceOpts: [{ launchTimeout: 60_000 }] });
  process.env.MONGODB_URI = repl.getUri('veejee');
  const { start } = await import('../server.js');
  const { runSeed } = await import('./seed.js');
  await start();
  await runSeed({ demo: true });
  const stop = async () => {
    await repl.stop();
  };
  process.on('exit', () => void stop());
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
