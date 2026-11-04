import { z } from 'zod';
import { ApiRouter } from '../../common/route';
import { boolQuery, idParam, objectId, requiredText, text } from '../../common/validation';
import { hasPermission } from '../../middleware/auth';
import { actorFrom } from '../../services/activity.service';
import * as svc from './taxonomy.service';

const industryBody = z.object({
  name: requiredText(100, 2),
  description: text(500).optional(),
  icon: z.string().regex(/^[a-z0-9_]{2,40}$/, 'Use a Material Symbols icon name').optional(),
  order: z.number().int().min(0).max(1000).optional(),
  active: z.boolean().optional(),
});
const categoryBody = z.object({ name: requiredText(100, 2), industry: objectId, active: z.boolean().optional() });

export const industriesRouter = new ApiRouter('Industries', '/industries')
  .route({
    method: 'get',
    path: '/',
    summary: 'List industries with published job counts',
    auth: 'optional',
    query: z.object({ all: boolQuery.optional() }),
    handler: ({ query, auth }) => svc.listIndustries(Boolean(query.all) && hasPermission(auth, 'taxonomy:manage')),
  })
  .route({
    method: 'get',
    path: '/:slug',
    summary: 'Industry details with categories',
    auth: 'public',
    params: z.object({ slug: z.string().max(100) }),
    handler: ({ params }) => svc.getIndustry(params.slug),
  })
  .route({
    method: 'post',
    path: '/',
    summary: 'Create industry',
    auth: ['admin'],
    permission: 'taxonomy:manage',
    body: industryBody,
    status: 201,
    message: 'Industry created',
    handler: ({ body, req }) => svc.createIndustry(body, actorFrom(req)),
  })
  .route({
    method: 'patch',
    path: '/:id',
    summary: 'Update industry',
    auth: ['admin'],
    permission: 'taxonomy:manage',
    params: idParam,
    body: industryBody.partial(),
    message: 'Industry updated',
    handler: ({ params, body, req }) => svc.updateIndustry(params.id, body, actorFrom(req)),
  })
  .route({
    method: 'delete',
    path: '/:id',
    summary: 'Delete industry (only when unused)',
    auth: ['admin'],
    permission: 'taxonomy:manage',
    params: idParam,
    message: 'Industry deleted',
    handler: async ({ params, req }) => {
      await svc.deleteIndustry(params.id, actorFrom(req));
      return null;
    },
  });

export const categoriesRouter = new ApiRouter('Categories', '/categories')
  .route({
    method: 'get',
    path: '/',
    summary: 'List job categories',
    auth: 'optional',
    query: z.object({ industry: objectId.optional(), all: boolQuery.optional() }),
    handler: ({ query, auth }) => svc.listCategories(query.industry, Boolean(query.all) && hasPermission(auth, 'taxonomy:manage')),
  })
  .route({
    method: 'post',
    path: '/',
    summary: 'Create category',
    auth: ['admin'],
    permission: 'taxonomy:manage',
    body: categoryBody,
    status: 201,
    message: 'Category created',
    handler: ({ body, req }) => svc.createCategory(body, actorFrom(req)),
  })
  .route({
    method: 'patch',
    path: '/:id',
    summary: 'Update category',
    auth: ['admin'],
    permission: 'taxonomy:manage',
    params: idParam,
    body: categoryBody.partial(),
    message: 'Category updated',
    handler: ({ params, body, req }) => svc.updateCategory(params.id, body, actorFrom(req)),
  })
  .route({
    method: 'delete',
    path: '/:id',
    summary: 'Delete category (only when unused)',
    auth: ['admin'],
    permission: 'taxonomy:manage',
    params: idParam,
    message: 'Category deleted',
    handler: async ({ params, req }) => {
      await svc.deleteCategory(params.id, actorFrom(req));
      return null;
    },
  });
