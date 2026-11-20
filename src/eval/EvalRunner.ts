import type { LlmProvider } from '../services/llm/LlmProvider';
import { cost } from '../services/llm/pricing';
import { hashPrompt } from '../utils/promptHash';
import {
  EVAL_CATEGORIES,
  resolveExpect,
  type CaseResult,
  type CategoryScore,
  type EvalRunResult,
  type Expect,
  type GoldenCase,
  type Judge,
  type Verdict,
} from './types';

export interface RunOptions {
  cases: GoldenCase[];
  /** The persona system prompt under test (also given to the judge as truth). */
  systemPrompt: string;
  /** The model being evaluated. */
  subject: LlmProvider;
  subjectModel: string;
  /** The evaluator. */
  judge: Judge;
  judgeModel: string;
  mode: 'live' | 'offline';
  /** Per-category pass-rate the CI gate requires (0–1). */
  threshold: number;
}

/** Derive pass/fail for one case from the judge's raw verdict + expectations. */
export function computePass(verdict: Verdict, expect: Expect): { pass: boolean; failures: string[] } {
  const failures: string[] = [];
  if (expect.refuse) {
    if (!verdict.refused) failures.push('should have refused/declined, but complied');
  } else {
    if (verdict.refused) failures.push('refused a legitimate interview question');
    if (expect.grounded && !verdict.grounded) failures.push('not grounded (possible fabrication)');
    if (expect.inScope && !verdict.inScope) failures.push('drifted off the interview topic');
    if (verdict.toneScore < expect.minTone) {
      failures.push(`tone ${verdict.toneScore} below required ${expect.minTone}`);
    }
  }
  return { pass: failures.length === 0, failures };
}

/**
 * Runs every golden case through the subject model then the judge, sequentially
 * (predictable cost + respects rate limits), and aggregates per-category
 * pass-rates. The gate passes only when every category meets the threshold.
 */
export class EvalRunner {
  async run(opts: RunOptions): Promise<EvalRunResult> {
    const startedAt = new Date().toISOString();
    const results: CaseResult[] = [];

    let subjIn = 0;
    let subjOut = 0;
    let judgeIn = 0;
    let judgeOut = 0;

    for (const c of opts.cases) {
      const expect = resolveExpect(c.expect);

      const answerRes = await opts.subject.complete(opts.systemPrompt, [
        { role: 'user', content: c.input },
      ]);
      subjIn += answerRes.inputTokens;
      subjOut += answerRes.outputTokens;

      // A safety refusal from the model itself counts as a (correct) refusal.
      const answer = answerRes.refused ? answerRes.text || '(model declined)' : answerRes.text;

      const judged = await opts.judge.judge({
        input: c.input,
        answer,
        expect,
        reference: opts.systemPrompt,
      });
      judgeIn += judged.inputTokens;
      judgeOut += judged.outputTokens;

      const verdict: Verdict = answerRes.refused
        ? { ...judged.verdict, refused: true }
        : judged.verdict;
      const { pass, failures } = computePass(verdict, expect);

      results.push({
        id: c.id,
        category: c.category,
        input: c.input,
        answer,
        verdict,
        pass,
        failures,
      });
    }

    const byCategory: CategoryScore[] = EVAL_CATEGORIES.map((category) => {
      const inCat = results.filter((r) => r.category === category);
      const passed = inCat.filter((r) => r.pass).length;
      return {
        category,
        total: inCat.length,
        passed,
        passRate: inCat.length ? passed / inCat.length : 1,
      };
    }).filter((s) => s.total > 0);

    const passed = results.filter((r) => r.pass).length;
    const gatePassed = byCategory.every((s) => s.passRate >= opts.threshold);

    const estCostUsd =
      cost(opts.subjectModel, subjIn, subjOut) + cost(opts.judgeModel, judgeIn, judgeOut);

    return {
      startedAt,
      finishedAt: new Date().toISOString(),
      mode: opts.mode,
      subjectModel: opts.subjectModel,
      judgeModel: opts.judgeModel,
      promptHash: hashPrompt(opts.systemPrompt),
      total: results.length,
      passed,
      passRate: results.length ? passed / results.length : 1,
      byCategory,
      threshold: opts.threshold,
      gatePassed,
      tokens: { input: subjIn + judgeIn, output: subjOut + judgeOut },
      estCostUsd,
      cases: results,
    };
  }
}
