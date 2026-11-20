import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import type { RequestHandler } from 'express';

/**
 * Security response headers via Helmet, including a strict Content-Security
 * Policy. Everything is same-origin: scripts, styles, and fonts are all
 * self-hosted (fonts vendored under public/fonts), so no third-party origin
 * appears anywhere in the policy.
 */
export function securityHeaders(isProduction: boolean): RequestHandler {
  const directives: Record<string, string[] | null> = {
    defaultSrc: ["'self'"],
    baseUri: ["'self'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'"],
    fontSrc: ["'self'"],
    imgSrc: ["'self'", 'data:', 'https:'],
    connectSrc: ["'self'"],
    objectSrc: ["'none'"],
    frameAncestors: ["'self'"],
    formAction: ["'self'"],
  };
  // Enable in production; explicitly remove the Helmet default in development so
  // local http://localhost assets are never force-upgraded to https.
  directives.upgradeInsecureRequests = isProduction ? [] : null;

  return helmet({
    contentSecurityPolicy: { useDefaults: true, directives },
    // HSTS only matters over HTTPS; enable in production (assumed behind TLS).
    hsts: isProduction ? { maxAge: 15_552_000, includeSubDomains: true } : false,
    crossOriginEmbedderPolicy: false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  });
}

/** Generous global limiter — a basic brute-force / DoS speed bump. */
export const generalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: 'Too many requests. Please slow down and try again shortly.',
});

/** Strict limiter for the login endpoint to throttle credential stuffing. */
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: 'Too many login attempts. Please try again in a few minutes.',
});

/** Throttles interview access requests (per IP) — a speed bump on top of the
 *  manual-approval gate and the global daily request cap. */
export const interviewRequestRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 3,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: 'Too many requests. Please try again later.',
});

/** Throttles interview chat messages (per IP). The per-session turn cap and the
 *  global daily token cap are the real cost backstops; this stops abusive bursts. */
export const interviewMessageRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 12,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: 'You are sending messages too quickly. Please slow down.',
});
