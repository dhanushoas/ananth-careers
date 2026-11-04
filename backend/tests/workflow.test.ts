import { Types } from 'mongoose';
import { Candidate, EmailOutbox, Industry, Interview, Job, Notification, RecruitmentNote } from '../src/models';
import { sendInterviewReminders, sendProfileReminders } from '../src/services/scheduler.service';
import { PDF, api, bearer, login, registerVerifiedCandidate, tokenFromEmail, useDatabase } from './helpers';

useDatabase({ seed: true });

/**
 * The complete Veejee Services consultancy workflow, end to end through the HTTP API:
 * Candidate registration → profile → resume → screening → filtering → matching → shortlist (+ approval)
 * → consent-gated company submission → employer review → interview request → scheduling → reminder
 * → feedback → selection → successful placement.
 */
describe('recruitment consultancy workflow', () => {
  const s: Record<string, string> = {};

  it('candidate registers, verifies, builds a profile and uploads a resume', async () => {
    const reg = await registerVerifiedCandidate('meera@example.com', { careerLevel: 'experienced' });
    s.cand = reg.token;
    s.candUserId = reg.user.id;
    let me = await api().get('/api/v1/candidates/me').set(bearer(s.cand)).expect(200);
    expect(me.body.data.stage).toBe('registered');
    expect(me.body.data.consent.profileSharing).toBe(false);

    await api()
      .put('/api/v1/candidates/me')
      .set(bearer(s.cand))
      .send({
        headline: 'Hospitality manager',
        summary: 'Eight years running restaurant floors.',
        location: { city: 'Kochi', state: 'Kerala' },
        careerLevel: 'experienced',
        skills: [
          { name: 'Team Leadership', type: 'non_technical' },
          { name: 'Guest Relations', type: 'non_technical' },
          { name: 'POS Systems', type: 'technical' },
        ],
        education: [{ qualification: 'BHM', specialization: 'Hotel Management', institution: 'IHM Kovalam', endYear: 2016 }],
        experience: [{ title: 'Restaurant Manager', company: 'Taj', startDate: '2018-01-01', current: true }],
        totalExperienceYears: 6,
        expectedSalary: { min: 700000 },
        preferredRoles: ['Restaurant Manager'],
        preferredLocations: ['Kochi'],
        preferredWorkModes: ['onsite'],
        noticePeriodDays: 30,
        availability: 'within_30_days',
      })
      .expect(200);
    await api().post('/api/v1/resumes').set(bearer(s.cand)).attach('file', PDF, { filename: 'cv.pdf', contentType: 'application/pdf' }).expect(201);
    me = await api().get('/api/v1/candidates/me').set(bearer(s.cand)).expect(200);
    expect(me.body.data.profileCompletion).toBeGreaterThanOrEqual(80);
    expect(me.body.data.stage).toBe('profile_completed');
    s.candidateId = me.body.data.id;
  });

  it('company registers, is verified, and its requirement is approved by Veejee Services', async () => {
    const industry = await Industry.findOne({ slug: 'hospitality-food-industry' });
    await api()
      .post('/api/v1/auth/register/employer')
      .send({ name: 'Anil Menon', email: 'hr@spice.example', mobile: '9822001100', password: 'Spice2026x', companyName: 'Spice Route Kitchens', industryId: String(industry!._id), acceptTerms: true, acceptPrivacy: true })
      .expect(201);
    await api().post('/api/v1/auth/verify-email').send({ token: await tokenFromEmail('hr@spice.example', 'verifyEmail') }).expect(200);
    s.emp = (await login('hr@spice.example', 'Spice2026x')).token;
    s.admin = (await login('admin@veejee.example')).token;
    s.rec = (await login('recruiter@veejee.example')).token;

    const companies = await api().get('/api/v1/admin/employers?verificationStatus=pending').set(bearer(s.admin)).expect(200);
    const company = companies.body.data.items.find((e: { companyName: string }) => e.companyName === 'Spice Route Kitchens');
    await api().patch(`/api/v1/admin/employers/${company.id}/verification`).set(bearer(s.admin)).send({ status: 'verified' }).expect(200);

    const job = await api()
      .post('/api/v1/jobs')
      .set(bearer(s.emp))
      .send({
        title: 'Restaurant Manager',
        description: 'Lead a busy fine-dining restaurant team, own guest experience, rostering and P&L.',
        industry: String(industry!._id),
        employmentType: 'full_time',
        workMode: 'onsite',
        locations: [{ city: 'Kochi', state: 'Kerala' }],
        experience: { min: 3, max: 8 },
        salary: { min: 600000, max: 900000, period: 'yearly' },
        skills: ['Team Leadership', 'Guest Relations', 'Inventory Management'],
        qualifications: ['BHM'],
        openings: 2,
        noticePeriodMaxDays: 45,
        submit: true,
      })
      .expect(201);
    s.job = job.body.data.id;
    await api().patch(`/api/v1/admin/jobs/${s.job}/moderation`).set(bearer(s.admin)).send({ action: 'approve' }).expect(200);
    await api().get(`/api/v1/jobs/${s.job}`).expect(200);
  });

  it('candidate applies to Veejee Services – the company sees nothing yet', async () => {
    const res = await api().post('/api/v1/candidates/me/applications').set(bearer(s.cand)).send({ jobId: s.job }).expect(201);
    expect(res.body.data.status).toBe('applied');
    expect(await EmailOutbox.exists({ to: 'meera@example.com', template: 'applicationConfirmation' })).toBeTruthy();
    expect(await Notification.exists({ type: 'application.new' })).toBeTruthy(); // staff notified
    const company = await api().get('/api/v1/employer/submissions').set(bearer(s.emp)).expect(200);
    expect(company.body.data.total).toBe(0);
  });

  it('recruiter screens: filters the database and gets transparent match scores', async () => {
    const apps = await api().get(`/api/v1/recruitment/applications?jobId=${s.job}&status=applied`).set(bearer(s.rec)).expect(200);
    expect(apps.body.data.total).toBe(1);
    await api().patch(`/api/v1/recruitment/applications/${apps.body.data.items[0].id}`).set(bearer(s.rec)).send({ status: 'under_review' }).expect(200);
    expect((await Candidate.findById(s.candidateId))!.stage).toBe('under_review');

    await api().patch(`/api/v1/recruitment/candidates/${s.candidateId}/stage`).set(bearer(s.rec)).send({ stage: 'screening', note: 'Phone screen booked', visibleToCandidate: false }).expect(200);
    await api().patch(`/api/v1/recruitment/candidates/${s.candidateId}/stage`).set(bearer(s.rec)).send({ stage: 'placed' }).expect(400); // automatic stages only

    const search = await api()
      .get('/api/v1/recruitment/candidates?skills=Guest Relations&location=Kochi&careerLevel=experienced&expMin=3&noticeMax=45&hasResume=true')
      .set(bearer(s.rec))
      .expect(200);
    expect(search.body.data.items.map((c: { id: string }) => c.id)).toContain(s.candidateId);
    const none = await api().get('/api/v1/recruitment/candidates?skills=Guest Relations&careerLevel=fresher').set(bearer(s.rec)).expect(200);
    expect(none.body.data.items.map((c: { id: string }) => c.id)).not.toContain(s.candidateId);

    const matches = await api().get(`/api/v1/recruitment/requirements/${s.job}/matches`).set(bearer(s.rec)).expect(200);
    const top = matches.body.data.items[0];
    expect(top.candidate.id).toBe(s.candidateId);
    expect(top.match.score).toBeGreaterThan(70);
    const skills = top.match.factors.find((f: { key: string }) => f.key === 'skills');
    expect(skills.reason).toMatch(/2 of 3 required skills/);
    expect(skills.reason).toMatch(/missing Inventory Management/);

    await api().post(`/api/v1/recruitment/candidates/${s.candidateId}/notes`).set(bearer(s.rec)).send({ body: 'CONFIDENTIAL: strong but salary-sensitive' }).expect(201);
  });

  it('shortlist needs management approval before submission', async () => {
    const sl = await api().post('/api/v1/recruitment/shortlists').set(bearer(s.rec)).send({ jobId: s.job, candidateId: s.candidateId }).expect(201);
    expect(sl.body.data.status).toBe('pending_approval');
    expect(sl.body.data.match.score).toBeGreaterThan(0);
    s.shortlist = sl.body.data.id;
    expect(await EmailOutbox.exists({ to: 'meera@example.com', template: 'shortlisted' })).toBeTruthy();
    expect((await Candidate.findById(s.candidateId))!.stage).toBe('shortlisted');

    await api().post('/api/v1/recruitment/submissions').set(bearer(s.rec)).send({ shortlistId: s.shortlist }).expect(409); // not approved yet
    await api().patch(`/api/v1/recruitment/shortlists/${s.shortlist}/approval`).set(bearer(s.rec)).send({ decision: 'approve' }).expect(403); // recruiters cannot approve
    await api().patch(`/api/v1/recruitment/shortlists/${s.shortlist}/approval`).set(bearer(s.admin)).send({ decision: 'approve' }).expect(200);
  });

  it('submission is blocked until the candidate consents (DPDP)', async () => {
    const noConsent = await api().post('/api/v1/recruitment/submissions').set(bearer(s.rec)).send({ shortlistId: s.shortlist }).expect(409);
    expect(noConsent.body.errorCode).toBe('CONSENT_REQUIRED');
    await api().put('/api/v1/candidates/me/consent').set(bearer(s.cand)).send({ profileSharing: true }).expect(200);
    const noContact = await api().post('/api/v1/recruitment/submissions').set(bearer(s.rec)).send({ shortlistId: s.shortlist, shareContact: true }).expect(409);
    expect(noContact.body.errorCode).toBe('CONTACT_CONSENT_REQUIRED');

    const sub = await api()
      .post('/api/v1/recruitment/submissions')
      .set(bearer(s.rec))
      .send({ shortlistId: s.shortlist, summary: 'Six years managing fine-dining floors. Recommended.' })
      .expect(201);
    s.submission = sub.body.data.id;
    expect(await EmailOutbox.exists({ to: 'hr@spice.example', template: 'candidateSubmitted' })).toBeTruthy();
    expect(await EmailOutbox.exists({ to: 'meera@example.com', template: 'profileSubmitted' })).toBeTruthy();
    const consent = await api().get('/api/v1/candidates/me/consent').set(bearer(s.cand)).expect(200);
    expect(consent.body.data.history[0]).toMatchObject({ type: 'profile_sharing', granted: true });
  });

  it('employer sees only the approved profile – no contact details, DOB or internal notes', async () => {
    const list = await api().get('/api/v1/employer/submissions').set(bearer(s.emp)).expect(200);
    expect(list.body.data.total).toBe(1);
    const detail = await api().get(`/api/v1/employer/submissions/${s.submission}`).set(bearer(s.emp)).expect(200);
    const d = detail.body.data;
    expect(d.status).toBe('company_reviewing'); // first view
    expect(d.candidate.name).toBe('Test Candidate');
    expect(d.candidate.email).toBeUndefined();
    expect(d.candidate.mobile).toBeUndefined();
    expect(d.candidateProfile.dateOfBirth).toBeUndefined();
    expect(d.candidateProfile.consent).toBeUndefined();
    expect(JSON.stringify(d)).not.toContain('CONFIDENTIAL');
    expect(d.recruiterSummary).toMatch(/Recommended/);
    const dl = await api().get(`/api/v1/resumes/${d.resume.id}/download`).set(bearer(s.emp)).buffer(true).expect(200);
    expect(Buffer.from(dl.body).subarray(0, 5).toString()).toBe('%PDF-');

    const other = (await login('employer@veejee.example')).token;
    await api().get(`/api/v1/employer/submissions/${s.submission}`).set(bearer(other)).expect(404);
    await api().get(`/api/v1/resumes/${d.resume.id}/download`).set(bearer(other)).expect(403);
  });

  it('employer requests an interview; Veejee Services schedules it; candidate accepts and is reminded', async () => {
    await api().post(`/api/v1/employer/submissions/${s.submission}/interview-request`).set(bearer(s.emp)).send({ note: 'Prefer weekday mornings', preferredSlots: ['Mon 10am'] }).expect(200);
    expect(await EmailOutbox.exists({ template: 'interviewRequested' })).toBeTruthy();
    expect((await Candidate.findById(s.candidateId))!.stage).toBe('interview_requested');

    const when = new Date(Date.now() + 20 * 3600_000).toISOString();
    const iv = await api()
      .post('/api/v1/recruitment/interviews')
      .set(bearer(s.rec))
      .send({ submissionId: s.submission, scheduledAt: when, durationMinutes: 45, mode: 'in_person', location: 'Spice Route, MG Road, Kochi' })
      .expect(201);
    s.interview = iv.body.data.id;
    expect(await EmailOutbox.exists({ to: 'meera@example.com', template: 'interviewInvitation' })).toBeTruthy();
    const mine = await api().get('/api/v1/candidates/me/interviews?upcoming=true').set(bearer(s.cand)).expect(200);
    expect(mine.body.data).toHaveLength(1);
    await api().post(`/api/v1/candidates/me/interviews/${s.interview}/respond`).set(bearer(s.cand)).send({ response: 'accepted' }).expect(200);

    expect(await sendInterviewReminders()).toBe(1);
    expect(await sendInterviewReminders()).toBe(0); // idempotent
    expect(await EmailOutbox.exists({ to: 'meera@example.com', template: 'interviewReminder' })).toBeTruthy();
  });

  it('employer gives feedback and selects; Veejee Services confirms placement', async () => {
    await api().post(`/api/v1/employer/interviews/${s.interview}/feedback`).set(bearer(s.emp)).send({ rating: 5, feedback: 'Excellent', recommendation: 'select' }).expect(409); // not yet held
    await Interview.updateOne({ _id: s.interview }, { scheduledAt: new Date(Date.now() - 3600_000) });
    await api().post(`/api/v1/employer/interviews/${s.interview}/feedback`).set(bearer(s.emp)).send({ rating: 5, feedback: 'Excellent leadership', recommendation: 'select' }).expect(201);
    await api().post(`/api/v1/employer/submissions/${s.submission}/decision`).set(bearer(s.emp)).send({ decision: 'accept', note: 'Offer approved' }).expect(200);
    expect(await EmailOutbox.exists({ to: 'meera@example.com', template: 'interviewResult' })).toBeTruthy();
    expect((await Candidate.findById(s.candidateId))!.stage).toBe('selected');

    await api().patch(`/api/v1/recruitment/submissions/${s.submission}/status`).set(bearer(s.rec)).send({ status: 'placed', joiningDate: '2026-12-01' }).expect(200);
    expect((await Candidate.findById(s.candidateId))!.stage).toBe('placed');
    expect((await Job.findById(s.job))!.filledCount).toBe(1);
    expect(await EmailOutbox.countDocuments({ template: 'placement' })).toBe(2); // candidate + company

    const dash = await api().get('/api/v1/candidates/me/dashboard').set(bearer(s.cand)).expect(200);
    expect(dash.body.data.stage).toBe('placed');
    const subs = await api().get('/api/v1/candidates/me/submissions').set(bearer(s.cand)).expect(200);
    expect(subs.body.data[0].status).toBe('placed');
    const me = await api().get('/api/v1/candidates/me').set(bearer(s.cand)).expect(200);
    // Internal "screening" note was recorded with visibleToCandidate=false
    expect(JSON.stringify(me.body.data.stageHistory)).not.toContain('Phone screen booked');
    expect(me.body.data.assignedRecruiter).toBeUndefined();
    expect(await RecruitmentNote.countDocuments({})).toBeGreaterThan(0);
  });

  it('management reports reflect the placement and recruiter performance', async () => {
    const r = await api().get('/api/v1/admin/reports').set(bearer(s.admin)).expect(200);
    expect(r.body.data.funnel.placed).toBeGreaterThanOrEqual(1);
    const arjun = r.body.data.recruiterPerformance.find((p: { name: string }) => p.name === 'Arjun Mehta');
    expect(arjun.placements).toBeGreaterThanOrEqual(1);
    expect(r.body.data.monthly).toHaveLength(12);
    const st = await api().get('/api/v1/admin/stats').set(bearer(s.admin)).expect(200);
    expect(st.body.data.pipeline.placed).toBeGreaterThanOrEqual(1);
    expect(st.body.data.candidates.freshers).toBeGreaterThan(0);
  });

  it('profile reminders go only to incomplete profiles, once per interval', async () => {
    const fresh = await registerVerifiedCandidate('lazy@example.com');
    await Candidate.collection.updateOne({ user: new Types.ObjectId(fresh.user.id) }, { $set: { createdAt: new Date(Date.now() - 5 * 86400_000) } });
    const sent = await sendProfileReminders();
    expect(sent).toBeGreaterThanOrEqual(1);
    expect(await EmailOutbox.exists({ to: 'lazy@example.com', template: 'profileReminder' })).toBeTruthy();
    expect(await EmailOutbox.exists({ to: 'meera@example.com', template: 'profileReminder' })).toBeFalsy();
    await sendProfileReminders();
    expect(await EmailOutbox.countDocuments({ to: 'lazy@example.com', template: 'profileReminder' })).toBe(1);
  });
});
