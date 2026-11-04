import { Types } from 'mongoose';
import { CONTENT_KEYS, LIMITS, SUPER_ADMIN } from '../../common/constants';
import { randomToken, sha256 } from '../../common/crypto';
import { ConflictError, ForbiddenError, InvalidStateError, NotFoundError } from '../../common/errors';
import { escapeRegex, paginated } from '../../common/http';
import type { AuthContext } from '../../middleware/auth';
import {
  Application,
  AuditLog,
  Candidate,
  ContactEnquiry,
  EmailOutbox,
  Employer,
  Industry,
  Interview,
  Job,
  PasswordResetToken,
  PlatformSettings,
  Recruiter,
  Resume,
  Shortlist,
  SiteContent,
  Submission,
  Testimonial,
  User,
  getSettings,
  withTransaction,
} from '../../models';
import { audit, notify, type Actor } from '../../services/activity.service';
import { queueEmail } from '../../services/email/email.service';
import { JOB_POPULATE } from '../../services/populate';
import { hashPassword, revokeAllSessions } from '../auth/auth.service';
import { removeResumeFile } from '../resumes/resumes.service';

type Page = { page: number; limit: number };
const skip = (p: Page) => (p.page - 1) * p.limit;

export async function stats() {
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const [
    candidates,
    freshers,
    experienced,
    companies,
    verifiedCompanies,
    pendingCompanies,
    activeRequirements,
    pendingRequirements,
    underReview,
    shortlisted,
    pendingShortlists,
    submitted,
    interviewsScheduled,
    selected,
    placed,
    placedThisMonth,
    recruiters,
    blockedUsers,
    newEnquiries,
    recentAuditLogs,
  ] = await Promise.all([
    Candidate.countDocuments({}),
    Candidate.countDocuments({ careerLevel: 'fresher' }),
    Candidate.countDocuments({ careerLevel: 'experienced' }),
    Employer.countDocuments({ deletedAt: null }),
    Employer.countDocuments({ deletedAt: null, verificationStatus: 'verified' }),
    Employer.countDocuments({ deletedAt: null, verificationStatus: 'pending' }),
    Job.countDocuments({ deletedAt: null, status: 'published' }),
    Job.countDocuments({ deletedAt: null, status: 'pending_approval' }),
    Candidate.countDocuments({ stage: { $in: ['under_review', 'screening'] } }),
    Shortlist.countDocuments({ status: { $in: ['approved', 'pending_approval', 'submitted'] } }),
    Shortlist.countDocuments({ status: 'pending_approval' }),
    Submission.countDocuments({}),
    Interview.countDocuments({ status: { $in: ['scheduled', 'rescheduled'] }, scheduledAt: { $gte: new Date() } }),
    Submission.countDocuments({ status: 'selected' }),
    Submission.countDocuments({ status: 'placed' }),
    Submission.countDocuments({ status: 'placed', placedAt: { $gte: monthStart } }),
    Recruiter.countDocuments({ active: true }),
    User.countDocuments({ status: 'blocked', deletedAt: null }),
    ContactEnquiry.countDocuments({ status: 'new' }),
    AuditLog.find().sort({ createdAt: -1 }).limit(10).populate('actor', 'name email role'),
  ]);
  return {
    candidates: { total: candidates, freshers, experienced, underReview },
    companies: { total: companies, verified: verifiedCompanies, pending: pendingCompanies },
    requirements: { active: activeRequirements, pendingApproval: pendingRequirements },
    pipeline: { shortlisted, pendingShortlists, submitted, interviewsScheduled, selected, placed, placedThisMonth },
    recruiters,
    blockedUsers,
    newEnquiries,
    recentAuditLogs,
  };
}

// ── Users ───────────────────────────────────────────────────────────────────

export async function listUsers(q: Page & { role?: string; status?: string; q?: string }) {
  const filter: Record<string, unknown> = { deletedAt: null };
  if (q.role) filter.role = q.role;
  if (q.status) filter.status = q.status;
  if (q.q) {
    const rx = new RegExp(escapeRegex(q.q), 'i');
    filter.$or = [{ name: rx }, { email: rx }, { mobile: rx }];
  }
  const [items, total] = await Promise.all([User.find(filter).sort({ createdAt: -1 }).skip(skip(q)).limit(q.limit), User.countDocuments(filter)]);
  return paginated(items, total, q.page, q.limit);
}

export async function setUserStatus(auth: AuthContext, id: string, status: 'active' | 'blocked', reason: string | undefined, actor: Actor) {
  if (id === auth.userId) throw new ForbiddenError('You cannot change your own status');
  const user = await User.findOne({ _id: id, deletedAt: null });
  if (!user) throw new NotFoundError('User');
  if (user.role === 'admin' && !auth.permissions.includes(SUPER_ADMIN)) throw new ForbiddenError('Only a super administrator can block administrators');
  user.status = status;
  user.blockedReason = status === 'blocked' ? reason : undefined;
  await user.save();
  if (status === 'blocked') await revokeAllSessions(id, 'blocked');
  await audit(actor, `user.${status === 'blocked' ? 'block' : 'unblock'}`, 'User', id, { reason });
  return user;
}

export async function createAdmin(input: { name: string; email: string; mobile: string; password: string; permissions: string[] }, actor: Actor) {
  if (await User.exists({ email: input.email })) throw new ConflictError('An account with this email already exists', 'DUPLICATE_RESOURCE');
  const user = await User.create({
    ...input,
    passwordHash: await hashPassword(input.password),
    role: 'admin',
    status: 'active',
    emailVerified: true,
    emailVerifiedAt: new Date(),
  });
  await audit(actor, 'admin.create', 'User', user._id, { permissions: input.permissions });
  return user;
}

export async function setPermissions(auth: AuthContext, id: string, permissions: string[], actor: Actor) {
  const user = await User.findOne({ _id: id, role: 'admin', deletedAt: null });
  if (!user) throw new NotFoundError('Administrator');
  if (id === auth.userId && user.permissions.includes(SUPER_ADMIN) && !permissions.includes(SUPER_ADMIN)) throw new ForbiddenError('You cannot remove your own super administrator access');
  user.permissions = permissions;
  await user.save();
  await audit(actor, 'admin.permissions', 'User', id, { permissions });
  return user;
}

// ── Veejee Services recruiters (staff) ───────────────────────────────────────────────

export async function listRecruiters(q: Page & { active?: boolean }) {
  const filter: Record<string, unknown> = {};
  if (q.active !== undefined) filter.active = q.active;
  const [items, total] = await Promise.all([
    Recruiter.find(filter).sort({ createdAt: -1 }).skip(skip(q)).limit(q.limit).populate('user', 'name email mobile status emailVerified lastLoginAt').populate('specializations', 'name'),
    Recruiter.countDocuments(filter),
  ]);
  const ids = items.map((r) => r.user && (r.user as unknown as { _id: unknown })._id);
  const [assigned, placements] = await Promise.all([
    Candidate.aggregate([{ $match: { assignedRecruiter: { $in: ids } } }, { $group: { _id: '$assignedRecruiter', n: { $sum: 1 } } }]),
    Submission.aggregate([{ $match: { submittedBy: { $in: ids }, status: 'placed' } }, { $group: { _id: '$submittedBy', n: { $sum: 1 } } }]),
  ]);
  const m = (rows: { _id: unknown; n: number }[]) => new Map(rows.map((r) => [String(r._id), r.n]));
  const [am, pm] = [m(assigned), m(placements)];
  return paginated(
    items.map((r) => {
      const uid = String((r.user as unknown as { _id: unknown })?._id);
      return { ...r.toJSON(), assignedCandidates: am.get(uid) ?? 0, placements: pm.get(uid) ?? 0 };
    }),
    total,
    q.page,
    q.limit,
  );
}

export async function createRecruiter(
  auth: AuthContext,
  input: { name: string; email: string; mobile: string; designation?: string; employeeCode?: string; specializations?: string[] },
  actor: Actor,
) {
  if (await User.exists({ email: input.email })) throw new ConflictError('An account with this email already exists', 'DUPLICATE_RESOURCE');
  const token = randomToken();
  const recruiter = await withTransaction(async (session) => {
    const [user] = await User.create([{ name: input.name, email: input.email, mobile: input.mobile, role: 'recruiter', status: 'pending', emailVerified: false }], { session });
    const [r] = await Recruiter.create(
      [{ user: user!._id, designation: input.designation, employeeCode: input.employeeCode, specializations: input.specializations ?? [], createdBy: auth.userId }],
      { session },
    );
    await PasswordResetToken.create([{ user: user!._id, purpose: 'invite', tokenHash: sha256(token), expiresAt: new Date(Date.now() + LIMITS.inviteDays * 86400_000) }], { session });
    return r!;
  });
  await queueEmail(input.email, 'staffInvite', { name: input.name, token, designation: input.designation });
  await audit(actor, 'recruiter.create', 'Recruiter', recruiter._id, { email: input.email });
  return recruiter.populate('user', 'name email mobile status');
}

export async function updateRecruiter(id: string, input: { designation?: string; employeeCode?: string; specializations?: string[]; active?: boolean }, actor: Actor) {
  const r = await Recruiter.findById(id);
  if (!r) throw new NotFoundError('Recruiter');
  r.set(input);
  await r.save();
  if (input.active === false) {
    await revokeAllSessions(String(r.user), 'recruiter_deactivated');
    // Unassign their candidates so nothing falls through the cracks.
    await Candidate.updateMany({ assignedRecruiter: r.user }, { $unset: { assignedRecruiter: 1, assignedAt: 1 } });
  }
  await audit(actor, 'recruiter.update', 'Recruiter', r._id, input);
  return r.populate([{ path: 'user', select: 'name email mobile status' }, { path: 'specializations', select: 'name' }]);
}

export async function resendRecruiterInvite(id: string, actor: Actor) {
  const r = await Recruiter.findById(id).populate<{ user: { _id: Types.ObjectId; name: string; email: string; status: string } }>('user', 'name email status');
  if (!r) throw new NotFoundError('Recruiter');
  if (r.user.status !== 'pending') throw new InvalidStateError('This recruiter has already activated their account');
  const token = randomToken();
  await PasswordResetToken.deleteMany({ user: r.user._id, purpose: 'invite' });
  await PasswordResetToken.create({ user: r.user._id, purpose: 'invite', tokenHash: sha256(token), expiresAt: new Date(Date.now() + LIMITS.inviteDays * 86400_000) });
  await queueEmail(r.user.email, 'staffInvite', { name: r.user.name, token, designation: r.designation });
  await audit(actor, 'recruiter.reinvite', 'Recruiter', r._id);
}

// ── Companies ───────────────────────────────────────────────────────────────

export async function listEmployers(q: Page & { verificationStatus?: string; q?: string }) {
  const filter: Record<string, unknown> = { deletedAt: null };
  if (q.verificationStatus) filter.verificationStatus = q.verificationStatus;
  if (q.q) filter.companyName = new RegExp(escapeRegex(q.q), 'i');
  const [items, total] = await Promise.all([
    Employer.find(filter)
      .select('+logoKey')
      .sort({ createdAt: -1 })
      .skip(skip(q))
      .limit(q.limit)
      .populate('industry', 'name')
      .populate('owner', 'name email mobile emailVerified status')
      .populate('accountManager', 'name'),
    Employer.countDocuments(filter),
  ]);
  return paginated(items, total, q.page, q.limit);
}

export async function verifyEmployer(id: string, status: 'verified' | 'rejected', reason: string | undefined, auth: AuthContext, actor: Actor) {
  const e = await Employer.findOne({ _id: id, deletedAt: null }).populate<{ owner: { _id: unknown; name: string; email: string } }>('owner', 'name email');
  if (!e) throw new NotFoundError('Company');
  e.verificationStatus = status;
  e.rejectionReason = status === 'rejected' ? reason : undefined;
  e.verifiedAt = status === 'verified' ? new Date() : undefined;
  e.verifiedBy = auth.userId as never;
  await e.save();
  if (status === 'rejected') await Job.updateMany({ employer: e._id, status: { $in: ['published', 'pending_approval'] } }, { status: 'draft' });
  await notify(e.owner._id as string, {
    type: 'employer.verification',
    title: status === 'verified' ? 'Company verified' : 'Company verification rejected',
    message: status === 'verified' ? `${e.companyName} is now verified by Veejee Services.` : `Verification of ${e.companyName} was rejected${reason ? `: ${reason}` : '.'}`,
    link: '/employer',
  });
  await queueEmail(e.owner.email, 'employerVerification', { name: e.owner.name, companyName: e.companyName, approved: status === 'verified', reason });
  await audit(actor, `employer.${status}`, 'Employer', e._id, { reason });
  return e;
}

export async function updateEmployerAdmin(id: string, input: { featured?: boolean; accountManager?: string | null }, actor: Actor) {
  const e = await Employer.findOne({ _id: id, deletedAt: null });
  if (!e) throw new NotFoundError('Company');
  if (input.featured !== undefined) e.featured = input.featured;
  if (input.accountManager !== undefined) e.accountManager = (input.accountManager ?? undefined) as never;
  await e.save();
  await audit(actor, 'employer.admin_update', 'Employer', id, input);
  return e.populate('accountManager', 'name');
}

// ── Requirements moderation ─────────────────────────────────────────────────

export async function listJobs(q: Page & { status?: string; q?: string }) {
  const filter: Record<string, unknown> = { deletedAt: null };
  if (q.status) filter.status = q.status;
  if (q.q) {
    const rx = new RegExp(escapeRegex(q.q), 'i');
    filter.$or = [{ title: rx }, { companyName: rx }];
  }
  const [items, total] = await Promise.all([
    Job.find(filter).sort({ status: 1, updatedAt: -1 }).skip(skip(q)).limit(q.limit).populate([...JOB_POPULATE, { path: 'assignedRecruiter', select: 'name' }]),
    Job.countDocuments(filter),
  ]);
  return paginated(items, total, q.page, q.limit);
}

export async function moderateJob(id: string, action: 'approve' | 'reject', reason: string | undefined, auth: AuthContext, actor: Actor) {
  const job = await Job.findOne({ _id: id, deletedAt: null });
  if (!job) throw new NotFoundError('Requirement');
  if (job.status !== 'pending_approval') throw new InvalidStateError('Only requirements awaiting approval can be moderated');
  if (action === 'approve') {
    const employer = await Employer.findById(job.employer);
    if (employer?.verificationStatus !== 'verified') throw new InvalidStateError('Verify the company before approving its requirements');
    job.status = 'published';
    job.publishedAt = new Date();
    job.rejectionReason = undefined;
    if (!job.assignedRecruiter && employer.accountManager) job.assignedRecruiter = employer.accountManager;
  } else {
    job.status = 'rejected';
    job.rejectionReason = reason;
  }
  job.moderatedBy = auth.userId as never;
  job.moderatedAt = new Date();
  await job.save();
  const poster = await User.findById(job.postedBy);
  if (poster) {
    await notify(poster._id, {
      type: 'requirement.moderation',
      title: action === 'approve' ? 'Requirement approved' : 'Requirement needs changes',
      message: action === 'approve' ? `"${job.title}" is live. Veejee Services has started sourcing candidates.` : `"${job.title}" was not approved${reason ? `: ${reason}` : '.'}`,
      link: '/employer/requirements',
    });
    await queueEmail(poster.email, 'jobModeration', { name: poster.name, jobTitle: job.title, approved: action === 'approve', reason });
  }
  await audit(actor, `job.${action}`, 'Job', job._id, { reason });
  return job.populate(JOB_POPULATE);
}

export async function setJobFeatured(id: string, featured: boolean, actor: Actor) {
  const job = await Job.findOneAndUpdate({ _id: id, deletedAt: null }, { featured }, { returnDocument: 'after' });
  if (!job) throw new NotFoundError('Requirement');
  await audit(actor, 'job.featured', 'Job', id, { featured });
  return job;
}

// ── Resumes, enquiries, email ───────────────────────────────────────────────

export async function listResumes(q: Page & { q?: string }) {
  const filter: Record<string, unknown> = { deletedAt: null };
  if (q.q) {
    const rx = new RegExp(escapeRegex(q.q), 'i');
    const owners = await User.find({ $or: [{ name: rx }, { email: rx }] }).select('_id').limit(500);
    filter.$or = [{ originalName: rx }, { owner: { $in: owners.map((o) => o._id) } }];
  }
  const [items, total] = await Promise.all([Resume.find(filter).sort({ createdAt: -1 }).skip(skip(q)).limit(q.limit).populate('owner', 'name email'), Resume.countDocuments(filter)]);
  return paginated(items, total, q.page, q.limit);
}

export async function deleteResume(id: string, actor: Actor) {
  if (!(await Resume.exists({ _id: id, deletedAt: null }))) throw new NotFoundError('Resume');
  await removeResumeFile(id);
  await audit(actor, 'resume.admin_delete', 'Resume', id);
}

export async function listEnquiries(q: Page & { status?: string }) {
  const filter: Record<string, unknown> = {};
  if (q.status) filter.status = q.status;
  const [items, total] = await Promise.all([ContactEnquiry.find(filter).sort({ createdAt: -1 }).skip(skip(q)).limit(q.limit).populate('handledBy', 'name'), ContactEnquiry.countDocuments(filter)]);
  return paginated(items, total, q.page, q.limit);
}

export async function updateEnquiry(id: string, input: { status?: 'new' | 'in_progress' | 'resolved'; notes?: string }, auth: AuthContext, actor: Actor) {
  const e = await ContactEnquiry.findByIdAndUpdate(id, { ...input, handledBy: auth.userId }, { returnDocument: 'after' });
  if (!e) throw new NotFoundError('Enquiry');
  await audit(actor, 'enquiry.update', 'ContactEnquiry', id, input);
  return e;
}

export async function listEmails(q: Page & { status?: string }) {
  const filter: Record<string, unknown> = {};
  if (q.status) filter.status = q.status;
  const [items, total] = await Promise.all([EmailOutbox.find(filter).select('-html -text').sort({ createdAt: -1 }).skip(skip(q)).limit(q.limit), EmailOutbox.countDocuments(filter)]);
  return paginated(items, total, q.page, q.limit);
}

export async function retryEmail(id: string, actor: Actor) {
  const e = await EmailOutbox.findOneAndUpdate({ _id: id, status: 'failed' }, { status: 'pending', attempts: 0, nextAttemptAt: new Date() }, { returnDocument: 'after' }).select('-html -text');
  if (!e) throw new InvalidStateError('Only failed emails can be retried');
  await audit(actor, 'email.retry', 'EmailOutbox', id);
  return e;
}

// ── Content & settings ──────────────────────────────────────────────────────

export async function putContent(key: (typeof CONTENT_KEYS)[number], value: unknown, auth: AuthContext, actor: Actor) {
  const doc = await SiteContent.findOneAndUpdate({ key }, { value, updatedBy: auth.userId }, { upsert: true, returnDocument: 'after' });
  await audit(actor, 'content.update', 'SiteContent', key);
  return { key, value: doc.value, updatedAt: doc.updatedAt };
}

export const listTestimonials = () => Testimonial.find().sort({ createdAt: -1 });

export async function saveTestimonial(id: string | undefined, input: Record<string, unknown>, actor: Actor) {
  let doc;
  if (id) {
    doc = await Testimonial.findById(id);
    if (!doc) throw new NotFoundError('Testimonial');
    doc.set(input);
    await doc.save();
  } else doc = await Testimonial.create(input);
  await audit(actor, id ? 'testimonial.update' : 'testimonial.create', 'Testimonial', doc._id);
  return doc;
}

export async function deleteTestimonial(id: string, actor: Actor) {
  if (!(await Testimonial.findByIdAndDelete(id))) throw new NotFoundError('Testimonial');
  await audit(actor, 'testimonial.delete', 'Testimonial', id);
}

export const readSettings = () => getSettings();

export async function updateSettings(input: Record<string, unknown>, auth: AuthContext, actor: Actor) {
  const s = await getSettings();
  const current = s.toObject() as unknown as Record<string, unknown>;
  // Merge nested groups so a partial update never wipes sibling values.
  const merged: Record<string, unknown> = { updatedBy: auth.userId };
  for (const [k, v] of Object.entries(input)) {
    merged[k] = v && typeof v === 'object' && !Array.isArray(v) ? { ...(current[k] as object), ...(v as object) } : v;
  }
  s.set(merged);
  await s.save();
  await audit(actor, 'settings.update', 'PlatformSettings', s._id, input);
  return s;
}

// ── Reports ─────────────────────────────────────────────────────────────────

export async function reports(from: Date, to: Date) {
  const range = { $gte: from, $lte: to };
  const month = (field: string) => ({ $dateToString: { format: '%Y-%m', date: `$${field}`, timezone: 'Asia/Kolkata' } });
  const yearAgo = new Date(new Date().getFullYear(), new Date().getMonth() - 11, 1);
  const [registrations, monthlyCandidates, monthlySubmissions, monthlyPlacements, submissionsByStatus, requirementsByIndustry, placementsByIndustry, recruiterPerformance, careerLevels] =
    await Promise.all([
      User.aggregate([
        { $match: { createdAt: range, role: { $in: ['candidate', 'employer'] } } },
        { $group: { _id: { d: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Kolkata' } }, role: '$role' }, n: { $sum: 1 } } },
        { $group: { _id: '$_id.d', counts: { $push: { k: '$_id.role', v: '$n' } } } },
        { $sort: { _id: 1 } },
      ]),
      Candidate.aggregate([{ $match: { createdAt: { $gte: yearAgo } } }, { $group: { _id: month('createdAt'), n: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
      Submission.aggregate([{ $match: { createdAt: { $gte: yearAgo } } }, { $group: { _id: month('createdAt'), n: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
      Submission.aggregate([{ $match: { placedAt: { $gte: yearAgo } } }, { $group: { _id: month('placedAt'), n: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
      Submission.aggregate([{ $match: { createdAt: range } }, { $group: { _id: '$status', count: { $sum: 1 } } }, { $project: { _id: 0, status: '$_id', count: 1 } }]),
      Job.aggregate([
        { $match: { createdAt: range, deletedAt: null } },
        { $group: { _id: '$industry', count: { $sum: 1 } } },
        { $lookup: { from: Industry.collection.name, localField: '_id', foreignField: '_id', as: 'i' } },
        { $project: { _id: 0, industry: { $ifNull: [{ $first: '$i.name' }, 'Unknown'] }, count: 1 } },
        { $sort: { count: -1 } },
      ]),
      Submission.aggregate([
        { $match: { status: 'placed', placedAt: range } },
        { $lookup: { from: Job.collection.name, localField: 'job', foreignField: '_id', as: 'j' } },
        { $lookup: { from: Industry.collection.name, localField: 'j.industry', foreignField: '_id', as: 'i' } },
        { $group: { _id: { $ifNull: [{ $first: '$i.name' }, 'Unknown'] }, count: { $sum: 1 } } },
        { $project: { _id: 0, industry: '$_id', count: 1 } },
        { $sort: { count: -1 } },
      ]),
      recruiterPerformanceReport(range),
      Candidate.aggregate([{ $group: { _id: '$careerLevel', count: { $sum: 1 } } }]),
    ]);
  const [applied, shortlisted, submitted, interviewed, selected, placed] = await Promise.all([
    Application.countDocuments({ createdAt: range }),
    Shortlist.countDocuments({ createdAt: range, status: { $ne: 'removed' } }),
    Submission.countDocuments({ createdAt: range }),
    Submission.countDocuments({ createdAt: range, 'statusHistory.status': 'interview_scheduled' }),
    Submission.countDocuments({ createdAt: range, 'statusHistory.status': 'selected' }),
    Submission.countDocuments({ createdAt: range, status: 'placed' }),
  ]);
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(yearAgo.getFullYear(), yearAgo.getMonth() + i, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const mm = (rows: { _id: string; n: number }[]) => new Map(rows.map((r) => [r._id, r.n]));
  const [mc, ms, mp] = [mm(monthlyCandidates), mm(monthlySubmissions), mm(monthlyPlacements)];
  return {
    registrations: (registrations as { _id: string; counts: { k: string; v: number }[] }[]).map((r) => ({
      date: r._id,
      candidates: r.counts.find((c) => c.k === 'candidate')?.v ?? 0,
      employers: r.counts.find((c) => c.k === 'employer')?.v ?? 0,
    })),
    monthly: months.map((m) => ({ month: m, candidates: mc.get(m) ?? 0, submissions: ms.get(m) ?? 0, placements: mp.get(m) ?? 0 })),
    funnel: { applied, shortlisted, submitted, interviewed, selected, placed },
    submissionsByStatus,
    requirementsByIndustry,
    placementsByIndustry,
    careerLevels: Object.fromEntries((careerLevels as { _id: string; count: number }[]).map((c) => [c._id, c.count])),
    recruiterPerformance,
  };
}

async function recruiterPerformanceReport(range: { $gte: Date; $lte: Date }) {
  const recruiters = await Recruiter.find().populate<{ user: { _id: unknown; name: string } }>('user', 'name');
  const ids = recruiters.map((r) => r.user?._id);
  const [shortlists, submissions, interviews, placements] = await Promise.all([
    Shortlist.aggregate([{ $match: { shortlistedBy: { $in: ids }, createdAt: range } }, { $group: { _id: '$shortlistedBy', n: { $sum: 1 } } }]),
    Submission.aggregate([{ $match: { submittedBy: { $in: ids }, createdAt: range } }, { $group: { _id: '$submittedBy', n: { $sum: 1 } } }]),
    Interview.aggregate([{ $match: { scheduledBy: { $in: ids }, createdAt: range } }, { $group: { _id: '$scheduledBy', n: { $sum: 1 } } }]),
    Submission.aggregate([{ $match: { submittedBy: { $in: ids }, status: 'placed', placedAt: range } }, { $group: { _id: '$submittedBy', n: { $sum: 1 } } }]),
  ]);
  const m = (rows: { _id: unknown; n: number }[]) => new Map(rows.map((r) => [String(r._id), r.n]));
  const [sl, sb, iv, pl] = [m(shortlists), m(submissions), m(interviews), m(placements)];
  return recruiters
    .map((r) => {
      const id = String(r.user?._id);
      const submitted = sb.get(id) ?? 0;
      const placedN = pl.get(id) ?? 0;
      return {
        recruiterId: id,
        name: r.user?.name ?? 'Unknown',
        active: r.active,
        shortlisted: sl.get(id) ?? 0,
        submitted,
        interviews: iv.get(id) ?? 0,
        placements: placedN,
        conversionRate: submitted ? Math.round((placedN / submitted) * 100) : 0,
      };
    })
    .sort((a, b) => b.placements - a.placements || b.submitted - a.submitted);
}

export async function auditLogs(q: Page & { action?: string; actor?: string }) {
  const filter: Record<string, unknown> = {};
  if (q.action) filter.action = new RegExp(`^${escapeRegex(q.action)}`);
  if (q.actor) filter.actor = q.actor;
  const [items, total] = await Promise.all([AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip(q)).limit(q.limit).populate('actor', 'name email role'), AuditLog.countDocuments(filter)]);
  return paginated(items, total, q.page, q.limit);
}

export { PlatformSettings };
