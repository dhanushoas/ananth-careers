/** Success envelope returned by every API endpoint. */
export interface ApiSuccess<T> {
  success: true;
  message: string;
  data: T;
  timestamp: string;
}

export interface ApiErrorDetail {
  field: string;
  message: string;
}

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'INVALID_CREDENTIALS'
  | 'UNAUTHENTICATED'
  | 'TOKEN_EXPIRED'
  | 'FORBIDDEN'
  | 'EMAIL_NOT_VERIFIED'
  | 'ACCOUNT_BLOCKED'
  | 'ACCOUNT_PENDING_APPROVAL'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'DUPLICATE_RESOURCE'
  | 'INVALID_STATE'
  | 'PAYLOAD_TOO_LARGE'
  | 'UNSUPPORTED_FILE_TYPE'
  | 'ACCOUNT_LOCKED'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE'
  | 'ALREADY_APPLIED'
  | 'ALREADY_SHORTLISTED'
  | 'ALREADY_SUBMITTED'
  | 'CONSENT_REQUIRED'
  | 'CONTACT_CONSENT_REQUIRED'
  | 'COMPANY_NOT_VERIFIED'
  | 'IN_USE'
  | 'LIMIT_REACHED'
  | 'GOOGLE_TOKEN_INVALID'
  | 'NETWORK_ERROR'
  | 'UNKNOWN_ERROR';

/** Error envelope. */
export interface ApiErrorBody {
  success: false;
  message: string;
  errorCode: ErrorCode;
  details?: ApiErrorDetail[];
  timestamp?: string;
}

/** Normalised error passed around the app. */
export interface AppError {
  status: number;
  errorCode: ErrorCode;
  message: string;
  details: ApiErrorDetail[];
}

export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PageQuery {
  page?: number;
  limit?: number;
}

/** Primitive values allowed in query strings. */
export type QueryValue = string | number | boolean | null | undefined | readonly (string | number)[];
export type QueryParams = Record<string, QueryValue>;
