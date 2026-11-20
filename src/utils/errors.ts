/** An error carrying an HTTP status code, for the central error handler. */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export class NotFoundError extends HttpError {
  constructor(message = 'Not found') {
    super(404, message);
    this.name = 'NotFoundError';
  }
}

/**
 * Thrown by services when domain-level validation fails (e.g. a duplicate slug).
 * Controllers catch this and re-render the form with per-field messages.
 */
export class FieldValidationError extends Error {
  constructor(public readonly fields: Record<string, string>) {
    super('Validation failed');
    this.name = 'FieldValidationError';
  }
}
