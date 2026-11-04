import { HttpErrorResponse } from '@angular/common/http';
import { ApiErrorBody, AppError, ErrorCode } from '../models';

/** Friendly, user-facing messages for every contract error code. */
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  VALIDATION_ERROR: 'Some of the information provided is invalid. Please review the highlighted fields.',
  INVALID_CREDENTIALS: 'The email or password you entered is incorrect.',
  UNAUTHENTICATED: 'Please sign in to continue.',
  TOKEN_EXPIRED: 'Your session has expired. Please sign in again.',
  FORBIDDEN: 'You do not have permission to perform this action.',
  EMAIL_NOT_VERIFIED: 'Please verify your email address before signing in.',
  ACCOUNT_BLOCKED: 'Your account has been blocked. Please contact support.',
  ACCOUNT_PENDING_APPROVAL: 'Your account is awaiting approval by the Veejee Services team.',
  NOT_FOUND: 'The requested item could not be found.',
  CONFLICT: 'This action conflicts with existing data.',
  DUPLICATE_RESOURCE: 'This record already exists.',
  INVALID_STATE: 'This action is not allowed in the current state.',
  PAYLOAD_TOO_LARGE: 'The file is too large.',
  UNSUPPORTED_FILE_TYPE: 'This file type is not supported.',
  ACCOUNT_LOCKED: 'Too many failed attempts. Your account is locked for 15 minutes.',
  RATE_LIMITED: 'Too many requests. Please wait a moment and try again.',
  INTERNAL_ERROR: 'Something went wrong on our side. Please try again.',
  SERVICE_UNAVAILABLE: 'The service is temporarily unavailable. Please try again shortly.',
  ALREADY_APPLIED: 'You have already applied for this job through Veejee Services.',
  ALREADY_SHORTLISTED: 'This candidate is already shortlisted for this requirement.',
  ALREADY_SUBMITTED: 'This candidate has already been submitted to the company for this requirement.',
  CONSENT_REQUIRED: 'The candidate has not consented to sharing their profile with companies.',
  CONTACT_CONSENT_REQUIRED: 'The candidate has not consented to sharing contact details with companies.',
  COMPANY_NOT_VERIFIED: 'Your company must be verified by Veejee Services before requirements can be submitted.',
  IN_USE: 'This item is in use and cannot be removed.',
  LIMIT_REACHED: 'You have reached the limit for this item.',
  GOOGLE_TOKEN_INVALID: 'Your Google sign-in has expired. Please click “Continue with Google” again.',
  NETWORK_ERROR: 'Unable to reach the server. Check your connection and try again.',
  UNKNOWN_ERROR: 'Unable to process your request.',
};

/** Codes for which the server message is usually more specific than our generic one. */
const PREFER_SERVER_MESSAGE: ReadonlySet<ErrorCode> = new Set<ErrorCode>([
  'VALIDATION_ERROR',
  'CONFLICT',
  'DUPLICATE_RESOURCE',
  'INVALID_STATE',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONSENT_REQUIRED',
  'CONTACT_CONSENT_REQUIRED',
  'LIMIT_REACHED',
]);

function statusToCode(status: number): ErrorCode {
  switch (status) {
    case 0:
      return 'NETWORK_ERROR';
    case 400:
      return 'VALIDATION_ERROR';
    case 401:
      return 'UNAUTHENTICATED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'CONFLICT';
    case 413:
      return 'PAYLOAD_TOO_LARGE';
    case 415:
      return 'UNSUPPORTED_FILE_TYPE';
    case 423:
      return 'ACCOUNT_LOCKED';
    case 429:
      return 'RATE_LIMITED';
    case 503:
      return 'SERVICE_UNAVAILABLE';
    default:
      return status >= 500 ? 'INTERNAL_ERROR' : 'UNKNOWN_ERROR';
  }
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return (
    typeof value === 'object' &&
    value !== null &&
    'errorCode' in value &&
    typeof (value as { errorCode: unknown }).errorCode === 'string'
  );
}

/** Normalise any HttpClient error into an {@link AppError}. */
export function toAppError(error: unknown): AppError {
  // Angular resources wrap non-Error throwables (HttpErrorResponse) in an Error with `cause`.
  if (error instanceof Error && (error as Error & { cause?: unknown }).cause instanceof HttpErrorResponse) {
    return toAppError((error as Error & { cause?: unknown }).cause);
  }
  if (error instanceof HttpErrorResponse) {
    const body: unknown = error.error;
    if (isApiErrorBody(body)) {
      const code = (body.errorCode in ERROR_MESSAGES ? body.errorCode : statusToCode(error.status)) as ErrorCode;
      return {
        status: error.status,
        errorCode: code,
        message: body.message || ERROR_MESSAGES[code],
        details: Array.isArray(body.details) ? body.details : [],
      };
    }
    const code = statusToCode(error.status);
    return { status: error.status, errorCode: code, message: ERROR_MESSAGES[code], details: [] };
  }
  return { status: 0, errorCode: 'UNKNOWN_ERROR', message: ERROR_MESSAGES.UNKNOWN_ERROR, details: [] };
}

/** The message to show the user for an error. */
export function friendlyMessage(error: AppError): string {
  if (PREFER_SERVER_MESSAGE.has(error.errorCode) && error.message) {
    return error.message;
  }
  return ERROR_MESSAGES[error.errorCode] ?? error.message;
}
