import { Schema, model, type ObjectId } from './base';
import { CONTENT_KEYS } from '../common/constants';

export interface INotification {
  _id: ObjectId;
  user: ObjectId;
  type: string;
  title: string;
  message: string;
  link?: string;
  readAt?: Date;
  createdAt: Date;
}
const notificationSchema = new Schema<INotification>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, required: true },
    title: { type: String, required: true, maxlength: 200 },
    message: { type: String, required: true, maxlength: 1000 },
    link: String,
    readAt: Date,
  },
  { timestamps: true },
);
notificationSchema.index({ user: 1, readAt: 1, createdAt: -1 });
// Keep notifications for 180 days.
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 180 * 24 * 3600 });
export const Notification = model<INotification>('Notification', notificationSchema, 'notifications');

export interface IContactEnquiry {
  _id: ObjectId;
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  enquiryType: 'candidate' | 'employer' | 'general';
  status: 'new' | 'in_progress' | 'resolved';
  notes?: string;
  handledBy?: ObjectId;
  ip?: string;
}
const enquirySchema = new Schema<IContactEnquiry>(
  {
    name: { type: String, required: true, maxlength: 100 },
    email: { type: String, required: true, lowercase: true },
    phone: String,
    subject: { type: String, required: true, maxlength: 200 },
    message: { type: String, required: true, maxlength: 5000 },
    enquiryType: { type: String, enum: ['candidate', 'employer', 'general'], default: 'general' },
    status: { type: String, enum: ['new', 'in_progress', 'resolved'], default: 'new', index: true },
    notes: { type: String, maxlength: 2000 },
    handledBy: { type: Schema.Types.ObjectId, ref: 'User' },
    ip: { type: String, select: false },
  },
  { timestamps: true },
);
export const ContactEnquiry = model<IContactEnquiry>('ContactEnquiry', enquirySchema, 'contact_enquiries');

export interface IAuditLog {
  _id: ObjectId;
  actor?: ObjectId;
  actorRole?: string;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
  createdAt: Date;
}
const auditSchema = new Schema<IAuditLog>(
  {
    actor: { type: Schema.Types.ObjectId, ref: 'User' },
    actorRole: String,
    action: { type: String, required: true },
    entityType: { type: String, required: true },
    entityId: String,
    metadata: Schema.Types.Mixed,
    ip: String,
    userAgent: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
auditSchema.index({ createdAt: -1 });
auditSchema.index({ action: 1, createdAt: -1 });
auditSchema.index({ actor: 1, createdAt: -1 });
export const AuditLog = model<IAuditLog>('AuditLog', auditSchema, 'audit_logs');

/** Durable email queue with retry/back-off. */
export interface IEmailOutbox {
  _id: ObjectId;
  to: string;
  subject: string;
  html: string;
  text: string;
  template: string;
  status: 'pending' | 'sending' | 'sent' | 'failed' | 'suppressed';
  attempts: number;
  nextAttemptAt: Date;
  lastError?: string;
  sentAt?: Date;
  createdAt: Date;
}
const outboxSchema = new Schema<IEmailOutbox>(
  {
    to: { type: String, required: true },
    subject: { type: String, required: true },
    html: { type: String, required: true },
    text: { type: String, required: true },
    template: { type: String, required: true },
    status: { type: String, enum: ['pending', 'sending', 'sent', 'failed', 'suppressed'], default: 'pending' },
    attempts: { type: Number, default: 0 },
    nextAttemptAt: { type: Date, default: Date.now },
    lastError: String,
    sentAt: Date,
  },
  { timestamps: true },
);
outboxSchema.index({ status: 1, nextAttemptAt: 1 });
// Sent emails (which may contain links) are purged after 30 days.
outboxSchema.index({ sentAt: 1 }, { expireAfterSeconds: 30 * 24 * 3600 });
export const EmailOutbox = model<IEmailOutbox>('EmailOutbox', outboxSchema, 'email_outbox');

export interface ISiteContent {
  _id: ObjectId;
  key: (typeof CONTENT_KEYS)[number];
  value: unknown;
  updatedBy?: ObjectId;
  updatedAt: Date;
}
const contentSchema = new Schema<ISiteContent>(
  {
    key: { type: String, enum: CONTENT_KEYS, required: true, unique: true },
    value: { type: Schema.Types.Mixed, required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, minimize: false },
);
export const SiteContent = model<ISiteContent>('SiteContent', contentSchema, 'site_contents');

export interface ITestimonial {
  _id: ObjectId;
  name: string;
  role?: string;
  company?: string;
  quote: string;
  rating: number;
  consentConfirmed: boolean;
  published: boolean;
}
const testimonialSchema = new Schema<ITestimonial>(
  {
    name: { type: String, required: true, maxlength: 100 },
    role: { type: String, maxlength: 100 },
    company: { type: String, maxlength: 100 },
    quote: { type: String, required: true, maxlength: 1000 },
    rating: { type: Number, min: 1, max: 5, default: 5 },
    consentConfirmed: { type: Boolean, default: false },
    published: { type: Boolean, default: false },
  },
  { timestamps: true },
);
testimonialSchema.pre('validate', function () {
  if (this.published && !this.consentConfirmed) {
    this.invalidate('published', 'A testimonial can only be published after the person has given verified consent');
  }
});
export const Testimonial = model<ITestimonial>('Testimonial', testimonialSchema, 'testimonials');

/** Singleton platform configuration managed by administrators. */
export interface IPlatformSettings {
  _id: ObjectId;
  key: 'global';
  matchingWeights: { skills: number; experience: number; education: number; location: number; salary: number; noticePeriod: number };
  requireShortlistApproval: boolean;
  reminders: { profileCompletion: boolean; profileReminderDays: number; interview: boolean; interviewHoursBefore: number };
  notifications: { emailCandidatesOnStageChange: boolean; emailEmployerOnSubmission: boolean };
  updatedBy?: ObjectId;
}
const settingsSchema = new Schema<IPlatformSettings>(
  {
    key: { type: String, enum: ['global'], default: 'global', unique: true },
    matchingWeights: {
      skills: { type: Number, min: 0, max: 100, default: 40 },
      experience: { type: Number, min: 0, max: 100, default: 20 },
      education: { type: Number, min: 0, max: 100, default: 10 },
      location: { type: Number, min: 0, max: 100, default: 15 },
      salary: { type: Number, min: 0, max: 100, default: 10 },
      noticePeriod: { type: Number, min: 0, max: 100, default: 5 },
    },
    requireShortlistApproval: { type: Boolean, default: true },
    reminders: {
      profileCompletion: { type: Boolean, default: true },
      profileReminderDays: { type: Number, min: 1, max: 60, default: 7 },
      interview: { type: Boolean, default: true },
      interviewHoursBefore: { type: Number, min: 1, max: 72, default: 24 },
    },
    notifications: {
      emailCandidatesOnStageChange: { type: Boolean, default: true },
      emailEmployerOnSubmission: { type: Boolean, default: true },
    },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, minimize: false },
);
export const PlatformSettings = model<IPlatformSettings>('PlatformSettings', settingsSchema, 'platform_settings');

export async function getSettings() {
  return PlatformSettings.findOneAndUpdate({ key: 'global' }, { $setOnInsert: { key: 'global' } }, { upsert: true, new: true, setDefaultsOnInsert: true });
}
