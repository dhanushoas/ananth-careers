import argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import { env } from '../../config/env';
import { CONSENT_VERSION, LIMITS } from '../../common/constants';
import { randomToken, safeEqualHex, sha256, uniqueSlug } from '../../common/crypto';
import { AppError, ConflictError, ForbiddenError, NotFoundError, UnauthenticatedError, ValidationError } from '../../common/errors';
import { signAccessToken } from '../../middleware/auth';
import {
  EmailVerificationToken,
  Employer,
  Industry,
  Candidate,
  Consent,
  PasswordResetToken,
  Recruiter,
  RefreshSession,
  User,
  withTransaction,
  type IUser,
} from '../../models';
import { audit, type Actor } from '../../services/activity.service';
import { queueEmail } from '../../services/email/email.service';
import type { HydratedDocument } from 'mongoose';

const HASH_OPTS = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;
export const hashPassword = (p: string) => argon2.hash(p, HASH_OPTS);
// Used to keep timing constant for unknown emails.
const DUMMY_HASH = hashPassword('dummy-password-for-timing-1');

export async function verifyPassword(hash: string | undefined, password: string) {
  try {
    return await argon2.verify(hash ?? (await DUMMY_HASH), password);
  } catch {
    return false;
  }
}

async function ensureEmailFree(email: string) {
  if (await User.exists({ email })) throw new ConflictError('An account with this email already exists', 'DUPLICATE_RESOURCE');
}

async function issueVerification(user: Pick<IUser, '_id' | 'name' | 'email'>) {
  const token = randomToken();
  await EmailVerificationToken.deleteMany({ user: user._id, usedAt: null });
  await EmailVerificationToken.create({
    user: user._id,
    tokenHash: sha256(token),
    expiresAt: new Date(Date.now() + LIMITS.emailVerificationHours * 3600_000),
  });
  await queueEmail(user.email, 'verifyEmail', { name: user.name, token });
}

type ConsentInput = { acceptTerms: true; acceptPrivacy: true };
/** An identity already verified by an external provider (e.g. Google) – no password, no email verification needed. */
export type ExternalIdentity = { googleId?: string };
const verifiedBy = (identity: ExternalIdentity) =>
  identity.googleId ? { googleId: identity.googleId, emailVerified: true, emailVerifiedAt: new Date() } : {};
const consentFields = () => ({ termsAcceptedAt: new Date(), privacyAcceptedAt: new Date(), marketingEmails: false });

export async function registerCandidate(
  input: { name: string; email: string; mobile: string; password?: string; careerLevel?: 'fresher' | 'experienced'; shareProfileConsent?: boolean } & ConsentInput,
  actor: Actor,
  identity: ExternalIdentity = {},
) {
  await ensureEmailFree(input.email);
  const passwordHash = input.password ? await hashPassword(input.password) : undefined;
  const user = await withTransaction(async (session) => {
    const [u] = await User.create(
      [{ name: input.name, email: input.email, mobile: input.mobile, passwordHash, role: 'candidate', status: 'active', consent: consentFields(), ...verifiedBy(identity) }],
      { session },
    );
    const share = Boolean(input.shareProfileConsent);
    await Candidate.create(
      [
        {
          user: u!._id,
          careerLevel: input.careerLevel ?? 'fresher',
          consent: { profileSharing: share, contactSharing: false, updatedAt: new Date() },
          stage: 'registered',
          stageHistory: [{ stage: 'registered', visibleToCandidate: true, changedBy: u!._id, at: new Date() }],
        },
      ],
      { session },
    );
    if (share) {
      await Consent.create([{ candidate: u!._id, type: 'profile_sharing', granted: true, version: CONSENT_VERSION, ip: actor.ip, userAgent: actor.userAgent }], { session });
    }
    return u!;
  });
  if (!identity.googleId) await issueVerification(user);
  else await queueEmail(user.email, 'registrationConfirmed', { name: user.name, role: 'candidate' });
  await audit({ ...actor, id: String(user._id), role: 'candidate' }, 'auth.register', 'User', user._id, { role: 'candidate', via: identity.googleId ? 'google' : 'password' });
  return { user: user.toJSON() };
}

export async function registerEmployer(
  input: { name: string; email: string; mobile: string; password?: string; companyName: string; industryId: string; website?: string; registrationNumber?: string } & ConsentInput,
  actor: Actor,
  identity: ExternalIdentity = {},
) {
  await ensureEmailFree(input.email);
  if (!(await Industry.exists({ _id: input.industryId, active: true }))) {
    throw new ValidationError('Please choose a valid industry', [{ field: 'industryId', message: 'Unknown industry' }]);
  }
  const passwordHash = input.password ? await hashPassword(input.password) : undefined;
  const { user, employer } = await withTransaction(async (session) => {
    const [u] = await User.create(
      [{ name: input.name, email: input.email, mobile: input.mobile, passwordHash, role: 'employer', status: 'active', consent: consentFields(), ...verifiedBy(identity) }],
      { session },
    );
    const [e] = await Employer.create(
      [
        {
          owner: u!._id,
          companyName: input.companyName,
          slug: uniqueSlug(input.companyName),
          industry: input.industryId,
          website: input.website,
          registrationNumber: input.registrationNumber,
          contactEmail: input.email,
          contactPhone: input.mobile,
        },
      ],
      { session },
    );
    return { user: u!, employer: e! };
  });
  if (!identity.googleId) await issueVerification(user);
  else await queueEmail(user.email, 'registrationConfirmed', { name: user.name, role: 'employer' });
  await audit({ ...actor, id: String(user._id), role: 'employer' }, 'auth.register', 'User', user._id, { role: 'employer', employer: String(employer._id), via: identity.googleId ? 'google' : 'password' });
  return { user: user.toJSON(), employer: employer.toJSON() };
}

async function consumeToken<T extends typeof EmailVerificationToken | typeof PasswordResetToken>(model: T, raw: string, purpose?: 'reset' | 'invite') {
  const filter: Record<string, unknown> = { tokenHash: sha256(raw), usedAt: null, expiresAt: { $gt: new Date() } };
  if (purpose) filter.purpose = purpose;
  const doc = await (model as typeof PasswordResetToken).findOneAndUpdate(filter, { usedAt: new Date() }, { returnDocument: 'after' });
  if (!doc) throw new AppError(400, 'INVALID_TOKEN', 'This link is invalid or has expired. Please request a new one.');
  return doc;
}

export async function verifyEmail(token: string, actor: Actor) {
  const t = await consumeToken(EmailVerificationToken, token);
  const user = await User.findById(t.user);
  if (!user || user.deletedAt) throw new NotFoundError('Account');
  if (!user.emailVerified) {
    user.emailVerified = true;
    user.emailVerifiedAt = new Date();
    await user.save();
    await queueEmail(user.email, 'registrationConfirmed', { name: user.name, role: user.role });
    await audit({ ...actor, id: String(user._id), role: user.role }, 'auth.email_verified', 'User', user._id);
  }
  return { emailVerified: true };
}

export async function resendVerification(email: string) {
  const user = await User.findOne({ email, deletedAt: null });
  // Same response whether or not the account exists (prevents account enumeration).
  if (user && !user.emailVerified && user.status !== 'blocked' && user.role !== 'recruiter') await issueVerification(user);
}

function refreshExpiry() {
  return new Date(Date.now() + env.REFRESH_TTL_DAYS * 24 * 3600_000);
}

export async function createSession(user: HydratedDocument<IUser>, actor: Actor, family: string = randomUUID()) {
  const secret = randomToken(48);
  const session = await RefreshSession.create({
    user: user._id,
    family,
    tokenHash: sha256(secret),
    expiresAt: refreshExpiry(),
    ip: actor.ip,
    userAgent: actor.userAgent,
  });
  const accessToken = signAccessToken({ sub: String(user._id), role: user.role, sid: String(session._id) });
  return {
    session,
    refreshToken: `${String(session._id)}.${secret}`,
    result: { accessToken, expiresIn: env.JWT_ACCESS_TTL_SECONDS, user: user.toJSON() },
  };
}

export async function login(email: string, password: string, actor: Actor) {
  const user = await User.findOne({ email, deletedAt: null }).select('+passwordHash +failedLoginAttempts +lockUntil');
  if (user?.lockUntil && user.lockUntil > new Date()) {
    throw new AppError(423, 'ACCOUNT_LOCKED', `Too many failed attempts. Try again after ${LIMITS.lockMinutes} minutes or reset your password.`);
  }
  const ok = await verifyPassword(user?.passwordHash, password);
  if (!user || !ok || !user.passwordHash) {
    if (user) {
      user.failedLoginAttempts = (user.failedLoginAttempts ?? 0) + 1;
      if (user.failedLoginAttempts >= LIMITS.maxLoginAttempts) {
        user.lockUntil = new Date(Date.now() + LIMITS.lockMinutes * 60_000);
        user.failedLoginAttempts = 0;
        await audit({ ...actor, id: String(user._id), role: user.role }, 'auth.account_locked', 'User', user._id);
      }
      await user.save();
    }
    await audit(actor, 'auth.login_failed', 'User', user?._id, { email });
    throw new UnauthenticatedError('Invalid email or password', 'INVALID_CREDENTIALS');
  }
  if (user.status === 'blocked') throw new ForbiddenError('Your account has been blocked. Please contact support.', 'ACCOUNT_BLOCKED');
  if (!user.emailVerified) throw new ForbiddenError('Please verify your email address before signing in', 'EMAIL_NOT_VERIFIED');

  user.failedLoginAttempts = 0;
  user.lockUntil = undefined;
  user.lastLoginAt = new Date();
  await user.save();
  const s = await createSession(user, actor);
  await audit({ ...actor, id: String(user._id), role: user.role }, 'auth.login', 'User', user._id);
  return s;
}

function parseRefresh(raw: string | undefined) {
  const [id, secret] = (raw ?? '').split('.');
  if (!id || !secret || !/^[a-f0-9]{24}$/.test(id)) throw new UnauthenticatedError('Session expired. Please sign in again.');
  return { id, secret };
}

export async function refresh(raw: string | undefined, actor: Actor) {
  const { id, secret } = parseRefresh(raw);
  const session = await RefreshSession.findById(id);
  if (!session || !safeEqualHex(session.tokenHash, sha256(secret))) throw new UnauthenticatedError('Session expired. Please sign in again.');
  if (session.revokedAt) {
    // A rotated token was presented again – likely theft. Kill the whole family.
    if (session.replacedBy) {
      await RefreshSession.updateMany({ family: session.family, revokedAt: null }, { revokedAt: new Date(), revokedReason: 'reuse_detected' });
      await audit({ ...actor, id: String(session.user) }, 'auth.refresh_reuse_detected', 'RefreshSession', session._id);
    }
    throw new UnauthenticatedError('Session expired. Please sign in again.');
  }
  if (session.expiresAt < new Date()) throw new UnauthenticatedError('Session expired. Please sign in again.');
  const user = await User.findById(session.user);
  if (!user || user.deletedAt || user.status === 'blocked') {
    session.revokedAt = new Date();
    await session.save();
    throw new UnauthenticatedError('Session expired. Please sign in again.');
  }
  const next = await createSession(user, actor, session.family);
  session.revokedAt = new Date();
  session.revokedReason = 'rotated';
  session.replacedBy = next.session._id;
  await session.save();
  return next;
}

export async function logout(raw: string | undefined) {
  try {
    const { id } = parseRefresh(raw);
    await RefreshSession.updateOne({ _id: id, revokedAt: null }, { revokedAt: new Date(), revokedReason: 'logout' });
  } catch {
    /* already logged out */
  }
}

export async function revokeAllSessions(userId: string, reason = 'logout_all') {
  await RefreshSession.updateMany({ user: userId, revokedAt: null }, { revokedAt: new Date(), revokedReason: reason });
}

export async function forgotPassword(email: string, actor: Actor) {
  const user = await User.findOne({ email, deletedAt: null });
  if (!user || user.status === 'blocked') return;
  const token = randomToken();
  await PasswordResetToken.deleteMany({ user: user._id, purpose: 'reset', usedAt: null });
  await PasswordResetToken.create({
    user: user._id,
    purpose: 'reset',
    tokenHash: sha256(token),
    expiresAt: new Date(Date.now() + LIMITS.passwordResetMinutes * 60_000),
  });
  await queueEmail(user.email, 'passwordReset', { name: user.name, token });
  await audit({ ...actor, id: String(user._id), role: user.role }, 'auth.password_reset_requested', 'User', user._id);
}

export async function resetPassword(token: string, password: string, actor: Actor) {
  const t = await consumeToken(PasswordResetToken, token, 'reset');
  const user = await User.findById(t.user);
  if (!user || user.deletedAt) throw new NotFoundError('Account');
  user.passwordHash = await hashPassword(password);
  user.lockUntil = undefined;
  user.failedLoginAttempts = 0;
  // Proving inbox access also proves email ownership.
  if (!user.emailVerified) {
    user.emailVerified = true;
    user.emailVerifiedAt = new Date();
  }
  await user.save();
  await revokeAllSessions(String(user._id), 'password_reset');
  await queueEmail(user.email, 'passwordChanged', { name: user.name });
  await audit({ ...actor, id: String(user._id), role: user.role }, 'auth.password_reset', 'User', user._id);
}

export async function acceptInvite(token: string, password: string, actor: Actor) {
  const t = await consumeToken(PasswordResetToken, token, 'invite');
  const user = await User.findById(t.user);
  if (!user || user.deletedAt || user.role !== 'recruiter') throw new NotFoundError('Invitation');
  user.passwordHash = await hashPassword(password);
  user.emailVerified = true;
  user.emailVerifiedAt = new Date();
  user.status = 'active';
  user.consent = { termsAcceptedAt: new Date(), privacyAcceptedAt: new Date(), marketingEmails: false };
  await user.save();
  await audit({ ...actor, id: String(user._id), role: user.role }, 'auth.invite_accepted', 'User', user._id);
  return { email: user.email };
}

export async function changePassword(userId: string, current: string, next: string, currentSessionId: string, actor: Actor) {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user) throw new NotFoundError('Account');
  if (!user.passwordHash) {
    throw new ValidationError('Your account uses Google sign-in and has no password yet. Use "Forgot password" to set one.', [{ field: 'currentPassword', message: 'No password set' }]);
  }
  if (!(await verifyPassword(user.passwordHash, current))) {
    throw new ValidationError('Current password is incorrect', [{ field: 'currentPassword', message: 'Incorrect password' }]);
  }
  user.passwordHash = await hashPassword(next);
  await user.save();
  // Sign out every other device.
  await RefreshSession.updateMany(
    { user: user._id, revokedAt: null, _id: { $ne: currentSessionId } },
    { revokedAt: new Date(), revokedReason: 'password_changed' },
  );
  await queueEmail(user.email, 'passwordChanged', { name: user.name });
  await audit(actor, 'auth.password_changed', 'User', user._id);
}

export async function getMe(userId: string) {
  const user = await User.findById(userId);
  if (!user) throw new NotFoundError('Account');
  let profile: unknown = null;
  if (user.role === 'candidate') profile = await Candidate.findOne({ user: user._id }).populate('assignedRecruiter', 'name');
  else if (user.role === 'employer') profile = await Employer.findOne({ owner: user._id }).populate('industry', 'name slug');
  else if (user.role === 'recruiter') profile = await Recruiter.findOne({ user: user._id }).populate('specializations', 'name slug');
  return { user: user.toJSON(), profile };
}
