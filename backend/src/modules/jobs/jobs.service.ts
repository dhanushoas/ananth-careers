import type { HydratedDocument } from 'mongoose';
import { EMPLOYMENT_TYPES, OPEN_SUBMISSION_STATUSES, WORK_MODES, type JobStatus } from '../../common/constants';
import { uniqueSlug } from '../../common/crypto';
import { ConflictError, InvalidStateError, NotFoundError, ValidationError } from '../../common/errors';
import { escapeRegex, paginated } from '../../common/http';
import { hasPermission, type AuthContext } from '../../middleware/auth';
import { Application, Candidate, Industry, Job, JobCategory, Submission, plain, type IJob } from '../../models';
import { audit, type Actor } from '../../services/activity.service';
import { assertCompanyVerified, getCompanyContext, isStaff, type CompanyContext } from '../../services/company.service';
import { isObjectId, JOB_POPULATE, notifyAdmins } from '../../services/populate';

export interface JobInput {
  title: string;
  description: string;
  responsibilities?: string[];
  requirements?: string[];
  skills?: string[];
  qualifications?: string[];
  industry: string;
  category?: string;
  employmentType: (typeof EMPLOYMENT_TYPES)[number];
  workMode: (typeof WORK_MODES)[number];
  locations: { city: string; state?: string; country?: string }[];
  experience: { min: number; max: number };
  salary: { min?: number; max?: number; currency?: string; period?: 'yearly' | 'monthly'; disclosed?: boolean };
  openings?: number;
  applicationDeadline?: Date;
}

export interface JobSearch {
  q?: string;
  location?: string;
  industry?: string;
  category?: string;
  employmentType?: string[];
  workMode?: string[];
  experience?: number;
  salaryMin?: number;
  postedWithin?: number;
  employer?: string;
  featured?: boolean;
  sort: 'relevance' | 'latest' | 'salary_high';
  page: number;
  limit: number;
}

const PUBLIC_HIDDEN = ['rejectionReason', 'moderatedBy', 'moderatedAt', 'assignedRecruiter', 'postedBy', 'filledCount'] as const;

export function toPublic(job: { toJSON(): unknown }) {
  const json = plain(job);
  for (const f of PUBLIC_HIDDEN) delete json[f];
  // Confidential requirements never reveal the client company publicly.
  if (json.confidential) {
    json.companyName = 'Veejee Services client (confidential)';
    json.employer = null;
  }
  return json;
}

export async function resolveIndustryId(value: string) {
  if (isObjectId(value)) return value;
  const i = await Industry.findOne({ slug: value }).select('_id');
  return i ? String(i._id) : undefined;
}

export function openJobFilter(): Record<string, unknown> {
  return { status: 'published', deletedAt: null, $or: [{ applicationDeadline: null }, { applicationDeadline: { $gte: new Date() } }] };
}

export async function searchJobs(s: JobSearch) {
  const filter: Record<string, unknown> = openJobFilter();
  const and: Record<string, unknown>[] = [];
  if (s.q) filter.$text = { $search: s.q };
  if (s.location) {
    const rx = new RegExp(escapeRegex(s.location), 'i');
    and.push({ $or: [{ 'locations.city': rx }, { 'locations.state': rx }] });
  }
  if (s.industry) {
    const id = await resolveIndustryId(s.industry);
    if (!id) return paginated([], 0, s.page, s.limit);
    filter.industry = id;
  }
  if (s.category) filter.category = s.category;
  if (s.employmentType?.length) filter.employmentType = { $in: s.employmentType };
  if (s.workMode?.length) filter.workMode = { $in: s.workMode };
  if (s.experience !== undefined) filter['experience.min'] = { $lte: s.experience };
  if (s.salaryMin !== undefined) and.push({ 'salary.disclosed': true }, { $or: [{ 'salary.max': { $gte: s.salaryMin } }, { 'salary.min': { $gte: s.salaryMin } }] });
  if (s.postedWithin) filter.publishedAt = { $gte: new Date(Date.now() - s.postedWithin * 86400_000) };
  if (s.employer) filter.employer = s.employer;
  if (s.featured) filter.featured = true;
  if (and.length) filter.$and = and;

  let sort: Record<string, 1 | -1 | { $meta: 'textScore' }>;
  if (s.sort === 'salary_high') sort = { 'salary.max': -1, publishedAt: -1 };
  else if (s.sort === 'latest' || !s.q) sort = s.sort === 'latest' ? { publishedAt: -1 } : { featured: -1, publishedAt: -1 };
  else sort = { score: { $meta: 'textScore' }, publishedAt: -1 };

  const projection = s.q ? { score: { $meta: 'textScore' } } : {};
  const [items, total] = await Promise.all([
    Job.find(filter, projection)
      .sort(sort)
      .skip((s.page - 1) * s.limit)
      .limit(s.limit)
      .populate(JOB_POPULATE),
    Job.countDocuments(filter),
  ]);
  return paginated(items.map(toPublic), total, s.page, s.limit);
}

export async function featuredJobs() {
  const jobs = await Job.find(openJobFilter()).sort({ featured: -1, publishedAt: -1 }).limit(8).populate(JOB_POPULATE);
  return jobs.map(toPublic);
}

async function canManage(auth: AuthContext | undefined, job: HydratedDocument<IJob>) {
  if (!auth) return false;
  if (hasPermission(auth, 'jobs:moderate') || isStaff(auth)) return true;
  if (auth.role !== 'employer') return false;
  try {
    const ctx = await getCompanyContext(auth);
    return String(ctx.employer._id) === String(job.employer);
  } catch {
    return false;
  }
}

export async function getJob(idOrSlug: string, auth: AuthContext | undefined) {
  const job = await Job.findOne(isObjectId(idOrSlug) ? { _id: idOrSlug, deletedAt: null } : { slug: idOrSlug, deletedAt: null }).populate(JOB_POPULATE);
  if (!job) throw new NotFoundError('Job');
  const manager = await canManage(auth, job);
  if (job.status !== 'published' && !manager) throw new NotFoundError('Job');
  const result: Record<string, unknown> = manager ? plain(job) : toPublic(job);
  if (job.status === 'published' && !manager) await Job.updateOne({ _id: job._id }, { $inc: { views: 1 } });
  if (auth?.role === 'candidate') {
    const [seeker, applied] = await Promise.all([
      Candidate.findOne({ user: auth.userId }).select('savedJobs'),
      Application.exists({ job: job._id, candidate: auth.userId }),
    ]);
    result.isSaved = Boolean(seeker?.savedJobs.some((j) => String(j) === String(job._id)));
    result.hasApplied = Boolean(applied);
  }
  return result;
}

async function validateTaxonomy(industry: string | undefined, category: string | undefined) {
  if (industry && !(await Industry.exists({ _id: industry, active: true })))
    throw new ValidationError('Please choose a valid industry', [{ field: 'industry', message: 'Unknown industry' }]);
  if (category && !(await JobCategory.exists({ _id: category, industry, active: true })))
    throw new ValidationError('The category does not belong to the selected industry', [{ field: 'category', message: 'Invalid category' }]);
}

function validateRanges(input: Partial<JobInput>) {
  if (input.experience && input.experience.max < input.experience.min)
    throw new ValidationError('Maximum experience must be greater than minimum', [{ field: 'experience.max', message: 'Must be ≥ minimum' }]);
  if (input.salary?.min !== undefined && input.salary?.max !== undefined && input.salary.max < input.salary.min)
    throw new ValidationError('Maximum salary must be greater than minimum', [{ field: 'salary.max', message: 'Must be ≥ minimum' }]);
  if (input.applicationDeadline && input.applicationDeadline < new Date())
    throw new ValidationError('Application deadline must be in the future', [{ field: 'applicationDeadline', message: 'Must be in the future' }]);
}

async function onSubmitted(job: HydratedDocument<IJob>, actor: Actor) {
  await notifyAdmins('jobs:moderate', {
    type: 'job.pending_approval',
    title: 'Job awaiting approval',
    message: `"${job.title}" from ${job.companyName} is awaiting review.`,
    link: '/admin/jobs',
  });
  await audit(actor, 'job.submit', 'Job', job._id);
}

export async function createJob(auth: AuthContext, input: JobInput & { submit?: boolean }, actor: Actor) {
  const ctx = await getCompanyContext(auth);
  if (input.submit) assertCompanyVerified(ctx);
  validateRanges(input);
  await validateTaxonomy(input.industry, input.category);
  const { submit, ...data } = input;
  const job = await Job.create({
    ...data,
    slug: uniqueSlug(`${input.title} ${ctx.employer.companyName}`),
    employer: ctx.employer._id,
    companyName: ctx.employer.companyName,
    postedBy: auth.userId,
    status: submit ? 'pending_approval' : 'draft',
  });
  await audit(actor, 'job.create', 'Job', job._id, { status: job.status });
  if (submit) await onSubmitted(job, actor);
  return (await job.populate(JOB_POPULATE)).toJSON();
}

async function loadOwnedJob(auth: AuthContext, id: string): Promise<{ job: HydratedDocument<IJob>; ctx: CompanyContext }> {
  const ctx = await getCompanyContext(auth);
  const job = await Job.findOne({ _id: id, deletedAt: null });
  if (!job || String(job.employer) !== String(ctx.employer._id)) throw new NotFoundError('Job');
  return { job, ctx };
}

export async function updateJob(auth: AuthContext, id: string, input: Partial<JobInput>, actor: Actor) {
  const { job, ctx } = await loadOwnedJob(auth, id);
  validateRanges(input);
  await validateTaxonomy(input.industry ?? String(job.industry), input.category);
  Object.assign(job, input);
  let resubmitted = false;
  // Material changes to a live or rejected job must be re-moderated.
  if (job.status === 'published' || job.status === 'rejected') {
    if (ctx.employer.verificationStatus === 'verified') {
      job.status = 'pending_approval';
      resubmitted = true;
    } else job.status = 'draft';
    job.rejectionReason = undefined;
  }
  await job.save();
  await audit(actor, 'job.update', 'Job', job._id, { fields: Object.keys(input) });
  if (resubmitted) await onSubmitted(job, actor);
  return (await job.populate(JOB_POPULATE)).toJSON();
}

const TRANSITIONS: Record<'submit' | 'close' | 'reopen', { from: JobStatus[]; to: JobStatus }> = {
  submit: { from: ['draft', 'rejected'], to: 'pending_approval' },
  close: { from: ['published', 'pending_approval'], to: 'closed' },
  reopen: { from: ['closed'], to: 'pending_approval' },
};

export async function transitionJob(auth: AuthContext, id: string, action: keyof typeof TRANSITIONS, actor: Actor) {
  const { job, ctx } = await loadOwnedJob(auth, id);
  const t = TRANSITIONS[action];
  if (!t.from.includes(job.status)) throw new InvalidStateError(`A ${job.status.replace('_', ' ')} job cannot be ${action === 'submit' ? 'submitted' : action + 'd'}`);
  if (t.to === 'pending_approval') assertCompanyVerified(ctx);
  job.status = t.to;
  if (t.to === 'closed') job.closedAt = new Date();
  if (t.to === 'pending_approval') job.rejectionReason = undefined;
  await job.save();
  await audit(actor, `job.${action}`, 'Job', job._id);
  if (t.to === 'pending_approval') await onSubmitted(job, actor);
  return (await job.populate(JOB_POPULATE)).toJSON();
}

export async function deleteJob(auth: AuthContext, id: string, actor: Actor) {
  const { job } = await loadOwnedJob(auth, id);
  if ((await Application.exists({ job: job._id, status: { $in: ['applied', 'under_review', 'shortlisted'] } })) || (await Submission.exists({ job: job._id, status: { $in: OPEN_SUBMISSION_STATUSES } })))
    throw new ConflictError('This job has active applications. Close the job instead of deleting it.', 'IN_USE');
  job.deletedAt = new Date();
  job.status = 'closed';
  await job.save();
  await audit(actor, 'job.delete', 'Job', job._id);
}

export async function myCompanyJobs(auth: AuthContext, q: { status?: JobStatus; q?: string; page: number; limit: number }) {
  const ctx = await getCompanyContext(auth);
  const filter: Record<string, unknown> = { employer: ctx.employer._id, deletedAt: null };
  if (q.status) filter.status = q.status;
  if (q.q) filter.title = new RegExp(escapeRegex(q.q), 'i');
  const [items, total] = await Promise.all([
    Job.find(filter).sort({ updatedAt: -1 }).skip((q.page - 1) * q.limit).limit(q.limit).populate(JOB_POPULATE),
    Job.countDocuments(filter),
  ]);
  return paginated(items, total, q.page, q.limit);
}

export function assertJobOpen(job: IJob | null): asserts job is IJob {
  if (!job || job.deletedAt || job.status !== 'published') throw new NotFoundError('Job');
  if (job.applicationDeadline && job.applicationDeadline < new Date()) throw new InvalidStateError('Applications for this job have closed');
}

