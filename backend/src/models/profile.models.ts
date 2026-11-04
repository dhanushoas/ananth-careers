import { Schema, jsonHiding, model, type ObjectId } from './base';
import { AVAILABILITY, CANDIDATE_STAGES, CAREER_LEVELS, COMPANY_SIZES, EMPLOYMENT_TYPES, LIMITS, VERIFICATION_STATUSES, WORK_MODES, type CandidateStage } from '../common/constants';

const location = { city: { type: String, trim: true }, state: { type: String, trim: true }, country: { type: String, trim: true, default: 'India' } };

export interface ICandidate {
  _id: ObjectId;
  user: ObjectId;
  headline?: string;
  summary?: string;
  location?: { city?: string; state?: string; country?: string };
  dateOfBirth?: Date;
  gender?: string;
  careerLevel: (typeof CAREER_LEVELS)[number];
  skills: { name: string; type: 'technical' | 'non_technical'; level?: string }[];
  education: { qualification: string; specialization?: string; institution: string; startYear?: number; endYear?: number; grade?: string }[];
  experience: { title: string; company: string; location?: string; startDate: Date; endDate?: Date; current: boolean; description?: string }[];
  totalExperienceYears: number;
  currentSalary?: number;
  expectedSalary?: { min?: number; max?: number; currency: string; period: 'yearly' | 'monthly' };
  preferredRoles: string[];
  preferredLocations: string[];
  preferredWorkModes: string[];
  preferredIndustries: ObjectId[];
  employmentTypes: string[];
  noticePeriodDays?: number;
  availability?: (typeof AVAILABILITY)[number];
  primaryResume?: ObjectId;
  savedJobs: ObjectId[];
  openToWork: boolean;
  profileCompletion: number;
  /** Current consent state (full history lives in candidate_consent). */
  consent: { profileSharing: boolean; contactSharing: boolean; updatedAt?: Date };
  stage: CandidateStage;
  stageHistory: { stage: CandidateStage; note?: string; visibleToCandidate: boolean; changedBy?: ObjectId; at: Date }[];
  assignedRecruiter?: ObjectId;
  assignedAt?: Date;
  lastReviewedAt?: Date;
  profileReminderSentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const candidateSchema = new Schema<ICandidate>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    headline: { type: String, maxlength: 150 },
    summary: { type: String, maxlength: 3000 },
    location,
    dateOfBirth: Date,
    gender: { type: String, enum: ['male', 'female', 'other', 'prefer_not_to_say'] },
    careerLevel: { type: String, enum: CAREER_LEVELS, default: 'fresher' },
    skills: [
      {
        _id: false,
        name: { type: String, required: true, maxlength: 60 },
        type: { type: String, enum: ['technical', 'non_technical'], default: 'technical' },
        level: { type: String, enum: ['beginner', 'intermediate', 'expert'] },
      },
    ],
    education: [
      {
        qualification: { type: String, required: true },
        specialization: String,
        institution: { type: String, required: true },
        startYear: Number,
        endYear: Number,
        grade: String,
      },
    ],
    experience: [
      {
        title: { type: String, required: true },
        company: { type: String, required: true },
        location: String,
        startDate: { type: Date, required: true },
        endDate: Date,
        current: { type: Boolean, default: false },
        description: { type: String, maxlength: 2000 },
      },
    ],
    totalExperienceYears: { type: Number, default: 0, min: 0, max: 60 },
    currentSalary: { type: Number, min: 0 },
    expectedSalary: {
      min: { type: Number, min: 0 },
      max: { type: Number, min: 0 },
      currency: { type: String, default: 'INR' },
      period: { type: String, enum: ['yearly', 'monthly'], default: 'yearly' },
    },
    preferredRoles: { type: [String], default: [] },
    preferredLocations: { type: [String], default: [] },
    preferredWorkModes: { type: [String], enum: WORK_MODES, default: [] },
    preferredIndustries: [{ type: Schema.Types.ObjectId, ref: 'Industry' }],
    employmentTypes: { type: [String], enum: EMPLOYMENT_TYPES, default: [] },
    noticePeriodDays: { type: Number, min: 0, max: 365 },
    availability: { type: String, enum: AVAILABILITY },
    primaryResume: { type: Schema.Types.ObjectId, ref: 'Resume' },
    savedJobs: [{ type: Schema.Types.ObjectId, ref: 'Job' }],
    openToWork: { type: Boolean, default: true },
    profileCompletion: { type: Number, default: 0 },
    consent: {
      profileSharing: { type: Boolean, default: false },
      contactSharing: { type: Boolean, default: false },
      updatedAt: Date,
    },
    stage: { type: String, enum: CANDIDATE_STAGES, default: 'registered' },
    stageHistory: [
      {
        _id: false,
        stage: { type: String, enum: CANDIDATE_STAGES, required: true },
        note: String,
        visibleToCandidate: { type: Boolean, default: true },
        changedBy: { type: Schema.Types.ObjectId, ref: 'User' },
        at: { type: Date, default: Date.now },
      },
    ],
    assignedRecruiter: { type: Schema.Types.ObjectId, ref: 'User' },
    assignedAt: Date,
    lastReviewedAt: Date,
    profileReminderSentAt: Date,
  },
  { timestamps: true },
);
candidateSchema.index(
  { headline: 'text', summary: 'text', 'skills.name': 'text', preferredRoles: 'text', 'education.specialization': 'text', 'experience.title': 'text' },
  { weights: { 'skills.name': 8, preferredRoles: 8, headline: 6, 'experience.title': 4, 'education.specialization': 3, summary: 1 }, name: 'candidate_text' },
);
candidateSchema.index({ 'skills.name': 1 });
candidateSchema.index({ stage: 1, updatedAt: -1 });
candidateSchema.index({ assignedRecruiter: 1, stage: 1 });
candidateSchema.index({ careerLevel: 1, totalExperienceYears: 1 });
candidateSchema.index({ preferredLocations: 1 });
candidateSchema.index({ 'location.city': 1 });
candidateSchema.index({ noticePeriodDays: 1 });
candidateSchema.index({ profileCompletion: -1 });

/** Profile completeness drives the first pipeline stages and the profile reminder emails. */
candidateSchema.pre('save', function () {
  const checks = [
    this.headline,
    this.summary,
    this.location?.city,
    this.skills.length > 0,
    this.education.length > 0,
    this.careerLevel === 'fresher' || this.experience.length > 0,
    this.expectedSalary?.min !== undefined,
    this.preferredLocations.length > 0,
    this.preferredRoles.length > 0,
    this.noticePeriodDays !== undefined || this.availability,
    this.primaryResume,
  ];
  this.profileCompletion = Math.round((checks.filter(Boolean).length / checks.length) * 100);
});
export const Candidate = model<ICandidate>('Candidate', candidateSchema, 'candidates');

export interface IEmployer {
  _id: ObjectId;
  owner: ObjectId;
  companyName: string;
  slug: string;
  industry: ObjectId;
  website?: string;
  description?: string;
  size?: string;
  foundedYear?: number;
  headquarters?: string;
  address?: string;
  registrationNumber?: string;
  contactPerson?: string;
  contactEmail?: string;
  contactPhone?: string;
  logoKey?: string;
  verificationStatus: (typeof VERIFICATION_STATUSES)[number];
  rejectionReason?: string;
  verifiedAt?: Date;
  verifiedBy?: ObjectId;
  accountManager?: ObjectId;
  featured: boolean;
  deletedAt?: Date;
}
const employerSchema = new Schema<IEmployer>(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    companyName: { type: String, required: true, trim: true, maxlength: 150 },
    slug: { type: String, required: true, unique: true },
    industry: { type: Schema.Types.ObjectId, ref: 'Industry', required: true },
    website: String,
    description: { type: String, maxlength: 5000 },
    size: { type: String, enum: COMPANY_SIZES },
    foundedYear: { type: Number, min: 1800, max: 2100 },
    headquarters: String,
    address: { type: String, maxlength: 500 },
    registrationNumber: { type: String, maxlength: 50 },
    contactPerson: { type: String, maxlength: 100 },
    contactEmail: String,
    contactPhone: String,
    logoKey: { type: String, select: false },
    verificationStatus: { type: String, enum: VERIFICATION_STATUSES, default: 'pending', index: true },
    rejectionReason: String,
    verifiedAt: Date,
    verifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    /** Veejee Services recruiter who manages this client. */
    accountManager: { type: Schema.Types.ObjectId, ref: 'User' },
    featured: { type: Boolean, default: false },
    deletedAt: Date,
  },
  { timestamps: true },
);
employerSchema.index({ companyName: 'text', description: 'text' });
employerSchema.index({ verificationStatus: 1, featured: -1, createdAt: -1 });
employerSchema.virtual('hasLogo').get(function (this: IEmployer) {
  return Boolean(this.logoKey);
});
employerSchema.set('toJSON', jsonHiding('logoKey'));
export const Employer = model<IEmployer>('Employer', employerSchema, 'companies');

/** Veejee Services recruitment staff profile. */
export interface IRecruiter {
  _id: ObjectId;
  user: ObjectId;
  employeeCode?: string;
  designation?: string;
  specializations: ObjectId[];
  createdBy: ObjectId;
  active: boolean;
}
const recruiterSchema = new Schema<IRecruiter>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    employeeCode: { type: String, maxlength: 30 },
    designation: { type: String, maxlength: 100 },
    specializations: [{ type: Schema.Types.ObjectId, ref: 'Industry' }],
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);
export const Recruiter = model<IRecruiter>('Recruiter', recruiterSchema, 'recruiters');
