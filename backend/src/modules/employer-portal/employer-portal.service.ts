import type { HydratedDocument, Types } from 'mongoose';
import { EMPLOYER_DECIDABLE_FROM, EMPLOYER_DECISIONS, type SubmissionStatus } from '../../common/constants';
import { ConflictError, InvalidStateError, NotFoundError } from '../../common/errors';
import { paginated } from '../../common/http';
import type { AuthContext } from '../../middleware/auth';
import { Candidate, Interview, InterviewFeedback, Job, Submission, User, plain, type ISubmission } from '../../models';
import { audit, notify, type Actor } from '../../services/activity.service';
import { getCompanyContext } from '../../services/company.service';
import { queueEmail } from '../../services/email/email.service';
import { announceOutcome, pushSubmissionStatus } from '../recruitment/recruitment.pipeline.service';
import { recomputeStage, staffRecipients } from '../recruitment/recruitment.shared';

/** The approved, consented view of a candidate a company may see. No DOB/gender; contact only with explicit consent. */
const COMPANY_PROFILE_FIELDS = 'headline summary location careerLevel totalExperienceYears skills education experience currentSalary expectedSalary preferredRoles preferredLocations preferredWorkModes noticePeriodDays availability';

async function loadOwn(auth: AuthContext, id: string) {
  const ctx = await getCompanyContext(auth);
  const s = await Submission.findOne({ _id: id, employer: ctx.employer._id });
  if (!s) throw new NotFoundError('Candidate submission');
  return { s, ctx };
}

async function companyView(s: HydratedDocument<ISubmission>) {
  await s.populate([
    { path: 'job', select: 'title slug locations employmentType status' },
    { path: 'candidate', select: s.contactShared ? 'name email mobile' : 'name' },
    { path: 'candidateProfile', select: COMPANY_PROFILE_FIELDS },
    { path: 'resume', select: 'originalName size' },
    { path: 'submittedBy', select: 'name' },
  ]);
  const json = plain(s);
  delete json.consentRecord;
  delete json.shortlist;
  // Only company-facing history (Veejee Services internal "visibleToCandidate=false" notes are still fine for the company, but strip actor ids).
  json.statusHistory = s.statusHistory.map((h) => ({ status: h.status, note: h.byRole === 'company' || h.visibleToCandidate ? h.note : undefined, byRole: h.byRole, at: h.at }));
  const [interviews, feedback] = await Promise.all([
    Interview.find({ submission: s._id }).sort({ scheduledAt: -1 }).select('-candidateNote'),
    InterviewFeedback.find({ submission: s._id }).sort({ createdAt: -1 }).populate('givenBy', 'name'),
  ]);
  json.interviews = interviews;
  json.feedback = feedback;
  return json;
}

export async function dashboard(auth: AuthContext) {
  const { employer } = await getCompanyContext(auth);
  const [requirements, byStatus, recent, upcoming] = await Promise.all([
    Job.aggregate<{ _id: string; count: number }>([{ $match: { employer: employer._id, deletedAt: null } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Submission.aggregate<{ _id: string; count: number }>([{ $match: { employer: employer._id } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Submission.find({ employer: employer._id, status: { $in: ['submitted', 'company_reviewing'] } })
      .sort({ createdAt: -1 })
      .limit(8)
      .populate('job', 'title')
      .populate('candidate', 'name')
      .populate('candidateProfile', 'headline totalExperienceYears skills'),
    Interview.find({ employer: employer._id, scheduledAt: { $gte: new Date() }, status: { $in: ['scheduled', 'rescheduled'] } })
      .sort({ scheduledAt: 1 })
      .limit(8)
      .select('-candidateNote')
      .populate('job', 'title')
      .populate('candidate', 'name'),
  ]);
  const m = (rows: { _id: string; count: number }[]) => Object.fromEntries(rows.map((r) => [r._id, r.count]));
  const subs = m(byStatus);
  return {
    company: { id: String(employer._id), companyName: employer.companyName, verificationStatus: employer.verificationStatus },
    requirementsByStatus: m(requirements),
    submissionsByStatus: subs,
    totals: {
      submitted: byStatus.reduce((a, r) => a + r.count, 0),
      awaitingReview: (subs.submitted ?? 0) + (subs.company_reviewing ?? 0),
      interviews: (subs.interview_requested ?? 0) + (subs.interview_scheduled ?? 0),
      hired: (subs.selected ?? 0) + (subs.placed ?? 0),
    },
    recentSubmissions: recent,
    upcomingInterviews: upcoming,
  };
}

export async function listSubmissions(auth: AuthContext, q: { jobId?: string; status?: SubmissionStatus; history?: boolean; page: number; limit: number }) {
  const { employer } = await getCompanyContext(auth);
  const filter: Record<string, unknown> = { employer: employer._id };
  if (q.jobId) filter.job = q.jobId;
  if (q.status) filter.status = q.status;
  else if (q.history) filter.status = { $in: ['placed', 'rejected', 'withdrawn', 'selected'] };
  const [items, total] = await Promise.all([
    Submission.find(filter)
      .sort({ updatedAt: -1 })
      .skip((q.page - 1) * q.limit)
      .limit(q.limit)
      .populate('job', 'title slug')
      .populate('candidate', 'name')
      .populate('candidateProfile', 'headline totalExperienceYears careerLevel skills location noticePeriodDays expectedSalary'),
    Submission.countDocuments(filter),
  ]);
  return paginated(
    items.map((s) => {
      const o = plain(s);
      delete o.consentRecord;
      delete o.statusHistory;
      return o;
    }),
    total,
    q.page,
    q.limit,
  );
}

export async function getSubmission(auth: AuthContext, id: string) {
  const { s } = await loadOwn(auth, id);
  if (s.status === 'submitted') {
    // First view by the company moves it to "company reviewing".
    await pushSubmissionStatus(s, 'company_reviewing', auth.userId, 'company');
    await s.save();
    await recomputeStage(s.candidate, { by: auth.userId });
  }
  return companyView(s);
}

async function tellAnanth(s: HydratedDocument<ISubmission>, title: string, message: string) {
  const job = await Job.findById(s.job).select('assignedRecruiter');
  const recipients = await staffRecipients(job?.assignedRecruiter ?? s.submittedBy);
  for (const r of recipients) await notify(r._id, { type: 'submission.company_update', title, message, link: `/recruiter/submissions/${s._id}` });
  return recipients;
}

export async function decide(auth: AuthContext, id: string, decision: keyof typeof EMPLOYER_DECISIONS, note: string | undefined, actor: Actor) {
  const { s, ctx } = await loadOwn(auth, id);
  if (!EMPLOYER_DECIDABLE_FROM.includes(s.status)) throw new InvalidStateError(`A decision can no longer be recorded for this candidate (status: ${s.status.replace(/_/g, ' ')})`);
  const status = EMPLOYER_DECISIONS[decision];
  await pushSubmissionStatus(s, status, auth.userId, 'company', note, decision === 'accept');
  s.employerNote = note;
  await s.save();
  if (status === 'rejected' || status === 'selected') {
    await Interview.updateMany({ submission: s._id, status: { $in: ['scheduled', 'rescheduled'] }, scheduledAt: { $gt: new Date() } }, { status: 'cancelled', cancelReason: 'Company decision recorded' });
    await announceOutcome(s, status);
  }
  await recomputeStage(s.candidate, { by: auth.userId });
  const cand = await User.findById(s.candidate).select('name');
  await tellAnanth(s, `Company decision: ${decision.replace('_', ' ')}`, `${ctx.employer.companyName} – ${cand?.name ?? 'candidate'}${note ? `: ${note}` : ''}`);
  await audit(actor, `submission.company_${decision}`, 'Submission', s._id, { note });
  return companyView(s);
}

export async function requestInterview(auth: AuthContext, id: string, input: { note?: string; preferredSlots?: string[] }, actor: Actor) {
  const { s, ctx } = await loadOwn(auth, id);
  if (!['submitted', 'company_reviewing', 'interview_completed', 'on_hold'].includes(s.status)) {
    throw new InvalidStateError('An interview can be requested only for candidates under review');
  }
  s.interviewRequest = { note: input.note, preferredSlots: input.preferredSlots ?? [], requestedBy: auth.userId as never, requestedAt: new Date() };
  await pushSubmissionStatus(s, 'interview_requested', auth.userId, 'company', input.note, false);
  await s.save();
  await recomputeStage(s.candidate, { by: auth.userId, note: 'The company would like to interview you – Veejee Services will confirm the schedule' });
  const [cand, job] = await Promise.all([User.findById(s.candidate).select('name'), Job.findById(s.job).select('title')]);
  const recipients = await tellAnanth(s, 'Interview requested', `${ctx.employer.companyName} wants to interview ${cand?.name ?? 'a candidate'}`);
  for (const r of recipients) {
    await queueEmail(r.email, 'interviewRequested', {
      name: r.name,
      companyName: ctx.employer.companyName,
      candidateName: cand?.name ?? 'a candidate',
      jobTitle: job?.title ?? 'the requirement',
      note: input.note,
      submissionId: String(s._id),
    });
  }
  await audit(actor, 'submission.interview_request', 'Submission', s._id);
  return companyView(s);
}

export async function listInterviews(auth: AuthContext, upcoming: boolean) {
  const { employer } = await getCompanyContext(auth);
  const filter: Record<string, unknown> = { employer: employer._id };
  if (upcoming) Object.assign(filter, { scheduledAt: { $gte: new Date() }, status: { $in: ['scheduled', 'rescheduled'] } });
  return Interview.find(filter).sort({ scheduledAt: upcoming ? 1 : -1 }).limit(300).select('-candidateNote').populate('job', 'title').populate('candidate', 'name');
}

export async function giveFeedback(
  auth: AuthContext,
  interviewId: string,
  input: { rating: number; feedback: string; recommendation: 'select' | 'reject' | 'next_round' | 'on_hold' },
  actor: Actor,
) {
  const { employer } = await getCompanyContext(auth);
  const iv = await Interview.findOne({ _id: interviewId, employer: employer._id });
  if (!iv) throw new NotFoundError('Interview');
  if (iv.status === 'cancelled') throw new InvalidStateError('Feedback cannot be added to a cancelled interview');
  if (iv.scheduledAt > new Date()) throw new InvalidStateError('Feedback can be added after the interview has taken place');
  if (await InterviewFeedback.exists({ interview: iv._id })) throw new ConflictError('Feedback was already submitted for this interview', 'DUPLICATE_RESOURCE');
  const fb = await InterviewFeedback.create({ interview: iv._id, submission: iv.submission, employer: employer._id, givenBy: auth.userId, ...input });
  if (iv.status !== 'completed') {
    iv.status = 'completed';
    await iv.save();
  }
  const s = await Submission.findById(iv.submission);
  if (s && s.status === 'interview_scheduled') {
    await pushSubmissionStatus(s, 'interview_completed', auth.userId, 'company', undefined, true);
    await s.save();
    await recomputeStage(s.candidate, { by: auth.userId });
  }
  if (s) await tellAnanth(s, 'Interview feedback received', `${employer.companyName}: ${input.recommendation.replace('_', ' ')} (${input.rating}/5)`);
  await audit(actor, 'interview.feedback', 'InterviewFeedback', fb._id, { recommendation: input.recommendation });
  return fb;
}

/** Resume access check used by the resumes module. */
export async function companyCanSeeResume(employerId: Types.ObjectId | string, resumeId: string) {
  return Boolean(await Submission.exists({ employer: employerId, resume: resumeId }));
}

export { Candidate };
