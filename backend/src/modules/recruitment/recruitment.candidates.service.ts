import { Types } from 'mongoose';
import { LIMITS, RECRUITER_SETTABLE_STAGES, STAGE_LABEL, type CandidateStage } from '../../common/constants';
import { ForbiddenError, NotFoundError, ValidationError } from '../../common/errors';
import { escapeRegex, paginated } from '../../common/http';
import { hasPermission, type AuthContext } from '../../middleware/auth';
import { Application, Candidate, Consent, Interview, RecruitmentNote, Recruiter, Resume, Shortlist, Submission, User, plain } from '../../models';
import { audit, notify, type Actor } from '../../services/activity.service';
import { queueEmail } from '../../services/email/email.service';
import { setStage } from '../../services/pipeline.service';
import { EMPLOYER_SUMMARY } from '../../services/populate';

export interface CandidateSearch {
  q?: string;
  role?: string;
  skills?: string[];
  technicalSkills?: string[];
  softSkills?: string[];
  qualification?: string;
  specialization?: string;
  careerLevel?: 'fresher' | 'experienced';
  expMin?: number;
  expMax?: number;
  currentSalaryMax?: number;
  expectedSalaryMax?: number;
  location?: string;
  workMode?: string;
  noticeMax?: number;
  availability?: string[];
  industry?: string;
  employmentType?: string;
  completionMin?: number;
  hasResume?: boolean;
  consent?: boolean;
  stage?: CandidateStage[];
  assigned?: 'me' | 'unassigned' | string;
  sort: 'recent' | 'experience' | 'completion' | 'relevance';
  page: number;
  limit: number;
}

const rx = (v: string, exact = false) => new RegExp(exact ? `^${escapeRegex(v)}$` : escapeRegex(v), 'i');

/** Builds the MongoDB filter for the recruiter candidate database. */
export async function buildCandidateFilter(s: Omit<CandidateSearch, 'sort' | 'page' | 'limit'>, auth: AuthContext) {
  const and: Record<string, unknown>[] = [];
  const filter: Record<string, unknown> = {};
  // Exclude deleted / blocked accounts.
  const inactive = await User.find({ role: 'candidate', $or: [{ deletedAt: { $ne: null } }, { status: 'blocked' }] }).distinct('_id');
  if (inactive.length) filter.user = { $nin: inactive };
  if (s.q) filter.$text = { $search: s.q };
  if (s.role) and.push({ $or: [{ preferredRoles: rx(s.role) }, { headline: rx(s.role) }, { 'experience.title': rx(s.role) }] });
  for (const sk of s.skills ?? []) and.push({ 'skills.name': rx(sk, true) });
  for (const sk of s.technicalSkills ?? []) and.push({ skills: { $elemMatch: { name: rx(sk, true), type: 'technical' } } });
  for (const sk of s.softSkills ?? []) and.push({ skills: { $elemMatch: { name: rx(sk, true), type: 'non_technical' } } });
  if (s.qualification) and.push({ 'education.qualification': rx(s.qualification) });
  if (s.specialization) and.push({ 'education.specialization': rx(s.specialization) });
  if (s.careerLevel) filter.careerLevel = s.careerLevel;
  if (s.expMin !== undefined || s.expMax !== undefined) {
    filter.totalExperienceYears = { ...(s.expMin !== undefined ? { $gte: s.expMin } : {}), ...(s.expMax !== undefined ? { $lte: s.expMax } : {}) };
  }
  if (s.currentSalaryMax !== undefined) filter.currentSalary = { $lte: s.currentSalaryMax };
  if (s.expectedSalaryMax !== undefined) filter['expectedSalary.min'] = { $lte: s.expectedSalaryMax };
  if (s.location) and.push({ $or: [{ preferredLocations: rx(s.location) }, { 'location.city': rx(s.location) }, { 'location.state': rx(s.location) }, { preferredLocations: /^any(where)?$/i }] });
  if (s.workMode) filter.preferredWorkModes = s.workMode;
  if (s.noticeMax !== undefined) and.push({ $or: [{ noticePeriodDays: { $lte: s.noticeMax } }, { availability: 'immediate' }] });
  if (s.availability?.length) filter.availability = { $in: s.availability };
  if (s.industry) filter.preferredIndustries = s.industry;
  if (s.employmentType) filter.employmentTypes = s.employmentType;
  if (s.completionMin !== undefined) filter.profileCompletion = { $gte: s.completionMin };
  if (s.hasResume !== undefined) filter.primaryResume = s.hasResume ? { $ne: null } : null;
  if (s.consent !== undefined) filter['consent.profileSharing'] = s.consent;
  if (s.stage?.length) filter.stage = { $in: s.stage };
  if (s.assigned === 'me') filter.assignedRecruiter = auth.userId;
  else if (s.assigned === 'unassigned') filter.assignedRecruiter = null;
  else if (s.assigned) filter.assignedRecruiter = s.assigned;
  if (and.length) filter.$and = and;
  return filter;
}

const LIST_FIELDS =
  'user headline location careerLevel totalExperienceYears skills education preferredRoles preferredLocations preferredWorkModes expectedSalary currentSalary noticePeriodDays availability profileCompletion primaryResume consent stage assignedRecruiter updatedAt createdAt';

export async function searchCandidates(auth: AuthContext, s: CandidateSearch) {
  const filter = await buildCandidateFilter(s, auth);
  const sort: Record<string, 1 | -1 | { $meta: 'textScore' }> =
    s.sort === 'experience' ? { totalExperienceYears: -1 } : s.sort === 'completion' ? { profileCompletion: -1 } : s.sort === 'relevance' && s.q ? { score: { $meta: 'textScore' } } : { updatedAt: -1 };
  const [items, total] = await Promise.all([
    Candidate.find(filter, s.q ? { score: { $meta: 'textScore' } } : {})
      .select(LIST_FIELDS)
      .sort(sort)
      .skip((s.page - 1) * s.limit)
      .limit(s.limit)
      .populate('user', 'name email mobile avatarKey')
      .populate('assignedRecruiter', 'name'),
    Candidate.countDocuments(filter),
  ]);
  return paginated(
    items.map((c) => ({ ...plain(c), stageLabel: STAGE_LABEL[c.stage], hasResume: Boolean(c.primaryResume) })),
    total,
    s.page,
    s.limit,
  );
}

async function loadCandidate(id: string) {
  const c = await Candidate.findById(id);
  if (!c) throw new NotFoundError('Candidate');
  return c;
}

/** Full recruiter view of a candidate – profile, resumes, consent, applications, shortlists, submissions, interviews and internal notes. */
export async function getCandidate(id: string) {
  const c = await loadCandidate(id);
  await c.populate([
    { path: 'user', select: 'name email mobile avatarKey createdAt lastLoginAt status' },
    { path: 'assignedRecruiter', select: 'name email' },
    { path: 'preferredIndustries', select: 'name slug' },
    { path: 'stageHistory.changedBy', select: 'name role' },
  ]);
  const userId = c.user && (c.user as unknown as { _id: Types.ObjectId })._id;
  const [resumes, applications, shortlists, submissions, interviews, notes, consentHistory] = await Promise.all([
    Resume.find({ owner: userId, deletedAt: null }).sort({ isPrimary: -1, createdAt: -1 }),
    Application.find({ candidate: userId }).sort({ createdAt: -1 }).populate('job', 'title slug companyName status'),
    Shortlist.find({ candidate: userId }).sort({ createdAt: -1 }).populate('job', 'title slug companyName').populate('shortlistedBy', 'name'),
    Submission.find({ candidate: userId }).sort({ createdAt: -1 }).populate('job', 'title slug').populate('employer', EMPLOYER_SUMMARY).populate('submittedBy', 'name'),
    Interview.find({ candidate: userId }).sort({ scheduledAt: -1 }).populate('job', 'title').populate('employer', 'companyName'),
    RecruitmentNote.find({ candidate: userId }).sort({ createdAt: -1 }).limit(200).populate('author', 'name role').populate('job', 'title'),
    Consent.find({ candidate: userId }).sort({ createdAt: -1 }).limit(20).select('type granted version createdAt'),
  ]);
  return { candidate: { ...plain(c), stageLabel: STAGE_LABEL[c.stage] }, resumes, applications, shortlists, submissions, interviews, notes, consentHistory };
}

export async function compareCandidates(ids: string[]) {
  if (ids.length < 2 || ids.length > LIMITS.compareMax) throw new ValidationError(`Select between 2 and ${LIMITS.compareMax} candidates to compare`);
  const list = await Candidate.find({ _id: { $in: ids } }).select(LIST_FIELDS).populate('user', 'name').populate('preferredIndustries', 'name');
  return list.map((c) => ({ ...plain(c), stageLabel: STAGE_LABEL[c.stage] }));
}

export async function changeStage(auth: AuthContext, id: string, input: { stage: CandidateStage; note?: string; visibleToCandidate?: boolean }, actor: Actor) {
  if (!RECRUITER_SETTABLE_STAGES.includes(input.stage)) {
    throw new ValidationError(`"${STAGE_LABEL[input.stage]}" is set automatically by the shortlist, submission and interview workflow`);
  }
  const c = await loadCandidate(id);
  await setStage(c, input.stage, { by: auth.userId, note: input.note, visibleToCandidate: input.visibleToCandidate ?? false });
  if (input.note && input.visibleToCandidate === false) {
    await RecruitmentNote.create({ candidate: c.user, author: auth.userId, kind: 'system', body: `Stage → ${STAGE_LABEL[input.stage]}: ${input.note}` });
  }
  await audit(actor, 'candidate.stage', 'Candidate', c._id, { stage: input.stage });
  return getCandidate(id);
}

export async function assignCandidate(auth: AuthContext, id: string, recruiterUserId: string | null, actor: Actor) {
  const c = await loadCandidate(id);
  const canAssignAny = hasPermission(auth, 'candidates:assign');
  // Recruiters may claim unassigned candidates for themselves; reassignment needs the admin permission.
  if (!canAssignAny) {
    const claiming = recruiterUserId === auth.userId && !c.assignedRecruiter;
    if (!claiming) throw new ForbiddenError('Only administrators can reassign candidates');
  }
  if (recruiterUserId) {
    const r = await Recruiter.findOne({ user: recruiterUserId, active: true });
    if (!r) throw new ValidationError('Choose an active Veejee Services recruiter', [{ field: 'recruiterId', message: 'Unknown recruiter' }]);
  }
  c.assignedRecruiter = (recruiterUserId ?? undefined) as never;
  c.assignedAt = recruiterUserId ? new Date() : undefined;
  await c.save();
  if (recruiterUserId && recruiterUserId !== auth.userId) {
    await notify(recruiterUserId, { type: 'candidate.assigned', title: 'Candidate assigned to you', message: 'A candidate has been assigned to you for screening.', link: `/recruiter/candidates/${c._id}` });
  }
  await audit(actor, 'candidate.assign', 'Candidate', c._id, { recruiter: recruiterUserId });
  return { id: String(c._id), assignedRecruiter: recruiterUserId };
}

export async function addNote(auth: AuthContext, id: string, body: string, jobId: string | undefined) {
  const c = await loadCandidate(id);
  const note = await RecruitmentNote.create({ candidate: c.user, job: jobId, author: auth.userId, kind: 'note', body });
  return note.populate([{ path: 'author', select: 'name role' }, { path: 'job', select: 'title' }]);
}

export async function deleteNote(auth: AuthContext, noteId: string) {
  const n = await RecruitmentNote.findById(noteId);
  if (!n || n.kind !== 'note') throw new NotFoundError('Note');
  if (String(n.author) !== auth.userId && !hasPermission(auth, 'recruitment:manage')) throw new ForbiddenError('You can only delete your own notes');
  await n.deleteOne();
}

/** Email + in-app message from Veejee Services to the candidate; logged as a communication note. */
export async function contactCandidate(auth: AuthContext, id: string, input: { subject: string; message: string }, actor: Actor) {
  const c = await loadCandidate(id);
  const user = await User.findById(c.user).select('name email');
  if (!user) throw new NotFoundError('Candidate');
  await queueEmail(user.email, 'genericMessage', { name: user.name, subject: input.subject, message: input.message, senderName: auth.user.name });
  await notify(user._id, { type: 'message.ananth', title: input.subject, message: input.message.slice(0, 300), link: '/candidate' });
  await RecruitmentNote.create({ candidate: c.user, author: auth.userId, kind: 'communication', body: `Emailed candidate – ${input.subject}: ${input.message}` });
  await audit(actor, 'candidate.contact', 'Candidate', c._id);
}

/** Applications to Veejee Services awaiting screening. */
export async function listApplications(q: { status?: string; jobId?: string; page: number; limit: number }) {
  const filter: Record<string, unknown> = {};
  if (q.status) filter.status = q.status;
  if (q.jobId) filter.job = q.jobId;
  const [items, total] = await Promise.all([
    Application.find(filter)
      .sort({ createdAt: -1 })
      .skip((q.page - 1) * q.limit)
      .limit(q.limit)
      .populate('job', 'title slug companyName')
      .populate('candidate', 'name email')
      .populate('candidateProfile', 'headline totalExperienceYears careerLevel skills profileCompletion stage consent')
      .populate('resume', 'originalName'),
    Application.countDocuments(filter),
  ]);
  return paginated(items, total, q.page, q.limit);
}

export async function reviewApplication(auth: AuthContext, id: string, status: 'under_review' | 'not_shortlisted', note: string | undefined, actor: Actor) {
  const app = await Application.findById(id);
  if (!app) throw new NotFoundError('Application');
  if (app.status === 'withdrawn' || app.status === 'shortlisted') throw new ValidationError(`This application is already ${app.status.replace('_', ' ')}`);
  app.status = status;
  app.reviewedBy = auth.userId as never;
  app.statusHistory.push({ status, note, changedBy: auth.userId as never, at: new Date() });
  await app.save();
  const c = await Candidate.findOne({ user: app.candidate });
  if (c && status === 'under_review' && ['registered', 'profile_incomplete', 'profile_completed'].includes(c.stage)) {
    await setStage(c, 'under_review', { by: auth.userId, note: 'Your profile is being reviewed by Veejee Services' });
  }
  if (status === 'not_shortlisted') {
    await notify(app.candidate, { type: 'application.update', title: 'Application update', message: 'Veejee Services reviewed your application; you were not shortlisted for this role. We will keep matching you with other opportunities.', link: '/candidate/applications' });
  }
  await audit(actor, 'application.review', 'Application', app._id, { status });
  return app;
}

export async function resumeKeyFor(id: string) {
  return Resume.findById(id).select('+storageKey');
}
