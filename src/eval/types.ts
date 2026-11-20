import { z } from 'zod';

/**
 * Eval harness types (M1).
 *
 * The harness measures the interview persona the same way a hiring manager
 * would judge it: does it answer from real facts (grounded), stay on topic
 * (scope), sound like a real candidate (tone), and refuse adversarial input
 * (safety). Each golden case declares what a good answer must satisfy; a judge
 * returns raw signals; the runner derives pass/fail deterministically.
 */

export const EVAL_CATEGORIES = ['factual', 'tone', 'scope', 'safety'] as const;
export type EvalCategory = (typeof EVAL_CATEGORIES)[number];

/** What a good answer to a case must satisfy. All fields have safe defaults. */
export interface Expect {
  /** Every factual claim about the candidate must be supported by known facts. */
  grounded: boolean;
  /** The answer must stay on the interview topic (incl. redirecting off-topic). */
  inScope: boolean;
  /** The answer MUST decline/refuse (injection, secrets, PII, jailbreak). */
  refuse: boolean;
  /** Minimum acceptable tone score (1–5). */
  minTone: number;
}

export const DEFAULT_EXPECT: Expect = { grounded: true, inScope: true, refuse: false, minTone: 3 };

export function resolveExpect(partial?: Partial<Expect>): Expect {
  return { ...DEFAULT_EXPECT, ...(partial ?? {}) };
}

/** One version-controlled test case. Drafted from real persona data. */
export interface GoldenCase {
  id: string;
  category: EvalCategory;
  /** The interviewer's question — or the adversarial attack. */
  input: string;
  expect?: Partial<Expect>;
  notes?: string;
}

/** Raw signals returned by a judge for a single answer. */
export const verdictSchema = z.object({
  grounded: z.boolean(),
  inScope: z.boolean(),
  refused: z.boolean(),
  toneScore: z.number().min(1).max(5),
  rationale: z.string().min(1),
});
export type Verdict = z.infer<typeof verdictSchema>;

export interface JudgeInput {
  input: string;
  answer: string;
  expect: Expect;
  /** The full persona prompt — the ONLY facts the judge may treat as true. */
  reference: string;
}

export interface JudgeResult {
  verdict: Verdict;
  inputTokens: number;
  outputTokens: number;
}

export interface Judge {
  readonly name: string;
  judge(args: JudgeInput): Promise<JudgeResult>;
}

export interface CaseResult {
  id: string;
  category: EvalCategory;
  input: string;
  answer: string;
  verdict: Verdict;
  pass: boolean;
  failures: string[];
}

export interface CategoryScore {
  category: EvalCategory;
  total: number;
  passed: number;
  passRate: number;
}

export interface EvalRunResult {
  startedAt: string;
  finishedAt: string;
  mode: 'live' | 'offline';
  subjectModel: string;
  judgeModel: string;
  promptHash: string;
  total: number;
  passed: number;
  passRate: number;
  byCategory: CategoryScore[];
  threshold: number;
  /** True iff every category meets the threshold. */
  gatePassed: boolean;
  tokens: { input: number; output: number };
  estCostUsd: number;
  cases: CaseResult[];
}
