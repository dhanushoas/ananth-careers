/**
 * Rehearsal for SEED_DEMO_DATA on a throw-away in-memory database (never touches a real database):
 * a "real" admin + real user exist → load demo data in live mode → check → remove → check real data survived.
 *   npx tsx src/scripts/live-demo-rehearsal.ts
 */
import assert from 'node:assert/strict';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

async function main() {
  const repl = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  Object.assign(process.env, {
    NODE_ENV: 'development',
    MONGODB_URI: repl.getUri('veejee_live_rehearsal'),
    STORAGE_DRIVER: 'mongo', // like Render
    FILE_ENCRYPTION_KEY: Buffer.alloc(32, 9).toString('base64'),
    JWT_ACCESS_SECRET: 'rehearsal-secret-rehearsal-secret-123456',
    SEED_ADMIN_EMAIL: 'owner@realcompany.in',
    SEED_ADMIN_PASSWORD: 'Real-Admin-Password-1',
    LOG_LEVEL: 'warn',
  });
  const mongoose = (await import('mongoose')).default;
  const { connectDatabase } = await import('../config/db.js');
  const { runSeed, removeDemoData } = await import('./seed.js');
  const models = await import('../models/index.js');
  const bcrypt = await import('argon2').catch(() => null);
  try {
    await connectDatabase();
    await runSeed({ demo: false, indexes: true });
    const realUser = await models.User.create({ name: 'Real Candidate', email: 'real.person@gmail.com', mobile: '9999999999', role: 'candidate', passwordHash: 'x', status: 'active', emailVerified: true });

    await assert.rejects(runSeed({ demo: true, live: true, demoPassword: 'short' }), /at least 12/);
    await runSeed({ demo: true, live: true, demoPassword: 'Live-Demo-Password-77' });
    await runSeed({ demo: true, live: true, demoPassword: 'Live-Demo-Password-77' }); // idempotent

    const db = mongoose.connection.db!;
    const counts: Record<string, number> = {};
    for (const c of (await db.listCollections().toArray()).map((x) => x.name).sort()) counts[c] = await db.collection(c).countDocuments();
    console.log('after live demo seed:', JSON.stringify(counts));
    assert.equal(await models.User.countDocuments({ email: 'admin@veejee.example' }), 0, 'no known-password demo admin on live');
    assert.equal(await models.User.countDocuments({ permissions: '*' }), 1, 'only the real admin');
    const demoUser = await models.User.findOne({ email: 'seeker@veejee.example' }).select('+passwordHash');
    if (bcrypt) assert.ok(await bcrypt.verify(demoUser!.passwordHash!, 'Live-Demo-Password-77'), 'demo accounts use DEMO_PASSWORD');
    const home = await models.SiteContent.findOne({ key: 'home' }).lean();
    assert.deepEqual((home?.value as { stats?: unknown[] }).stats, [], 'no invented stats on live');
    const empty = Object.entries(counts).filter(([, n]) => n === 0).map(([c]) => c);
    console.log('empty collections:', empty.join(', ') || 'none');
    const gridfsBefore = counts['storage.files'] ?? counts['resumes.files'] ?? 0;
    assert.ok(gridfsBefore > 0 || Object.keys(counts).some((c) => c.endsWith('.files')), 'resume PDFs stored in GridFS');

    await removeDemoData();
    const after: Record<string, number> = {};
    for (const c of (await db.listCollections().toArray()).map((x) => x.name).sort()) after[c] = await db.collection(c).countDocuments();
    console.log('after removal:', JSON.stringify(after));
    assert.equal(await models.User.countDocuments({ email: /\.example$/ }), 0);
    assert.ok(await models.User.exists({ _id: realUser._id }), 'real user kept');
    assert.ok(await models.User.exists({ email: 'owner@realcompany.in' }), 'real admin kept');
    for (const c of ['companies', 'job_requirements', 'candidates', 'candidate_applications', 'interviews', 'resumes', 'testimonials', 'contact_enquiries']) {
      assert.equal(after[c] ?? 0, 0, `${c} emptied`);
    }
    const files = Object.entries(after).filter(([c]) => c.endsWith('.files')).reduce((n, [, v]) => n + v, 0);
    assert.equal(files, 0, 'resume files removed from GridFS');
    console.log('\nLIVE DEMO REHEARSAL PASSED');
  } finally {
    await mongoose.disconnect();
    await repl.stop();
  }
}
main().catch((e) => {
  console.error('REHEARSAL FAILED:', e.message);
  process.exit(1);
});
