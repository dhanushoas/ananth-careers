import { z } from 'zod';
import { COMPANY_SIZES } from '../../common/constants';
import { ApiRouter } from '../../common/route';
import { boolQuery, email, idParam, mobile, objectId, pagination, requiredText, text } from '../../common/validation';
import { actorFrom } from '../../services/activity.service';
import * as svc from './employers.service';

const optionalUrl = z.url().max(200).optional().or(z.literal('').transform(() => undefined));
const E = ['employer'] as 'employer'[];

export const employersRouter = new ApiRouter('Companies', '/employers')
  .route({
    method: 'get',
    path: '/',
    summary: 'Verified client companies',
    auth: 'public',
    query: pagination.extend({ featured: boolQuery.optional(), q: text(100).optional(), industry: objectId.optional() }),
    handler: ({ query }) => svc.listPublic(query),
  })
  .route({ method: 'get', path: '/me', summary: 'My company profile', auth: E, handler: ({ auth }) => svc.getMine(auth) })
  .route({
    method: 'put',
    path: '/me',
    summary: 'Update company profile',
    auth: E,
    body: z.object({
      companyName: requiredText(150, 2),
      industry: objectId,
      website: optionalUrl,
      description: text(5000).optional(),
      size: z.enum(COMPANY_SIZES).optional(),
      foundedYear: z.number().int().min(1800).max(new Date().getFullYear()).optional(),
      headquarters: text(120).optional(),
      address: text(500).optional(),
      registrationNumber: text(50).optional(),
      contactPerson: text(100).optional(),
      contactEmail: email.optional(),
      contactPhone: mobile.optional(),
    }),
    message: 'Company profile updated',
    handler: ({ auth, body, req }) => svc.updateMine(auth, body as never, actorFrom(req)),
  })
  .route({
    method: 'post',
    path: '/me/logo',
    summary: 'Upload company logo',
    auth: E,
    upload: 'image',
    message: 'Logo updated',
    handler: ({ auth, req }) => svc.uploadLogo(auth, req.file, actorFrom(req)),
  })
  .route({
    method: 'get',
    path: '/:id/logo',
    summary: 'Company logo image',
    auth: 'public',
    params: idParam,
    raw: true,
    handler: async ({ params, res }) => {
      const f = await svc.getLogo(params.id);
      res.setHeader('Content-Type', f.mime);
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.end(f.buffer);
    },
  })
  .route({
    method: 'get',
    path: '/:slug',
    summary: 'Public company profile with open requirements',
    auth: 'public',
    params: z.object({ slug: z.string().max(120) }),
    handler: ({ params }) => svc.getPublic(params.slug),
  });
