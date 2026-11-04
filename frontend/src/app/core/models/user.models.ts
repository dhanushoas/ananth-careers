export type Role = 'candidate' | 'employer' | 'recruiter' | 'admin';
export type UserStatus = 'active' | 'pending' | 'blocked';

export const ADMIN_PERMISSIONS = [
  'users:manage',
  'employers:verify',
  'recruiters:manage',
  'jobs:moderate',
  'recruitment:manage',
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

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];
export type Permission = AdminPermission | '*';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  mobile: string;
  role: Role;
  status: UserStatus;
  emailVerified: boolean;
  permissions: string[];
  hasAvatar: boolean;
  createdAt: string;
  lastLoginAt?: string | null;
  /** Not in the AuthUser contract; shown in settings only when the server includes it. */
  marketingEmails?: boolean;
  /** v2: consent timestamps and marketing preference. */
  consent?: { termsAcceptedAt?: string; privacyAcceptedAt?: string; marketingEmails?: boolean };
}

export interface LoginResponse {
  accessToken: string;
  expiresIn: number;
  user: AuthUser;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterCandidateRequest {
  name: string;
  email: string;
  mobile: string;
  password: string;
  acceptTerms: true;
  acceptPrivacy: true;
  careerLevel?: 'fresher' | 'experienced';
  shareProfileConsent?: boolean;
}

/** @deprecated v1 name */
export type RegisterJobSeekerRequest = RegisterCandidateRequest;

export interface RegisterEmployerRequest {
  name: string;
  email: string;
  mobile: string;
  password: string;
  companyName: string;
  industryId: string;
  website?: string;
  registrationNumber?: string;
  acceptTerms: true;
  acceptPrivacy: true;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface TokenPasswordRequest {
  token: string;
  password: string;
}

export interface UpdateMeRequest {
  name?: string;
  mobile?: string;
}

export interface AuthProviders {
  google: { enabled: boolean; clientId: string | null };
}

export type GoogleSignup =
  | {
      role: 'candidate';
      mobile: string;
      acceptTerms: true;
      acceptPrivacy: true;
      careerLevel?: 'fresher' | 'experienced';
      shareProfileConsent?: boolean;
    }
  | {
      role: 'employer';
      mobile: string;
      acceptTerms: true;
      acceptPrivacy: true;
      companyName: string;
      industryId: string;
      website?: string;
    };

export type GoogleAuthResponse =
  | ({ status: 'signed_in' } & LoginResponse)
  | { status: 'signup_required'; profile: { email: string; name: string; picture?: string | null } };
