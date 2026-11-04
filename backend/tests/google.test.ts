import { Candidate, Employer, Industry, User } from '../src/models';
import { setGoogleVerifier, type GoogleProfile } from '../src/modules/auth/auth.google';
import { api, bearer, useDatabase } from './helpers';

useDatabase({ seed: true });

const TOKEN = 'g'.repeat(200);
let profile: GoogleProfile;
beforeAll(() => setGoogleVerifier(async () => profile));
afterAll(() => setGoogleVerifier(null));

describe('Continue with Google', () => {
  it('asks a new person to complete sign-up, then creates a verified candidate', async () => {
    profile = { sub: 'google-1', email: 'newcomer@candidate-mail.in', emailVerified: true, name: 'New Comer' };
    const first = await api().post('/api/v1/auth/google').send({ credential: TOKEN }).expect(200);
    expect(first.body.data).toMatchObject({ status: 'signup_required', profile: { email: 'newcomer@candidate-mail.in', name: 'New Comer' } });
    expect(await User.exists({ email: 'newcomer@candidate-mail.in' })).toBeFalsy();

    await api().post('/api/v1/auth/google').send({ credential: TOKEN, signup: { role: 'candidate', mobile: '9876500999' } }).expect(400); // consent required
    const done = await api()
      .post('/api/v1/auth/google')
      .send({ credential: TOKEN, signup: { role: 'candidate', mobile: '9876500999', acceptTerms: true, acceptPrivacy: true, careerLevel: 'fresher' } })
      .expect(200);
    expect(done.body.data.status).toBe('signed_in');
    expect(done.body.data.accessToken).toBeDefined();
    expect(done.headers['set-cookie'][0]).toMatch(/ananth_rt=/);
    const u = await User.findOne({ email: 'newcomer@candidate-mail.in' }).select('+passwordHash +googleId');
    expect(u).toMatchObject({ role: 'candidate', emailVerified: true, googleId: 'google-1' });
    expect(u!.passwordHash).toBeUndefined();
    expect(await Candidate.exists({ user: u!._id })).toBeTruthy();
    const me = await api().get('/api/v1/auth/me').set(bearer(done.body.data.accessToken)).expect(200);
    expect(me.body.data.user.googleId).toBeUndefined(); // never exposed
  });

  it('signs a returning Google user straight in', async () => {
    const again = await api().post('/api/v1/auth/google').send({ credential: TOKEN }).expect(200);
    expect(again.body.data.status).toBe('signed_in');
  });

  it('creates a company account via Google', async () => {
    profile = { sub: 'google-2', email: 'owner@company-mail.in', emailVerified: true, name: 'Company Owner' };
    const industry = await Industry.findOne();
    const r = await api()
      .post('/api/v1/auth/google')
      .send({ credential: TOKEN, signup: { role: 'employer', mobile: '9876500998', acceptTerms: true, acceptPrivacy: true, companyName: 'Google Signup Pvt Ltd', industryId: String(industry!._id) } })
      .expect(200);
    expect(r.body.data.user.role).toBe('employer');
    expect((await Employer.findOne({ companyName: 'Google Signup Pvt Ltd' }))!.verificationStatus).toBe('pending');
  });

  it('links Google to an existing password account and verifies its email', async () => {
    await api().post('/api/v1/auth/register/candidate').send({ name: 'Pass User', email: 'linker@candidate-mail.in', mobile: '9876500997', password: 'Secret123', acceptTerms: true, acceptPrivacy: true }).expect(201);
    await api().post('/api/v1/auth/login').send({ email: 'linker@candidate-mail.in', password: 'Secret123' }).expect(403); // not verified yet
    profile = { sub: 'google-3', email: 'linker@candidate-mail.in', emailVerified: true, name: 'Pass User' };
    await api().post('/api/v1/auth/google').send({ credential: TOKEN }).expect(200);
    await api().post('/api/v1/auth/login').send({ email: 'linker@candidate-mail.in', password: 'Secret123' }).expect(200);
  });

  it('rejects unverified Google emails, other Google accounts for a linked email, and blocked users', async () => {
    profile = { sub: 'google-4', email: 'unverified@candidate-mail.in', emailVerified: false };
    await api().post('/api/v1/auth/google').send({ credential: TOKEN }).expect(403);
    profile = { sub: 'google-OTHER', email: 'linker@candidate-mail.in', emailVerified: true };
    await api().post('/api/v1/auth/google').send({ credential: TOKEN }).expect(409);
    await User.updateOne({ email: 'newcomer@candidate-mail.in' }, { status: 'blocked' });
    profile = { sub: 'google-1', email: 'newcomer@candidate-mail.in', emailVerified: true };
    expect((await api().post('/api/v1/auth/google').send({ credential: TOKEN }).expect(403)).body.errorCode).toBe('ACCOUNT_BLOCKED');
  });

  it('never creates staff accounts via Google; Google-only users delete with a typed confirmation', async () => {
    profile = { sub: 'google-5', email: 'deleteme@candidate-mail.in', emailVerified: true, name: 'Delete Me' };
    const r = await api().post('/api/v1/auth/google').send({ credential: TOKEN, signup: { role: 'recruiter', mobile: '9876500996', acceptTerms: true, acceptPrivacy: true } }).expect(400);
    expect(r.body.errorCode).toBe('VALIDATION_ERROR');
    const ok = await api().post('/api/v1/auth/google').send({ credential: TOKEN, signup: { role: 'candidate', mobile: '9876500996', acceptTerms: true, acceptPrivacy: true } }).expect(200);
    const t = ok.body.data.accessToken;
    await api().post('/api/v1/auth/change-password').set(bearer(t)).send({ currentPassword: 'x', newPassword: 'NewPass123' }).expect(400);
    await api().delete('/api/v1/users/me').set(bearer(t)).send({}).expect(400);
    await api().delete('/api/v1/users/me').set(bearer(t)).send({ confirm: 'DELETE' }).expect(200);
  });

  it('reports provider configuration publicly', async () => {
    const p = await api().get('/api/v1/auth/providers').expect(200);
    expect(p.body.data.google).toHaveProperty('enabled');
  });
});
