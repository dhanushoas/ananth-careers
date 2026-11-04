import { Schema, jsonHiding, model, type ObjectId } from './base';
import { ROLES, USER_STATUSES, type Role } from '../common/constants';

export interface IUser {
  _id: ObjectId;
  name: string;
  email: string;
  mobile: string;
  passwordHash?: string;
  googleId?: string;
  role: Role;
  status: (typeof USER_STATUSES)[number];
  blockedReason?: string;
  emailVerified: boolean;
  emailVerifiedAt?: Date;
  permissions: string[];
  avatarKey?: string;
  failedLoginAttempts: number;
  lockUntil?: Date;
  lastLoginAt?: Date;
  consent: { termsAcceptedAt?: Date; privacyAcceptedAt?: Date; marketingEmails: boolean };
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
    mobile: { type: String, required: true, trim: true, maxlength: 20 },
    passwordHash: { type: String, select: false },
    googleId: { type: String, select: false },
    role: { type: String, enum: ROLES, required: true, index: true },
    status: { type: String, enum: USER_STATUSES, default: 'active', index: true },
    blockedReason: String,
    emailVerified: { type: Boolean, default: false },
    emailVerifiedAt: Date,
    permissions: { type: [String], default: [] },
    avatarKey: { type: String, select: false },
    failedLoginAttempts: { type: Number, default: 0, select: false },
    lockUntil: { type: Date, select: false },
    lastLoginAt: Date,
    consent: {
      termsAcceptedAt: Date,
      privacyAcceptedAt: Date,
      marketingEmails: { type: Boolean, default: false },
    },
    deletedAt: { type: Date, index: true },
  },
  { timestamps: true },
);
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ googleId: 1 }, { unique: true, sparse: true });
userSchema.index({ role: 1, status: 1, createdAt: -1 });
userSchema.virtual('hasAvatar').get(function (this: IUser) {
  return Boolean(this.avatarKey);
});
userSchema.set('toJSON', jsonHiding('passwordHash', 'googleId', 'avatarKey', 'failedLoginAttempts', 'lockUntil'));
export const User = model<IUser>('User', userSchema, 'users');

/** Refresh-token sessions with rotation + reuse detection per token family. */
export interface IRefreshSession {
  _id: ObjectId;
  user: ObjectId;
  family: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt?: Date;
  revokedReason?: string;
  replacedBy?: ObjectId;
  ip?: string;
  userAgent?: string;
  createdAt: Date;
}
const refreshSessionSchema = new Schema<IRefreshSession>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    family: { type: String, required: true, index: true },
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    revokedAt: Date,
    revokedReason: String,
    replacedBy: { type: Schema.Types.ObjectId, ref: 'RefreshSession' },
    ip: String,
    userAgent: String,
  },
  { timestamps: true },
);
// Expired sessions are purged automatically by MongoDB.
refreshSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const RefreshSession = model<IRefreshSession>('RefreshSession', refreshSessionSchema, 'refresh_sessions');

interface IToken {
  _id: ObjectId;
  user: ObjectId;
  tokenHash: string;
  expiresAt: Date;
  usedAt?: Date;
  purpose?: 'reset' | 'invite';
}
const tokenSchema = (withPurpose: boolean) => {
  const s = new Schema<IToken>(
    {
      user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
      tokenHash: { type: String, required: true, unique: true },
      expiresAt: { type: Date, required: true },
      usedAt: Date,
      ...(withPurpose ? { purpose: { type: String, enum: ['reset', 'invite'], default: 'reset' } } : {}),
    },
    { timestamps: true },
  );
  s.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  return s;
};
export const EmailVerificationToken = model<IToken>('EmailVerificationToken', tokenSchema(false), 'email_verification_tokens');
export const PasswordResetToken = model<IToken>('PasswordResetToken', tokenSchema(true), 'password_reset_tokens');
