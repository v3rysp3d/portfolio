import type { Guard, GuardInput, GuardVerdict } from './types';

/**
 * Personal-data guard. Blocks input asking for private contact details, and
 * flags (without blocking) output that appears to contain a phone number or
 * an email other than the public profile address.
 */
const INPUT_PATTERNS: RegExp[] = [
  /\b(home|street|residential)\s+address\b/i,
  /\bwhere\s+(do|does)\s+(you|nathan)\s+live\b/i,
  /\bpersonal\s+(phone|mobile|number|email|cell)\b/i,
  /\b(phone|mobile|cell)\s+number\b/i,
  /\bdate\s+of\s+birth\b|\bbirth\s*day\b|\bbirthdate\b/i,
  /\b(bank|credit\s*card|passport|licen[cs]e)\s+(number|details?)\b/i,
];

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const PHONE_RE = /(?:\+?\d[\s-]?){8,13}\d/;

export class PiiGuard implements Guard {
  readonly name = 'pii';

  constructor(private readonly publicEmail: string | null = null) {}

  check({ text, direction }: GuardInput): GuardVerdict {
    if (direction === 'input') {
      if (INPUT_PATTERNS.some((p) => p.test(text))) {
        return {
          flag: 'pii',
          blocked: true,
          message:
            "I'd rather not share personal contact or identity details here — the public " +
            "contact links on this site are the right channel. Happy to talk about Nathan's " +
            'work, background, or how he approaches problems.',
        };
      }
      return { flag: null, blocked: false };
    }

    // Output direction: flag-only (the reply still goes out; the trace records it).
    const emails = (text.match(EMAIL_RE) ?? []).filter(
      (e) => !this.publicEmail || e.toLowerCase() !== this.publicEmail.toLowerCase(),
    );
    if (emails.length > 0 || PHONE_RE.test(text)) {
      return { flag: 'pii-out', blocked: false };
    }
    return { flag: null, blocked: false };
  }
}
