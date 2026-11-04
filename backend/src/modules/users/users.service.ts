import { CONSENT_VERSION, OPEN_SUBMISSION_STATUSES, SUPER_ADMIN } from '../../common/constants';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../common/errors';
import { hasPermission, type AuthContext } from '../../middleware/auth';
import { verifyFileSignature } from '../../middleware/upload';
import {
  Application,
  Candidate,
  Consent,
  Employer,
  Interview,
  Job,
  Notification,
  Recruiter,
  RefreshSession,
  Resume,
  Shortlist,
  Submission,
  User,
} from '../../models';
import { audit, type Actor } from '../../services/activity.service';
import { getCompanyContext, isStaff } from '../../services/company.service';
import { queueEmail } from '../../services/email/email.service';
import { storage } from '../../services/storage/storage.service';
import { verifyPassword } from '../auth/auth.service';
import { removeResumeFile } from '../resumes/resumes.service';

export async function updateMe(userId: string, input: { name?: string; mobile?: string }) {
  const user = await User.findByIdAndUpdate(userId, input, { returnDocument: 'after', runValidators: true });
  if (!user) throw new NotFoundError('Account');
  return { user };
}

export async function uploadAvatar(userId: string, file: Express.Multer.File | undefined, actor: Actor) {
  const { ext } = verifyFileSignature(file, 'image');
  const user = await User.findById(userId).select('+avatarKey');
  if (!user) throw new NotFoundError('Account');
  const old = user.avatarKey;
  user.avatarKey = await storage.save('avatars', file!.buffer, ext);
  await user.save();
  await storage.remove(old);
  await audit(actor, 'user.avatar', 'User', user._id);
  return { user };
}

export async function deleteAvatar(userId: string) {
  const user = await User.findById(userId).select('+avatarKey');
  if (!user) throw new NotFoundError('Account');
  await storage.remove(user.avatarKey);
  user.avatarKey = undefined;
  await user.save();
  return { user };
}

export async function getAvatar(auth: AuthContext, userId: string) {
  let allowed = auth.userId === userId || auth.role === 'admin' || isStaff(auth);
  if (!allowed && auth.role === 'employer') {
    const ctx = await getCompanyContext(auth);
    allowed = Boolean(await Submission.exists({ candidate: userId, employer: ctx.employer._id }));
  }
  if (!allowed) throw new ForbiddenError();
  const user = await User.findById(userId).select('+avatarKey');
  if (!user?.avatarKey) throw new NotFoundError('Photo');
  const ext = user.avatarKey.split('.').slice(-2)[0];
  return { buffer: await storage.read(user.avatarKey), mime: ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg' };
}

export async function updateConsent(userId: string, marketingEmails: boolean, actor: Actor) {
  const user = await User.findByIdAndUpdate(userId, { 'consent.marketingEmails': marketingEmails }, { returnDocument: 'after' });
  await audit(actor, 'user.consent', 'User', userId, { marketingEmails });
  return { user };
}

/** DPDP right to access: everything we hold about the user, in a portable format. */
export async function exportData(userId: string) {
  const user = await User.findById(userId);
  if (!user) throw new NotFoundError('Account');
  const [profile, resumes, applications, submissions, interviews, consents, notifications, employer, recruiter] = await Promise.all([
    Candidate.findOne({ user: userId }).select('-assignedRecruiter -lastReviewedAt'),
    Resume.find({ owner: userId, deletedAt: null }),
    Application.find({ candidate: userId }).populate('job', 'title'),
    Submission.find({ candidate: userId }).select('job employer status contactShared createdAt').populate('job', 'title').populate('employer', 'companyName'),
    Interview.find({ candidate: userId }).select('-notes'),
    Consent.find({ candidate: userId }).select('type granted version createdAt'),
    Notification.find({ user: userId }),
    Employer.findOne({ owner: userId }),
    Recruiter.findOne({ user: userId }),
  ]);
  return { exportedAt: new Date().toISOString(), user, profile, resumes, applications, sharedWithCompanies: submissions, interviews, consents, notifications, employer, recruiter };
}

/** DPDP right to erasure: removes files, anonymises identity, keeps only non-personal business records. */
export async function deleteAccount(userId: string, password: string | undefined, actor: Actor, confirm?: string) {
  const user = await User.findById(userId).select('+passwordHash +avatarKey');
  if (!user || user.deletedAt) throw new NotFoundError('Account');
  if (user.passwordHash) {
    if (!password || !(await verifyPassword(user.passwordHash, password))) {
      throw new ValidationError('Password is incorrect', [{ field: 'password', message: 'Incorrect password' }]);
    }
  } else if (confirm !== 'DELETE') {
    // Google-only accounts have no password – require an explicit typed confirmation instead.
    throw new ValidationError('Type DELETE to confirm account deletion', [{ field: 'confirm', message: 'Type DELETE to confirm' }]);
  }
  if (user.role === 'admin' && user.permissions.includes(SUPER_ADMIN)) {
    const others = await User.countDocuments({ role: 'admin', permissions: SUPER_ADMIN, deletedAt: null, _id: { $ne: user._id } });
    if (!others) throw new ConflictError('You are the last super administrator and cannot delete this account', 'LAST_SUPER_ADMIN');
  }
  const { email, name } = user;

  if (user.role === 'candidate') {
    await Application.updateMany(
      { candidate: user._id, status: { $in: ['applied', 'under_review', 'shortlisted'] } },
      { status: 'withdrawn', $push: { statusHistory: { status: 'withdrawn', note: 'Account deleted', changedBy: user._id, at: new Date() } } },
    );
    await Application.updateMany({ candidate: user._id }, { $unset: { coverLetter: 1 } });
    await Submission.updateMany(
      { candidate: user._id, status: { $in: OPEN_SUBMISSION_STATUSES } },
      { status: 'withdrawn', $push: { statusHistory: { status: 'withdrawn', note: 'Candidate account deleted', byRole: 'staff', visibleToCandidate: false, at: new Date() } } },
    );
    await Shortlist.updateMany({ candidate: user._id, status: { $in: ['pending_approval', 'approved'] } }, { status: 'removed', removedReason: 'Account deleted' });
    // Consent is withdrawn as part of erasure; the ledger keeps the (non-identifying) record.
    await Consent.create([
      { candidate: user._id, type: 'profile_sharing', granted: false, version: CONSENT_VERSION },
      { candidate: user._id, type: 'contact_sharing', granted: false, version: CONSENT_VERSION },
    ]);
    await Interview.updateMany({ candidate: user._id, status: { $in: ['scheduled', 'rescheduled'] } }, { status: 'cancelled', cancelReason: 'Candidate account deleted' });
    for (const r of await Resume.find({ owner: user._id, deletedAt: null })) await removeResumeFile(String(r._id));
    await Candidate.deleteOne({ user: user._id });
  }
  if (user.role === 'employer') {
    const employer = await Employer.findOne({ owner: user._id }).select('+logoKey');
    if (employer) {
      await Job.updateMany({ employer: employer._id, status: { $ne: 'closed' } }, { status: 'closed', closedAt: new Date() });
      await storage.remove(employer.logoKey);
      employer.deletedAt = new Date();
      employer.logoKey = undefined;
      await employer.save();
    }
  }
  if (user.role === 'recruiter') await Recruiter.updateOne({ user: user._id }, { active: false });

  await Notification.deleteMany({ user: user._id });
  await RefreshSession.updateMany({ user: user._id, revokedAt: null }, { revokedAt: new Date(), revokedReason: 'account_deleted' });
  await storage.remove(user.avatarKey);

  user.set({
    name: 'Deleted user',
    email: `deleted+${String(user._id)}@deleted.invalid`,
    mobile: '0000000000',
    passwordHash: undefined,
    googleId: undefined,
    avatarKey: undefined,
    permissions: [],
    status: 'blocked',
    deletedAt: new Date(),
  });
  await user.save();
  await queueEmail(email, 'accountDeleted', { name });
  await audit(actor, 'user.delete_account', 'User', user._id);
}

export { hasPermission };
