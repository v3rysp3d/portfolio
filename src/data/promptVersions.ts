/**
 * Hand-maintained, append-only changelog mapping prompt-version hashes
 * (utils/promptHash of the persona system prompt) to human-readable labels
 * for the /lab timeline. Unlabelled hashes render as `v?<hash>` — honest by
 * construction; add an entry here when the persona prompt changes.
 */
export interface PromptVersion {
  version: string;
  hash: string;
  date: string; // YYYY-MM-DD
  note: string;
}

export const PROMPT_VERSIONS: PromptVersion[] = [
  {
    version: 'v1',
    hash: '9b013331583a',
    date: '2026-06-18',
    note: 'Initial persona prompt: DB-grounded CV + interview notes + behaviour rules. The 2026-06-18 run recorded safety 0/4 with no guardrails; deterministic guardrails (injection/PII/scope) were added in front of the same prompt and the 2026-07-05 run passes 18/18.',
  },
];

export function labelForHash(hash: string): string {
  return PROMPT_VERSIONS.find((v) => v.hash === hash)?.version ?? `v?${hash.slice(0, 6)}`;
}
