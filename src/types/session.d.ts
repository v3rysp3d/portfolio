import 'express-session';
import type { SessionUser } from '../models/User';

export type FlashKind = 'success' | 'error' | 'info';
export interface FlashMessage {
  type: FlashKind;
  message: string;
}

declare module 'express-session' {
  interface SessionData {
    /** The authenticated admin, if signed in. */
    user?: SessionUser;
    /** Per-session CSRF synchroniser token. */
    csrfToken?: string;
    /** One-shot flash messages, consumed on the next render. */
    flash?: FlashMessage[];
    /** Bound interview session id, set after a valid magic-link entry. */
    interviewId?: number;
    /** Validated red-team attack id to pre-fill in chat (never raw input). */
    pendingAttack?: string;
  }
}
