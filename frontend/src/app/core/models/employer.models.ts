import { RefSummary } from './taxonomy.models';
import { Job, JobStatus } from './job.models';
import { ApplicationStatus } from './application.models';
import { Interview } from './interview.models';

export const COMPANY_SIZES = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'] as const;
export type CompanySize = (typeof COMPANY_SIZES)[number];
export type VerificationStatus = 'pending' | 'verified' | 'rejected';

export interface Employer {
  id: string;
  owner: string;
  companyName: string;
  slug: string;
  industry: RefSummary;
  website?: string | null;
  description?: string | null;
  size?: CompanySize | null;
  foundedYear?: number | null;
  headquarters?: string | null;
  address?: string | null;
  registrationNumber?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  contactPerson?: string | null;
  accountManager?: string | { id: string; name: string } | null;
  hasLogo: boolean;
  verificationStatus: VerificationStatus;
  rejectionReason?: string | null;
  featured: boolean;
  createdAt: string;
}

/**
 * Public employer projection. The contract does not spell it out, so everything beyond
 * id/companyName/slug/hasLogo is treated as optional.
 */
export interface EmployerPublic {
  id: string;
  companyName: string;
  slug: string;
  industry?: RefSummary | null;
  website?: string | null;
  description?: string | null;
  size?: CompanySize | null;
  foundedYear?: number | null;
  headquarters?: string | null;
  hasLogo: boolean;
  featured?: boolean;
  verificationStatus?: VerificationStatus;
  /** Optional count of open (published) jobs, if the server includes it. */
  jobCount?: number;
}

export interface EmployerProfileResponse {
  employer: EmployerPublic;
  jobs: Job[];
}

export interface EmployerInput {
  companyName: string;
  industry: string;
  website?: string;
  description?: string;
  size?: CompanySize;
  foundedYear?: number;
  headquarters?: string;
  address?: string;
  registrationNumber?: string;
  contactEmail?: string;
  contactPhone?: string;
  contactPerson?: string;
}

export interface EmployerAnalytics {
  jobsByStatus: Partial<Record<JobStatus, number>>;
  applicationsByStatus: Partial<Record<ApplicationStatus, number>>;
  applicationsLast30Days: { date: string; count: number }[];
  topJobs: { id: string; title: string; applicationsCount: number; views: number }[];
  /** Contract is ambiguous: a count or a list of interviews. Both are handled. */
  upcomingInterviews: number | Interview[];
  totals: { jobs: number; applications: number; hires: number };
}

export interface EmployerListQuery {
  featured?: boolean;
  q?: string;
  industry?: string;
  page?: number;
  limit?: number;
}
