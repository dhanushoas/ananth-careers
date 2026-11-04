import { Schema, jsonHiding, model, type ObjectId } from './base';
import {
  APPLICATION_STATUSES,
  CONSENT_TYPES,
  FEEDBACK_RECOMMENDATIONS,
  INTERVIEW_MODES,
  INTERVIEW_STATUSES,
  SHORTLIST_STATUSES,
  SUBMISSION_STATUSES,
  type ApplicationStatus,
  type ConsentType,
  type ShortlistStatus,
  type SubmissionStatus,
} from '../common/constants';

const ref = (name: string, required = false) => ({ type: Schema.Types.ObjectId, ref: name, required });

export interface IResume {
  _id: ObjectId;
  owner: ObjectId;
  storageKey: string;
  originalName: string;
  mimeType: string;
  size: number;
  isPrimary: boolean;
  deletedAt?: Date;
  createdAt: Date;
}
const resumeSchema = new Schema<IResume>(
  {
    owner: ref('User', true),
    storageKey: { type: String, required: true, select: false },
    originalName: { type: String, required: true, maxlength: 200 },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    isPrimary: { type: Boolean, default: false },
    deletedAt: Date,
  },
  { timestamps: true },
);
resumeSchema.index({ owner: 1, deletedAt: 1, createdAt: -1 });
// select:false only affects queries – also hide the storage key when serialising freshly created docs.
resumeSchema.set('toJSON', jsonHiding('storageKey'));
export const Resume = model<IResume>('Resume', resumeSchema, 'resumes');

type History<S> = { status: S; note?: string; changedBy?: ObjectId; at: Date }[];

/** A candidate's application to Veejee Services for a published requirement – reviewed by Veejee Services, never sent to the company directly. */
export interface IApplication {
  _id: ObjectId;
  job: ObjectId;
  employer: ObjectId;
  candidate: ObjectId;
  candidateProfile: ObjectId;
  resume: ObjectId;
  coverLetter?: string;
  status: ApplicationStatus;
  statusHistory: History<ApplicationStatus>;
  reviewedBy?: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
const applicationSchema = new Schema<IApplication>(
  {
    job: ref('Job', true),
    employer: ref('Employer', true),
    candidate: ref('User', true),
    candidateProfile: ref('Candidate', true),
    resume: ref('Resume', true),
    coverLetter: { type: String, maxlength: 5000 },
    status: { type: String, enum: APPLICATION_STATUSES, default: 'applied' },
    statusHistory: [{ _id: false, status: { type: String, enum: APPLICATION_STATUSES }, note: String, changedBy: ref('User'), at: { type: Date, default: Date.now } }],
    reviewedBy: ref('User'),
  },
  { timestamps: true },
);
applicationSchema.index({ job: 1, candidate: 1 }, { unique: true });
applicationSchema.index({ candidate: 1, createdAt: -1 });
applicationSchema.index({ status: 1, createdAt: -1 });
applicationSchema.index({ job: 1, status: 1 });
export const Application = model<IApplication>('Application', applicationSchema, 'candidate_applications');

export interface IMatchBreakdown {
  score: number;
  factors: { key: string; label: string; weight: number; score: number; reason: string }[];
}

/** Veejee Services's shortlist of a candidate for a company requirement. */
export interface IShortlist {
  _id: ObjectId;
  job: ObjectId;
  employer: ObjectId;
  candidate: ObjectId;
  candidateProfile: ObjectId;
  application?: ObjectId;
  source: 'application' | 'search' | 'match';
  match?: IMatchBreakdown;
  status: ShortlistStatus;
  note?: string;
  shortlistedBy: ObjectId;
  reviewedBy?: ObjectId;
  reviewedAt?: Date;
  reviewNote?: string;
  removedReason?: string;
  createdAt: Date;
}
const shortlistSchema = new Schema<IShortlist>(
  {
    job: ref('Job', true),
    employer: ref('Employer', true),
    candidate: ref('User', true),
    candidateProfile: ref('Candidate', true),
    application: ref('Application'),
    source: { type: String, enum: ['application', 'search', 'match'], default: 'search' },
    match: { type: Schema.Types.Mixed },
    status: { type: String, enum: SHORTLIST_STATUSES, default: 'pending_approval' },
    note: { type: String, maxlength: 2000 },
    shortlistedBy: ref('User', true),
    reviewedBy: ref('User'),
    reviewedAt: Date,
    reviewNote: String,
    removedReason: String,
  },
  { timestamps: true },
);
shortlistSchema.index({ job: 1, candidate: 1 }, { unique: true });
shortlistSchema.index({ status: 1, createdAt: -1 });
shortlistSchema.index({ candidate: 1 });
shortlistSchema.index({ shortlistedBy: 1, createdAt: -1 });
export const Shortlist = model<IShortlist>('Shortlist', shortlistSchema, 'candidate_shortlists');

/** A consented candidate profile submitted by Veejee Services to a company. */
export interface ISubmission {
  _id: ObjectId;
  job: ObjectId;
  employer: ObjectId;
  candidate: ObjectId;
  candidateProfile: ObjectId;
  shortlist: ObjectId;
  resume?: ObjectId;
  submittedBy: ObjectId;
  recruiterSummary?: string;
  contactShared: boolean;
  consentRecord: ObjectId;
  status: SubmissionStatus;
  statusHistory: { status: SubmissionStatus; note?: string; changedBy?: ObjectId; byRole?: string; visibleToCandidate: boolean; at: Date }[];
  interviewRequest?: { note?: string; preferredSlots: string[]; requestedBy?: ObjectId; requestedAt?: Date };
  employerNote?: string;
  joiningDate?: Date;
  placedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
const submissionSchema = new Schema<ISubmission>(
  {
    job: ref('Job', true),
    employer: ref('Employer', true),
    candidate: ref('User', true),
    candidateProfile: ref('Candidate', true),
    shortlist: ref('Shortlist', true),
    resume: ref('Resume'),
    submittedBy: ref('User', true),
    recruiterSummary: { type: String, maxlength: 3000 },
    contactShared: { type: Boolean, default: false },
    consentRecord: ref('Consent', true),
    status: { type: String, enum: SUBMISSION_STATUSES, default: 'submitted' },
    statusHistory: [
      {
        _id: false,
        status: { type: String, enum: SUBMISSION_STATUSES },
        note: String,
        changedBy: ref('User'),
        byRole: String,
        visibleToCandidate: { type: Boolean, default: true },
        at: { type: Date, default: Date.now },
      },
    ],
    interviewRequest: { note: String, preferredSlots: { type: [String], default: undefined }, requestedBy: ref('User'), requestedAt: Date },
    employerNote: { type: String, maxlength: 2000 },
    joiningDate: Date,
    placedAt: Date,
  },
  { timestamps: true },
);
submissionSchema.index({ job: 1, candidate: 1 }, { unique: true });
submissionSchema.index({ employer: 1, status: 1, createdAt: -1 });
submissionSchema.index({ candidate: 1, createdAt: -1 });
submissionSchema.index({ submittedBy: 1, status: 1 });
submissionSchema.index({ status: 1, updatedAt: -1 });
export const Submission = model<ISubmission>('Submission', submissionSchema, 'employer_candidate_submissions');

export interface IInterview {
  _id: ObjectId;
  submission: ObjectId;
  job: ObjectId;
  employer: ObjectId;
  candidate: ObjectId;
  scheduledBy: ObjectId;
  round: number;
  scheduledAt: Date;
  durationMinutes: number;
  mode: (typeof INTERVIEW_MODES)[number];
  location?: string;
  meetingLink?: string;
  notes?: string;
  status: (typeof INTERVIEW_STATUSES)[number];
  candidateResponse: 'pending' | 'accepted' | 'declined';
  candidateNote?: string;
  cancelReason?: string;
  reminderSentAt?: Date;
  createdAt: Date;
}
const interviewSchema = new Schema<IInterview>(
  {
    submission: ref('Submission', true),
    job: ref('Job', true),
    employer: ref('Employer', true),
    candidate: ref('User', true),
    scheduledBy: ref('User', true),
    round: { type: Number, default: 1, min: 1, max: 10 },
    scheduledAt: { type: Date, required: true },
    durationMinutes: { type: Number, required: true, min: 15, max: 480 },
    mode: { type: String, enum: INTERVIEW_MODES, required: true },
    location: String,
    meetingLink: String,
    notes: { type: String, maxlength: 2000 },
    status: { type: String, enum: INTERVIEW_STATUSES, default: 'scheduled' },
    candidateResponse: { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending' },
    candidateNote: String,
    cancelReason: String,
    reminderSentAt: Date,
  },
  { timestamps: true },
);
interviewSchema.index({ submission: 1, scheduledAt: -1 });
interviewSchema.index({ candidate: 1, scheduledAt: 1 });
interviewSchema.index({ employer: 1, scheduledAt: 1 });
interviewSchema.index({ status: 1, scheduledAt: 1, reminderSentAt: 1 });
export const Interview = model<IInterview>('Interview', interviewSchema, 'interviews');

export interface IInterviewFeedback {
  _id: ObjectId;
  interview: ObjectId;
  submission: ObjectId;
  employer: ObjectId;
  givenBy: ObjectId;
  rating: number;
  feedback: string;
  recommendation: (typeof FEEDBACK_RECOMMENDATIONS)[number];
  createdAt: Date;
}
const feedbackSchema = new Schema<IInterviewFeedback>(
  {
    interview: ref('Interview', true),
    submission: ref('Submission', true),
    employer: ref('Employer', true),
    givenBy: ref('User', true),
    rating: { type: Number, required: true, min: 1, max: 5 },
    feedback: { type: String, required: true, maxlength: 5000 },
    recommendation: { type: String, enum: FEEDBACK_RECOMMENDATIONS, required: true },
  },
  { timestamps: true },
);
feedbackSchema.index({ interview: 1 }, { unique: true });
feedbackSchema.index({ submission: 1 });
export const InterviewFeedback = model<IInterviewFeedback>('InterviewFeedback', feedbackSchema, 'interview_feedback');

/** Append-only consent ledger (DPDP): one record per grant or withdrawal. */
export interface IConsent {
  _id: ObjectId;
  candidate: ObjectId;
  type: ConsentType;
  granted: boolean;
  version: string;
  ip?: string;
  userAgent?: string;
  createdAt: Date;
}
const consentSchema = new Schema<IConsent>(
  {
    candidate: ref('User', true),
    type: { type: String, enum: CONSENT_TYPES, required: true },
    granted: { type: Boolean, required: true },
    version: { type: String, required: true },
    ip: String,
    userAgent: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
consentSchema.index({ candidate: 1, type: 1, createdAt: -1 });
export const Consent = model<IConsent>('Consent', consentSchema, 'candidate_consent');

/** Internal Veejee Services recruitment notes – never shown to candidates or companies. */
export interface IRecruitmentNote {
  _id: ObjectId;
  candidate: ObjectId;
  job?: ObjectId;
  author: ObjectId;
  kind: 'note' | 'communication' | 'system';
  body: string;
  createdAt: Date;
}
const noteSchema = new Schema<IRecruitmentNote>(
  {
    candidate: ref('User', true),
    job: ref('Job'),
    author: ref('User', true),
    kind: { type: String, enum: ['note', 'communication', 'system'], default: 'note' },
    body: { type: String, required: true, maxlength: 5000 },
  },
  { timestamps: true },
);
noteSchema.index({ candidate: 1, createdAt: -1 });
export const RecruitmentNote = model<IRecruitmentNote>('RecruitmentNote', noteSchema, 'recruitment_notes');
