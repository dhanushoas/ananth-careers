/**
 * Persistent local MongoDB for development (no installation or admin rights needed).
 * Uses the official mongod binary that mongodb-memory-server downloads, runs it as a
 * single-node replica set (required for transactions) on 127.0.0.1:27017, and keeps
 * data in backend/.mongo-data so it survives restarts.
 *
 *   npm run db:local          – start the database (leave this terminal open)
 *   Connection string:  mongodb://127.0.0.1:27017/veejee?replicaSet=rs0&directConnection=true
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { MongoBinary } from 'mongodb-memory-server';
import { MongoClient } from 'mongodb';

const PORT = Number(process.env.LOCAL_DB_PORT ?? 27017);
const DB_PATH = path.resolve(__dirname, '../../.mongo-data');

async function main() {
  mkdirSync(DB_PATH, { recursive: true });
  const bin = await MongoBinary.getPath();
  console.log(`Starting MongoDB (${bin}) on 127.0.0.1:${PORT}, data in ${DB_PATH}`);
  const proc = spawn(bin, ['--port', String(PORT), '--bind_ip', '127.0.0.1', '--dbpath', DB_PATH, '--replSet', 'rs0', '--quiet'], { stdio: ['ignore', 'ignore', 'inherit'] });
  proc.on('exit', (code) => {
    console.log(`mongod exited with code ${code}`);
    process.exit(code ?? 0);
  });
  const stop = () => proc.kill('SIGINT');
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);

  // Wait for the server, then initialise the replica set once.
  const client = new MongoClient(`mongodb://127.0.0.1:${PORT}/?directConnection=true`, { serverSelectionTimeoutMS: 2000 });
  for (let i = 0; i < 30; i++) {
    try {
      await client.connect();
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  const admin = client.db('admin');
  try {
    await admin.command({ replSetGetStatus: 1 });
  } catch {
    await admin.command({ replSetInitiate: { _id: 'rs0', members: [{ _id: 0, host: `127.0.0.1:${PORT}` }] } });
    console.log('Replica set rs0 initialised');
  }
  for (let i = 0; i < 30; i++) {
    const hello = await admin.command({ hello: 1 });
    if (hello.isWritablePrimary) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  await client.close();
  console.log(`MongoDB ready: mongodb://127.0.0.1:${PORT}/veejee?replicaSet=rs0&directConnection=true  (Ctrl+C to stop)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
