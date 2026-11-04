import { RefreshSession, User } from '../src/models';
import { api, bearer, login, tokenFromEmail, useDatabase } from './helpers';

useDatabase({ seed: true });

const reg = (over: Record<string, unknown> = {}) => ({
  name: 'Asha Verma',
  email: 'asha@example.com',
  mobile: '+919812345678',
  password: 'Password1',
  acceptTerms: true,
  acceptPrivacy: true,
  ...over,
});
const cookieHdr = (setCookie: string[]) => setCookie.map((c) => c.split(';')[0]).join('; ');
const XHR = { 'X-Requested-With': 'XMLHttpRequest' };

describe('registration & verification', () => {
  it('validates input and returns the standard error envelope', async () => {
    const res = await api().post('/api/v1/auth/register/candidate').send(reg({ email: 'nope', password: 'short', acceptTerms: false })).expect(400);
    expect(res.body).toMatchObject({ success: false, errorCode: 'VALIDATION_ERROR' });
    const fields = res.body.details.map((d: { field: string }) => d.field);
    expect(fields).toEqual(expect.arrayContaining(['email', 'password', 'acceptTerms']));
    expect(res.body.timestamp).toBeDefined();
    expect(JSON.stringify(res.body)).not.toMatch(/stack|at Object\./);
  });

  it('registers, blocks login until verified, then verifies via emailed link', async () => {
    const res = await api().post('/api/v1/auth/register/candidate').send(reg()).expect(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.passwordHash).toBeUndefined();
    expect(res.body.data.user.email).toBe('asha@example.com');

    const blocked = await api().post('/api/v1/auth/login').send({ email: 'asha@example.com', password: 'Password1' }).expect(403);
    expect(blocked.body.errorCode).toBe('EMAIL_NOT_VERIFIED');

    const token = await tokenFromEmail('asha@example.com', 'verifyEmail');
    await api().post('/api/v1/auth/verify-email').send({ token }).expect(200);
    await api().post('/api/v1/auth/verify-email').send({ token }).expect(400); // single use

    const { user } = await login('asha@example.com', 'Password1');
    expect(user.emailVerified).toBe(true);
  });

  it('rejects duplicate emails (case-insensitive)', async () => {
    const res = await api().post('/api/v1/auth/register/candidate').send(reg({ email: 'ASHA@example.com' })).expect(409);
    expect(res.body.errorCode).toBe('DUPLICATE_RESOURCE');
  });

  it('stores passwords with Argon2id', async () => {
    const u = await User.findOne({ email: 'asha@example.com' }).select('+passwordHash');
    expect(u!.passwordHash).toMatch(/^\$argon2id\$/);
  });

  it('strips HTML from text input (stored XSS defence)', async () => {
    await api().post('/api/v1/auth/register/candidate').send(reg({ email: 'x@example.com', name: '<script>alert(1)</script>Ravi <b>K</b>' })).expect(201);
    const u = await User.findOne({ email: 'x@example.com' });
    expect(u!.name).toBe('Ravi K');
  });
});

describe('login security', () => {
  it('rejects NoSQL operator injection', async () => {
    const res = await api().post('/api/v1/auth/login').send({ email: { $gt: '' }, password: { $gt: '' } }).expect(400);
    expect(res.body.errorCode).toBe('VALIDATION_ERROR');
  });

  it('uses a generic message for unknown users and wrong passwords', async () => {
    const a = await api().post('/api/v1/auth/login').send({ email: 'ghost@example.com', password: 'Password1' }).expect(401);
    const b = await api().post('/api/v1/auth/login').send({ email: 'asha@example.com', password: 'Wrong1234' }).expect(401);
    expect(a.body.message).toBe(b.body.message);
    expect(a.body.errorCode).toBe('INVALID_CREDENTIALS');
  });

  it('locks the account after 5 failed attempts', async () => {
    for (let i = 0; i < 5; i++) await api().post('/api/v1/auth/login').send({ email: 'x@example.com', password: 'Wrong1234' });
    const res = await api().post('/api/v1/auth/login').send({ email: 'x@example.com', password: 'Password1' }).expect(423);
    expect(res.body.errorCode).toBe('ACCOUNT_LOCKED');
  });

  it('rejects missing, malformed and tampered access tokens', async () => {
    await api().get('/api/v1/auth/me').expect(401);
    await api().get('/api/v1/auth/me').set(bearer('not-a-jwt')).expect(401);
    const { token } = await login('seeker@veejee.example');
    const tampered = token.slice(0, -3) + (token.endsWith('aaa') ? 'bbb' : 'aaa');
    await api().get('/api/v1/auth/me').set(bearer(tampered)).expect(401);
    const me = await api().get('/api/v1/auth/me').set(bearer(token)).expect(200);
    expect(me.body.data.profile.headline).toBeDefined();
  });

  it('sets an httpOnly SameSite=Strict refresh cookie', async () => {
    const { cookie } = await login('seeker@veejee.example');
    expect(cookie[0]).toMatch(/ananth_rt=/);
    expect(cookie[0]).toMatch(/HttpOnly/i);
    expect(cookie[0]).toMatch(/SameSite=Strict/i);
    expect(cookie[0]).toMatch(/Path=\/api\/v1\/auth/);
  });
});

describe('refresh token rotation', () => {
  it('requires the CSRF header and an allowed origin', async () => {
    const { cookie } = await login('seeker@veejee.example');
    await api().post('/api/v1/auth/refresh').set('Cookie', cookieHdr(cookie)).expect(403);
    await api().post('/api/v1/auth/refresh').set('Cookie', cookieHdr(cookie)).set(XHR).set('Origin', 'https://evil.example').expect(403);
  });

  it('rotates tokens and revokes the family when an old token is replayed', async () => {
    const { cookie } = await login('seeker@veejee.example');
    const first = await api().post('/api/v1/auth/refresh').set('Cookie', cookieHdr(cookie)).set(XHR).set('Origin', 'http://localhost:4200').expect(200);
    expect(first.body.data.accessToken).toBeDefined();
    const rotated = first.headers['set-cookie'] as unknown as string[];

    // Replay of the original (already rotated) token → reuse detected.
    await api().post('/api/v1/auth/refresh').set('Cookie', cookieHdr(cookie)).set(XHR).expect(401);
    // The legitimately rotated token is now revoked too.
    await api().post('/api/v1/auth/refresh').set('Cookie', cookieHdr(rotated)).set(XHR).expect(401);
    expect(await RefreshSession.countDocuments({ revokedReason: 'reuse_detected' })).toBeGreaterThan(0);
  });

  it('logout revokes the session', async () => {
    const { cookie } = await login('seeker@veejee.example');
    await api().post('/api/v1/auth/logout').set('Cookie', cookieHdr(cookie)).set(XHR).expect(200);
    await api().post('/api/v1/auth/refresh').set('Cookie', cookieHdr(cookie)).set(XHR).expect(401);
  });
});

describe('password reset & change', () => {
  it('resets a forgotten password with a single-use emailed token and signs out other sessions', async () => {
    const { cookie } = await login('asha@example.com', 'Password1');
    await api().post('/api/v1/auth/forgot-password').send({ email: 'asha@example.com' }).expect(200);
    await api().post('/api/v1/auth/forgot-password').send({ email: 'nobody@example.com' }).expect(200); // no enumeration
    const token = await tokenFromEmail('asha@example.com', 'passwordReset');
    await api().post('/api/v1/auth/reset-password').send({ token, password: 'NewPassw0rd' }).expect(200);
    await api().post('/api/v1/auth/reset-password').send({ token, password: 'Another1x' }).expect(400);
    await api().post('/api/v1/auth/refresh').set('Cookie', cookieHdr(cookie)).set(XHR).expect(401);
    await login('asha@example.com', 'NewPassw0rd');
  });

  it('changes password only with the correct current password', async () => {
    const { token } = await login('asha@example.com', 'NewPassw0rd');
    await api().post('/api/v1/auth/change-password').set(bearer(token)).send({ currentPassword: 'wrong', newPassword: 'Changed123' }).expect(400);
    await api().post('/api/v1/auth/change-password').set(bearer(token)).send({ currentPassword: 'NewPassw0rd', newPassword: 'Changed123' }).expect(200);
    await login('asha@example.com', 'Changed123');
  });
});
