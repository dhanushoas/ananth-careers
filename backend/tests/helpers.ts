import mongoose from 'mongoose';
import request from 'supertest';
import { randomBytes } from 'node:crypto';
import os from 'node:os';
import { createApp } from '../src/app';
import { EmailOutbox } from '../src/models';
import { runSeed, DEMO_PASSWORD } from '../src/scripts/seed';

export const app = createApp();
export const api = () => request(app);
export { DEMO_PASSWORD };

/** Each test file gets its own database on the shared in-memory replica set. */
export function useDatabase(opts: { seed?: boolean } = {}) {
  beforeAll(async () => {
    // The driver loads its `os` adapter via dynamic import(), which Jest's CommonJS VM cannot do – inject it.
    await mongoose.connect(process.env.MONGODB_URI!, { dbName: `t_${randomBytes(4).toString('hex')}`, runtimeAdapters: { os } } as mongoose.ConnectOptions);
    await Promise.all(Object.values(mongoose.models).map((m) => m.createIndexes()));
    if (opts.seed) await runSeed({ demo: true });
  });
  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
}

export async function login(email: string, password = DEMO_PASSWORD) {
  const res = await api().post('/api/v1/auth/login').send({ email, password });
  if (res.status !== 200) throw new Error(`login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  return { token: res.body.data.accessToken as string, user: res.body.data.user, cookie: res.headers['set-cookie'] as unknown as string[] };
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

/** Extract the token from the most recent email of a template sent to an address. */
export async function tokenFromEmail(to: string, template: string) {
  const mail = await EmailOutbox.findOne({ to, template }).sort({ createdAt: -1 });
  if (!mail) throw new Error(`no ${template} email for ${to}`);
  const m = mail.html.match(/token=([A-Za-z0-9_\-%]+)/);
  if (!m) throw new Error('token not found in email');
  return decodeURIComponent(m[1]!);
}

export const PDF = Buffer.from('%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF');
export const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);

export async function registerVerifiedCandidate(email: string, extra: Record<string, unknown> = {}) {
  await api()
    .post('/api/v1/auth/register/candidate')
    .send({ name: 'Test Candidate', email, mobile: '9876543210', password: 'Secret123', acceptTerms: true, acceptPrivacy: true, ...extra })
    .expect(201);
  const token = await tokenFromEmail(email, 'verifyEmail');
  await api().post('/api/v1/auth/verify-email').send({ token }).expect(200);
  return login(email, 'Secret123');
}
