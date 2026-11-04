import { OAuth2Client } from 'google-auth-library';
import { env } from '../../config/env';
import { AppError, ForbiddenError, ServiceUnavailableError, UnauthenticatedError } from '../../common/errors';
import { User } from '../../models';
import { audit, type Actor } from '../../services/activity.service';
import { createSession, registerCandidate, registerEmployer } from './auth.service';

export interface GoogleProfile {
  sub: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  picture?: string;
}

type Verifier = (credential: string) => Promise<GoogleProfile>;

const client = new OAuth2Client();

/**
 * Verifies a Google Identity Services ID token (signature, audience = our client ID,
 * issuer, expiry) using Google's official library. Never trust client-side claims.
 */
const googleVerifier: Verifier = async (credential) => {
  if (!env.GOOGLE_CLIENT_ID) throw new ServiceUnavailableError('Google sign-in is not configured');
  try {
    const ticket = await client.verifyIdToken({ idToken: credential, audience: env.GOOGLE_CLIENT_ID });
    const p = ticket.getPayload();
    if (!p?.sub || !p.email) throw new Error('Incomplete token');
    return { sub: p.sub, email: p.email.toLowerCase(), emailVerified: Boolean(p.email_verified), name: p.name, picture: p.picture };
  } catch {
    throw new UnauthenticatedError('Google sign-in failed or expired. Please try again.', 'GOOGLE_TOKEN_INVALID');
  }
};

let verifier: Verifier = googleVerifier;
/** Test hook. */
export function setGoogleVerifier(v: Verifier | null) {
  verifier = v ?? googleVerifier;
}

export const providers = () => ({ google: { enabled: Boolean(env.GOOGLE_CLIENT_ID), clientId: env.GOOGLE_CLIENT_ID ?? null } });

export type GoogleSignup =
  | { role: 'candidate'; mobile: string; acceptTerms: true; acceptPrivacy: true; careerLevel?: 'fresher' | 'experienced'; shareProfileConsent?: boolean }
  | { role: 'employer'; mobile: string; acceptTerms: true; acceptPrivacy: true; companyName: string; industryId: string; website?: string };

/**
 * "Continue with Google":
 *  - existing account (by Google ID or verified email) → sign in, linking Google on first use;
 *  - no account and no `signup` → `{ status: 'signup_required', profile }` so the SPA can ask for role, mobile and consent;
 *  - no account with `signup` → create a candidate or company account (email already verified by Google) and sign in.
 * Staff accounts (recruiter/admin) are never created via Google – only existing ones can sign in.
 */
export async function continueWithGoogle(credential: string, signup: GoogleSignup | undefined, actor: Actor) {
  const g = await verifier(credential);
  if (!g.emailVerified) throw new ForbiddenError('Your Google account email is not verified', 'EMAIL_NOT_VERIFIED');

  let user = await User.findOne({ googleId: g.sub, deletedAt: null }).select('+googleId');
  if (!user) user = await User.findOne({ email: g.email, deletedAt: null }).select('+googleId');

  if (user) {
    if (user.status === 'blocked') throw new ForbiddenError('Your account has been blocked. Please contact support.', 'ACCOUNT_BLOCKED');
    if (user.googleId && user.googleId !== g.sub) throw new AppError(409, 'CONFLICT', 'This email is linked to a different Google account');
    const firstLink = !user.googleId;
    user.googleId = g.sub;
    if (!user.emailVerified) {
      user.emailVerified = true; // Google has proven ownership of the address
      user.emailVerifiedAt = new Date();
    }
    if (user.status === 'pending' && user.role === 'recruiter') user.status = 'active'; // invited staff accepting via Google
    user.lastLoginAt = new Date();
    user.failedLoginAttempts = 0;
    user.lockUntil = undefined;
    await user.save();
    if (firstLink) await audit({ ...actor, id: String(user._id), role: user.role }, 'auth.google_linked', 'User', user._id);
    await audit({ ...actor, id: String(user._id), role: user.role }, 'auth.login', 'User', user._id, { via: 'google' });
    return { status: 'signed_in' as const, session: await createSession(user, actor) };
  }

  if (!signup) {
    return { status: 'signup_required' as const, profile: { email: g.email, name: g.name ?? g.email.split('@')[0], picture: g.picture } };
  }

  const base = { name: g.name ?? g.email.split('@')[0]!, email: g.email, mobile: signup.mobile, acceptTerms: true as const, acceptPrivacy: true as const };
  if (signup.role === 'candidate') {
    await registerCandidate({ ...base, careerLevel: signup.careerLevel, shareProfileConsent: signup.shareProfileConsent }, actor, { googleId: g.sub });
  } else {
    await registerEmployer({ ...base, companyName: signup.companyName, industryId: signup.industryId, website: signup.website }, actor, { googleId: g.sub });
  }
  const created = await User.findOne({ email: g.email });
  if (!created) throw new AppError(500, 'INTERNAL_ERROR', 'Account creation failed');
  created.lastLoginAt = new Date();
  await created.save();
  return { status: 'signed_in' as const, session: await createSession(created, actor) };
}
