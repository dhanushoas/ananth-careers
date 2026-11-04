import type { Response } from 'express';
import { z } from 'zod';
import { env } from '../../config/env';
import { CAREER_LEVELS, REFRESH_COOKIE, REFRESH_COOKIE_PATH } from '../../common/constants';
import { ApiRouter } from '../../common/route';
import { email, mobile, objectId, password, requiredText, text } from '../../common/validation';
import { authLimiter, requireSameOriginRequest } from '../../middleware/security';
import { actorFrom } from '../../services/activity.service';
import * as svc from './auth.service';
import { continueWithGoogle, providers } from './auth.google';

const consent = {
  acceptTerms: z.literal(true, { error: 'You must accept the Terms & Conditions' }),
  acceptPrivacy: z.literal(true, { error: 'You must accept the Privacy Policy' }),
};
const base = { name: requiredText(100, 2), email, mobile, password };

function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: 'strict',
    path: REFRESH_COOKIE_PATH,
    maxAge: env.REFRESH_TTL_DAYS * 24 * 3600_000,
  });
}
function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE, { httpOnly: true, secure: env.cookieSecure, sameSite: 'strict', path: REFRESH_COOKIE_PATH });
}

const tokenBody = z.object({ token: z.string().min(10).max(200) });

export const authRouter = new ApiRouter('Auth', '/auth')
  .route({ method: 'get', path: '/providers', summary: 'Enabled sign-in providers (Google client ID is public)', auth: 'public', handler: async () => providers() })
  .route({
    method: 'post',
    path: '/google',
    summary: 'Continue with Google (sign in, link, or sign up with a Google ID token)',
    auth: 'public',
    middleware: [authLimiter],
    body: z.object({
      credential: z.string().min(100).max(5000),
      signup: z
        .discriminatedUnion('role', [
          z.object({ role: z.literal('candidate'), mobile, ...consent, careerLevel: z.enum(CAREER_LEVELS).optional(), shareProfileConsent: z.boolean().optional() }),
          z.object({
            role: z.literal('employer'),
            mobile,
            ...consent,
            companyName: requiredText(150, 2),
            industryId: objectId,
            website: z.url().max(200).optional().or(z.literal('').transform(() => undefined)),
          }),
        ])
        .optional(),
    }),
    message: 'Google sign-in processed',
    handler: async ({ body, req, res }) => {
      const r = await continueWithGoogle(body.credential, body.signup, actorFrom(req));
      if (r.status === 'signup_required') return r;
      setRefreshCookie(res, r.session.refreshToken);
      return { status: r.status, ...r.session.result };
    },
  })
  .route({
    method: 'post',
    path: '/register/candidate',
    summary: 'Register a candidate (job seeker) account',
    auth: 'public',
    middleware: [authLimiter],
    body: z.object({ ...base, ...consent, careerLevel: z.enum(CAREER_LEVELS).optional(), shareProfileConsent: z.boolean().optional() }),
    status: 201,
    message: 'Registration successful. Please check your email to verify your account.',
    handler: ({ body, req }) => svc.registerCandidate(body, actorFrom(req)),
  })
  .route({
    method: 'post',
    path: '/register/employer',
    summary: 'Register an employer (company) account',
    auth: 'public',
    middleware: [authLimiter],
    body: z.object({
      ...base,
      ...consent,
      companyName: requiredText(150, 2),
      industryId: objectId,
      website: z.url().max(200).optional().or(z.literal('').transform(() => undefined)),
      registrationNumber: text(50).optional(),
    }),
    status: 201,
    message: 'Registration successful. Please verify your email. Your company will be reviewed by our team.',
    handler: ({ body, req }) => svc.registerEmployer(body, actorFrom(req)),
  })
  .route({
    method: 'post',
    path: '/verify-email',
    summary: 'Verify email address using the emailed token',
    auth: 'public',
    middleware: [authLimiter],
    body: tokenBody,
    message: 'Email verified successfully. You can now sign in.',
    handler: ({ body, req }) => svc.verifyEmail(body.token, actorFrom(req)),
  })
  .route({
    method: 'post',
    path: '/resend-verification',
    summary: 'Resend the verification email',
    auth: 'public',
    middleware: [authLimiter],
    body: z.object({ email }),
    message: 'If an unverified account exists for this email, a new verification link has been sent.',
    handler: async ({ body }) => {
      await svc.resendVerification(body.email);
      return null;
    },
  })
  .route({
    method: 'post',
    path: '/login',
    summary: 'Sign in – returns an access token and sets the refresh cookie',
    auth: 'public',
    middleware: [authLimiter],
    body: z.object({ email, password: z.string().min(1).max(128) }),
    message: 'Signed in successfully',
    handler: async ({ body, req, res }) => {
      const s = await svc.login(body.email, body.password, actorFrom(req));
      setRefreshCookie(res, s.refreshToken);
      return s.result;
    },
  })
  .route({
    method: 'post',
    path: '/refresh',
    summary: 'Rotate the refresh token cookie and obtain a new access token',
    auth: 'public',
    middleware: [requireSameOriginRequest],
    message: 'Session refreshed',
    handler: async ({ req, res }) => {
      try {
        const s = await svc.refresh(req.cookies?.[REFRESH_COOKIE], actorFrom(req));
        setRefreshCookie(res, s.refreshToken);
        return s.result;
      } catch (err) {
        clearRefreshCookie(res);
        throw err;
      }
    },
  })
  .route({
    method: 'post',
    path: '/logout',
    summary: 'Sign out of this device',
    auth: 'public',
    middleware: [requireSameOriginRequest],
    message: 'Signed out',
    handler: async ({ req, res }) => {
      await svc.logout(req.cookies?.[REFRESH_COOKIE]);
      clearRefreshCookie(res);
      return null;
    },
  })
  .route({
    method: 'post',
    path: '/logout-all',
    summary: 'Sign out of all devices',
    auth: 'any',
    message: 'Signed out of all devices',
    handler: async ({ auth, res }) => {
      await svc.revokeAllSessions(auth.userId);
      clearRefreshCookie(res);
      return null;
    },
  })
  .route({
    method: 'post',
    path: '/forgot-password',
    summary: 'Request a password reset email',
    auth: 'public',
    middleware: [authLimiter],
    body: z.object({ email }),
    message: 'If an account exists for this email, a password reset link has been sent.',
    handler: async ({ body, req }) => {
      await svc.forgotPassword(body.email, actorFrom(req));
      return null;
    },
  })
  .route({
    method: 'post',
    path: '/reset-password',
    summary: 'Set a new password using the emailed token',
    auth: 'public',
    middleware: [authLimiter],
    body: tokenBody.extend({ password }),
    message: 'Your password has been reset. Please sign in.',
    handler: async ({ body, req }) => {
      await svc.resetPassword(body.token, body.password, actorFrom(req));
      return null;
    },
  })
  .route({
    method: 'post',
    path: '/accept-invite',
    summary: 'Veejee Services recruiter accepts a staff invitation and sets a password',
    auth: 'public',
    middleware: [authLimiter],
    body: tokenBody.extend({ password }),
    message: 'Invitation accepted. You can now sign in.',
    handler: ({ body, req }) => svc.acceptInvite(body.token, body.password, actorFrom(req)),
  })
  .route({
    method: 'post',
    path: '/change-password',
    summary: 'Change password (signs out other devices)',
    auth: 'any',
    body: z.object({ currentPassword: z.string().min(1).max(128), newPassword: password }),
    message: 'Password changed successfully',
    handler: async ({ body, auth, req }) => {
      await svc.changePassword(auth.userId, body.currentPassword, body.newPassword, auth.sessionId, actorFrom(req));
      return null;
    },
  })
  .route({
    method: 'get',
    path: '/me',
    summary: 'Current user and role profile',
    auth: 'any',
    handler: ({ auth }) => svc.getMe(auth.userId),
  });
