import { z } from 'zod';
import { CONTENT_KEYS, JOB_STATUSES, PERMISSIONS, ROLES, SUPER_ADMIN, USER_STATUSES } from '../../common/constants';
import { ApiRouter } from '../../common/route';
import { boolQuery, email, idParam, mobile, objectId, pagination, password, requiredText, text } from '../../common/validation';
import { actorFrom } from '../../services/activity.service';
import { getContent } from '../public/public.service';
import * as svc from './admin.service';

const A = ['admin'] as 'admin'[];
const reason = text(500).optional();
const permissions = z.array(z.enum([SUPER_ADMIN, ...PERMISSIONS])).min(1).max(PERMISSIONS.length + 1);
const testimonialBody = z.object({
  name: requiredText(100),
  role: text(100).optional(),
  company: text(100).optional(),
  quote: requiredText(1000, 10),
  rating: z.number().int().min(1).max(5).default(5),
  consentConfirmed: z.boolean(),
  published: z.boolean(),
});
const contentValue = z.unknown().refine((v) => v !== undefined && JSON.stringify(v).length <= 100_000, 'Content is too large (max 100 KB)');
const weight = z.number().int().min(0).max(100);
const settingsBody = z
  .object({
    matchingWeights: z.object({ skills: weight, experience: weight, education: weight, location: weight, salary: weight, noticePeriod: weight }).partial(),
    requireShortlistApproval: z.boolean(),
    reminders: z.object({ profileCompletion: z.boolean(), profileReminderDays: z.number().int().min(1).max(60), interview: z.boolean(), interviewHoursBefore: z.number().int().min(1).max(72) }).partial(),
    notifications: z.object({ emailCandidatesOnStageChange: z.boolean(), emailEmployerOnSubmission: z.boolean() }).partial(),
  })
  .partial();

export const adminRouter = new ApiRouter('Admin', '/admin')
  .route({ method: 'get', path: '/stats', summary: 'Management dashboard statistics', auth: A, handler: () => svc.stats() })
  // Users & administrators
  .route({
    method: 'get',
    path: '/users',
    summary: 'List users',
    auth: A,
    permission: 'users:manage',
    query: pagination.extend({ role: z.enum(ROLES).optional(), status: z.enum(USER_STATUSES).optional(), q: text(100).optional() }),
    handler: ({ query }) => svc.listUsers(query),
  })
  .route({
    method: 'patch',
    path: '/users/:id/status',
    summary: 'Block or unblock a user',
    auth: A,
    permission: 'users:manage',
    params: idParam,
    body: z.object({ status: z.enum(['active', 'blocked']), reason }),
    message: 'User status updated',
    handler: ({ auth, params, body, req }) => svc.setUserStatus(auth, params.id, body.status, body.reason, actorFrom(req)),
  })
  .route({
    method: 'post',
    path: '/users/admins',
    summary: 'Create an administrator',
    auth: A,
    permission: 'admins:manage',
    body: z.object({ name: requiredText(100, 2), email, mobile, password, permissions }),
    status: 201,
    message: 'Administrator created',
    handler: ({ body, req }) => svc.createAdmin(body, actorFrom(req)),
  })
  .route({
    method: 'patch',
    path: '/users/:id/permissions',
    summary: 'Set administrator permissions',
    auth: A,
    permission: 'admins:manage',
    params: idParam,
    body: z.object({ permissions }),
    message: 'Permissions updated',
    handler: ({ auth, params, body, req }) => svc.setPermissions(auth, params.id, body.permissions, actorFrom(req)),
  })
  // Recruitment staff
  .route({
    method: 'get',
    path: '/recruiters',
    summary: 'Recruitment team with workload and placements',
    auth: A,
    permission: 'recruiters:manage',
    query: pagination.extend({ active: boolQuery.optional() }),
    handler: ({ query }) => svc.listRecruiters(query),
  })
  .route({
    method: 'post',
    path: '/recruiters',
    summary: 'Add a recruiter (sends an invitation email)',
    auth: A,
    permission: 'recruiters:manage',
    body: z.object({ name: requiredText(100, 2), email, mobile, designation: text(100).optional(), employeeCode: text(30).optional(), specializations: z.array(objectId).max(12).optional() }),
    status: 201,
    message: 'Recruiter added and invited',
    handler: ({ auth, body, req }) => svc.createRecruiter(auth, body, actorFrom(req)),
  })
  .route({
    method: 'patch',
    path: '/recruiters/:id',
    summary: 'Update or deactivate a recruiter',
    auth: A,
    permission: 'recruiters:manage',
    params: idParam,
    body: z.object({ designation: text(100).optional(), employeeCode: text(30).optional(), specializations: z.array(objectId).max(12).optional(), active: z.boolean().optional() }),
    message: 'Recruiter updated',
    handler: ({ params, body, req }) => svc.updateRecruiter(params.id, body, actorFrom(req)),
  })
  .route({
    method: 'post',
    path: '/recruiters/:id/resend-invite',
    summary: 'Resend the recruiter invitation',
    auth: A,
    permission: 'recruiters:manage',
    params: idParam,
    message: 'Invitation re-sent',
    handler: async ({ params, req }) => {
      await svc.resendRecruiterInvite(params.id, actorFrom(req));
      return null;
    },
  })
  // Companies
  .route({
    method: 'get',
    path: '/employers',
    summary: 'Client companies',
    auth: A,
    permission: 'employers:verify',
    query: pagination.extend({ verificationStatus: z.enum(['pending', 'verified', 'rejected']).optional(), q: text(100).optional() }),
    handler: ({ query }) => svc.listEmployers(query),
  })
  .route({
    method: 'patch',
    path: '/employers/:id/verification',
    summary: 'Verify or reject a company',
    auth: A,
    permission: 'employers:verify',
    params: idParam,
    body: z.object({ status: z.enum(['verified', 'rejected']), reason }),
    message: 'Company verification updated',
    handler: ({ auth, params, body, req }) => svc.verifyEmployer(params.id, body.status, body.reason, auth, actorFrom(req)),
  })
  .route({
    method: 'patch',
    path: '/employers/:id',
    summary: 'Feature a company or set its account manager',
    auth: A,
    permission: 'employers:verify',
    params: idParam,
    body: z.object({ featured: z.boolean().optional(), accountManager: objectId.nullable().optional() }),
    message: 'Company updated',
    handler: ({ params, body, req }) => svc.updateEmployerAdmin(params.id, body, actorFrom(req)),
  })
  // Requirements
  .route({
    method: 'get',
    path: '/jobs',
    summary: 'Recruitment requirements for moderation',
    auth: A,
    permission: 'jobs:moderate',
    query: pagination.extend({ status: z.enum(JOB_STATUSES).optional(), q: text(100).optional() }),
    handler: ({ query }) => svc.listJobs(query),
  })
  .route({
    method: 'patch',
    path: '/jobs/:id/moderation',
    summary: 'Approve or reject a requirement',
    auth: A,
    permission: 'jobs:moderate',
    params: idParam,
    body: z.object({ action: z.enum(['approve', 'reject']), reason }).refine((b) => b.action === 'approve' || (b.reason && b.reason.length >= 5), {
      message: 'Please give the company a reason (at least 5 characters)',
      path: ['reason'],
    }),
    message: 'Requirement moderation recorded',
    handler: ({ auth, params, body, req }) => svc.moderateJob(params.id, body.action, body.reason, auth, actorFrom(req)),
  })
  .route({
    method: 'patch',
    path: '/jobs/:id/featured',
    summary: 'Feature a requirement on the website',
    auth: A,
    permission: 'jobs:moderate',
    params: idParam,
    body: z.object({ featured: z.boolean() }),
    handler: ({ params, body, req }) => svc.setJobFeatured(params.id, body.featured, actorFrom(req)),
  })
  // Resumes, enquiries, email
  .route({
    method: 'get',
    path: '/resumes',
    summary: 'Resumes',
    auth: A,
    permission: 'resumes:manage',
    query: pagination.extend({ q: text(100).optional() }),
    handler: ({ query }) => svc.listResumes(query),
  })
  .route({
    method: 'delete',
    path: '/resumes/:id',
    summary: 'Delete a resume file',
    auth: A,
    permission: 'resumes:manage',
    params: idParam,
    message: 'Resume deleted',
    handler: async ({ params, req }) => {
      await svc.deleteResume(params.id, actorFrom(req));
      return null;
    },
  })
  .route({
    method: 'get',
    path: '/enquiries',
    summary: 'Contact enquiries',
    auth: A,
    permission: 'enquiries:manage',
    query: pagination.extend({ status: z.enum(['new', 'in_progress', 'resolved']).optional() }),
    handler: ({ query }) => svc.listEnquiries(query),
  })
  .route({
    method: 'patch',
    path: '/enquiries/:id',
    summary: 'Update an enquiry',
    auth: A,
    permission: 'enquiries:manage',
    params: idParam,
    body: z.object({ status: z.enum(['new', 'in_progress', 'resolved']).optional(), notes: text(2000).optional() }),
    message: 'Enquiry updated',
    handler: ({ auth, params, body, req }) => svc.updateEnquiry(params.id, body, auth, actorFrom(req)),
  })
  .route({
    method: 'get',
    path: '/emails',
    summary: 'Email outbox',
    auth: A,
    permission: 'emails:manage',
    query: pagination.extend({ status: z.enum(['pending', 'sending', 'sent', 'failed', 'suppressed']).optional() }),
    handler: ({ query }) => svc.listEmails(query),
  })
  .route({
    method: 'post',
    path: '/emails/:id/retry',
    summary: 'Retry a failed email',
    auth: A,
    permission: 'emails:manage',
    params: idParam,
    message: 'Email queued for retry',
    handler: ({ params, req }) => svc.retryEmail(params.id, actorFrom(req)),
  })
  // Content & settings
  .route({
    method: 'get',
    path: '/content/:key',
    summary: 'Read a content block',
    auth: A,
    permission: 'content:manage',
    params: z.object({ key: z.enum(CONTENT_KEYS) }),
    handler: ({ params }) => getContent(params.key),
  })
  .route({
    method: 'put',
    path: '/content/:key',
    summary: 'Replace a content block',
    auth: A,
    permission: 'content:manage',
    params: z.object({ key: z.enum(CONTENT_KEYS) }),
    body: z.object({ value: contentValue }),
    message: 'Content saved',
    handler: ({ auth, params, body, req }) => svc.putContent(params.key, body.value, auth, actorFrom(req)),
  })
  .route({ method: 'get', path: '/testimonials', summary: 'All testimonials', auth: A, permission: 'content:manage', handler: () => svc.listTestimonials() })
  .route({
    method: 'post',
    path: '/testimonials',
    summary: 'Create testimonial',
    auth: A,
    permission: 'content:manage',
    body: testimonialBody,
    status: 201,
    message: 'Testimonial saved',
    handler: ({ body, req }) => svc.saveTestimonial(undefined, body, actorFrom(req)),
  })
  .route({
    method: 'patch',
    path: '/testimonials/:id',
    summary: 'Update testimonial',
    auth: A,
    permission: 'content:manage',
    params: idParam,
    body: testimonialBody.partial(),
    message: 'Testimonial saved',
    handler: ({ params, body, req }) => svc.saveTestimonial(params.id, body, actorFrom(req)),
  })
  .route({
    method: 'delete',
    path: '/testimonials/:id',
    summary: 'Delete testimonial',
    auth: A,
    permission: 'content:manage',
    params: idParam,
    message: 'Testimonial deleted',
    handler: async ({ params, req }) => {
      await svc.deleteTestimonial(params.id, actorFrom(req));
      return null;
    },
  })
  .route({ method: 'get', path: '/settings', summary: 'Platform settings', auth: A, permission: 'settings:manage', handler: () => svc.readSettings() })
  .route({
    method: 'put',
    path: '/settings',
    summary: 'Update matching weights, shortlist approval, reminders and notification settings',
    auth: A,
    permission: 'settings:manage',
    body: settingsBody,
    message: 'Settings saved',
    handler: ({ auth, body, req }) => svc.updateSettings(body, auth, actorFrom(req)),
  })
  // Reports & audit
  .route({
    method: 'get',
    path: '/reports',
    summary: 'Recruitment reports & analytics',
    auth: A,
    permission: 'reports:view',
    query: z.object({
      from: z.coerce.date().default(() => new Date(Date.now() - 30 * 86400_000)),
      to: z.coerce.date().default(() => new Date()),
    }),
    handler: ({ query }) => svc.reports(query.from, query.to),
  })
  .route({
    method: 'get',
    path: '/audit-logs',
    summary: 'Audit trail',
    auth: A,
    permission: 'audit:view',
    query: pagination.extend({ action: text(80).optional(), actor: objectId.optional() }),
    handler: ({ query }) => svc.auditLogs(query),
  });
