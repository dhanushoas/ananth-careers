import { z } from 'zod';
import { AVAILABILITY, CAREER_LEVELS, EMPLOYMENT_TYPES, WORK_MODES } from '../../common/constants';
import { ApiRouter } from '../../common/route';
import { boolQuery, idParam, objectId, pagination, requiredText, text } from '../../common/validation';
import { actorFrom } from '../../services/activity.service';
import * as svc from './candidates.service';

const year = z.number().int().min(1950).max(2100);
export const profileBody = z
  .object({
    headline: text(150),
    summary: text(3000),
    location: z.object({ city: text(80).optional(), state: text(80).optional(), country: text(80).optional() }),
    dateOfBirth: z.coerce
      .date()
      .refine((d) => d < new Date(Date.now() - 14 * 365.25 * 86400_000), 'You must be at least 14 years old')
      .nullable(),
    gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).nullable(),
    careerLevel: z.enum(CAREER_LEVELS),
    skills: z
      .array(z.object({ name: requiredText(60), type: z.enum(['technical', 'non_technical']), level: z.enum(['beginner', 'intermediate', 'expert']).optional() }))
      .max(60),
    education: z
      .array(
        z.object({
          qualification: requiredText(120),
          specialization: text(120).optional(),
          institution: requiredText(150),
          startYear: year.optional(),
          endYear: year.optional(),
          grade: text(30).optional(),
        }),
      )
      .max(15),
    experience: z
      .array(
        z
          .object({
            title: requiredText(120),
            company: requiredText(150),
            location: text(100).optional(),
            startDate: z.coerce.date(),
            endDate: z.coerce.date().optional().nullable(),
            current: z.boolean().default(false),
            description: text(2000).optional(),
          })
          .refine((e) => e.current || !e.endDate || e.endDate >= e.startDate, { message: 'End date must be after start date', path: ['endDate'] }),
      )
      .max(30),
    totalExperienceYears: z.number().min(0).max(60),
    currentSalary: z.number().min(0).max(1e9).nullable(),
    expectedSalary: z.object({
      min: z.number().min(0).max(1e9).optional(),
      max: z.number().min(0).max(1e9).optional(),
      currency: z.literal('INR').default('INR'),
      period: z.enum(['yearly', 'monthly']).default('yearly'),
    }),
    preferredRoles: z.array(requiredText(80)).max(10),
    preferredLocations: z.array(requiredText(80)).max(10),
    preferredWorkModes: z.array(z.enum(WORK_MODES)).max(3),
    preferredIndustries: z.array(objectId).max(10),
    employmentTypes: z.array(z.enum(EMPLOYMENT_TYPES)).max(6),
    noticePeriodDays: z.number().int().min(0).max(365).nullable(),
    availability: z.enum(AVAILABILITY).nullable(),
    openToWork: z.boolean(),
  })
  .partial();

const jobIdParam = z.object({ jobId: objectId });
const C = ['candidate'] as 'candidate'[];

export const candidatesRouter = new ApiRouter('Candidates', '/candidates')
  .route({ method: 'get', path: '/me', summary: 'My candidate profile', auth: C, handler: ({ auth }) => svc.getProfile(auth.userId) })
  .route({
    method: 'put',
    path: '/me',
    summary: 'Update my profile (personal, education, skills, experience, preferences)',
    auth: C,
    body: profileBody,
    message: 'Profile updated',
    handler: ({ auth, body }) => svc.updateProfile(auth.userId, body as svc.ProfileInput),
  })
  .route({ method: 'get', path: '/me/dashboard', summary: 'Candidate dashboard', auth: C, handler: ({ auth }) => svc.dashboard(auth.userId) })
  .route({ method: 'get', path: '/me/consent', summary: 'My consent settings and history', auth: C, handler: ({ auth }) => svc.getConsent(auth.userId) })
  .route({
    method: 'put',
    path: '/me/consent',
    summary: 'Grant or withdraw consent to share my profile / contact details with companies',
    auth: C,
    body: z.object({ profileSharing: z.boolean().optional(), contactSharing: z.boolean().optional() }),
    message: 'Consent preferences saved',
    handler: ({ auth, body, req }) => svc.updateConsent(auth.userId, body, actorFrom(req)),
  })
  .route({ method: 'get', path: '/me/submissions', summary: 'Companies my profile was shared with, and progress', auth: C, handler: ({ auth }) => svc.mySubmissions(auth.userId) })
  .route({
    method: 'get',
    path: '/me/applications',
    summary: 'My applications to Veejee Services',
    auth: C,
    query: pagination,
    handler: ({ auth, query }) => svc.myApplications(auth.userId, query.page, query.limit),
  })
  .route({
    method: 'post',
    path: '/me/applications',
    summary: 'Apply for a job through Veejee Services',
    auth: C,
    body: z.object({ jobId: objectId, resumeId: objectId.optional(), coverLetter: text(5000).optional() }),
    status: 201,
    message: 'Application submitted. Veejee Services will review your profile.',
    handler: ({ auth, body, req }) => svc.apply(auth, body, actorFrom(req)),
  })
  .route({ method: 'get', path: '/me/applications/:id', summary: 'One of my applications', auth: C, params: idParam, handler: ({ auth, params }) => svc.getApplication(auth.userId, params.id) })
  .route({
    method: 'post',
    path: '/me/applications/:id/withdraw',
    summary: 'Withdraw an application still under Veejee Services review',
    auth: C,
    params: idParam,
    body: z.object({ reason: text(500).optional() }),
    message: 'Application withdrawn',
    handler: ({ auth, params, body, req }) => svc.withdrawApplication(auth, params.id, body.reason, actorFrom(req)),
  })
  .route({
    method: 'get',
    path: '/me/interviews',
    summary: 'My interview schedule',
    auth: C,
    query: z.object({ upcoming: boolQuery.optional() }),
    handler: ({ auth, query }) => svc.myInterviews(auth.userId, Boolean(query.upcoming)),
  })
  .route({
    method: 'post',
    path: '/me/interviews/:id/respond',
    summary: 'Accept or decline an interview',
    auth: C,
    params: idParam,
    body: z.object({ response: z.enum(['accepted', 'declined']), note: text(500).optional() }),
    message: 'Response recorded',
    handler: ({ auth, params, body }) => svc.respondToInterview(auth, params.id, body.response, body.note),
  })
  .route({
    method: 'get',
    path: '/me/saved-jobs',
    summary: 'Saved jobs',
    auth: C,
    query: pagination,
    handler: ({ auth, query }) => svc.savedJobs(auth.userId, query.page, query.limit),
  })
  .route({
    method: 'post',
    path: '/me/saved-jobs/:jobId',
    summary: 'Save a job',
    auth: C,
    params: jobIdParam,
    message: 'Job saved',
    handler: async ({ auth, params }) => {
      await svc.saveJob(auth.userId, params.jobId);
      return { saved: true };
    },
  })
  .route({
    method: 'delete',
    path: '/me/saved-jobs/:jobId',
    summary: 'Remove a saved job',
    auth: C,
    params: jobIdParam,
    message: 'Removed from saved jobs',
    handler: async ({ auth, params }) => {
      await svc.unsaveJob(auth.userId, params.jobId);
      return { saved: false };
    },
  });
