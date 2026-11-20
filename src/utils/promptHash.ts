import crypto from 'node:crypto';

/**
 * Canonical prompt-version hash (sha256, first 12 hex chars). The eval
 * harness and the live chat's trace recorder MUST use this same function so
 * /lab can correlate chat traces with eval runs by prompt version.
 */
export function hashPrompt(prompt: string): string {
  return crypto.createHash('sha256').update(prompt).digest('hex').slice(0, 12);
}
