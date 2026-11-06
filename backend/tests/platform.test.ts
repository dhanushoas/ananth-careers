import type { Transporter } from 'nodemailer';
import { EmailOutbox, Resume, User } from '../src/models';
import { processOutbox, queueEmail, setTransport } from '../src/services/email/email.service';
import { api, bearer, login, registerVerifiedCandidate, useDatabase, PDF } from './helpers';

useDatabase({ seed: true });

describe('email queue', () => {
  beforeEach(() => EmailOutbox.deleteMany({}));

  it('delivers queued emails with a branded HTML template', async () => {
    const sent: { to: string; subject: string; html: string }[] = [];
    setTransport({ sendMail: async (m: { to: string; subject: string; html: string }) => sent.push(m) } as unknown as Transporter);
    await queueEmail('a@candidate-mail.in', 'contactConfirmation', { name: 'A <b>', subject: 'Hello' });
    expect(await processOutbox()).toBe(1);
    expect(sent[0]!.html).toContain('Veejee Services');
    expect(sent[0]!.html).toContain('A &lt;b&gt;'); // escaped
    expect((await EmailOutbox.findOne())!.status).toBe('sent');
  });

  it('retries with back-off and marks the email failed after 5 attempts', async () => {
    setTransport({ sendMail: async () => Promise.reject(new Error('SMTP down')) } as unknown as Transporter);
    await queueEmail('b@candidate-mail.in', 'contactConfirmation', { name: 'B', subject: 'Hi' });
    await processOutbox();
    let mail = await EmailOutbox.findOne();
    expect(mail!.status).toBe('pending');
    expect(mail!.attempts).toBe(1);
    expect(mail!.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
    for (let i = 0; i < 4; i++) {
      await EmailOutbox.updateOne({}, { nextAttemptAt: new Date(0) });
      await processOutbox();
    }
    mail = await EmailOutbox.findOne();
    expect(mail!.status).toBe('failed');
    expect(mail!.lastError).toBe('SMTP down');

    const admin = (await login('admin@veejee.example')).token;
    await api().post(`/api/v1/admin/emails/${mail!._id}/retry`).set(bearer(admin)).expect(200);
    expect((await EmailOutbox.findById(mail!._id))!.status).toBe('pending');
  });
});

describe('public website', () => {
  it('serves content, stats and enquiry submission', async () => {
    const faq = await api().get('/api/v1/content/faq').expect(200);
    expect(faq.body.data.value.items.length).toBeGreaterThan(3);
    await api().get('/api/v1/content/unknown').expect(400);
    const stats = await api().get('/api/v1/stats/public').expect(200);
    expect(stats.body.data.jobs).toBeGreaterThan(10);
    const featured = await api().get('/api/v1/employers?featured=true').expect(200);
    expect(featured.body.data.items[0].openJobs).toBeGreaterThan(0);

    const admin = (await login('admin@veejee.example')).token;
    const newEnquiries = async () => (await api().get('/api/v1/admin/enquiries?status=new').set(bearer(admin)).expect(200)).body.data.total as number;
    const before = await newEnquiries(); // demo seed includes sample enquiries
    await api().post('/api/v1/contact').send({ name: 'Visitor', email: 'v@example.com', subject: 'Hiring help', message: 'We need 20 drivers.', enquiryType: 'employer' }).expect(400); // consent required
    await api().post('/api/v1/contact').send({ name: 'Visitor', email: 'v@example.com', subject: 'Hiring help', message: 'We need 20 drivers.', enquiryType: 'employer', consent: true }).expect(201);
    expect(await newEnquiries()).toBe(before + 1);
  });

  it('admins edit content; testimonials need verified consent before publishing', async () => {
    const admin = (await login('admin@veejee.example')).token;
    await api().put('/api/v1/admin/content/faq').set(bearer(admin)).send({ value: { items: [{ question: 'Q?', answer: 'A.' }] } }).expect(200);
    expect((await api().get('/api/v1/content/faq')).body.data.value.items).toHaveLength(1);

    const published = (await api().get('/api/v1/testimonials')).body.data.length as number; // demo seed includes sample testimonials
    const bad = await api().post('/api/v1/admin/testimonials').set(bearer(admin)).send({ name: 'R', quote: 'Great service, got hired!', consentConfirmed: false, published: true }).expect(400);
    expect(bad.body.errorCode).toBe('VALIDATION_ERROR');
    await api().post('/api/v1/admin/testimonials').set(bearer(admin)).send({ name: 'R', quote: 'Great service, got hired!', consentConfirmed: true, published: true }).expect(201);
    expect((await api().get('/api/v1/testimonials')).body.data).toHaveLength(published + 1);
  });

  it('admin reports and audit logs work', async () => {
    const admin = (await login('admin@veejee.example')).token;
    const r = await api().get('/api/v1/admin/reports').set(bearer(admin)).expect(200);
    expect(r.body.data.requirementsByIndustry.length).toBeGreaterThan(0);
    expect(r.body.data.funnel).toHaveProperty('applied');
    const logs = await api().get('/api/v1/admin/audit-logs?action=auth.login').set(bearer(admin)).expect(200);
    expect(logs.body.data.total).toBeGreaterThan(0);
    const s = await api().get('/api/v1/admin/stats').set(bearer(admin)).expect(200);
    expect(s.body.data.candidates.total).toBeGreaterThan(0);
  });
});

describe('privacy rights (DPDP)', () => {
  it('exports personal data and deletes the account with files', async () => {
    const { token, user } = await registerVerifiedCandidate('leaving@example.com');
    const up = await api().post('/api/v1/resumes').set(bearer(token)).attach('file', PDF, { filename: 'cv.pdf', contentType: 'application/pdf' }).expect(201);
    const exp = await api().get('/api/v1/users/me/export').set(bearer(token)).expect(200);
    expect(exp.body.data.user.email).toBe('leaving@example.com');
    expect(exp.body.data.resumes).toHaveLength(1);

    await api().delete('/api/v1/users/me').set(bearer(token)).send({ password: 'wrong' }).expect(400);
    await api().delete('/api/v1/users/me').set(bearer(token)).send({ password: 'Secret123' }).expect(200);
    const u = await User.findById(user.id);
    expect(u!.email).not.toContain('leaving');
    expect(u!.deletedAt).toBeDefined();
    expect((await Resume.findById(up.body.data.id))!.deletedAt).toBeDefined();
    await api().get('/api/v1/auth/me').set(bearer(token)).expect(401);
    await api().post('/api/v1/auth/login').send({ email: 'leaving@example.com', password: 'Secret123' }).expect(401);
  });
});

describe('API root', () => {
  it('answers browsers with a friendly landing response', async () => {
    const r = await api().get('/').expect(200);
    expect(r.body.data).toMatchObject({ name: 'Veejee Services API', docs: '/api/docs', api: '/api/v1' });
  });
});
