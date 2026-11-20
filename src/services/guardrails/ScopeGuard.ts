import type { Guard, GuardInput, GuardVerdict } from './types';

/**
 * Scope drift detector — flag-only in v1 (the persona prompt already
 * redirects politely, and keyword heuristics have too many false positives
 * to justify hard-blocking). The flag feeds the /lab guardrail telemetry.
 */
const OFF_TOPIC_PATTERNS: RegExp[] = [
  /\b(write|generate|draft)\s+(me\s+)?(a\s+)?(poem|story|essay|song|rap|novel)\b/i,
  /\b(homework|assignment|exam)\s+(question|answer|help)\b/i,
  /\btranslate\s+(this|the\s+following)\b/i,
  /\b(medical|legal|financial|investment)\s+advice\b/i,
  /\b(politics|election|religion)\b/i,
];

export class ScopeGuard implements Guard {
  readonly name = 'scope';

  check({ text, direction }: GuardInput): GuardVerdict {
    if (direction !== 'input') return { flag: null, blocked: false };
    if (OFF_TOPIC_PATTERNS.some((p) => p.test(text))) {
      return { flag: 'scope', blocked: false };
    }
    return { flag: null, blocked: false };
  }
}
