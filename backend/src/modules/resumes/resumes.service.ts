import { LIMITS, OPEN_SUBMISSION_STATUSES } from '../../common/constants';
import { ConflictError, ForbiddenError, NotFoundError } from '../../common/errors';
import { hasPermission, type AuthContext } from '../../middleware/auth';
import { verifyFileSignature } from '../../middleware/upload';
import { Application, Candidate, Resume, Submission } from '../../models';
import { audit, type Actor } from '../../services/activity.service';
import { getCompanyContext, isStaff } from '../../services/company.service';
import { syncProfileStage } from '../../services/pipeline.service';
import { storage } from '../../services/storage/storage.service';

export const listResumes = (userId: string) => Resume.find({ owner: userId, deletedAt: null }).sort({ isPrimary: -1, createdAt: -1 });

async function setCandidatePrimary(userId: string, resumeId: unknown) {
  const c = await Candidate.findOne({ user: userId });
  if (!c) return;
  c.primaryResume = resumeId as never;
  await c.save();
  await syncProfileStage(c);
}

export async function uploadResume(userId: string, file: Express.Multer.File | undefined, actor: Actor) {
  const { ext, mime } = verifyFileSignature(file, 'resume');
  const count = await Resume.countDocuments({ owner: userId, deletedAt: null });
  if (count >= LIMITS.maxResumesPerUser) throw new ConflictError(`You can keep up to ${LIMITS.maxResumesPerUser} resumes. Delete one to upload another.`, 'LIMIT_REACHED');
  const key = await storage.save('resumes', file!.buffer, ext);
  const originalName = file!.originalname.replace(/[^\w.\- ()]/g, '_').slice(0, 150) || 'resume.pdf';
  const resume = await Resume.create({ owner: userId, storageKey: key, originalName, mimeType: mime, size: file!.size, isPrimary: count === 0 });
  if (count === 0) await setCandidatePrimary(userId, resume._id);
  await audit(actor, 'resume.upload', 'Resume', resume._id, { size: file!.size });
  return resume;
}

export async function setPrimary(userId: string, id: string) {
  const resume = await Resume.findOne({ _id: id, owner: userId, deletedAt: null });
  if (!resume) throw new NotFoundError('Resume');
  await Resume.updateMany({ owner: userId }, { isPrimary: false });
  resume.isPrimary = true;
  await resume.save();
  await setCandidatePrimary(userId, resume._id);
  return resume;
}

/** Hard-removes the encrypted file, soft-deletes the record (kept for history). */
export async function removeResumeFile(id: string) {
  const r = await Resume.findById(id).select('+storageKey');
  if (!r) return;
  await storage.remove(r.storageKey);
  r.deletedAt = new Date();
  r.isPrimary = false;
  await r.save();
}

export async function deleteResume(userId: string, id: string, actor: Actor) {
  const resume = await Resume.findOne({ _id: id, owner: userId, deletedAt: null });
  if (!resume) throw new NotFoundError('Resume');
  const inUse =
    (await Application.exists({ resume: resume._id, status: { $in: ['applied', 'under_review', 'shortlisted'] } })) ||
    (await Submission.exists({ resume: resume._id, status: { $in: OPEN_SUBMISSION_STATUSES } }));
  if (inUse) throw new ConflictError('This resume is being used in an active recruitment process and cannot be deleted yet.', 'IN_USE');
  await removeResumeFile(id);
  const c = await Candidate.findOne({ user: userId });
  if (c && String(c.primaryResume) === id) {
    const next = await Resume.findOne({ owner: userId, deletedAt: null }).sort({ createdAt: -1 });
    if (next) await Resume.updateOne({ _id: next._id }, { isPrimary: true });
    await setCandidatePrimary(userId, next?._id);
  }
  await audit(actor, 'resume.delete', 'Resume', id);
}

/**
 * Access: the owner, Veejee Services staff, admins with resumes:manage, or a company that Veejee Services
 * submitted this resume to (with the candidate's consent).
 */
export async function downloadResume(auth: AuthContext, id: string, actor: Actor) {
  const resume = await Resume.findOne({ _id: id, deletedAt: null }).select('+storageKey');
  if (!resume) throw new NotFoundError('Resume');
  let allowed = String(resume.owner) === auth.userId || isStaff(auth) || hasPermission(auth, 'resumes:manage');
  if (!allowed && auth.role === 'employer') {
    const ctx = await getCompanyContext(auth);
    allowed = Boolean(await Submission.exists({ resume: resume._id, employer: ctx.employer._id }));
  }
  if (!allowed) throw new ForbiddenError('You are not authorised to download this resume');
  if (String(resume.owner) !== auth.userId) await audit(actor, 'resume.download', 'Resume', resume._id, { owner: String(resume.owner), role: auth.role });
  return { buffer: await storage.read(resume.storageKey), name: resume.originalName, mime: resume.mimeType };
}
