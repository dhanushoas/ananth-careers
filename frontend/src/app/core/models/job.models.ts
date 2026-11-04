import { PageQuery } from './api.models';
import { RefSummary } from './taxonomy.models';

export const EMPLOYMENT_TYPES = ['full_time', 'part_time', 'contract', 'internship', 'temporary', 'freelance'] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

export const WORK_MODES = ['onsite', 'remote', 'hybrid'] as const;
export type WorkMode = (typeof WORK_MODES)[number];

export const JOB_STATUSES = ['draft', 'pending_approval', 'published', 'rejected', 'closed'] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export type SalaryPeriod = 'yearly' | 'monthly';

export interface JobLocation {
  city: string;
  state?: string;
  country: string;
}

export interface Salary {
  min?: number | null;
  max?: number | null;
  currency: 'INR';
  period: SalaryPeriod;
  disclosed: boolean;
}

export interface ExperienceRange {
  min: number;
  max: number;
}

export interface JobEmployerSummary {
  id: string;
  companyName: string;
  slug: string;
  hasLogo: boolean;
  verificationStatus?: 'pending' | 'verified' | 'rejected';
}

export interface Job {
  id: string;
  slug: string;
  title: string;
  description: string;
  responsibilities: string[];
  requirements: string[];
  skills: string[];
  qualifications: string[];
  industry: RefSummary;
  category?: RefSummary | null;
  /** null for confidential requirements on public endpoints. */
  employer: JobEmployerSummary | null;
  employmentType: EmploymentType;
  workMode: WorkMode;
  locations: JobLocation[];
  experience: ExperienceRange;
  salary: Salary;
  openings: number;
  applicationDeadline?: string | null;
  status: JobStatus;
  rejectionReason?: string | null;
  featured: boolean;
  applicationsCount: number;
  views: number;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  postedBy?: { id: string; name: string };
  /** v2: company name, or "Veejee Services client (confidential)" for confidential requirements. */
  companyName?: string;
  confidential?: boolean;
  noticePeriodMaxDays?: number | null;
  /** Present when a jobseeker token is sent. */
  isSaved?: boolean;
  hasApplied?: boolean;
}

export interface JobInput {
  title: string;
  description: string;
  responsibilities?: string[];
  requirements?: string[];
  skills?: string[];
  qualifications?: string[];
  industry: string;
  category?: string;
  employmentType: EmploymentType;
  workMode: WorkMode;
  locations: JobLocation[];
  experience: ExperienceRange;
  salary: Salary;
  openings?: number;
  applicationDeadline?: string;
  confidential?: boolean;
  noticePeriodMaxDays?: number;
}

export type JobSort = 'relevance' | 'latest' | 'salary_high';

export interface JobSearchQuery extends PageQuery {
  q?: string;
  location?: string;
  industry?: string;
  category?: string;
  employmentType?: EmploymentType[];
  workMode?: WorkMode[];
  experience?: number;
  salaryMin?: number;
  postedWithin?: number;
  employer?: string;
  featured?: boolean;
  sort?: JobSort;
}

export interface MyJobsQuery extends PageQuery {
  status?: JobStatus;
  q?: string;
}
