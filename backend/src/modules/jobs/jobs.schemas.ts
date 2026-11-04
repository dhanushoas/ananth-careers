import { z } from 'zod';
import { EMPLOYMENT_TYPES, JOB_STATUSES, WORK_MODES } from '../../common/constants';
import { boolQuery, csvEnum, objectId, pagination, requiredText, text } from '../../common/validation';

const list = (max: number, itemMax = 300) => z.array(requiredText(itemMax)).max(max).optional();

export const jobInput = z.object({
  title: requiredText(150, 3),
  description: requiredText(10000, 30),
  responsibilities: list(30),
  requirements: list(30),
  skills: z.array(requiredText(60)).max(30).optional(),
  qualifications: list(15, 150),
  industry: objectId,
  category: objectId.optional(),
  employmentType: z.enum(EMPLOYMENT_TYPES),
  workMode: z.enum(WORK_MODES),
  locations: z
    .array(z.object({ city: requiredText(80), state: text(80).optional(), country: text(80).optional() }))
    .min(1, 'Add at least one location')
    .max(10),
  experience: z.object({ min: z.number().min(0).max(50), max: z.number().min(0).max(60) }),
  salary: z.object({
    min: z.number().min(0).max(1e9).optional(),
    max: z.number().min(0).max(1e9).optional(),
    currency: z.literal('INR').optional(),
    period: z.enum(['yearly', 'monthly']).optional(),
    disclosed: z.boolean().optional(),
  }),
  openings: z.number().int().min(1).max(10000).optional(),
  applicationDeadline: z.coerce.date().optional(),
  confidential: z.boolean().optional(),
  noticePeriodMaxDays: z.number().int().min(0).max(365).optional(),
});

export const createJobBody = jobInput.extend({ submit: z.boolean().optional() });
export const updateJobBody = jobInput.partial();

export const searchQuery = pagination.extend({
  q: text(100).optional(),
  location: text(80).optional(),
  industry: z.string().max(100).optional(),
  category: objectId.optional(),
  employmentType: csvEnum(EMPLOYMENT_TYPES).optional(),
  workMode: csvEnum(WORK_MODES).optional(),
  experience: z.coerce.number().min(0).max(60).optional(),
  salaryMin: z.coerce.number().min(0).optional(),
  postedWithin: z.coerce.number().int().min(1).max(365).optional(),
  employer: objectId.optional(),
  featured: boolQuery.optional(),
  sort: z.enum(['relevance', 'latest', 'salary_high']).default('relevance'),
});

export const mineQuery = pagination.extend({ status: z.enum(JOB_STATUSES).optional(), q: text(100).optional() });
