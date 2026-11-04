import type { HydratedDocument } from 'mongoose';
import { CONSENT_VERSION, OPEN_SUBMISSION_STATUSES, STAGE_LABEL, type ConsentType } from '../../common/constants';
import { ConflictError, InvalidStateError, NotFoundError, ValidationError } from '../../common/errors';
import { paginated } from '../../common/http';
import type { AuthContext } from '../../middleware/auth';
import {
  Application,
  Candidate,
  Consent,
  Interview,
  Job,
  Resume,
  Submission,
  User,
  plain,
  withTransaction,
  type IApplication,
  type ICandidate,
  type IJob,
} from '../../models';
import { audit, notify, type Actor } from '../../services/activity.service';
import { queueEmail } from '../../services/email/email.service';
import { syncProfileStage } from '../../services/pipeline.service';
import { EMPLOYER_SUMMARY, JOB_POPULATE } from '../../services/populate';
import { staffRecipients } from '../recruitment/recruitment.shared';
import { assertJobOpen, openJobFilter, toPublic } from '../jobs/jobs.service';

export async function profileOf(userId: string) {
  const p = await Candidate.findOne({ user: userId });
  if (!p) throw new NotFoundError('Candidate profile');
  return p;
}

/** What a candidate may see about themselves: no internal fields, only candidate-visible history. */
export function candidateView(c: HydratedDocument<ICandidate>) {
  const json = plain(c);
  json.stageLabel = STAGE_LABEL[c.stage];
  json.stageHistory = c.stageHistory
    .filter((h) => h.visibleToCandidate)
    .map((h) => ({ stage: h.stage, label: STAGE_LABEL[h.stage], note: h.note, at: h.at }));
  delete json.assignedRecruiter;
  delete json.assignedAt;
  delete json.lastReviewedAt;
  delete json.profileReminderSentAt;
  return json;
}

export async function getProfile(userId: string) {
  return candidateView(await profileOf(userId));
}

export type ProfileInput = Partial<
  Omit<ICandidate, '_id' | 'user' | 'savedJobs' | 'primaryResume' | 'profileCompletion' | 'preferredIndustries' | 'consent' | 'stage' | 'stageHistory' | 'assignedRecruiter'>
> & { preferredIndustries?: string[] };

export async function updateProfile(userId: string, input: ProfileInput) {
  const p = await profileOf(userId);
  p.set(input);
  if (input.careerLevel === 'fresher' && input.totalExperienceYears === undefined) p.totalExperienceYears = 0;
  await p.save();
  await syncProfileStage(p);
  return candidateView(p);
}

export async function dashboard(userId: string) {
  const p = await profileOf(userId);
  const [applications, submissions, upcomingInterviews, recommended] = await Promise.all([
    Application.aggregate<{ _id: string; count: number }>([{ $match: { candidate: p.user } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Submission.aggregate<{ _id: string; count: number }>([{ $match: { candidate: p.user } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Interview.find({ candidate: userId, scheduledAt: { $gte: new Date() }, status: { $in: ['scheduled', 'rescheduled'] } })
      .sort({ scheduledAt: 1 })
      .limit(5)
      .populate('job', 'title slug')
      .populate('employer', 'companyName slug'),
    recommendedJobs(p),
  ]);
  const toMap = (rows: { _id: string; count: number }[]) => Object.fromEntries(rows.map((r) => [r._id, r.count]));
  return {
    stage: p.stage,
    stageLabel: STAGE_LABEL[p.stage],
    profileCompletion: p.profileCompletion,
    hasResume: Boolean(p.primaryResume),
    consent: p.consent,
    applications: { total: applications.reduce((a, r) => a + r.count, 0), byStatus: toMap(applications) },
    submissions: { total: submissions.reduce((a, r) => a + r.count, 0), byStatus: toMap(submissions) },
    savedJobs: p.savedJobs.length,
    upcomingInterviews: upcomingInterviews.map((i) => {
      const o = plain(i);
      delete o.notes;
      return o;
    }),
    recommendedJobs: recommended,
  };
}

async function recommendedJobs(p: ICandidate) {
  const applied = await Application.find({ candidate: p.user }).distinct('job');
  const filter: Record<string, unknown> = { ...openJobFilter(), _id: { $nin: applied } };
  const or: Record<string, unknown>[] = [];
  if (p.preferredIndustries.length) or.push({ industry: { $in: p.preferredIndustries } });
  if (p.skills.length) or.push({ skills: { $in: p.skills.map((s) => new RegExp(`^${s.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')) } });
  if (or.length) filter.$and = [{ $or: or }];
  const matched = await Job.find(filter).sort({ featured: -1, publishedAt: -1 }).limit(6).populate(JOB_POPULATE);
  const jobs = matched.length ? matched : await Job.find({ ...openJobFilter(), _id: { $nin: applied } }).sort({ publishedAt: -1 }).limit(6).populate(JOB_POPULATE);
  return jobs.map(toPublic);
}

export async function savedJobs(userId: string, page: number, limit: number) {
  const p = await profileOf(userId);
  const filter = { _id: { $in: p.savedJobs }, deletedAt: null };
  const [items, total] = await Promise.all([
    Job.find(filter).sort({ publishedAt: -1 }).skip((page - 1) * limit).limit(limit).populate(JOB_POPULATE),
    Job.countDocuments(filter),
  ]);
  return paginated(items.map(toPublic), total, page, limit);
}

export async function saveJob(userId: string, jobId: string) {
  assertJobOpen(await Job.findById(jobId));
  await Candidate.updateOne({ user: userId }, { $addToSet: { savedJobs: jobId } });
}

export const unsaveJob = (userId: string, jobId: string) => Candidate.updateOne({ user: userId }, { $pull: { savedJobs: jobId } });

// ── Consent (DPDP) ───────────────────────────────────────────────────────────

export async function getConsent(userId: string) {
  const p = await profileOf(userId);
  const history = await Consent.find({ candidate: userId }).sort({ createdAt: -1 }).limit(50).select('type granted version createdAt');
  return { current: p.consent, version: CONSENT_VERSION, history };
}

export async function updateConsent(userId: string, input: Partial<Record<'profileSharing' | 'contactSharing', boolean>>, actor: Actor) {
  const p = await profileOf(userId);
  const map: [keyof typeof input, ConsentType][] = [
    ['profileSharing', 'profile_sharing'],
    ['contactSharing', 'contact_sharing'],
  ];
  const changes: { type: ConsentType; granted: boolean }[] = [];
  for (const [field, type] of map) {
    const v = input[field];
    if (v !== undefined && v !== p.consent[field]) changes.push({ type, granted: v });
  }
  // Contact sharing only makes sense together with profile sharing.
  const next = { ...p.consent, ...input };
  if (!next.profileSharing && next.contactSharing) {
    next.contactSharing = false;
    if (p.consent.contactSharing) changes.push({ type: 'contact_sharing', granted: false });
  }
  if (!changes.length) return getConsent(userId);
  await withTransaction(async (session) => {
    await Consent.create(
      changes.map((c) => ({ candidate: userId, ...c, version: CONSENT_VERSION, ip: actor.ip, userAgent: actor.userAgent })),
      { session, ordered: true },
    );
    p.consent = { profileSharing: next.profileSharing, contactSharing: next.contactSharing, updatedAt: new Date() };
    await p.save({ session });
  });
  await audit(actor, 'candidate.consent', 'Candidate', p._id, { changes });
  return getConsent(userId);
}

// ── Applications to Veejee Services ──────────────────────────────────────────────────

const APP_POPULATE = [
  { path: 'job', select: 'title slug employer companyName confidential locations employmentType workMode status', populate: { path: 'employer', select: EMPLOYER_SUMMARY } },
  { path: 'resume', select: 'originalName size createdAt' },
];

/** Hide the company identity of confidential requirements from candidates. */
function maskJob(app: Record<string, unknown>) {
  const job = app.job as (Record<string, unknown> & { confidential?: boolean }) | undefined;
  if (job?.confidential) {
    job.companyName = 'Veejee Services client (confidential)';
    job.employer = null;
  }
  return app;
}

export async function apply(auth: AuthContext, input: { jobId: string; resumeId?: string; coverLetter?: string }, actor: Actor) {
  const job = await Job.findById(input.jobId);
  assertJobOpen(job);
  const p = await profileOf(auth.userId);
  const resumeId = input.resumeId ?? (p.primaryResume ? String(p.primaryResume) : undefined);
  const resume = resumeId ? await Resume.findOne({ _id: resumeId, owner: auth.userId, deletedAt: null }) : null;
  if (!resume) throw new ValidationError('Please upload a resume before applying', [{ field: 'resumeId', message: 'Resume required' }]);
  if (await Application.exists({ job: job._id, candidate: auth.userId })) throw new ConflictError('You have already applied for this job', 'ALREADY_APPLIED');

  let app: HydratedDocument<IApplication>;
  try {
    app = await withTransaction(async (session) => {
      const [a] = await Application.create(
        [
          {
            job: job._id,
            employer: job.employer,
            candidate: auth.userId,
            candidateProfile: p._id,
            resume: resume._id,
            coverLetter: input.coverLetter,
            status: 'applied',
            statusHistory: [{ status: 'applied', changedBy: auth.userId, at: new Date() }],
          },
        ],
        { session },
      );
      await Job.updateOne({ _id: job._id }, { $inc: { applicationsCount: 1 } }, { session });
      return a!;
    });
  } catch (err) {
    if ((err as { code?: number }).code === 11000) throw new ConflictError('You have already applied for this job', 'ALREADY_APPLIED');
    throw err;
  }

  const companyLabel = (job as IJob).confidential ? 'a Veejee Services client' : job.companyName;
  await queueEmail(auth.user.email, 'applicationConfirmation', { name: auth.user.name, jobTitle: job.title, companyName: companyLabel });
  await notify(auth.userId, { type: 'application.submitted', title: 'Application received by Veejee Services', message: `Veejee Services will review your profile for ${job.title}.`, link: `/candidate/applications` });
  for (const r of await staffRecipients(job.assignedRecruiter ?? p.assignedRecruiter)) {
    await notify(r._id, { type: 'application.new', title: 'New application to review', message: `${auth.user.name} applied for ${job.title} (${job.companyName}).`, link: `/recruiter/candidates/${p._id}` });
    await queueEmail(r.email, 'newApplication', { name: r.name, jobTitle: job.title, companyName: job.companyName, candidateName: auth.user.name, candidateId: String(p._id) });
  }
  await audit(actor, 'application.create', 'Application', app._id, { job: String(job._id) });
  return maskJob(plain(await app.populate(APP_POPULATE)));
}

export async function myApplications(userId: string, page: number, limit: number) {
  const filter = { candidate: userId };
  const [items, total] = await Promise.all([
    Application.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate(APP_POPULATE),
    Application.countDocuments(filter),
  ]);
  return paginated(items.map((a) => maskJob(plain(a))), total, page, limit);
}

export async function getApplication(userId: string, id: string) {
  const app = await Application.findOne({ _id: id, candidate: userId }).populate(APP_POPULATE);
  if (!app) throw new NotFoundError('Application');
  return maskJob(plain(app));
}

export async function withdrawApplication(auth: AuthContext, id: string, reason: string | undefined, actor: Actor) {
  const app = await Application.findOne({ _id: id, candidate: auth.userId });
  if (!app) throw new NotFoundError('Application');
  if (!['applied', 'under_review'].includes(app.status)) throw new InvalidStateError('This application can no longer be withdrawn. Contact Veejee Services if your circumstances have changed.');
  app.status = 'withdrawn';
  app.statusHistory.push({ status: 'withdrawn', note: reason, changedBy: auth.userId as never, at: new Date() });
  await app.save();
  await audit(actor, 'application.withdraw', 'Application', app._id);
  return maskJob(plain(await app.populate(APP_POPULATE)));
}

/** Companies the candidate's profile was shared with, and how each is progressing (candidate-safe view). */
export async function mySubmissions(userId: string) {
  const subs = await Submission.find({ candidate: userId })
    .sort({ createdAt: -1 })
    .populate('job', 'title slug locations employmentType')
    .populate('employer', EMPLOYER_SUMMARY);
  const interviews = await Interview.find({ candidate: userId }).sort({ scheduledAt: 1 }).select('-notes');
  return subs.map((s) => ({
    id: String(s._id),
    job: s.job,
    employer: s.employer,
    status: s.status,
    contactShared: s.contactShared,
    submittedAt: s.createdAt,
    history: s.statusHistory.filter((h) => h.visibleToCandidate).map((h) => ({ status: h.status, note: h.note, at: h.at })),
    interviews: interviews.filter((i) => String(i.submission) === String(s._id)),
    active: OPEN_SUBMISSION_STATUSES.includes(s.status),
  }));
}

export async function myInterviews(userId: string, upcoming: boolean) {
  const filter: Record<string, unknown> = { candidate: userId };
  if (upcoming) Object.assign(filter, { scheduledAt: { $gte: new Date() }, status: { $in: ['scheduled', 'rescheduled'] } });
  return Interview.find(filter)
    .sort({ scheduledAt: upcoming ? 1 : -1 })
    .limit(200)
    .select('-notes')
    .populate('job', 'title slug')
    .populate('employer', 'companyName slug');
}

export async function respondToInterview(auth: AuthContext, id: string, response: 'accepted' | 'declined', note: string | undefined) {
  const iv = await Interview.findOne({ _id: id, candidate: auth.userId });
  if (!iv) throw new NotFoundError('Interview');
  if (!['scheduled', 'rescheduled'].includes(iv.status) || iv.scheduledAt < new Date()) throw new InvalidStateError('This interview can no longer be responded to');
  iv.candidateResponse = response;
  iv.candidateNote = note;
  await iv.save();
  await notify(iv.scheduledBy, {
    type: 'interview.response',
    title: `Interview ${response}`,
    message: `${auth.user.name} ${response} the interview invitation${note ? `: ${note}` : '.'}`,
    link: `/recruiter/submissions/${iv.submission}`,
  });
  const json = plain(await iv.populate([{ path: 'job', select: 'title slug' }, { path: 'employer', select: 'companyName slug' }]));
  delete json.notes;
  return json;
}

export async function candidateUser(id: unknown) {
  return User.findById(id).select('name email mobile');
}
