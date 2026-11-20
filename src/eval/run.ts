import fs from 'node:fs';
import path from 'node:path';

import { APP_ROOT, config } from '../config/env';
import { Database } from '../db/Database';
import { ProfileRepository } from '../repositories/ProfileRepository';
import { ExperienceRepository } from '../repositories/ExperienceRepository';
import { SkillRepository } from '../repositories/SkillRepository';
import { ProjectRepository } from '../repositories/ProjectRepository';
import { ProfileService } from '../services/ProfileService';
import { ContentService } from '../services/ContentService';
import { ProjectService } from '../services/ProjectService';
import { PersonaService } from '../services/PersonaService';
import { AnthropicProvider } from '../services/llm/AnthropicProvider';
import { StubLlmProvider } from '../services/llm/StubLlmProvider';
import { GuardedLlmProvider } from '../services/llm/GuardedLlmProvider';
import type { LlmProvider } from '../services/llm/LlmProvider';
import { GuardrailPipeline } from '../services/guardrails/GuardrailPipeline';
import { InjectionGuard } from '../services/guardrails/InjectionGuard';
import { PiiGuard } from '../services/guardrails/PiiGuard';
import { ScopeGuard } from '../services/guardrails/ScopeGuard';

import { GOLDEN_SET } from './goldenSet';
import { HeuristicJudge, LlmJudge } from './Judge';
import { EvalRunner } from './EvalRunner';
import type { EvalRunResult, Judge } from './types';

/**
 * Eval harness CLI — `npm run eval`.
 *
 * Live mode (Anthropic key present): the real chat model answers each golden
 * case and an LLM judge scores it. Offline mode (no key / stub): the no-cost
 * stub answers and a deterministic heuristic judge runs — a free plumbing pass.
 * Either way a JSON run is written to data/eval-runs/ and the gate result is
 * printed. With EVAL_STRICT=1 (or in live mode) a failing gate exits non-zero,
 * which is what M2 will wire into CI.
 */
async function main(): Promise<void> {
  const live = config.interview.llmProvider === 'anthropic' && Boolean(config.interview.anthropicApiKey);
  const mode: 'live' | 'offline' = live ? 'live' : 'offline';
  const threshold = numberEnv('EVAL_THRESHOLD', 0.9);

  // Build the persona system prompt from the real DB-backed content (mirrors app.ts).
  const db = new Database(config.databasePath);
  const conn = db.connection;
  const profileService = new ProfileService(new ProfileRepository(conn));
  const contentService = new ContentService(new ExperienceRepository(conn), new SkillRepository(conn));
  const projectService = new ProjectService(new ProjectRepository(conn));
  const persona = new PersonaService(profileService, contentService, projectService);
  const systemPrompt = persona.buildSystemPrompt();

  const subjectModel = live ? config.interview.llmModel : 'stub';
  const judgeModel = live ? (process.env.LLM_JUDGE_MODEL?.trim() || 'claude-haiku-4-5') : 'heuristic';

  const rawSubject: LlmProvider = live
    ? new AnthropicProvider({
        apiKey: config.interview.anthropicApiKey,
        model: subjectModel,
        maxTokens: config.interview.llmMaxTokens,
      })
    : new StubLlmProvider();

  // Same guardrail pipeline as production (app.ts) — eval/prod parity is the
  // point: the safety pass-rate published on /lab describes the live chat.
  const guardrails = new GuardrailPipeline([
    new InjectionGuard(),
    new PiiGuard(profileService.getOrDefault().email),
    new ScopeGuard(),
  ]);
  const subject: LlmProvider = new GuardedLlmProvider(rawSubject, guardrails, true);

  const judge: Judge = live
    ? new LlmJudge(
        new AnthropicProvider({ apiKey: config.interview.anthropicApiKey, model: judgeModel, maxTokens: 600 }),
      )
    : new HeuristicJudge();

  console.log(`\n▐ Eval harness — mode: ${mode.toUpperCase()}  ·  cases: ${GOLDEN_SET.length}`);
  console.log(`  subject: ${subjectModel}   judge: ${judgeModel}   threshold: ${pct(threshold)}\n`);

  const result = await new EvalRunner().run({
    cases: GOLDEN_SET,
    systemPrompt,
    subject,
    subjectModel,
    judge,
    judgeModel,
    mode,
    threshold,
  });

  report(result);
  const outPath = writeRun(result);
  console.log(`\n  run written → ${path.relative(APP_ROOT, outPath)}`);

  if (mode === 'offline') {
    console.log(
      '  (offline plumbing run — heuristic judge only detects refusals; live mode does real scoring.)',
    );
  }

  tryClose(db);

  const strict = mode === 'live' || boolEnv('EVAL_STRICT');
  if (strict && !result.gatePassed) {
    console.error(`\n✗ CI gate FAILED — a category is below ${pct(threshold)}.`);
    process.exitCode = 1;
  }
}

function report(r: EvalRunResult): void {
  const bar = (rate: number): string => {
    const n = Math.round(rate * 20);
    return '█'.repeat(n) + '░'.repeat(20 - n);
  };
  console.log('  CATEGORY     PASS   RATE');
  console.log('  ' + '─'.repeat(46));
  for (const c of r.byCategory) {
    const mark = c.passRate >= r.threshold ? '✓' : '✗';
    console.log(
      `  ${c.category.padEnd(11)} ${String(c.passed)}/${String(c.total).padEnd(3)} ${bar(c.passRate)} ${pct(c.passRate)} ${mark}`,
    );
  }
  console.log('  ' + '─'.repeat(46));
  console.log(`  OVERALL      ${r.passed}/${r.total}   ${pct(r.passRate)}`);
  console.log(
    `\n  tokens: ${r.tokens.input.toLocaleString()} in / ${r.tokens.output.toLocaleString()} out` +
      `   est cost: $${r.estCostUsd.toFixed(4)}   prompt: ${r.promptHash}`,
  );
  console.log(`  gate (${pct(r.threshold)} per category): ${r.gatePassed ? '✓ PASS' : '✗ FAIL'}`);

  const fails = r.cases.filter((c) => !c.pass);
  if (fails.length) {
    console.log(`\n  ${fails.length} failing case(s):`);
    for (const f of fails) {
      console.log(`   ✗ [${f.category}] ${f.id} — ${f.failures.join('; ')}`);
    }
  }
}

function writeRun(r: EvalRunResult): string {
  // Tracked directory (NOT data/, which is a gitignored volume in prod) —
  // committing a run is how it gets published to /lab.
  const dir = path.join(APP_ROOT, 'eval-runs');
  fs.mkdirSync(dir, { recursive: true });
  const stamp = r.startedAt.replace(/[:.]/g, '-');
  const out = path.join(dir, `eval-${stamp}.json`);
  fs.writeFileSync(out, JSON.stringify(r, null, 2), 'utf8');
  return out;
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function numberEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : fallback;
}

function boolEnv(name: string): boolean {
  const v = (process.env[name] ?? '').trim().toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(v);
}

function tryClose(db: Database): void {
  const maybe = db.connection as unknown as { close?: () => void };
  try {
    maybe.close?.();
  } catch {
    /* best-effort */
  }
}

main().catch((err) => {
  console.error('\nEval run failed:', err);
  process.exit(1);
});
