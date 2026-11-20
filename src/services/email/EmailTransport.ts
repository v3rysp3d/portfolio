/** A fully-rendered email ready to send. */
export interface EmailMessage {
  to: string;
  from: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * Low-level email sink. Implementations: a console transport for local dev and
 * an AWS SES transport for production. Swapped via config in the composition
 * root, so the rest of the app never knows which is in use.
 */
export interface EmailTransport {
  readonly name: string;
  send(message: EmailMessage): Promise<void>;
}
