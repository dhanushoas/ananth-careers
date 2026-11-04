export type ErrorDetail = { field?: string; message: string };

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly errorCode: string,
    message: string,
    public readonly details: ErrorDetail[] = [],
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Some fields are invalid', details: ErrorDetail[] = []) {
    super(400, 'VALIDATION_ERROR', message, details);
  }
}
export class UnauthenticatedError extends AppError {
  constructor(message = 'Please sign in to continue', code = 'UNAUTHENTICATED') {
    super(401, code, message);
  }
}
export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to perform this action', code = 'FORBIDDEN') {
    super(403, code, message);
  }
}
export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(404, 'NOT_FOUND', `${resource} not found`);
  }
}
export class ConflictError extends AppError {
  constructor(message: string, code = 'CONFLICT') {
    super(409, code, message);
  }
}
export class InvalidStateError extends AppError {
  constructor(message: string) {
    super(409, 'INVALID_STATE', message);
  }
}
export class FileError extends AppError {}
export class ServiceUnavailableError extends AppError {
  constructor(message = 'Service temporarily unavailable. Please try again shortly.') {
    super(503, 'SERVICE_UNAVAILABLE', message);
  }
}
