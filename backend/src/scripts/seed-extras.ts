/**
 * Extra demo records so every collection and every portal screen has something to show:
 * full pipelines (interview scheduled / selected / placed / rejected), pending approvals,
 * interviews + feedback, recruiter notes, notifications, enquiries, testimonials,
 * website content, audit log and email outbox history.
 * Called from `seedDemo` – development only, idempotent (each block is skipped if already present).
 */
import type { HydratedDocument, Types } from 'mongoose';
import { CONSENT_VERSION, type ApplicationStatus, type CandidateStage, type ShortlistStatus, type SubmissionStatus } from '../common/constants';
import { slugify, uniqueSlug } from '../common/crypto';
import {
  Application,
  AuditLog,
  Candidate,
  Consent,
  ContactEnquiry,
  EmailOutbox,
  Employer,
  Interview,
  InterviewFeedback,
  Job,
  Notification,
  RecruitmentNote,
  Shortlist,
  SiteContent,
  Submission,
  Testimonial,
  User,
  getSettings,
  type ICandidate,
  type IUser,
} from '../models';
import { hashPassword } from '../modules/auth/auth.service';
import { DEFAULT_CONTENT } from '../modules/public/default-content';
import { scoreCandidate } from '../services/matching.service';
import { jobDescription } from './seed-data';

type UserDoc = HydratedDocument<IUser>;
type Profile = { user: UserDoc; c: HydratedDocument<ICandidate> };
type Taxonomy = { ind: { _id: Types.ObjectId }; cats: ({ _id: Types.ObjectId } | null)[] }[];
type Ctx = { admin: UserDoc; recruiters: UserDoc[]; profiles: Profile[]; taxonomy: Taxonomy; password: string; live: boolean };

const DAY = 86400_000;
const ago = (days: number, hour = 10) => {
  const d = new Date(Date.now() - days * DAY);
  d.setHours(hour, 0, 0, 0);
  return d;
};

type InterviewPlan = { daysFromNow: number; mode: 'in_person' | 'video' | 'phone'; status: 'scheduled' | 'completed' | 'cancelled'; response?: 'pending' | 'accepted' | 'declined'; cancelReason?: string };
type FeedbackPlan = { rating: number; recommendation: 'select' | 'reject' | 'next_round' | 'on_hold'; feedback: string };

/** Builds one candidate's journey for a requirement: application → shortlist → submission → interviews → feedback. */
async function journey(
  ctx: Ctx,
  p: Profile,
  jobTitle: string,
  plan: {
    application: ApplicationStatus;
    shortlist?: ShortlistStatus;
    submission?: SubmissionStatus;
    interviews?: InterviewPlan[];
    feedback?: FeedbackPlan;
    stage?: CandidateStage;
    stageNote?: string;
    recruiterSummary?: string;
    startedDaysAgo: number;
  },
) {
  const job = await Job.findOne({ title: jobTitle });
  if (!job || (await Application.exists({ job: job._id, candidate: p.user._id }))) return;
  const recruiter = ctx.recruiters[0]!;
  const employer = await Employer.findById(job.employer);
  const settings = await getSettings();
  const t0 = plan.startedDaysAgo;

  const app = await Application.create({
    job: job._id,
    employer: job.employer,
    candidate: p.user._id,
    candidateProfile: p.c._id,
    resume: p.c.primaryResume,
    coverLetter: `I am interested in the ${job.title} role and available ${p.c.noticePeriodDays ? `after ${p.c.noticePeriodDays} days notice` : 'immediately'}.`,
    status: plan.application,
    reviewedBy: plan.application === 'applied' ? undefined : recruiter._id,
    statusHistory: [
      { status: 'applied', changedBy: p.user._id, at: ago(t0) },
      ...(plan.application !== 'applied' ? [{ status: plan.application, changedBy: recruiter._id, at: ago(t0 - 1) }] : []),
    ],
  });
  await Job.updateOne({ _id: job._id }, { $inc: { applicationsCount: 1 } });
  if (!plan.shortlist) return;

  const sl = await Shortlist.create({
    job: job._id,
    employer: job.employer,
    candidate: p.user._id,
    candidateProfile: p.c._id,
    application: app._id,
    source: 'application',
    match: scoreCandidate(job, p.c, settings.matchingWeights),
    status: plan.shortlist,
    note: 'Strong fit on skills and location.',
    shortlistedBy: recruiter._id,
    ...(plan.shortlist !== 'pending_approval' ? { reviewedBy: ctx.admin._id, reviewedAt: ago(t0 - 2), reviewNote: 'Approved – good match.' } : {}),
  });
  if (!plan.submission) return;

  const consent = await Consent.findOne({ candidate: p.user._id, type: 'profile_sharing', granted: true });
  if (!consent) return;
  const order: SubmissionStatus[] = ['submitted', 'company_reviewing', 'interview_requested', 'interview_scheduled', 'interview_completed', 'selected', 'placed'];
  const reached = plan.submission === 'rejected' ? order.slice(0, 5) : order.slice(0, order.indexOf(plan.submission) + 1);
  const history = [...reached, ...(plan.submission === 'rejected' ? (['rejected'] as SubmissionStatus[]) : [])].map((status, i) => ({
    status,
    changedBy: ['submitted', 'interview_scheduled', 'placed'].includes(status) ? recruiter._id : employer?.owner,
    byRole: ['submitted', 'interview_scheduled', 'placed'].includes(status) ? 'staff' : 'company',
    visibleToCandidate: true,
    at: ago(t0 - 3 - i),
  }));
  const sub = await Submission.create({
    job: job._id,
    employer: job.employer,
    candidate: p.user._id,
    candidateProfile: p.c._id,
    shortlist: sl._id,
    resume: p.c.primaryResume,
    submittedBy: recruiter._id,
    recruiterSummary: plan.recruiterSummary ?? `${p.c.headline}. Screened by Veejee Services – recommended for ${job.title}.`,
    contactShared: Boolean(p.c.consent?.contactSharing),
    consentRecord: consent._id,
    status: plan.submission,
    statusHistory: history,
    ...(reached.includes('interview_requested')
      ? { interviewRequest: { note: 'Please arrange a first-round interview.', preferredSlots: ['Weekday mornings', 'Thursday 3-5 PM'], requestedBy: employer?.owner, requestedAt: ago(t0 - 5) } }
      : {}),
    ...(plan.submission === 'rejected' ? { employerNote: 'Strong basics, but we need deeper production experience for this role.' } : {}),
    ...(plan.submission === 'selected' ? { employerNote: 'Offer being prepared – please confirm joining date.' } : {}),
    ...(plan.submission === 'placed' ? { joiningDate: ago(2), placedAt: ago(3) } : {}),
  });

  let lastInterview;
  for (const [i, iv] of (plan.interviews ?? []).entries()) {
    const when = new Date(Date.now() + iv.daysFromNow * DAY);
    when.setHours(11 + i, 0, 0, 0);
    lastInterview = await Interview.create({
      submission: sub._id,
      job: job._id,
      employer: job.employer,
      candidate: p.user._id,
      scheduledBy: recruiter._id,
      round: 1,
      scheduledAt: when,
      durationMinutes: 45,
      mode: iv.mode,
      location: iv.mode === 'in_person' ? `${employer?.companyName} office, ${job.locations[0]?.city}` : undefined,
      meetingLink: iv.mode === 'video' ? 'https://meet.example.com/veejee-demo' : undefined,
      notes: 'Carry a printed copy of your resume and a government photo ID.',
      status: iv.status,
      candidateResponse: iv.response ?? (iv.status === 'completed' ? 'accepted' : 'pending'),
      cancelReason: iv.cancelReason,
      // Mark as already reminded so the scheduler never emails the fake demo address.
      reminderSentAt: new Date(),
    });
  }
  if (plan.feedback && lastInterview && employer) {
    await InterviewFeedback.create({ interview: lastInterview._id, submission: sub._id, employer: employer._id, givenBy: employer.owner, ...plan.feedback });
  }

  if (plan.stage) {
    p.c.stage = plan.stage;
    p.c.stageHistory.push({ stage: plan.stage, visibleToCandidate: true, note: plan.stageNote, at: ago(Math.max(0, t0 - 6)) } as never);
    await p.c.save();
  }
}

async function seedPipelines(ctx: Ctx) {
  const [kavya, rahul, sneha, arun, fatima, vikram, priya, irfan] = ctx.profiles;
  // Interview scheduled (upcoming) – with an earlier cancelled slot.
  await journey(ctx, fatima!, 'Staff Nurse (ICU)', {
    application: 'shortlisted', shortlist: 'submitted', submission: 'interview_scheduled', startedDaysAgo: 10,
    interviews: [
      { daysFromNow: -2, mode: 'video', status: 'cancelled', cancelReason: 'Panel unavailable – rescheduled by the hospital' },
      { daysFromNow: 3, mode: 'video', status: 'scheduled', response: 'accepted' },
    ],
    stage: 'interview_scheduled', stageNote: 'Interview scheduled with CarePlus Hospitals',
  });
  // Interview done, company selected.
  await journey(ctx, vikram!, 'Store Manager', {
    application: 'shortlisted', shortlist: 'submitted', submission: 'selected', startedDaysAgo: 18,
    interviews: [{ daysFromNow: -6, mode: 'in_person', status: 'completed' }],
    feedback: { rating: 4, recommendation: 'select', feedback: 'Excellent store operations knowledge and team leadership. Recommend offer.' },
    stage: 'selected', stageNote: 'Selected by Saffron Retail Group – offer in progress',
  });
  // Full journey to placement.
  await journey(ctx, sneha!, 'Software Engineering Intern', {
    application: 'shortlisted', shortlist: 'submitted', submission: 'placed', startedDaysAgo: 25,
    interviews: [{ daysFromNow: -14, mode: 'phone', status: 'completed' }],
    feedback: { rating: 5, recommendation: 'select', feedback: 'Very quick learner, solid JavaScript fundamentals. Offer extended.' },
    stage: 'placed', stageNote: 'Successfully placed at Northwind Technologies',
  });
  // Interviewed and rejected (Kavya's main journey for Senior Angular stays open).
  await journey(ctx, kavya!, 'Node.js Backend Engineer', {
    application: 'shortlisted', shortlist: 'submitted', submission: 'rejected', startedDaysAgo: 20,
    interviews: [{ daysFromNow: -8, mode: 'video', status: 'completed' }],
    feedback: { rating: 2, recommendation: 'reject', feedback: 'Good Angular skills but limited backend depth for this role.' },
  });
  // Waiting for admin approval of the shortlist.
  const angular = await Job.findOne({ title: 'Senior Angular Developer' });
  if (angular && rahul && !(await Shortlist.exists({ job: angular._id, candidate: rahul.user._id }))) {
    const settings = await getSettings();
    const app = await Application.findOneAndUpdate({ job: angular._id, candidate: rahul.user._id }, { status: 'under_review', reviewedBy: ctx.recruiters[0]!._id }, { returnDocument: 'after' });
    await Shortlist.create({
      job: angular._id, employer: angular.employer, candidate: rahul.user._id, candidateProfile: rahul.c._id, application: app?._id,
      source: 'application', match: scoreCandidate(angular, rahul.c, settings.matchingWeights), status: 'pending_approval',
      note: '6 years Angular, currently leading a team of 4.', shortlistedBy: ctx.recruiters[0]!._id,
    });
  }
  // Approved shortlist, ready to submit.
  const qa = await Job.findOne({ title: 'QA Automation Engineer' });
  if (qa && priya && !(await Shortlist.exists({ job: qa._id, candidate: priya.user._id }))) {
    const settings = await getSettings();
    const app = await Application.findOneAndUpdate({ job: qa._id, candidate: priya.user._id }, { status: 'shortlisted', reviewedBy: ctx.recruiters[0]!._id }, { returnDocument: 'after' });
    await Shortlist.create({
      job: qa._id, employer: qa.employer, candidate: priya.user._id, candidateProfile: priya.c._id, application: app?._id,
      source: 'match', match: scoreCandidate(qa, priya.c, settings.matchingWeights), status: 'approved',
      shortlistedBy: ctx.recruiters[0]!._id, reviewedBy: ctx.admin._id, reviewedAt: ago(1), reviewNote: 'Approved – submit after confirming notice period.',
    });
    priya.c.stage = 'shortlisted';
    priya.c.stageHistory.push({ stage: 'shortlisted', visibleToCandidate: true, note: 'Shortlisted for QA Automation Engineer', at: ago(1) } as never);
    await priya.c.save();
  }
  // Under review (no profile-sharing consent yet) and not shortlisted.
  await journey(ctx, arun!, 'Site Engineer – Civil', { application: 'under_review', startedDaysAgo: 4, stage: 'screening', stageNote: 'Screening in progress' });
  await journey(ctx, irfan!, 'Warehouse Supervisor', { application: 'not_shortlisted', startedDaysAgo: 9 });
  await journey(ctx, irfan!, 'Delivery Partner', { application: 'applied', startedDaysAgo: 1 });
  await journey(ctx, vikram!, 'Visual Merchandiser', { application: 'withdrawn', startedDaysAgo: 12 });
}

/** A company awaiting verification, requirements in every moderation state, and users in other states. */
async function seedModerationQueue(ctx: Ctx) {
  const email = 'hr@greenleaf-agro.example';
  if (await User.exists({ email })) return;
  const owner = await User.create({
    name: 'Anita Desai', email, mobile: '9811122233', role: 'employer', passwordHash: await hashPassword(ctx.password), status: 'active',
    emailVerified: true, emailVerifiedAt: new Date(), consent: { termsAcceptedAt: new Date(), privacyAcceptedAt: new Date(), marketingEmails: false },
  });
  const t = ctx.taxonomy[4]!;
  const employer = await Employer.create({
    owner: owner._id, companyName: 'GreenLeaf Agro Foods', slug: slugify('GreenLeaf Agro Foods'), industry: t.ind._id,
    description: 'Food processing and packaged foods company (demo – awaiting verification).', size: '51-200', headquarters: 'Nashik',
    website: 'https://greenleaf-agro.example', registrationNumber: 'U15400MH2019PTC000123', contactPerson: owner.name, contactEmail: email,
    verificationStatus: 'pending',
  });
  const base = {
    employer: employer._id, companyName: employer.companyName, postedBy: owner._id, industry: t.ind._id, category: t.cats[0]?._id,
    employmentType: 'full_time' as const, workMode: 'onsite' as const, locations: [{ city: 'Nashik', state: 'Maharashtra', country: 'India' }],
    salary: { min: 400000, max: 700000, currency: 'INR', period: 'yearly' as const, disclosed: true }, openings: 2,
  };
  for (const j of [
    { title: 'Production Planner', status: 'pending_approval', skills: ['Production Planning', 'SAP PP', 'MS Excel'], exp: { min: 2, max: 5 } },
    { title: 'Food Technologist', status: 'draft', skills: ['HACCP', 'FSSAI', 'Quality Testing'], exp: { min: 1, max: 4 } },
    { title: 'Sales Intern (Unpaid)', status: 'rejected', skills: ['Communication'], exp: { min: 0, max: 0 }, rejectionReason: 'Veejee Services does not list unpaid roles. Please add a stipend.' },
  ]) {
    await Job.create({ ...base, ...jobDescription(j.title, employer.companyName), ...j, slug: uniqueSlug(`${j.title} ${employer.companyName}`), moderatedBy: j.status === 'rejected' ? ctx.admin._id : undefined, moderatedAt: j.status === 'rejected' ? new Date() : undefined } as never);
  }
  const closed = await Job.findOne({ title: 'Quantity Surveyor' });
  if (closed) await Job.updateOne({ _id: closed._id }, { status: 'closed', closedAt: ago(2) });

  // A candidate who has not finished their profile (no resume) and one who never verified their email.
  const neha = await User.create({
    name: 'Neha Gupta', email: 'neha.candidate@veejee.example', mobile: '9876500120', role: 'candidate', passwordHash: await hashPassword(ctx.password),
    status: 'active', emailVerified: true, emailVerifiedAt: new Date(), consent: { termsAcceptedAt: new Date(), privacyAcceptedAt: new Date(), marketingEmails: true },
  });
  await Candidate.create({
    user: neha._id, headline: 'Accounts executive', location: { city: 'Jaipur', state: 'Rajasthan', country: 'India' }, careerLevel: 'experienced', totalExperienceYears: 1,
    skills: [{ name: 'Tally', type: 'technical', level: 'beginner' }], preferredRoles: ['Accountant'], stage: 'profile_incomplete', assignedRecruiter: ctx.recruiters[1]!._id,
    stageHistory: [{ stage: 'registered', visibleToCandidate: true, at: ago(3) }, { stage: 'profile_incomplete', visibleToCandidate: true, at: ago(3) }],
    profileReminderSentAt: new Date(),
  });
  await User.create({
    name: 'Ravi Teja', email: 'ravi.unverified@veejee.example', mobile: '9876500121', role: 'candidate', passwordHash: await hashPassword(ctx.password),
    status: 'pending', emailVerified: false, consent: { termsAcceptedAt: new Date(), privacyAcceptedAt: new Date(), marketingEmails: false },
  });
  await User.create({
    name: 'Blocked Demo User', email: 'blocked.candidate@veejee.example', mobile: '9876500122', role: 'candidate', passwordHash: await hashPassword(ctx.password),
    status: 'blocked', emailVerified: true, emailVerifiedAt: ago(30), consent: { termsAcceptedAt: ago(30), privacyAcceptedAt: ago(30), marketingEmails: false },
  });
  // Kavya withdraws contact sharing then grants it again – shows the append-only consent ledger.
  const kavya = ctx.profiles[0]!;
  await Consent.create({ candidate: kavya.user._id, type: 'contact_sharing', granted: false, version: CONSENT_VERSION, ip: '127.0.0.1', userAgent: 'seed' });
  await Consent.create({ candidate: kavya.user._id, type: 'contact_sharing', granted: true, version: CONSENT_VERSION, ip: '127.0.0.1', userAgent: 'seed' });
}

async function seedNotes(ctx: Ctx) {
  if (await RecruitmentNote.exists({ author: ctx.recruiters[0]!._id, kind: 'communication' })) return;
  const [r1, r2] = ctx.recruiters as [UserDoc, UserDoc];
  const [kavya, rahul, sneha, arun, fatima, vikram] = ctx.profiles as Profile[];
  const job = async (title: string) => (await Job.findOne({ title }))?._id;
  await RecruitmentNote.insertMany([
    { candidate: kavya!.user._id, job: await job('Senior Angular Developer'), author: r1._id, kind: 'communication', body: 'Called Kavya – confirmed 30-day notice and interest in hybrid work. Expected CTC 16 LPA, negotiable.' },
    { candidate: kavya!.user._id, author: r1._id, kind: 'note', body: 'Strong communicator. Portfolio reviewed – good RxJS knowledge.' },
    { candidate: rahul!.user._id, job: await job('Senior Angular Developer'), author: r1._id, kind: 'note', body: 'Shortlisted; awaiting admin approval. Prefers Hyderabad but open to Bengaluru hybrid.' },
    { candidate: sneha!.user._id, author: r1._id, kind: 'system', body: 'Candidate placed at Northwind Technologies (internship).' },
    { candidate: arun!.user._id, job: await job('Site Engineer – Civil'), author: r2._id, kind: 'communication', body: 'Asked Arun to enable profile sharing consent so we can submit him to Meridian Infra.' },
    { candidate: fatima!.user._id, job: await job('Staff Nurse (ICU)'), author: r2._id, kind: 'communication', body: 'Interview moved by the hospital – new video slot confirmed with candidate.' },
    { candidate: vikram!.user._id, job: await job('Store Manager'), author: r2._id, kind: 'note', body: 'Selected. Coordinate offer letter and joining date with Saffron HR.' },
  ]);
}

async function seedNotifications(ctx: Ctx) {
  if (await Notification.exists({ message: 'GreenLeaf Agro Foods registered and needs verification.' })) return;
  const [kavya, , sneha, , fatima, vikram] = ctx.profiles;
  const employer = await User.findOne({ email: 'employer@veejee.example' });
  const rows = [
    { user: kavya!.user._id, type: 'submission.status', title: 'Your profile was shared', message: 'Veejee Services submitted your profile to Northwind Technologies for Senior Angular Developer.', link: '/candidate/applications', readAt: ago(2) },
    { user: kavya!.user._id, type: 'submission.status', title: 'Update on Node.js Backend Engineer', message: 'The company has decided not to proceed. We will keep matching you to new roles.', link: '/candidate/applications' },
    { user: fatima!.user._id, type: 'interview.scheduled', title: 'Interview scheduled', message: 'CarePlus Hospitals – Staff Nurse (ICU). Please confirm your availability.', link: '/candidate/interviews' },
    { user: vikram!.user._id, type: 'submission.status', title: 'Congratulations – you were selected!', message: 'Saffron Retail Group selected you for Store Manager.', link: '/candidate/applications' },
    { user: sneha!.user._id, type: 'submission.status', title: 'Successfully placed', message: 'Welcome aboard Northwind Technologies!', link: '/candidate/applications', readAt: ago(3) },
    { user: ctx.recruiters[0]!._id, type: 'application.new', title: 'New application', message: 'Mohammed Irfan applied for Delivery Partner.', link: '/recruiter/applications' },
    { user: ctx.recruiters[0]!._id, type: 'shortlist.approved', title: 'Shortlist approved', message: 'Priya Nair – QA Automation Engineer is ready to submit.', link: '/recruiter/pipeline' },
    { user: ctx.admin._id, type: 'shortlist.pending', title: 'Shortlist awaiting approval', message: 'Rahul Verma – Senior Angular Developer.', link: '/admin/shortlists' },
    { user: ctx.admin._id, type: 'employer.registered', title: 'Company awaiting verification', message: 'GreenLeaf Agro Foods registered and needs verification.', link: '/admin/employers' },
    ...(employer ? [{ user: employer._id, type: 'submission.new', title: 'New candidate profile', message: 'Veejee Services shared a candidate for Senior Angular Developer.', link: '/employer/candidates' }] : []),
  ];
  await Notification.insertMany(rows);
}

async function seedEnquiries(ctx: Ctx) {
  if (await ContactEnquiry.exists({ email: /@example\.com$/ })) return;
  await ContactEnquiry.insertMany([
    { name: 'Suresh Patel', email: 'suresh.patel@example.com', phone: '9822001122', subject: 'Hiring 20 warehouse staff', message: 'We are opening a new warehouse in Surat and need 20 associates within a month. Please share your terms.', enquiryType: 'employer', status: 'new' },
    { name: 'Lakshmi R', email: 'lakshmi.r@example.com', subject: 'Resume upload problem', message: 'My resume is a Word file – can I upload it?', enquiryType: 'candidate', status: 'resolved', notes: 'Explained only PDF is accepted; candidate re-uploaded as PDF.', handledBy: ctx.recruiters[1]!._id },
    { name: 'Karan Malhotra', email: 'karan@example.com', phone: '9988776655', subject: 'Partnership', message: 'We run a coding bootcamp and would like to refer our graduates.', enquiryType: 'general', status: 'in_progress', notes: 'Call scheduled for next week.', handledBy: ctx.admin._id },
    { name: 'Meena Joseph', email: 'meena.j@example.com', subject: 'Nursing jobs abroad?', message: 'Do you have any openings for nurses in the Gulf region?', enquiryType: 'candidate', status: 'new' },
  ]);
}

/** Demo notifications addressed to the real admin (removed with the demo data). */
export const DEMO_ADMIN_NOTIFICATIONS = ['Rahul Verma – Senior Angular Developer.', 'GreenLeaf Agro Foods registered and needs verification.'];

export const DEMO_TESTIMONIAL_QUOTES = [
  'Veejee Services prepared me for every round and kept me updated at each step. I got my first job within a month!',
  'Instead of hundreds of random CVs we received five well-screened profiles. Two of them are now on our team.',
  'Professional, transparent and quick. They only shared my profile after asking me first.',
  'Awaiting written consent before publishing (demo of the consent rule).',
];

async function seedTestimonials() {
  if (await Testimonial.exists({ quote: { $in: DEMO_TESTIMONIAL_QUOTES } })) return;
  await Testimonial.insertMany([
    { name: 'Sneha I.', role: 'Software Engineering Intern', company: 'Northwind Technologies', quote: 'Veejee Services prepared me for every round and kept me updated at each step. I got my first job within a month!', rating: 5, consentConfirmed: true, published: true },
    { name: 'Priya Sharma', role: 'HR Manager', company: 'Northwind Technologies', quote: 'Instead of hundreds of random CVs we received five well-screened profiles. Two of them are now on our team.', rating: 5, consentConfirmed: true, published: true },
    { name: 'Vikram S.', role: 'Store Manager', company: 'Saffron Retail Group', quote: 'Professional, transparent and quick. They only shared my profile after asking me first.', rating: 4, consentConfirmed: true, published: true },
    { name: 'Draft testimonial', role: 'Staff Nurse', quote: 'Awaiting written consent before publishing (demo of the consent rule).', rating: 5, consentConfirmed: false, published: false },
  ]);
}

async function seedContent(ctx: Ctx) {
  for (const [key, value] of Object.entries(DEFAULT_CONTENT) as [keyof typeof DEFAULT_CONTENT, unknown][]) {
    const v =
      key === 'home' && !ctx.live // never publish invented headline numbers on the live site
        ? { ...(value as object), stats: [{ label: 'Candidates placed', value: '1,200+' }, { label: 'Client companies', value: 150 }, { label: 'Industries served', value: 12 }, { label: 'Average days to hire', value: 21 }] }
        : value;
    await SiteContent.updateOne({ key }, { $setOnInsert: { key, value: v, updatedBy: ctx.admin._id } }, { upsert: true });
  }
}

async function seedAudit(ctx: Ctx) {
  if (await AuditLog.exists({ 'metadata.seed': true })) return;
  const r1 = ctx.recruiters[0]!;
  const a = { actor: ctx.admin._id, actorRole: 'admin', ip: '127.0.0.1', userAgent: 'seed' };
  const r = { actor: r1._id, actorRole: 'recruiter', ip: '127.0.0.1', userAgent: 'seed' };
  const rows: { metadata?: Record<string, unknown>; [k: string]: unknown }[] = [
    { ...a, action: 'auth.login', entityType: 'User', entityId: String(ctx.admin._id), createdAt: ago(5, 9) },
    { ...a, action: 'employer.verify', entityType: 'Employer', metadata: { company: 'Northwind Technologies' }, createdAt: ago(5, 9) },
    { ...a, action: 'job.approve', entityType: 'Job', metadata: { title: 'Senior Angular Developer' }, createdAt: ago(5, 10) },
    { ...r, action: 'auth.login', entityType: 'User', entityId: String(r1._id), createdAt: ago(4, 9) },
    { ...r, action: 'shortlist.create', entityType: 'Shortlist', metadata: { candidate: 'Rahul Verma' }, createdAt: ago(4, 11) },
    { ...a, action: 'shortlist.approve', entityType: 'Shortlist', metadata: { candidate: 'Priya Nair' }, createdAt: ago(1, 12) },
    { ...r, action: 'submission.create', entityType: 'Submission', metadata: { candidate: 'Kavya Reddy', company: 'Northwind Technologies' }, createdAt: ago(3, 15) },
    { ...r, action: 'resume.download', entityType: 'Resume', metadata: { owner: 'Kavya Reddy', role: 'recruiter' }, createdAt: ago(3, 14) },
    { ...a, action: 'settings.update', entityType: 'PlatformSettings', metadata: { field: 'requireShortlistApproval', value: true }, createdAt: ago(6, 16) },
  ];
  for (const x of rows) x.metadata = { ...(x.metadata ?? {}), seed: true };
  // insertMany through the driver keeps the back-dated createdAt values.
  await AuditLog.collection.insertMany(rows);
}

async function seedOutbox() {
  if (await EmailOutbox.exists({ template: { $regex: /^demo\./ } })) return;
  // No 'pending' rows – the email worker would try to deliver them to the fake demo addresses.
  const mail = (to: string, subject: string, body: string) => ({ to, subject, html: `<p>${body}</p>`, text: body });
  await EmailOutbox.insertMany([
    { ...mail('seeker@veejee.example', 'Your profile was shared with Northwind Technologies', 'Veejee Services submitted your profile for Senior Angular Developer.'), template: 'demo.submissionCandidate', status: 'sent', attempts: 1, sentAt: ago(3) },
    { ...mail('employer@veejee.example', 'New candidate for Senior Angular Developer', 'A screened candidate profile is ready in your portal.'), template: 'demo.submissionEmployer', status: 'sent', attempts: 1, sentAt: ago(3) },
    { ...mail('fatima.candidate@veejee.example', 'Interview scheduled – CarePlus Hospitals', 'Your interview for Staff Nurse (ICU) has been scheduled.'), template: 'demo.interviewScheduled', status: 'sent', attempts: 1, sentAt: ago(1) },
    { ...mail('old.address@veejee.example', 'Verify your email', 'Please verify your email address.'), template: 'demo.verifyEmail', status: 'failed', attempts: 5, lastError: '550 5.1.1 Recipient address rejected (demo)' },
    { ...mail('blocked.candidate@veejee.example', 'Job alert', 'New jobs matching your profile.'), template: 'demo.jobAlert', status: 'suppressed', attempts: 0 },
  ]);
}

export async function seedDemoExtras(ctx: Ctx) {
  await seedPipelines(ctx);
  await seedModerationQueue(ctx);
  await seedNotes(ctx);
  await seedNotifications(ctx);
  await seedEnquiries(ctx);
  await seedTestimonials();
  await seedContent(ctx);
  await seedAudit(ctx);
  await seedOutbox();
}
