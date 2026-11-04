// Resumes, recruiters, notifications, public content.

export interface Resume {
  id: string;
  originalName: string;
  size: number;
  mimeType: string;
  isPrimary: boolean;
  createdAt: string;
}

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface Recruiter {
  id: string;
  user: { id: string; name: string; email: string; mobile: string };
  employer: { id: string; companyName: string };
  designation: string;
  approvalStatus: ApprovalStatus;
  active: boolean;
  rejectionReason?: string | null;
  createdAt?: string;
}

export interface InviteRecruiterRequest {
  name: string;
  email: string;
  mobile: string;
  designation: string;
}

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  link?: string | null;
  readAt?: string | null;
  createdAt: string;
}

export const CONTENT_KEYS = ['home', 'about', 'services', 'process', 'job-seekers', 'employers', 'faq', 'privacy', 'terms', 'refund'] as const;
export type ContentKey = (typeof CONTENT_KEYS)[number];

export interface FaqContent {
  items: { question: string; answer: string }[];
}

export interface PolicyContent {
  title: string;
  updatedAt?: string;
  sections: { heading: string; body: string }[];
}

export interface HomeContent {
  heroTitle?: string;
  heroSubtitle?: string;
  stats?: { label: string; value: string | number }[];
}

/** Any JSON object stored under a content key. */
export type ContentValue = Record<string, unknown>;

export interface Testimonial {
  id: string;
  name: string;
  role: string;
  company: string;
  quote: string;
  rating: number;
}

export interface PublicStats {
  jobs: number;
  employers: number;
  jobSeekers: number;
  industries: number;
}

export type EnquiryType = 'candidate' | 'employer' | 'general';

export interface ContactRequest {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  enquiryType: EnquiryType;
  consent: true;
}

export interface ProcessContent {
  title?: string;
  intro?: string;
  steps: { icon?: string; title: string; body: string }[];
}

export interface AudienceContent {
  title?: string;
  intro?: string;
  benefits: { icon?: string; title: string; body: string }[];
  steps?: (string | { icon?: string; title: string; body?: string })[];
}
