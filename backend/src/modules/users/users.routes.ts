import { z } from 'zod';
import { ApiRouter } from '../../common/route';
import { idParam, mobile, requiredText } from '../../common/validation';
import { actorFrom } from '../../services/activity.service';
import * as svc from './users.service';

export const usersRouter = new ApiRouter('Users', '/users')
  .route({
    method: 'patch',
    path: '/me',
    summary: 'Update my name or mobile',
    auth: 'any',
    body: z.object({ name: requiredText(100, 2).optional(), mobile: mobile.optional() }),
    message: 'Account updated',
    handler: ({ auth, body }) => svc.updateMe(auth.userId, body),
  })
  .route({
    method: 'post',
    path: '/me/avatar',
    summary: 'Upload profile photo (JPEG/PNG/WebP ≤ 2 MB)',
    auth: 'any',
    upload: 'image',
    message: 'Profile photo updated',
    handler: ({ auth, req }) => svc.uploadAvatar(auth.userId, req.file, actorFrom(req)),
  })
  .route({ method: 'delete', path: '/me/avatar', summary: 'Remove profile photo', auth: 'any', message: 'Profile photo removed', handler: ({ auth }) => svc.deleteAvatar(auth.userId) })
  .route({ method: 'get', path: '/me/export', summary: 'Export my personal data (JSON)', auth: 'any', handler: ({ auth }) => svc.exportData(auth.userId) })
  .route({
    method: 'patch',
    path: '/me/consent',
    summary: 'Update marketing consent',
    auth: 'any',
    body: z.object({ marketingEmails: z.boolean() }),
    message: 'Preferences updated',
    handler: ({ auth, body, req }) => svc.updateConsent(auth.userId, body.marketingEmails, actorFrom(req)),
  })
  .route({
    method: 'delete',
    path: '/me',
    summary: 'Delete my account and personal data',
    auth: 'any',
    body: z.object({ password: z.string().min(1).max(128).optional(), confirm: z.literal('DELETE').optional() }),
    message: 'Your account has been deleted',
    handler: async ({ auth, body, req, res }) => {
      await svc.deleteAccount(auth.userId, body.password, actorFrom(req), body.confirm);
      res.clearCookie('ananth_rt', { path: '/api/v1/auth' });
      return null;
    },
  })
  .route({
    method: 'get',
    path: '/:id/avatar',
    summary: 'Profile photo (self, admins, or companies the user applied to)',
    auth: 'any',
    params: idParam,
    raw: true,
    handler: async ({ auth, params, res }) => {
      const f = await svc.getAvatar(auth, params.id);
      res.setHeader('Content-Type', f.mime);
      res.setHeader('Cache-Control', 'private, max-age=300');
      res.end(f.buffer);
    },
  });
