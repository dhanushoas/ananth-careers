import { Types } from 'mongoose';
import { NotFoundError, ValidationError } from '../../common/errors';
import { escapeRegex, paginated } from '../../common/http';
import type { AuthContext } from '../../middleware/auth';
import { verifyFileSignature } from '../../middleware/upload';
import { Employer, Industry, Job, type IEmployer } from '../../models';
import { audit, type Actor } from '../../services/activity.service';
import { getCompanyContext } from '../../services/company.service';
import { JOB_POPULATE, notifyAdmins } from '../../services/populate';
import { storage } from '../../services/storage/storage.service';
import { openJobFilter } from '../jobs/jobs.service';

const PUBLIC_FIELDS = 'companyName slug industry website description size foundedYear headquarters logoKey verificationStatus featured createdAt';

export async function listPublic(q: { featured?: boolean; q?: string; industry?: string; page: number; limit: number }) {
  const filter: Record<string, unknown> = { verificationStatus: 'verified', deletedAt: null };
  if (q.featured) filter.featured = true;
  if (q.industry) filter.industry = q.industry;
  if (q.q) filter.companyName = new RegExp(escapeRegex(q.q), 'i');
  const [items, total] = await Promise.all([
    Employer.find(filter).select(PUBLIC_FIELDS).sort({ featured: -1, companyName: 1 }).skip((q.page - 1) * q.limit).limit(q.limit).populate('industry', 'name slug'),
    Employer.countDocuments(filter),
  ]);
  const counts = await Job.aggregate<{ _id: Types.ObjectId; count: number }>([
    { $match: { ...openJobFilter(), confidential: { $ne: true }, employer: { $in: items.map((i) => i._id) } } },
    { $group: { _id: '$employer', count: { $sum: 1 } } },
  ]);
  const map = new Map(counts.map((c) => [String(c._id), c.count]));
  return paginated(items.map((e) => ({ ...e.toJSON(), openJobs: map.get(String(e._id)) ?? 0 })), total, q.page, q.limit);
}

export async function getPublic(slug: string) {
  const employer = await Employer.findOne({ slug, verificationStatus: 'verified', deletedAt: null }).select(PUBLIC_FIELDS).populate('industry', 'name slug');
  if (!employer) throw new NotFoundError('Company');
  const jobs = await Job.find({ ...openJobFilter(), employer: employer._id, confidential: { $ne: true } }).sort({ publishedAt: -1 }).limit(50).populate(JOB_POPULATE);
  return { employer, jobs };
}

export async function getLogo(id: string) {
  const e = await Employer.findOne({ _id: id, deletedAt: null }).select('+logoKey');
  if (!e?.logoKey) throw new NotFoundError('Logo');
  const ext = e.logoKey.split('.').slice(-2)[0];
  return { buffer: await storage.read(e.logoKey), mime: ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg' };
}

export async function getMine(auth: AuthContext) {
  const ctx = await getCompanyContext(auth);
  const e = await Employer.findById(ctx.employer._id).select('+logoKey').populate('industry', 'name slug');
  return e;
}

export async function updateMine(auth: AuthContext, input: Partial<IEmployer> & { industry?: string }, actor: Actor) {
  const ctx = await getCompanyContext(auth);
  if (input.industry && !(await Industry.exists({ _id: input.industry, active: true })))
    throw new ValidationError('Please choose a valid industry', [{ field: 'industry', message: 'Unknown industry' }]);
  const e = ctx.employer;
  const identityChanged = (input.companyName && input.companyName !== e.companyName) || (input.registrationNumber && input.registrationNumber !== e.registrationNumber);
  e.set(input);
  // Changing legal identity of a verified/rejected company requires re-verification.
  if (identityChanged && e.verificationStatus !== 'pending') {
    e.verificationStatus = 'pending';
    e.rejectionReason = undefined;
    await notifyAdmins('employers:verify', { type: 'employer.pending', title: 'Company re-verification', message: `${e.companyName} updated its legal details.`, link: '/admin/employers' });
  }
  await e.save();
  if (input.companyName) await Job.updateMany({ employer: e._id }, { companyName: e.companyName });
  await audit(actor, 'employer.update', 'Employer', e._id, { fields: Object.keys(input) });
  return getMine(auth);
}

export async function uploadLogo(auth: AuthContext, file: Express.Multer.File | undefined, actor: Actor) {
  const ctx = await getCompanyContext(auth);
  const { ext } = verifyFileSignature(file, 'image');
  const e = await Employer.findById(ctx.employer._id).select('+logoKey');
  const old = e!.logoKey;
  e!.logoKey = await storage.save('logos', file!.buffer, ext);
  await e!.save();
  await storage.remove(old);
  await audit(actor, 'employer.logo', 'Employer', e!._id);
  return { hasLogo: true };
}
