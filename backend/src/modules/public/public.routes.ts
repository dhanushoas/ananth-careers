import { z } from 'zod';
import { CONTENT_KEYS } from '../../common/constants';
import { ApiRouter } from '../../common/route';
import { boolQuery, email, idParam, mobile, pagination, requiredText } from '../../common/validation';
import { contactLimiter } from '../../middleware/security';
import * as svc from './public.service';

export const contactRouter = new ApiRouter('Contact', '/contact').route({
  method: 'post',
  path: '/',
  summary: 'Submit a contact enquiry',
  auth: 'public',
  middleware: [contactLimiter],
  body: z.object({
    name: requiredText(100, 2),
    email,
    phone: mobile.optional().or(z.literal('').transform(() => undefined)),
    subject: requiredText(200, 3),
    message: requiredText(5000, 10),
    enquiryType: z.enum(['candidate', 'employer', 'general']).default('general'),
    consent: z.literal(true, { error: 'Please consent to us processing your enquiry' }),
  }),
  status: 201,
  message: 'Thank you! Your enquiry has been received. We will get back to you shortly.',
  handler: ({ body, req }) => {
    const { consent: _c, ...data } = body;
    return svc.createEnquiry(data, req.ip);
  },
});

export const contentRouter = new ApiRouter('Content', '/content').route({
  method: 'get',
  path: '/:key',
  summary: 'Website content block',
  auth: 'public',
  params: z.object({ key: z.enum(CONTENT_KEYS) }),
  handler: ({ params }) => svc.getContent(params.key),
});

export const testimonialsRouter = new ApiRouter('Content', '/testimonials').route({
  method: 'get',
  path: '/',
  summary: 'Published testimonials (verified consent only)',
  auth: 'public',
  handler: () => svc.publishedTestimonials(),
});

export const statsRouter = new ApiRouter('Content', '/stats').route({
  method: 'get',
  path: '/public',
  summary: 'Public platform statistics',
  auth: 'public',
  handler: () => svc.publicStats(),
});

export const notificationsRouter = new ApiRouter('Notifications', '/notifications')
  .route({
    method: 'get',
    path: '/',
    summary: 'My notifications',
    auth: 'any',
    query: pagination.extend({ unread: boolQuery.optional() }),
    handler: ({ auth, query }) => svc.listNotifications(auth.userId, Boolean(query.unread), query.page, query.limit),
  })
  .route({ method: 'get', path: '/unread-count', summary: 'Unread notification count', auth: 'any', handler: ({ auth }) => svc.unreadCount(auth.userId) })
  .route({
    method: 'patch',
    path: '/read-all',
    summary: 'Mark all notifications read',
    auth: 'any',
    message: 'All notifications marked as read',
    handler: async ({ auth }) => {
      await svc.markAllRead(auth.userId);
      return null;
    },
  })
  .route({ method: 'patch', path: '/:id/read', summary: 'Mark a notification read', auth: 'any', params: idParam, handler: ({ auth, params }) => svc.markRead(auth.userId, params.id) });
