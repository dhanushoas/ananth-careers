import { Schema, model, type ObjectId } from './base';
import { EMPLOYMENT_TYPES, JOB_STATUSES, WORK_MODES, type JobStatus } from '../common/constants';

export interface IIndustry {
  _id: ObjectId;
  name: string;
  slug: string;
  description?: string;
  icon: string;
  order: number;
  active: boolean;
}
const industrySchema = new Schema<IIndustry>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    slug: { type: String, required: true, unique: true },
    description: { type: String, maxlength: 500 },
    icon: { type: String, default: 'work' },
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);
industrySchema.index({ name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });
export const Industry = model<IIndustry>('Industry', industrySchema, 'industries');

export interface IJobCategory {
  _id: ObjectId;
  industry: ObjectId;
  name: string;
  slug: string;
  active: boolean;
}
const categorySchema = new Schema<IJobCategory>(
  {
    industry: { type: Schema.Types.ObjectId, ref: 'Industry', required: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    slug: { type: String, required: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);
categorySchema.index({ industry: 1, slug: 1 }, { unique: true });
export const JobCategory = model<IJobCategory>('JobCategory', categorySchema, 'job_categories');

export interface IJob {
  _id: ObjectId;
  slug: string;
  title: string;
  description: string;
  responsibilities: string[];
  requirements: string[];
  skills: string[];
  qualifications: string[];
  industry: ObjectId;
  category?: ObjectId;
  employer: ObjectId;
  companyName: string;
  postedBy: ObjectId;
  employmentType: (typeof EMPLOYMENT_TYPES)[number];
  workMode: (typeof WORK_MODES)[number];
  locations: { city: string; state?: string; country: string }[];
  experience: { min: number; max: number };
  salary: { min?: number; max?: number; currency: string; period: 'yearly' | 'monthly'; disclosed: boolean };
  openings: number;
  applicationDeadline?: Date;
  /** Hide the company name on the public website (shown as "Veejee Services client"). */
  confidential: boolean;
  noticePeriodMaxDays?: number;
  /** Veejee Services recruiter responsible for filling this requirement. */
  assignedRecruiter?: ObjectId;
  filledCount: number;
  status: JobStatus;
  rejectionReason?: string;
  moderatedBy?: ObjectId;
  moderatedAt?: Date;
  publishedAt?: Date;
  closedAt?: Date;
  featured: boolean;
  applicationsCount: number;
  views: number;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
const jobSchema = new Schema<IJob>(
  {
    slug: { type: String, required: true, unique: true },
    title: { type: String, required: true, trim: true, maxlength: 150 },
    description: { type: String, required: true, maxlength: 10000 },
    responsibilities: { type: [String], default: [] },
    requirements: { type: [String], default: [] },
    skills: { type: [String], default: [] },
    qualifications: { type: [String], default: [] },
    industry: { type: Schema.Types.ObjectId, ref: 'Industry', required: true },
    category: { type: Schema.Types.ObjectId, ref: 'JobCategory' },
    employer: { type: Schema.Types.ObjectId, ref: 'Employer', required: true, index: true },
    companyName: { type: String, required: true },
    postedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    employmentType: { type: String, enum: EMPLOYMENT_TYPES, required: true },
    workMode: { type: String, enum: WORK_MODES, required: true },
    locations: {
      type: [{ _id: false, city: { type: String, required: true }, state: String, country: { type: String, default: 'India' } }],
      validate: [(v: unknown[]) => v.length > 0, 'At least one location is required'],
    },
    experience: { min: { type: Number, default: 0, min: 0 }, max: { type: Number, default: 0, min: 0 } },
    salary: {
      min: { type: Number, min: 0 },
      max: { type: Number, min: 0 },
      currency: { type: String, default: 'INR' },
      period: { type: String, enum: ['yearly', 'monthly'], default: 'yearly' },
      disclosed: { type: Boolean, default: true },
    },
    openings: { type: Number, default: 1, min: 1 },
    applicationDeadline: Date,
    confidential: { type: Boolean, default: false },
    noticePeriodMaxDays: { type: Number, min: 0, max: 365 },
    assignedRecruiter: { type: Schema.Types.ObjectId, ref: 'User' },
    filledCount: { type: Number, default: 0 },
    status: { type: String, enum: JOB_STATUSES, default: 'draft' },
    rejectionReason: String,
    moderatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    moderatedAt: Date,
    publishedAt: Date,
    closedAt: Date,
    featured: { type: Boolean, default: false },
    applicationsCount: { type: Number, default: 0 },
    views: { type: Number, default: 0 },
    deletedAt: Date,
  },
  { timestamps: true },
);
jobSchema.index(
  { title: 'text', skills: 'text', companyName: 'text', description: 'text' },
  { weights: { title: 10, skills: 6, companyName: 4, description: 1 }, name: 'job_text' },
);
jobSchema.index({ status: 1, publishedAt: -1 });
jobSchema.index({ status: 1, industry: 1, publishedAt: -1 });
jobSchema.index({ status: 1, featured: -1, publishedAt: -1 });
jobSchema.index({ employer: 1, status: 1, createdAt: -1 });
jobSchema.index({ 'locations.city': 1 });
jobSchema.index({ assignedRecruiter: 1, status: 1 });
export const Job = model<IJob>('Job', jobSchema, 'job_requirements');
