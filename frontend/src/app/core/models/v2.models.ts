// Contract v2 (Veejee Services – recruitment intermediary) models.
import { PageQuery } from './api.models';
import { EmploymentType, Job, JobLocation, Salary, SalaryPeriod, WorkMode } from './job.models';
import { Gender, SkillLevel, SkillType } from './jobseeker.models';

/** A reference that some endpoints populate and others return as a bare id. */
export type Ref<T> = string | T;

export interface PersonRef {
  id: string;
  name: string;
  email?: string;
  mobile?: string;
  hasAvatar?: boolean;
}

export const CAREER_LEVELS = ['fresher', 'experienced'] as const;
export type CareerLevel = (typeof CAREER_LEVELS)[number];

export const AVAILABILITY = [
  'immediate',
  'within_15_days',
  'within_30_days',
  'within_60_days',
  'more_than_60_days',
  'not_looking',
] as const;
export type Availability = (typeof AVAILABILITY)[number];

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

export const STAGE_LABELS: Record<CandidateStage, string> = {
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

/** Stages a recruiter may set manually (PATCH /recruitment/candidates/:id/stage). */
export const RECRUITER_SETTABLE_STAGES: readonly CandidateStage[] = [
  'under_review',
  'screening',
  'on_hold',
  'rejected',
  'profile_completed',
];

export const CANDIDATE_APPLICATION_STATUSES = ['applied', 'under_review', 'shortlisted', 'not_shortlisted', 'withdrawn'] as const;
export type CandidateApplicationStatus = (typeof CANDIDATE_APPLICATION_STATUSES)[number];

export const SHORTLIST_STATUSES = ['pending_approval', 'approved', 'rejected', 'removed', 'submitted'] as const;
export type ShortlistStatus = (typeof SHORTLIST_STATUSES)[number];

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

export const FEEDBACK_RECOMMENDATIONS = ['select', 'reject', 'next_round', 'on_hold'] as const;
export type FeedbackRecommendation = (typeof FEEDBACK_RECOMMENDATIONS)[number];

export interface Consent {
  profileSharing: boolean;
  contactSharing: boolean;
  updatedAt?: string;
}

export interface ConsentHistoryEntry {
  id?: string;
  type: string;
  granted: boolean;
  version?: string;
  createdAt: string;
}

export interface ConsentResponse {
  current: Consent;
  version: string;
  history: ConsentHistoryEntry[];
}

export interface CandidateSkill {
  name: string;
  type: SkillType;
  level?: SkillLevel;
}

export interface CandidateEducation {
  id?: string;
  qualification: string;
  specialization?: string;
  institution: string;
  startYear?: number;
  endYear?: number;
  grade?: string;
}

export interface CandidateExperience {
  id?: string;
  title: string;
  company: string;
  location?: string;
  startDate: string;
  endDate?: string | null;
  current: boolean;
  description?: string;
}

export interface StageHistoryEntry {
  stage: CandidateStage;
  label?: string;
  note?: string;
  at: string;
  visibleToCandidate?: boolean;
}

export interface CandidateProfile {
  id: string;
  user: Ref<PersonRef>;
  headline?: string;
  summary?: string;
  location?: { city?: string; state?: string; country?: string };
  dateOfBirth?: string | null;
  gender?: Gender | null;
  careerLevel?: CareerLevel;
  skills: CandidateSkill[];
  education: CandidateEducation[];
  experience: CandidateExperience[];
  totalExperienceYears?: number;
  currentSalary?: number | null;
  expectedSalary?: { min?: number | null; max?: number | null; currency?: 'INR'; period?: SalaryPeriod };
  preferredRoles?: string[];
  preferredLocations?: string[];
  preferredWorkModes?: WorkMode[];
  preferredIndustries?: string[];
  employmentTypes?: EmploymentType[];
  noticePeriodDays?: number | null;
  availability?: Availability;
  openToWork?: boolean;
  profileCompletion?: number;
  profileComplete?: boolean;
  stage?: CandidateStage;
  stageLabel?: string;
  stageHistory?: StageHistoryEntry[];
  consent?: Consent;
  primaryResume?: string | null;
  hasResume?: boolean;
  assignedRecruiter?: Ref<PersonRef> | null;
  savedJobs?: string[];
  createdAt?: string;
  updatedAt?: string;
}

/** PUT /candidates/me body (all optional). */
export interface CandidateProfileInput {
  headline?: string;
  summary?: string;
  location?: { city?: string; state?: string; country?: string };
  dateOfBirth?: string;
  gender?: Gender;
  careerLevel?: CareerLevel;
  skills?: CandidateSkill[];
  education?: CandidateEducation[];
  experience?: CandidateExperience[];
  totalExperienceYears?: number;
  currentSalary?: number;
  expectedSalary?: { min?: number; max?: number; period?: SalaryPeriod };
  preferredRoles?: string[];
  preferredLocations?: string[];
  preferredWorkModes?: WorkMode[];
  preferredIndustries?: string[];
  employmentTypes?: EmploymentType[];
  noticePeriodDays?: number;
  availability?: Availability;
  openToWork?: boolean;
}

export interface CandidateInterview {
  id: string;
  submission?: string;
  job?: { id: string; title: string };
  employer?: { id: string; companyName: string } | null;
  candidate?: Ref<PersonRef>;
  scheduledAt: string;
  durationMinutes: number;
  mode: 'in_person' | 'video' | 'phone';
  location?: string | null;
  meetingLink?: string | null;
  notes?: string | null;
  status: 'scheduled' | 'rescheduled' | 'completed' | 'cancelled';
  candidateResponse: 'pending' | 'accepted' | 'declined';
  createdAt?: string;
}

export interface CandidateDashboard {
  stage: CandidateStage;
  stageLabel: string;
  profileCompletion: number;
  hasResume: boolean;
  consent: Consent;
  applications: { total: number; byStatus: Partial<Record<string, number>> };
  submissions: { total: number; byStatus: Partial<Record<string, number>> };
  savedJobs: number;
  upcomingInterviews: CandidateInterview[];
  recommendedJobs: Job[];
}

export interface StatusHistory<S extends string = string> {
  status: S;
  note?: string;
  byRole?: string;
  changedBy?: Ref<PersonRef>;
  visibleToCandidate?: boolean;
  at: string;
}

export interface JobSummary {
  id: string;
  slug?: string;
  title: string;
  companyName?: string;
  employer?: Ref<{ id: string; companyName: string }> | null;
  employmentType?: EmploymentType;
  workMode?: WorkMode;
  locations?: JobLocation[];
  confidential?: boolean;
  status?: string;
}

export interface CompanyRef {
  id: string;
  companyName: string;
  slug?: string;
  verificationStatus?: string;
  hasLogo?: boolean;
}

/** Candidate → Veejee Services application. */
export interface CandidateApplication {
  id: string;
  job: JobSummary;
  employer?: Ref<CompanyRef> | null;
  candidate?: Ref<PersonRef>;
  candidateProfile?: Ref<Partial<CandidateProfile>>;
  resume?: Ref<{ id: string; originalName: string }> | null;
  coverLetter?: string;
  status: CandidateApplicationStatus;
  statusHistory: StatusHistory<CandidateApplicationStatus>[];
  createdAt: string;
  updatedAt?: string;
}

/** GET /candidates/me/submissions item. */
export interface CandidateSubmission {
  id: string;
  job: JobSummary;
  employer: CompanyRef | null;
  status: SubmissionStatus;
  contactShared: boolean;
  submittedAt: string;
  history: StatusHistory<SubmissionStatus>[];
  interviews: CandidateInterview[];
  active: boolean;
}

export interface MatchFactor {
  key: string;
  label: string;
  weight: number;
  /** 0–1 */
  score: number;
  reason: string;
}

export interface MatchResult {
  /** 0–100 */
  score: number;
  factors: MatchFactor[];
}

export interface Shortlist {
  id: string;
  job: JobSummary;
  employer?: Ref<CompanyRef>;
  candidate: Ref<PersonRef>;
  candidateProfile?: Ref<Partial<CandidateProfile>>;
  source?: string;
  match?: MatchResult;
  status: ShortlistStatus;
  note?: string;
  shortlistedBy?: Ref<PersonRef>;
  reviewedBy?: Ref<PersonRef> | null;
  reviewedAt?: string | null;
  reviewNote?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface InterviewFeedback {
  id?: string;
  rating: number;
  feedback: string;
  recommendation: FeedbackRecommendation;
  interview?: string;
  createdAt?: string;
  by?: Ref<PersonRef>;
}

export interface Submission {
  id: string;
  job: JobSummary;
  employer: Ref<CompanyRef>;
  candidate: PersonRef;
  candidateProfile?: Partial<CandidateProfile>;
  shortlist?: string;
  resume?: Ref<{ id: string; originalName: string; size?: number }>;
  submittedBy?: Ref<PersonRef>;
  recruiterSummary?: string;
  contactShared: boolean;
  status: SubmissionStatus;
  statusHistory: StatusHistory<SubmissionStatus>[];
  joiningDate?: string | null;
  interviewRequest?: { note?: string; preferredSlots?: string[]; requestedAt?: string } | null;
  interviews?: CandidateInterview[];
  feedback?: InterviewFeedback[];
  createdAt: string;
  updatedAt?: string;
}

export interface SubmissionDetail {
  submission: Submission;
  interviews: CandidateInterview[];
  feedback: InterviewFeedback[];
}

export interface RecruiterNote {
  id: string;
  body: string;
  job?: Ref<{ id: string; title: string }> | null;
  author?: Ref<PersonRef>;
  createdAt: string;
}

export interface ResumeMeta {
  id: string;
  originalName: string;
  mimeType?: string;
  size: number;
  isPrimary: boolean;
  createdAt: string;
}

export interface RecruiterCandidateDetail {
  candidate: CandidateProfile;
  resumes: ResumeMeta[];
  applications: CandidateApplication[];
  shortlists: Shortlist[];
  submissions: Submission[];
  interviews: CandidateInterview[];
  notes: RecruiterNote[];
  consentHistory: ConsentHistoryEntry[];
}

export interface CandidateSearchQuery extends PageQuery {
  q?: string;
  role?: string;
  skills?: string[];
  technicalSkills?: string[];
  softSkills?: string[];
  qualification?: string;
  specialization?: string;
  careerLevel?: CareerLevel;
  expMin?: number;
  expMax?: number;
  currentSalaryMax?: number;
  expectedSalaryMax?: number;
  location?: string;
  workMode?: WorkMode;
  noticeMax?: number;
  availability?: Availability[];
  industry?: string;
  employmentType?: EmploymentType;
  completionMin?: number;
  hasResume?: boolean;
  consent?: boolean;
  stage?: CandidateStage[];
  assigned?: string;
  sort?: 'recent' | 'experience' | 'completion' | 'relevance';
}

/** Recruitment requirement = Job with consultancy extras. */
export type Requirement = Job & {
  companyName?: string;
  confidential?: boolean;
  noticePeriodMaxDays?: number | null;
  filledCount?: number;
  assignedRecruiter?: Ref<PersonRef> | null;
  counts?: { shortlisted: number; submitted: number; pendingApplications: number };
};

export interface RequirementDetail {
  requirement: Requirement;
  shortlists: Shortlist[];
  submissions: Submission[];
  applications: CandidateApplication[];
}

export interface MatchItem {
  candidate: CandidateProfile;
  match: MatchResult;
  shortlistStatus?: ShortlistStatus | null;
  submissionStatus?: SubmissionStatus | null;
}

export interface MatchesResponse {
  items: MatchItem[];
  weights?: Record<string, number>;
  poolSize?: number;
}

export interface RecruiterDashboard {
  assignedCandidates: { total: number; byStage: Partial<Record<CandidateStage, number>> };
  pendingApplications: number;
  pendingApprovals: number;
  openSubmissions: number;
  placementsThisMonth: number;
  interviewRequests: Submission[];
  upcomingInterviews: CandidateInterview[];
  myRequirements: { id: string; title: string; companyName?: string; openings: number; filledCount?: number; applicationsCount?: number }[];
  recentApplications: CandidateApplication[];
}

export interface RecruiterOption {
  id: string;
  name: string;
  designation?: string;
}

export interface ScheduleInterviewInput {
  submissionId: string;
  scheduledAt: string;
  durationMinutes: number;
  mode: 'in_person' | 'video' | 'phone';
  location?: string;
  meetingLink?: string;
  notes?: string;
}

export interface EmployerDashboard {
  company: { id: string; companyName: string; verificationStatus: string };
  requirementsByStatus: Partial<Record<string, number>>;
  submissionsByStatus: Partial<Record<string, number>>;
  totals: { submitted: number; awaitingReview: number; interviews: number; hired: number };
  recentSubmissions: Submission[];
  upcomingInterviews: CandidateInterview[];
}

export type EmployerDecision = 'reviewing' | 'accept' | 'reject' | 'on_hold';

export interface StaffRecruiter {
  id: string;
  user: PersonRef & { status?: string; emailVerified?: boolean };
  employeeCode?: string;
  designation?: string;
  specializations?: string[];
  active: boolean;
  assignedCandidates?: number;
  placements?: number;
  createdAt?: string;
}

export interface StaffRecruiterInput {
  name?: string;
  email?: string;
  mobile?: string;
  designation?: string;
  employeeCode?: string;
  specializations?: string[];
  active?: boolean;
}

export interface AdminStatsV2 {
  candidates: { total: number; freshers: number; experienced: number; underReview: number };
  companies: { total: number; verified: number; pending: number };
  requirements: { active: number; pendingApproval: number };
  pipeline: {
    shortlisted: number;
    pendingShortlists: number;
    submitted: number;
    interviewsScheduled: number;
    selected: number;
    placed: number;
    placedThisMonth: number;
  };
  recruiters: number;
  blockedUsers: number;
  newEnquiries: number;
  recentAuditLogs: {
    id: string;
    action: string;
    actor?: Ref<PersonRef & { role?: string }> | null;
    actorRole?: string;
    entityType?: string;
    entityId?: string;
    createdAt: string;
  }[];
}

export interface SystemSettings {
  matchingWeights: { skills: number; experience: number; education: number; location: number; salary: number; noticePeriod: number };
  requireShortlistApproval: boolean;
  reminders: { profileCompletion: boolean; profileReminderDays: number; interview: boolean; interviewHoursBefore: number };
  notifications: { emailCandidatesOnStageChange: boolean; emailEmployerOnSubmission: boolean };
}

export interface ReportsV2 {
  registrations: { date: string; candidates: number; employers: number }[];
  monthly: { month: string; candidates: number; submissions: number; placements: number }[];
  funnel: { applied: number; shortlisted: number; submitted: number; interviewed: number; selected: number; placed: number };
  submissionsByStatus: { status: string; count: number }[];
  requirementsByIndustry: { industry: string; count: number }[];
  placementsByIndustry: { industry: string; count: number }[];
  careerLevels: { fresher: number; experienced: number };
  recruiterPerformance: {
    recruiterId: string;
    name: string;
    active: boolean;
    shortlisted: number;
    submitted: number;
    interviews: number;
    placements: number;
    conversionRate: number;
  }[];
}

export type { Salary };
