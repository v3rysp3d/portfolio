import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../utils/errors';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Synchroniser-token CSRF protection. A random token is minted per session and
 * exposed to templates as `res.locals.csrfToken`; every state-changing request
 * must echo it back (hidden `_csrf` form field or `X-CSRF-Token` header), and it
 * is compared in constant time.
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('base64url');
  }
  res.locals.csrfToken = req.session.csrfToken;

  if (SAFE_METHODS.has(req.method.toUpperCase())) {
    next();
    return;
  }

  const body = req.body as Record<string, unknown> | undefined;
  const submitted =
    (body && typeof body._csrf === 'string' ? body._csrf : undefined) ??
    req.get('x-csrf-token') ??
    '';
  const expected = req.session.csrfToken;

  if (!submitted || !expected || !timingSafeEqual(submitted, expected)) {
    next(new HttpError(403, 'Invalid or missing CSRF token. Please reload and try again.'));
    return;
  }

  next();
}
