import { EmploymentType, JobLocation } from './job.models';
import { JobSeekerProfile } from './jobseeker.models';
import { Interview } from './interview.models';
import { PageQuery } from './api.models';
import { Role } from './user.models';

export const APPLICATION_STATUSES = [
  'applied',
  'under_review',
  'shortlisted',
  'interview_scheduled',
  'selected',
  'rejected',
  'withdrawn',
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const FINAL_APPLICATION_STATUSES: readonly ApplicationStatus[] = ['selected', 'rejected', 'withdrawn'];
export const WITHDRAWABLE_STATUSES: readonly ApplicationStatus[] = [
  'applied',
  'under_review',
  'shortlisted',
  'interview_scheduled',
];

/** Statuses an employer may set via PATCH /applications/:id/status. */
export type EmployerSettableStatus = 'under_review' | 'shortlisted' | 'selected' | 'rejected';

export interface StatusHistoryEntry {
  status: ApplicationStatus;
  note?: string | null;
  changedBy?: { id: string; name: string } | null;
  at: string;
}

export interface Application {
  id: string;
  job: {
    id: string;
    title: string;
    slug: string;
    employer: { id: string; companyName: string; slug: string; hasLogo: boolean };
    locations: JobLocation[];
    employmentType: EmploymentType;
  };
  candidate: { id: string; name: string; email?: string; mobile?: string; hasAvatar: boolean };
  candidateProfile?: JobSeekerProfile | null;
  resume: { id: string; originalName: string };
  coverLetter?: string | null;
  status: ApplicationStatus;
  statusHistory: StatusHistoryEntry[];
  interviews?: Interview[];
  createdAt: string;
  updatedAt: string;
}

export interface ApplyRequest {
  jobId: string;
  resumeId: string;
  coverLetter?: string;
}

export interface ApplicationQuery extends PageQuery {
  jobId?: string;
  status?: ApplicationStatus;
  q?: string;
}

export interface Message {
  id: string;
  sender: { id: string; name: string; role: Role };
  body: string;
  createdAt: string;
}
