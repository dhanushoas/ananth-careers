import { AuthUser, Role, UserStatus } from './user.models';
import { PageQuery } from './api.models';
import { EnquiryType, Testimonial } from './misc.models';

/** Shape not fully specified by the contract; optional fields are rendered when present. */
export interface AuditLog {
  id: string;
  action: string;
  actor?: { id: string; name: string; email?: string; role?: Role } | string | null;
  targetType?: string;
  targetId?: string;
  entityType?: string;
  entityId?: string;
  actorRole?: string;
  ip?: string;
  meta?: Record<string, unknown> | null;
  createdAt: string;
}

export interface AdminStats {
  totals: {
    jobSeekers: number;
    employers: number;
    recruiters: number;
    jobs: number;
    applications: number;
    interviews: number;
  };
  pending: { employers: number; recruiters: number; jobs: number; enquiries: number };
  verifiedEmployers: number;
  blockedUsers: number;
  recentAuditLogs: AuditLog[];
}

export type AdminUser = AuthUser;

export interface AdminUserQuery extends PageQuery {
  role?: Role;
  status?: UserStatus;
  q?: string;
}

export interface CreateAdminRequest {
  name: string;
  email: string;
  mobile: string;
  password: string;
  permissions: string[];
}

export type EnquiryStatus = 'new' | 'in_progress' | 'resolved';

export interface Enquiry {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  subject: string;
  message: string;
  enquiryType: EnquiryType;
  status: EnquiryStatus;
  notes?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface EmailOutboxItem {
  id: string;
  to: string;
  subject: string;
  template?: string;
  status: string;
  attempts?: number;
  lastError?: string | null;
  sentAt?: string | null;
  createdAt: string;
}

export interface AdminTestimonial extends Testimonial {
  consentConfirmed: boolean;
  published: boolean;
  createdAt?: string;
}

export type TestimonialInput = Omit<AdminTestimonial, 'id' | 'createdAt'>;

export interface AdminResume {
  id: string;
  originalName: string;
  size: number;
  mimeType: string;
  isPrimary?: boolean;
  /** Owner of the resume; the contract does not name the field, both spellings are accepted. */
  owner?: { id: string; name: string; email: string } | null;
  user?: { id: string; name: string; email: string } | null;
  createdAt: string;
}

export interface AdminReports {
  registrations: { date: string; jobseekers: number; employers: number }[];
  jobsByIndustry: { industry: string; count: number }[];
  applicationsByStatus: { status: string; count: number }[];
  hiresByIndustry: { industry: string; count: number }[];
  funnel: { applied: number; shortlisted: number; interviewed: number; selected: number };
}

export interface AuditLogQuery extends PageQuery {
  action?: string;
  actor?: string;
}
