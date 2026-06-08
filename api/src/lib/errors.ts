// Typed application errors → mapped to HTTP status by errorHandler middleware (SECURITY-09/15).
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly publicMessage: string,
    message?: string,
  ) {
    super(message ?? publicMessage);
  }
}

export class ValidationError extends AppError {
  constructor(message?: string) {
    super(400, 'Invalid request', message);
  }
}
export class AuthError extends AppError {
  constructor(message?: string) {
    super(401, 'Unauthorized', message);
  }
}
export class ForbiddenError extends AppError {
  constructor(message?: string) {
    super(403, 'Forbidden', message);
  }
}
export class NotFoundError extends AppError {
  constructor(message?: string) {
    super(404, 'Not found', message);
  }
}
export class ConflictError extends AppError {
  constructor(message?: string) {
    super(409, 'Conflict', message);
  }
}
export class LockedError extends AppError {
  constructor(message?: string) {
    super(409, 'Match is locked', message);
  }
}
