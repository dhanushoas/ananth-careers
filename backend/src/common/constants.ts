export const ROLES = ['candidate', 'employer', 'recruiter', 'admin'] as const;
export type Role = (typeof ROLES)[number];
/** Veejee Services staff roles – the only roles that can screen, shortlist and submit candidates. */
export const STAFF_ROLES: Role[] = ['recruiter', 'admin'];

export const USER_STATUSES = ['pending', 'active', 'blocked'] as const;

export const PERMISSIONS = [
  'users:manage',
  'employers:verify',
  'recruiters:manage',
  'jobs:moderate',
  'recruitment:manage', // perform all recruiter functions across every candidate
  'shortlists:approve',
  'candidates:assign',
  'resumes:manage',
  'taxonomy:manage',
  'content:manage',
  'enquiries:manage',
  'emails:manage',
  'settings:manage',
  'reports:view',
  'audit:view',
  'admins:manage',
] as const;
export type Permission = (typeof PERMISSIONS)[number];
export const SUPER_ADMIN = '*';

export const EMPLOYMENT_TYPES = ['full_time', 'part_time', 'contract', 'internship', 'temporary', 'freelance'] as const;
export const WORK_MODES = ['onsite', 'remote', 'hybrid'] as const;
export const JOB_STATUSES = ['draft', 'pending_approval', 'published', 'rejected', 'closed'] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const CAREER_LEVELS = ['fresher', 'experienced'] as const;
export const AVAILABILITY = ['immediate', 'within_15_days', 'within_30_days', 'within_60_days', 'more_than_60_days', 'not_looking'] as const;

/** The 15-stage candidate recruitment pipeline (overall candidate stage). */
export const CANDIDATE_STAGES = [
  'registered',
  'profile_incomplete',
  'profile_completed',
  'under_review',
  'screening',
  'shortlisted',
  'submitted',
  'company_reviewing',
  'interview_requested',
  'interview_scheduled',
  'interview_completed',
  'selected',
  'rejected',
  'on_hold',
  'placed',
] as const;
export type CandidateStage = (typeof CANDIDATE_STAGES)[number];

export const STAGE_LABEL: Record<CandidateStage, string> = {
  registered: 'Registered',
  profile_incomplete: 'Profile incomplete',
  profile_completed: 'Profile completed',
  under_review: 'Under Veejee Services review',
  screening: 'Screening in progress',
  shortlisted: 'Shortlisted by Veejee Services',
  submitted: 'Submitted to company',
  company_reviewing: 'Company reviewing',
  interview_requested: 'Interview requested',
  interview_scheduled: 'Interview scheduled',
  interview_completed: 'Interview completed',
  selected: 'Selected',
  rejected: 'Not selected',
  on_hold: 'On hold',
  placed: 'Successfully placed',
};

/** Stages the candidate reaches before any company is involved; profile edits may move between the first three. */
export const PROFILE_STAGES: CandidateStage[] = ['registered', 'profile_incomplete', 'profile_completed'];
/** Stages a recruiter may set directly on a candidate. */
export const RECRUITER_SETTABLE_STAGES: CandidateStage[] = ['under_review', 'screening', 'on_hold', 'rejected', 'profile_completed'];

/** Candidate → Veejee Services application for a published requirement. */
export const APPLICATION_STATUSES = ['applied', 'under_review', 'shortlisted', 'not_shortlisted', 'withdrawn'] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const SHORTLIST_STATUSES = ['pending_approval', 'approved', 'rejected', 'removed', 'submitted'] as const;
export type ShortlistStatus = (typeof SHORTLIST_STATUSES)[number];

/** Candidate profile submitted by Veejee Services to a company for a requirement. */
export const SUBMISSION_STATUSES = [
  'submitted',
  'company_reviewing',
  'interview_requested',
  'interview_scheduled',
  'interview_completed',
  'selected',
  'rejected',
  'on_hold',
  'placed',
  'withdrawn',
] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];
export const OPEN_SUBMISSION_STATUSES: SubmissionStatus[] = ['submitted', 'company_reviewing', 'interview_requested', 'interview_scheduled', 'interview_completed', 'on_hold', 'selected'];
export const FINAL_SUBMISSION_STATUSES: SubmissionStatus[] = ['rejected', 'placed', 'withdrawn'];

/** Company decisions on a submitted candidate. */
export const EMPLOYER_DECISIONS = { reviewing: 'company_reviewing', accept: 'selected', reject: 'rejected', on_hold: 'on_hold' } as const;
export const EMPLOYER_DECIDABLE_FROM: SubmissionStatus[] = ['submitted', 'company_reviewing', 'interview_requested', 'interview_scheduled', 'interview_completed', 'on_hold'];

/** Veejee Services staff transitions on a submission (interview statuses are driven by the interviews module). */
export const STAFF_SUBMISSION_TRANSITIONS: Record<SubmissionStatus, SubmissionStatus[]> = {
  submitted: ['company_reviewing', 'on_hold', 'rejected', 'withdrawn'],
  company_reviewing: ['on_hold', 'rejected', 'selected', 'withdrawn'],
  interview_requested: ['on_hold', 'rejected', 'withdrawn'],
  interview_scheduled: ['interview_completed', 'on_hold', 'rejected', 'withdrawn'],
  interview_completed: ['selected', 'rejected', 'on_hold', 'interview_requested'],
  on_hold: ['company_reviewing', 'rejected', 'withdrawn', 'selected'],
  selected: ['placed', 'rejected', 'withdrawn'],
  placed: [],
  rejected: [],
  withdrawn: [],
};

export const SUBMISSION_STAGE: Record<SubmissionStatus, CandidateStage | null> = {
  submitted: 'submitted',
  company_reviewing: 'company_reviewing',
  interview_requested: 'interview_requested',
  interview_scheduled: 'interview_scheduled',
  interview_completed: 'interview_completed',
  selected: 'selected',
  rejected: 'rejected',
  on_hold: 'on_hold',
  placed: 'placed',
  withdrawn: null,
};

export const INTERVIEW_MODES = ['in_person', 'video', 'phone'] as const;
export const INTERVIEW_STATUSES = ['scheduled', 'rescheduled', 'completed', 'cancelled'] as const;
export const FEEDBACK_RECOMMENDATIONS = ['select', 'reject', 'next_round', 'on_hold'] as const;
export const COMPANY_SIZES = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'] as const;
export const VERIFICATION_STATUSES = ['pending', 'verified', 'rejected'] as const;
export const CONSENT_TYPES = ['profile_sharing', 'contact_sharing'] as const;
export type ConsentType = (typeof CONSENT_TYPES)[number];
export const CONSENT_VERSION = '2026-11';

export const CONTENT_KEYS = ['home', 'about', 'faq', 'privacy', 'terms', 'refund', 'services', 'process', 'job-seekers', 'employers'] as const;

export const LIMITS = {
  resumeBytes: 5 * 1024 * 1024,
  imageBytes: 2 * 1024 * 1024,
  maxResumesPerUser: 5,
  maxLoginAttempts: 5,
  lockMinutes: 15,
  emailVerificationHours: 24,
  passwordResetMinutes: 30,
  inviteDays: 7,
  profileCompleteThreshold: 80,
  matchPoolSize: 1500,
  compareMax: 4,
} as const;

export const REFRESH_COOKIE = 'ananth_rt';
export const REFRESH_COOKIE_PATH = '/api/v1/auth';
