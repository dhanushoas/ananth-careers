import { ApiRouter } from '../../common/route';
import { idParam } from '../../common/validation';
import { actorFrom } from '../../services/activity.service';
import * as svc from './resumes.service';

export const resumesRouter = new ApiRouter('Resumes', '/resumes')
  .route({ method: 'get', path: '/', summary: 'My resumes', auth: ['candidate'], handler: ({ auth }) => svc.listResumes(auth.userId) })
  .route({
    method: 'post',
    path: '/',
    summary: 'Upload a PDF resume (≤ 5 MB, stored encrypted)',
    auth: ['candidate'],
    upload: 'resume',
    status: 201,
    message: 'Resume uploaded',
    handler: ({ auth, req }) => svc.uploadResume(auth.userId, req.file, actorFrom(req)),
  })
  .route({
    method: 'patch',
    path: '/:id/primary',
    summary: 'Set primary resume',
    auth: ['candidate'],
    params: idParam,
    message: 'Primary resume updated',
    handler: ({ auth, params }) => svc.setPrimary(auth.userId, params.id),
  })
  .route({
    method: 'delete',
    path: '/:id',
    summary: 'Delete a resume',
    auth: ['candidate'],
    params: idParam,
    message: 'Resume deleted',
    handler: async ({ auth, params, req }) => {
      await svc.deleteResume(auth.userId, params.id, actorFrom(req));
      return null;
    },
  })
  .route({
    method: 'get',
    path: '/:id/download',
    summary: 'Download a resume (authorised parties only)',
    auth: 'any',
    params: idParam,
    raw: true,
    handler: async ({ auth, params, req, res }) => {
      const f = await svc.downloadResume(auth, params.id, actorFrom(req));
      res.setHeader('Content-Type', f.mime);
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(f.name)}"`);
      res.setHeader('Cache-Control', 'private, no-store');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.end(f.buffer);
    },
  });
