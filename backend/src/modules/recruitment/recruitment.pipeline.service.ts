import type { HydratedDocument } from 'mongoose';
import { LIMITS, OPEN_SUBMISSION_STATUSES, STAFF_SUBMISSION_TRANSITIONS, type SubmissionStatus } from '../../common/constants';
import { ConflictError, ForbiddenError, InvalidStateError, NotFoundError, ValidationError } from '../../common/errors';
import { escapeRegex, paginated } from '../../common/http';
import { hasPermission, type AuthContext } from '../../middleware/auth';
import {
  Application,
  Candidate,
  Consent,
  Employer,
  Interview,
  InterviewFeedback,
  Job,
  RecruitmentNote,
  Recruiter,
  Shortlist,
  Submission,
  User,
  getSettings,
  plain,
  withTransaction,
  type IInterview,
  type ISubmission,
} from '../../models';
import { audit, notify, type Actor } from '../../services/activity.service';
import { queueEmail } from '../../services/email/email.service';
import { scoreCandidate } from '../../services/matching.service';
import { EMPLOYER_SUMMARY, JOB_POPULATE, notifyAdmins } from '../../services/populate';
import { companyOwner, recomputeStage } from './recruitment.shared';

// ── Requirements ────────────────────────────────────────────────────────────

export async function listRequirements(auth: AuthContext, q: { status?: string; q?: string; assigned?: string; employer?: string; page: number; limit: number }) {
  const filter: Record<string, unknown> = { deletedAt: null };
  if (q.status) filter.status = q.status;
  if (q.employer) filter.employer = q.employer;
  if (q.assigned === 'me') filter.assignedRecruiter = auth.userId;
  else if (q.assigned === 'unassigned') filter.assignedRecruiter = null;
  if (q.q) filter.$or = [{ title: new RegExp(escapeRegex(q.q), 'i') }, { companyName: new RegExp(escapeRegex(q.q), 'i') }];
  const [items, total] = await Promise.all([
    Job.find(filter).sort({ status: 1, updatedAt: -1 }).skip((q.page - 1) * q.limit).limit(q.limit).populate([...JOB_POPULATE, { path: 'assignedRecruiter', select: 'name' }]),
    Job.countDocuments(filter),
  ]);
  const ids = items.map((j) => j._id);
  const [shortlisted, submitted, applied] = await Promise.all([
    Shortlist.aggregate([{ $match: { job: { $in: ids }, status: { $in: ['pending_approval', 'approved', 'submitted'] } } }, { $group: { _id: '$job', n: { $sum: 1 } } }]),
    Submission.aggregate([{ $match: { job: { $in: ids } } }, { $group: { _id: '$job', n: { $sum: 1 } } }]),
    Application.aggregate([{ $match: { job: { $in: ids }, status: { $in: ['applied', 'under_review'] } } }, { $group: { _id: '$job', n: { $sum: 1 } } }]),
  ]);
  const m = (rows: { _id: unknown; n: number }[]) => new Map(rows.map((r) => [String(r._id), r.n]));
  const [sm, subm, am] = [m(shortlisted), m(submitted), m(applied)];
  return paginated(
    items.map((j) => ({ ...plain(j), counts: { shortlisted: sm.get(String(j._id)) ?? 0, submitted: subm.get(String(j._id)) ?? 0, pendingApplications: am.get(String(j._id)) ?? 0 } })),
    total,
    q.page,
    q.limit,
  );
}

export async function getRequirement(id: string) {
  const job = await Job.findOne({ _id: id, deletedAt: null }).populate([...JOB_POPULATE, { path: 'assignedRecruiter', select: 'name email' }]);
  if (!job) throw new NotFoundError('Requirement');
  const [shortlists, submissions, applications] = await Promise.all([
    Shortlist.find({ job: id, status: { $ne: 'removed' } })
      .sort({ 'match.score': -1 })
      .populate('candidate', 'name email')
      .populate('candidateProfile', 'headline totalExperienceYears careerLevel skills consent stage profileCompletion')
      .populate('shortlistedBy', 'name'),
    Submission.find({ job: id }).sort({ createdAt: -1 }).populate('candidate', 'name').populate('submittedBy', 'name'),
    Application.find({ job: id }).sort({ createdAt: -1 }).populate('candidate', 'name email').populate('candidateProfile', 'headline totalExperienceYears stage'),
  ]);
  return { requirement: job, shortlists, submissions, applications };
}

export async function assignRequirement(auth: AuthContext, id: string, recruiterUserId: string | null, actor: Actor) {
  if (!hasPermission(auth, 'candidates:assign') && recruiterUserId !== auth.userId) throw new ForbiddenError('Only administrators can assign requirements to other recruiters');
  if (recruiterUserId && !(await Recruiter.exists({ user: recruiterUserId, active: true }))) throw new ValidationError('Choose an active Veejee Services recruiter');
  const job = await Job.findOneAndUpdate({ _id: id, deletedAt: null }, { assignedRecruiter: recruiterUserId }, { returnDocument: 'after' });
  if (!job) throw new NotFoundError('Requirement');
  if (recruiterUserId && recruiterUserId !== auth.userId) {
    await notify(recruiterUserId, { type: 'requirement.assigned', title: 'Requirement assigned to you', message: `${job.title} (${job.companyName})`, link: `/recruiter/requirements/${job._id}` });
  }
  await audit(actor, 'requirement.assign', 'Job', id, { recruiter: recruiterUserId });
  return job;
}

// ── Matching ────────────────────────────────────────────────────────────────

/**
 * Ranks registered candidates against a requirement. Every candidate keeps their place in the
 * database regardless of score – the score only orders the list for recruiter review.
 */
export async function matchCandidates(id: string, q: { minScore?: number; consentOnly?: boolean; includeShortlisted?: boolean; page: number; limit: number }) {
  const job = await Job.findOne({ _id: id, deletedAt: null });
  if (!job) throw new NotFoundError('Requirement');
  const settings = await getSettings();
  const inactive = await User.find({ role: 'candidate', $or: [{ deletedAt: { $ne: null } }, { status: 'blocked' }] }).distinct('_id');
  const filter: Record<string, unknown> = { openToWork: true, stage: { $ne: 'placed' }, user: { $nin: inactive } };
  if (q.consentOnly) filter['consent.profileSharing'] = true;
  const pool = await Candidate.find(filter)
    .sort({ updatedAt: -1 })
    .limit(LIMITS.matchPoolSize)
    .populate('user', 'name email')
    .select('-stageHistory -savedJobs');
  const [shortlisted, submitted] = await Promise.all([
    Shortlist.find({ job: id, status: { $ne: 'removed' } }).select('candidate status'),
    Submission.find({ job: id }).select('candidate status'),
  ]);
  const sMap = new Map(shortlisted.map((s) => [String(s.candidate), s.status]));
  const subMap = new Map(submitted.map((s) => [String(s.candidate), s.status]));
  let scored = pool.map((c) => {
    const userId = String((c.user as unknown as { _id: unknown })._id);
    return {
      candidate: { ...plain(c), hasResume: Boolean(c.primaryResume) },
      match: scoreCandidate(job, c, settings.matchingWeights),
      shortlistStatus: sMap.get(userId) ?? null,
      submissionStatus: subMap.get(userId) ?? null,
    };
  });
  if (!q.includeShortlisted) scored = scored.filter((s) => !s.shortlistStatus || s.shortlistStatus === 'removed');
  if (q.minScore !== undefined) scored = scored.filter((s) => s.match.score >= q.minScore!);
  scored.sort((a, b) => b.match.score - a.match.score);
  const items = scored.slice((q.page - 1) * q.limit, q.page * q.limit);
  return { ...paginated(items, scored.length, q.page, q.limit), weights: settings.matchingWeights, poolSize: pool.length };
}

// ── Shortlists ──────────────────────────────────────────────────────────────

const SHORTLIST_POPULATE = [
  { path: 'job', select: 'title slug companyName employer status' },
  { path: 'candidate', select: 'name email' },
  { path: 'candidateProfile', select: 'headline totalExperienceYears careerLevel skills consent stage profileCompletion primaryResume' },
  { path: 'shortlistedBy', select: 'name' },
  { path: 'reviewedBy', select: 'name' },
];

export async function createShortlist(
  auth: AuthContext,
  input: { jobId: string; candidateId: string; applicationId?: string; note?: string; source?: 'application' | 'search' | 'match' },
  actor: Actor,
) {
  const job = await Job.findOne({ _id: input.jobId, deletedAt: null });
  if (!job || job.status !== 'published') throw new InvalidStateError('Candidates can only be shortlisted for open (published) requirements');
  const candidate = await Candidate.findById(input.candidateId);
  if (!candidate) throw new NotFoundError('Candidate');
  const settings = await getSettings();
  const match = scoreCandidate(job, candidate, settings.matchingWeights);
  const needsApproval = settings.requireShortlistApproval && !hasPermission(auth, 'shortlists:approve');
  const status = needsApproval ? 'pending_approval' : 'approved';
  const application = input.applicationId
    ? await Application.findOne({ _id: input.applicationId, job: job._id, candidate: candidate.user })
    : await Application.findOne({ job: job._id, candidate: candidate.user });

  const existing = await Shortlist.findOne({ job: job._id, candidate: candidate.user });
  if (existing && !['removed', 'rejected'].includes(existing.status)) throw new ConflictError('This candidate is already shortlisted for this requirement', 'ALREADY_SHORTLISTED');
  const doc = existing ?? new Shortlist({ job: job._id, employer: job.employer, candidate: candidate.user, candidateProfile: candidate._id });
  doc.set({
    application: application?._id,
    source: input.source ?? (application ? 'application' : 'search'),
    match,
    status,
    note: input.note,
    shortlistedBy: auth.userId,
    reviewedBy: needsApproval ? undefined : auth.userId,
    reviewedAt: needsApproval ? undefined : new Date(),
    removedReason: undefined,
  });
  await doc.save();
  if (application && application.status !== 'shortlisted') {
    application.status = 'shortlisted';
    application.statusHistory.push({ status: 'shortlisted', changedBy: auth.userId as never, at: new Date() });
    await application.save();
  }
  if (input.note) await RecruitmentNote.create({ candidate: candidate.user, job: job._id, author: auth.userId, kind: 'note', body: `Shortlist note: ${input.note}` });
  await recomputeStage(candidate.user, { by: auth.userId, note: `Shortlisted for ${job.title}` });

  const user = await User.findById(candidate.user).select('name email');
  if (user) {
    await queueEmail(user.email, 'shortlisted', {
      name: user.name,
      jobTitle: job.title,
      companyLabel: job.confidential ? 'a Veejee Services client' : job.companyName,
      hasConsent: candidate.consent.profileSharing,
    });
  }
  if (needsApproval) {
    await notifyAdmins('shortlists:approve', { type: 'shortlist.pending', title: 'Shortlist awaiting approval', message: `${user?.name ?? 'A candidate'} for ${job.title} (${job.companyName})`, link: '/admin/shortlists' });
  }
  await audit(actor, 'shortlist.create', 'Shortlist', doc._id, { job: input.jobId, score: match.score, status });
  return doc.populate(SHORTLIST_POPULATE);
}

export async function listShortlists(q: { status?: string; jobId?: string; mine?: boolean; page: number; limit: number }, auth: AuthContext) {
  const filter: Record<string, unknown> = {};
  if (q.status) filter.status = q.status;
  else filter.status = { $ne: 'removed' };
  if (q.jobId) filter.job = q.jobId;
  if (q.mine) filter.shortlistedBy = auth.userId;
  const [items, total] = await Promise.all([
    Shortlist.find(filter).sort({ createdAt: -1 }).skip((q.page - 1) * q.limit).limit(q.limit).populate(SHORTLIST_POPULATE),
    Shortlist.countDocuments(filter),
  ]);
  return paginated(items, total, q.page, q.limit);
}

export async function removeShortlist(auth: AuthContext, id: string, reason: string | undefined, actor: Actor) {
  const s = await Shortlist.findById(id);
  if (!s) throw new NotFoundError('Shortlist entry');
  if (s.status === 'submitted') throw new InvalidStateError('This candidate has already been submitted to the company – update the submission instead');
  s.status = 'removed';
  s.removedReason = reason;
  await s.save();
  if (reason) await RecruitmentNote.create({ candidate: s.candidate, job: s.job, author: auth.userId, kind: 'system', body: `Removed from shortlist: ${reason}` });
  await recomputeStage(s.candidate, { by: auth.userId, visibleToCandidate: false });
  await audit(actor, 'shortlist.remove', 'Shortlist', s._id, { reason });
  return s.populate(SHORTLIST_POPULATE);
}

export async function reviewShortlist(auth: AuthContext, id: string, decision: 'approve' | 'reject', note: string | undefined, actor: Actor) {
  const s = await Shortlist.findById(id);
  if (!s) throw new NotFoundError('Shortlist entry');
  if (s.status !== 'pending_approval') throw new InvalidStateError('Only shortlists awaiting approval can be reviewed');
  s.status = decision === 'approve' ? 'approved' : 'rejected';
  s.reviewedBy = auth.userId as never;
  s.reviewedAt = new Date();
  s.reviewNote = note;
  await s.save();
  await notify(s.shortlistedBy, {
    type: 'shortlist.reviewed',
    title: decision === 'approve' ? 'Shortlist approved' : 'Shortlist rejected',
    message: decision === 'approve' ? 'The candidate can now be submitted to the company.' : `Reason: ${note ?? 'not specified'}`,
    link: `/recruiter/requirements/${s.job}`,
  });
  if (decision === 'reject') await recomputeStage(s.candidate, { by: auth.userId, visibleToCandidate: false });
  await audit(actor, `shortlist.${decision}`, 'Shortlist', s._id, { note });
  return s.populate(SHORTLIST_POPULATE);
}

// ── Submissions to companies ────────────────────────────────────────────────

const SUBMISSION_POPULATE = [
  { path: 'job', select: 'title slug companyName status locations' },
  { path: 'employer', select: EMPLOYER_SUMMARY },
  { path: 'candidate', select: 'name email mobile' },
  { path: 'candidateProfile', select: 'headline totalExperienceYears careerLevel skills consent stage' },
  { path: 'submittedBy', select: 'name' },
  { path: 'statusHistory.changedBy', select: 'name role' },
];

export async function submitToCompany(auth: AuthContext, input: { shortlistId: string; summary?: string; shareContact?: boolean }, actor: Actor) {
  const s = await Shortlist.findById(input.shortlistId);
  if (!s) throw new NotFoundError('Shortlist entry');
  if (s.status === 'submitted') throw new ConflictError('This candidate has already been submitted for this requirement', 'ALREADY_SUBMITTED');
  if (s.status !== 'approved') throw new InvalidStateError('The shortlist must be approved before submitting the candidate');
  const [job, candidate, employer] = await Promise.all([Job.findById(s.job), Candidate.findById(s.candidateProfile), Employer.findById(s.employer)]);
  if (!job || job.status !== 'published') throw new InvalidStateError('The requirement is no longer open');
  if (!employer || employer.verificationStatus !== 'verified' || employer.deletedAt) throw new InvalidStateError('The company is not verified');
  if (!candidate) throw new NotFoundError('Candidate');
  // DPDP: never share personal data without the candidate's active consent.
  if (!candidate.consent.profileSharing) {
    throw new ConflictError('The candidate has not consented to sharing their profile with companies. Ask them to enable profile sharing first.', 'CONSENT_REQUIRED');
  }
  if (input.shareContact && !candidate.consent.contactSharing) {
    throw new ConflictError('The candidate has not consented to sharing contact details. Submit without contact details or ask for consent.', 'CONTACT_CONSENT_REQUIRED');
  }
  const consent = await Consent.findOne({ candidate: candidate.user, type: 'profile_sharing', granted: true }).sort({ createdAt: -1 });
  if (!consent) throw new ConflictError('No consent record found for this candidate', 'CONSENT_REQUIRED');

  const submission = await withTransaction(async (session) => {
    const [created] = await Submission.create(
      [
        {
          job: job._id,
          employer: employer._id,
          candidate: candidate.user,
          candidateProfile: candidate._id,
          shortlist: s._id,
          resume: candidate.primaryResume,
          submittedBy: auth.userId,
          recruiterSummary: input.summary,
          contactShared: Boolean(input.shareContact),
          consentRecord: consent._id,
          status: 'submitted',
          statusHistory: [{ status: 'submitted', changedBy: auth.userId, byRole: 'staff', visibleToCandidate: true, at: new Date() }],
        },
      ],
      { session },
    );
    s.status = 'submitted';
    await s.save({ session });
    return created!;
  });
  await recomputeStage(candidate.user, { by: auth.userId, note: `Profile submitted to ${employer.companyName} for ${job.title}` });

  const [candUser, owner, settings] = await Promise.all([User.findById(candidate.user).select('name email'), companyOwner(employer._id), getSettings()]);
  if (candUser) {
    await queueEmail(candUser.email, 'profileSubmitted', { name: candUser.name, jobTitle: job.title, companyName: employer.companyName, contactShared: submission.contactShared });
    await notify(candUser._id, { type: 'submission.created', title: 'Profile shared with a company', message: `Veejee Services shared your profile with ${employer.companyName} for ${job.title}.`, link: '/candidate/applications' });
  }
  if (owner) {
    await notify(owner.owner._id, { type: 'submission.new', title: 'New candidate from Veejee Services', message: `${candUser?.name ?? 'A candidate'} was submitted for ${job.title}.`, link: `/employer/candidates/${submission._id}` });
    if (settings.notifications.emailEmployerOnSubmission) {
      await queueEmail(owner.owner.email, 'candidateSubmitted', { name: owner.owner.name, jobTitle: job.title, candidateName: candUser?.name ?? 'A candidate', submissionId: String(submission._id) });
    }
  }
  await audit(actor, 'submission.create', 'Submission', submission._id, { job: String(job._id), contactShared: submission.contactShared, consent: String(consent._id) });
  return submission.populate(SUBMISSION_POPULATE);
}

export async function listSubmissions(q: { status?: SubmissionStatus; jobId?: string; employer?: string; mine?: boolean; page: number; limit: number }, auth: AuthContext) {
  const filter: Record<string, unknown> = {};
  if (q.status) filter.status = q.status;
  if (q.jobId) filter.job = q.jobId;
  if (q.employer) filter.employer = q.employer;
  if (q.mine) filter.submittedBy = auth.userId;
  const [items, total] = await Promise.all([
    Submission.find(filter).sort({ updatedAt: -1 }).skip((q.page - 1) * q.limit).limit(q.limit).populate(SUBMISSION_POPULATE),
    Submission.countDocuments(filter),
  ]);
  return paginated(items, total, q.page, q.limit);
}

export async function getSubmission(id: string) {
  const s = await Submission.findById(id).populate(SUBMISSION_POPULATE);
  if (!s) throw new NotFoundError('Submission');
  const [interviews, feedback] = await Promise.all([
    Interview.find({ submission: s._id }).sort({ scheduledAt: -1 }).populate('scheduledBy', 'name'),
    InterviewFeedback.find({ submission: s._id }).sort({ createdAt: -1 }).populate('givenBy', 'name'),
  ]);
  return { submission: s, interviews, feedback };
}

export async function pushSubmissionStatus(
  s: HydratedDocument<ISubmission>,
  status: SubmissionStatus,
  by: string,
  byRole: 'staff' | 'company',
  note?: string,
  visibleToCandidate = true,
) {
  s.status = status;
  s.statusHistory.push({ status, note, changedBy: by as never, byRole, visibleToCandidate, at: new Date() });
}

/** Emails the candidate about a final outcome. */
export async function announceOutcome(s: HydratedDocument<ISubmission>, status: 'selected' | 'rejected' | 'placed', note?: string) {
  const [user, job, employer, owner] = await Promise.all([User.findById(s.candidate).select('name email'), Job.findById(s.job).select('title'), Employer.findById(s.employer).select('companyName'), companyOwner(s.employer)]);
  if (!user || !job || !employer) return;
  if (status === 'placed') {
    await queueEmail(user.email, 'placement', { name: user.name, jobTitle: job.title, companyName: employer.companyName, joiningDate: s.joiningDate });
    if (owner) await queueEmail(owner.owner.email, 'placement', { name: owner.owner.name, jobTitle: job.title, companyName: employer.companyName, joiningDate: s.joiningDate, forEmployer: true, candidateName: user.name });
  } else {
    await queueEmail(user.email, 'interviewResult', { name: user.name, jobTitle: job.title, companyName: employer.companyName, selected: status === 'selected', note });
  }
}

export async function updateSubmissionStatus(
  auth: AuthContext,
  id: string,
  input: { status: SubmissionStatus; note?: string; visibleToCandidate?: boolean; joiningDate?: Date },
  actor: Actor,
) {
  const s = await Submission.findById(id);
  if (!s) throw new NotFoundError('Submission');
  if (!STAFF_SUBMISSION_TRANSITIONS[s.status].includes(input.status)) throw new InvalidStateError(`Cannot move a submission from "${s.status}" to "${input.status}"`);
  if (input.status === 'placed') {
    s.placedAt = new Date();
    s.joiningDate = input.joiningDate;
    await Job.updateOne({ _id: s.job }, { $inc: { filledCount: 1 } });
  }
  await pushSubmissionStatus(s, input.status, auth.userId, 'staff', input.note, input.visibleToCandidate ?? true);
  await s.save();
  if (['selected', 'rejected', 'withdrawn', 'placed'].includes(input.status)) {
    await Interview.updateMany({ submission: s._id, status: { $in: ['scheduled', 'rescheduled'] }, scheduledAt: { $gt: new Date() } }, { status: 'cancelled', cancelReason: 'Recruitment decision made' });
  }
  if (input.status === 'selected' || input.status === 'rejected' || input.status === 'placed') await announceOutcome(s, input.status, input.visibleToCandidate === false ? undefined : input.note);
  await recomputeStage(s.candidate, { by: auth.userId, note: input.visibleToCandidate === false ? undefined : input.note });
  const owner = await companyOwner(s.employer);
  if (owner) await notify(owner.owner._id, { type: 'submission.status', title: 'Candidate status updated by Veejee Services', message: `Status: ${input.status.replace(/_/g, ' ')}`, link: `/employer/candidates/${s._id}` });
  await audit(actor, 'submission.status', 'Submission', s._id, { status: input.status });
  return getSubmission(id);
}

// ── Interview coordination ──────────────────────────────────────────────────

export interface InterviewInput {
  scheduledAt: Date;
  durationMinutes: number;
  mode: IInterview['mode'];
  location?: string;
  meetingLink?: string;
  notes?: string;
}

function validateInterview(i: InterviewInput) {
  if (i.scheduledAt <= new Date()) throw new ValidationError('Interview must be scheduled in the future', [{ field: 'scheduledAt', message: 'Must be in the future' }]);
  if (i.mode === 'video' && !i.meetingLink) throw new ValidationError('A meeting link is required for video interviews', [{ field: 'meetingLink', message: 'Required' }]);
  if (i.mode === 'in_person' && !i.location) throw new ValidationError('A location is required for in-person interviews', [{ field: 'location', message: 'Required' }]);
}

async function announceInterview(iv: HydratedDocument<IInterview>, rescheduled: boolean) {
  const [user, job, employer, owner] = await Promise.all([User.findById(iv.candidate).select('name email'), Job.findById(iv.job).select('title'), Employer.findById(iv.employer).select('companyName'), companyOwner(iv.employer)]);
  if (!user || !job || !employer) return;
  await notify(user._id, {
    type: rescheduled ? 'interview.rescheduled' : 'interview.scheduled',
    title: rescheduled ? 'Interview rescheduled' : 'Interview scheduled',
    message: `${employer.companyName} – ${job.title}`,
    link: '/candidate/interviews',
  });
  await queueEmail(user.email, 'interviewInvitation', {
    name: user.name,
    jobTitle: job.title,
    companyName: employer.companyName,
    scheduledAt: iv.scheduledAt,
    durationMinutes: iv.durationMinutes,
    mode: iv.mode,
    where: iv.mode === 'video' ? iv.meetingLink : iv.mode === 'in_person' ? iv.location : (iv.location ?? 'Veejee Services will share the call details'),
    rescheduled,
  });
  if (owner) {
    await notify(owner.owner._id, { type: 'interview.scheduled', title: rescheduled ? 'Interview rescheduled' : 'Interview scheduled by Veejee Services', message: `${user.name} – ${job.title}`, link: `/employer/candidates/${iv.submission}` });
  }
}

export async function scheduleInterview(auth: AuthContext, submissionId: string, input: InterviewInput, actor: Actor) {
  validateInterview(input);
  const s = await Submission.findById(submissionId);
  if (!s) throw new NotFoundError('Submission');
  if (!['submitted', 'company_reviewing', 'interview_requested', 'interview_completed', 'on_hold', 'interview_scheduled'].includes(s.status)) {
    throw new InvalidStateError('Interviews can only be scheduled for active submissions');
  }
  const round = (await Interview.countDocuments({ submission: s._id, status: { $ne: 'cancelled' } })) + 1;
  const iv = await withTransaction(async (session) => {
    const [created] = await Interview.create(
      [{ ...input, submission: s._id, job: s.job, employer: s.employer, candidate: s.candidate, scheduledBy: auth.userId, round }],
      { session },
    );
    await pushSubmissionStatus(s, 'interview_scheduled', auth.userId, 'staff', `Round ${round} interview scheduled`);
    await s.save({ session });
    return created!;
  });
  await announceInterview(iv, false);
  await recomputeStage(s.candidate, { by: auth.userId, note: 'Interview scheduled' });
  await audit(actor, 'interview.schedule', 'Interview', iv._id, { submission: submissionId, round });
  return iv.populate([{ path: 'job', select: 'title' }, { path: 'employer', select: 'companyName' }, { path: 'candidate', select: 'name' }]);
}

async function loadInterview(id: string) {
  const iv = await Interview.findById(id);
  if (!iv) throw new NotFoundError('Interview');
  return iv;
}

export async function rescheduleInterview(id: string, input: InterviewInput, actor: Actor) {
  validateInterview(input);
  const iv = await loadInterview(id);
  if (iv.status === 'cancelled' || iv.status === 'completed') throw new InvalidStateError(`A ${iv.status} interview cannot be rescheduled`);
  iv.set({ ...input, status: 'rescheduled', candidateResponse: 'pending', reminderSentAt: undefined });
  await iv.save();
  await announceInterview(iv, true);
  await audit(actor, 'interview.reschedule', 'Interview', iv._id);
  return iv;
}

export async function cancelInterview(auth: AuthContext, id: string, reason: string | undefined, actor: Actor) {
  const iv = await loadInterview(id);
  if (iv.status === 'cancelled' || iv.status === 'completed') throw new InvalidStateError(`This interview is already ${iv.status}`);
  iv.status = 'cancelled';
  iv.cancelReason = reason;
  await iv.save();
  const [user, job, employer] = await Promise.all([User.findById(iv.candidate).select('name email'), Job.findById(iv.job).select('title'), Employer.findById(iv.employer).select('companyName')]);
  if (user && job && employer) {
    await notify(user._id, { type: 'interview.cancelled', title: 'Interview cancelled', message: `${employer.companyName} – ${job.title}`, link: '/candidate/interviews' });
    await queueEmail(user.email, 'interviewCancelled', { name: user.name, jobTitle: job.title, companyName: employer.companyName, reason });
  }
  const s = await Submission.findById(iv.submission);
  if (s && s.status === 'interview_scheduled' && !(await Interview.exists({ submission: s._id, status: { $in: ['scheduled', 'rescheduled'] } }))) {
    await pushSubmissionStatus(s, 'company_reviewing', auth.userId, 'staff', 'Interview cancelled');
    await s.save();
    await recomputeStage(s.candidate, { by: auth.userId, visibleToCandidate: false });
  }
  await audit(actor, 'interview.cancel', 'Interview', iv._id, { reason });
  return iv;
}

export async function completeInterview(auth: AuthContext, id: string, actor: Actor) {
  const iv = await loadInterview(id);
  if (iv.status === 'cancelled') throw new InvalidStateError('A cancelled interview cannot be completed');
  iv.status = 'completed';
  await iv.save();
  const s = await Submission.findById(iv.submission);
  if (s && s.status === 'interview_scheduled') {
    await pushSubmissionStatus(s, 'interview_completed', auth.userId, 'staff');
    await s.save();
    await recomputeStage(s.candidate, { by: auth.userId });
  }
  await audit(actor, 'interview.complete', 'Interview', iv._id);
  return iv;
}

export async function listInterviews(q: { upcoming?: boolean; status?: string; mine?: boolean }, auth: AuthContext) {
  const filter: Record<string, unknown> = {};
  if (q.status) filter.status = q.status;
  if (q.upcoming) filter.scheduledAt = { $gte: new Date() };
  if (q.mine) filter.scheduledBy = auth.userId;
  return Interview.find(filter)
    .sort({ scheduledAt: q.upcoming ? 1 : -1 })
    .limit(300)
    .populate('job', 'title slug')
    .populate('employer', 'companyName')
    .populate('candidate', 'name');
}

// ── Recruiter dashboard ─────────────────────────────────────────────────────

export async function dashboard(auth: AuthContext) {
  const me = auth.userId;
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const [assignedByStage, pendingApplications, pendingApprovals, openSubmissions, interviewRequests, upcomingInterviews, placementsThisMonth, myRequirements, recentApplications] =
    await Promise.all([
      Candidate.aggregate<{ _id: string; count: number }>([{ $match: { assignedRecruiter: auth.user._id } }, { $group: { _id: '$stage', count: { $sum: 1 } } }]),
      Application.countDocuments({ status: { $in: ['applied', 'under_review'] } }),
      Shortlist.countDocuments({ status: 'pending_approval', ...(auth.role === 'recruiter' ? { shortlistedBy: me } : {}) }),
      Submission.countDocuments({ status: { $in: OPEN_SUBMISSION_STATUSES } }),
      Submission.find({ status: 'interview_requested' }).sort({ updatedAt: 1 }).limit(10).populate('job', 'title').populate('employer', 'companyName').populate('candidate', 'name'),
      Interview.find({ scheduledAt: { $gte: new Date() }, status: { $in: ['scheduled', 'rescheduled'] } }).sort({ scheduledAt: 1 }).limit(10).populate('job', 'title').populate('employer', 'companyName').populate('candidate', 'name'),
      Submission.countDocuments({ status: 'placed', placedAt: { $gte: monthStart } }),
      Job.find({ assignedRecruiter: me, status: 'published', deletedAt: null }).select('title companyName openings filledCount applicationsCount').limit(10),
      Application.find({ status: 'applied' }).sort({ createdAt: -1 }).limit(8).populate('job', 'title companyName').populate('candidate', 'name').populate('candidateProfile', 'headline totalExperienceYears'),
    ]);
  return {
    assignedCandidates: { total: assignedByStage.reduce((a, r) => a + r.count, 0), byStage: Object.fromEntries(assignedByStage.map((r) => [r._id, r.count])) },
    pendingApplications,
    pendingApprovals,
    openSubmissions,
    placementsThisMonth,
    interviewRequests,
    upcomingInterviews,
    myRequirements,
    recentApplications,
  };
}

export async function listRecruiters() {
  const rs = await Recruiter.find({ active: true }).populate('user', 'name email');
  return rs.map((r) => ({ id: String(r.user && (r.user as unknown as { _id: unknown })._id), name: (r.user as unknown as { name: string })?.name, designation: r.designation }));
}

export { InterviewFeedback };
