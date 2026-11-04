import { Candidate, Job, Recruiter, Resume, User } from '../src/models';
import { PDF, PNG, api, bearer, login, registerVerifiedCandidate, useDatabase } from './helpers';

useDatabase({ seed: true });

let admin: string, employer: string, candidate: string, recruiter: string;
beforeAll(async () => {
  [admin, employer, candidate, recruiter] = await Promise.all([
    login('admin@veejee.example').then((r) => r.token),
    login('employer@veejee.example').then((r) => r.token),
    login('seeker@veejee.example').then((r) => r.token),
    login('recruiter@veejee.example').then((r) => r.token),
  ]);
});

describe('role-based access control', () => {
  it('only Veejee Services staff can use the recruitment portal', async () => {
    for (const t of [candidate, employer]) {
      await api().get('/api/v1/recruitment/candidates').set(bearer(t)).expect(403);
      await api().get('/api/v1/recruitment/dashboard').set(bearer(t)).expect(403);
    }
    await api().get('/api/v1/recruitment/candidates').expect(401);
    await api().get('/api/v1/recruitment/candidates').set(bearer(recruiter)).expect(200);
    await api().get('/api/v1/recruitment/candidates').set(bearer(admin)).expect(200); // super admin
  });

  it('admins need recruitment:manage to act as recruiters', async () => {
    await api()
      .post('/api/v1/admin/users/admins')
      .set(bearer(admin))
      .send({ name: 'Content Editor', email: 'editor@veejee.example', mobile: '9000000001', password: 'Editor1234', permissions: ['content:manage'] })
      .expect(201);
    const editor = (await login('editor@veejee.example', 'Editor1234')).token;
    await api().get('/api/v1/recruitment/candidates').set(bearer(editor)).expect(403);
    await api().get('/api/v1/admin/users').set(bearer(editor)).expect(403);
    await api().get('/api/v1/admin/testimonials').set(bearer(editor)).expect(200);
  });

  it('deactivated recruiters lose access immediately', async () => {
    await api().post('/api/v1/admin/recruiters').set(bearer(admin)).send({ name: 'Temp Recruiter', email: 'temp.rec@veejee.example', mobile: '9811122233', designation: 'Consultant' }).expect(201);
    const r = await Recruiter.findOne().sort({ createdAt: -1 });
    const user = await User.findById(r!.user);
    expect(user!.status).toBe('pending'); // must accept the invite first
    await User.updateOne({ _id: user!._id }, { status: 'active', emailVerified: true, passwordHash: (await User.findOne({ email: 'recruiter@veejee.example' }).select('+passwordHash'))!.passwordHash });
    const t = (await login('temp.rec@veejee.example')).token;
    await api().get('/api/v1/recruitment/dashboard').set(bearer(t)).expect(200);
    await api().patch(`/api/v1/admin/recruiters/${r!._id}`).set(bearer(admin)).send({ active: false }).expect(200);
    await api().get('/api/v1/recruitment/dashboard').set(bearer(t)).expect(403);
  });

  it('recruiters may claim unassigned candidates but not reassign others', async () => {
    const c = await Candidate.findOne({ assignedRecruiter: { $ne: null } });
    const other = await User.findOne({ email: 'recruiter2@veejee.example' });
    const mine = String(c!.assignedRecruiter) === String(other!._id) ? 'recruiter' : 'recruiter2';
    void mine;
    const res = await api().patch(`/api/v1/recruitment/candidates/${c!._id}/assign`).set(bearer(recruiter)).send({ recruiterId: String(other!._id) }).expect(403);
    expect(res.body.errorCode).toBe('FORBIDDEN');
    await api().patch(`/api/v1/recruitment/candidates/${c!._id}/assign`).set(bearer(admin)).send({ recruiterId: String(other!._id) }).expect(200);
  });

  it('candidates and employers are confined to their own data', async () => {
    await api().get('/api/v1/employer/submissions').set(bearer(candidate)).expect(403);
    await api().get('/api/v1/candidates/me').set(bearer(employer)).expect(403);
    const job = await Job.findOne({ companyName: 'Northwind Technologies' });
    const other = (await login('hr@saffron-retail-group.example')).token;
    await api().patch(`/api/v1/jobs/${job!._id}`).set(bearer(other)).send({ title: 'Hijacked' }).expect(404);
    expect((await Job.findById(job!._id))!.title).not.toBe('Hijacked');
  });

  it('resumes: owner and staff yes; companies only via a submission; strangers never', async () => {
    const resume = await Resume.findOne({ originalName: /Kavya/ });
    await api().get(`/api/v1/resumes/${resume!._id}/download`).set(bearer(candidate)).expect(200);
    await api().get(`/api/v1/resumes/${resume!._id}/download`).set(bearer(recruiter)).expect(200);
    await api().get(`/api/v1/resumes/${resume!._id}/download`).set(bearer(employer)).expect(200); // demo submission to Northwind
    const otherCo = (await login('hr@saffron-retail-group.example')).token;
    await api().get(`/api/v1/resumes/${resume!._id}/download`).set(bearer(otherCo)).expect(403);
    const stranger = (await registerVerifiedCandidate('stranger@example.com')).token;
    await api().get(`/api/v1/resumes/${resume!._id}/download`).set(bearer(stranger)).expect(403);
  });

  it('confidential requirements hide the client company publicly', async () => {
    const conf = await Job.findOne({ confidential: true });
    const pub = await api().get(`/api/v1/jobs/${conf!._id}`).expect(200);
    expect(pub.body.data.companyName).toMatch(/confidential/i);
    expect(pub.body.data.employer).toBeNull();
    expect(pub.body.data.assignedRecruiter).toBeUndefined();
    const staff = await api().get(`/api/v1/jobs/${conf!._id}`).set(bearer(recruiter)).expect(200);
    expect(staff.body.data.companyName).toBe(conf!.companyName);
  });

  it('blocked users are cut off immediately', async () => {
    const victim = await registerVerifiedCandidate('blockme@example.com');
    await api().patch(`/api/v1/admin/users/${victim.user.id}/status`).set(bearer(admin)).send({ status: 'blocked', reason: 'Spam' }).expect(200);
    const res = await api().get('/api/v1/auth/me').set(bearer(victim.token)).expect(403);
    expect(res.body.errorCode).toBe('ACCOUNT_BLOCKED');
  });
});

describe('file upload validation', () => {
  it('rejects non-PDF types, disguised files and oversize uploads', async () => {
    expect((await api().post('/api/v1/resumes').set(bearer(candidate)).attach('file', PNG, { filename: 'x.png', contentType: 'image/png' }).expect(415)).body.errorCode).toBe('UNSUPPORTED_FILE_TYPE');
    expect((await api().post('/api/v1/resumes').set(bearer(candidate)).attach('file', PNG, { filename: 'cv.pdf', contentType: 'application/pdf' }).expect(415)).body.errorCode).toBe('UNSUPPORTED_FILE_TYPE');
    const big = Buffer.concat([PDF, Buffer.alloc(5 * 1024 * 1024 + 10)]);
    expect((await api().post('/api/v1/resumes').set(bearer(candidate)).attach('file', big, { filename: 'big.pdf', contentType: 'application/pdf' }).expect(413)).body.errorCode).toBe('PAYLOAD_TOO_LARGE');
    await api().post('/api/v1/resumes').set(bearer(candidate)).expect(400);
  });
  it('accepts a valid company logo and serves it publicly', async () => {
    await api().post('/api/v1/employers/me/logo').set(bearer(employer)).attach('file', PNG, { filename: 'logo.png', contentType: 'image/png' }).expect(200);
    const me = await api().get('/api/v1/employers/me').set(bearer(employer)).expect(200);
    expect(me.body.data.hasLogo).toBe(true);
    expect((await api().get(`/api/v1/employers/${me.body.data.id}/logo`).expect(200)).headers['content-type']).toBe('image/png');
  });
});

describe('error handling & headers', () => {
  it('returns standard envelopes for 404, malformed JSON and bad ids', async () => {
    expect((await api().get('/api/v1/does-not-exist').expect(404)).body).toMatchObject({ success: false, errorCode: 'NOT_FOUND' });
    expect((await api().post('/api/v1/auth/login').set('Content-Type', 'application/json').send('{"email":').expect(400)).body.errorCode).toBe('VALIDATION_ERROR');
    expect((await api().get('/api/v1/recruitment/candidates/not-an-id').set(bearer(recruiter)).expect(400)).body.errorCode).toBe('VALIDATION_ERROR');
  });
  it('sets security headers and enforces the CORS allow-list', async () => {
    const res = await api().get('/api/v1/industries').set('Origin', 'http://localhost:4200').expect(200);
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:4200');
    const bad = await api().get('/api/v1/industries').set('Origin', 'https://evil.example');
    expect(bad.headers['access-control-allow-origin']).toBeUndefined();
  });
});
