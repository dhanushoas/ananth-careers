import { z } from 'zod';
import { ApiRouter } from '../../common/route';
import { idParam } from '../../common/validation';
import { actorFrom } from '../../services/activity.service';
import { createJobBody, mineQuery, searchQuery, updateJobBody } from './jobs.schemas';
import * as svc from './jobs.service';

const company = ['employer'] as 'employer'[];

export const jobsRouter = new ApiRouter('Jobs', '/jobs')
  .route({ method: 'get', path: '/', summary: 'Search open job opportunities', auth: 'public', query: searchQuery, handler: ({ query }) => svc.searchJobs(query) })
  .route({ method: 'get', path: '/featured', summary: 'Featured & latest jobs', auth: 'public', handler: () => svc.featuredJobs() })
  .route({ method: 'get', path: '/mine', summary: "Company's jobs (any status)", auth: company, query: mineQuery, handler: ({ auth, query }) => svc.myCompanyJobs(auth, query) })
  .route({
    method: 'get',
    path: '/:idOrSlug',
    summary: 'Job details',
    auth: 'optional',
    params: z.object({ idOrSlug: z.string().min(1).max(120) }),
    handler: ({ params, auth }) => svc.getJob(params.idOrSlug, auth),
  })
  .route({
    method: 'post',
    path: '/',
    summary: 'Create a recruitment requirement (draft or submit for Veejee Services approval)',
    auth: company,
    body: createJobBody,
    status: 201,
    message: 'Job saved',
    handler: ({ auth, body, req }) => svc.createJob(auth, body, actorFrom(req)),
  })
  .route({
    method: 'patch',
    path: '/:id',
    summary: 'Edit a job (published/rejected jobs return to moderation)',
    auth: company,
    params: idParam,
    body: updateJobBody,
    message: 'Job updated',
    handler: ({ auth, params, body, req }) => svc.updateJob(auth, params.id, body, actorFrom(req)),
  })
  .route({
    method: 'post',
    path: '/:id/submit',
    summary: 'Submit a draft/rejected job for approval',
    auth: company,
    params: idParam,
    message: 'Job submitted for approval',
    handler: ({ auth, params, req }) => svc.transitionJob(auth, params.id, 'submit', actorFrom(req)),
  })
  .route({
    method: 'post',
    path: '/:id/close',
    summary: 'Close (deactivate) a job',
    auth: company,
    params: idParam,
    message: 'Job closed',
    handler: ({ auth, params, req }) => svc.transitionJob(auth, params.id, 'close', actorFrom(req)),
  })
  .route({
    method: 'post',
    path: '/:id/reopen',
    summary: 'Reopen a closed job (requires re-approval)',
    auth: company,
    params: idParam,
    message: 'Job submitted for approval',
    handler: ({ auth, params, req }) => svc.transitionJob(auth, params.id, 'reopen', actorFrom(req)),
  })
  .route({
    method: 'delete',
    path: '/:id',
    summary: 'Delete a job without active applications',
    auth: company,
    params: idParam,
    message: 'Job deleted',
    handler: async ({ auth, params, req }) => {
      await svc.deleteJob(auth, params.id, actorFrom(req));
      return null;
    },
  });
