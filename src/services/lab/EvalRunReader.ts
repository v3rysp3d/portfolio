import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { APP_ROOT } from '../../config/env';

/**
 * Reads published eval runs from the tracked eval-runs/ directory. Committing
 * a run file is the publish act — nothing here can invent a number. Only the
 * aggregate fields are validated/parsed; case verdicts load minimally (id,
 * category, pass) so transcripts never enter the page path.
 */
const runSchema = z.object({
  startedAt: z.string(),
  finishedAt: z.string(),
  mode: z.enum(['live', 'offline']),
  subjectModel: z.string(),
  judgeModel: z.string(),
  promptHash: z.string(),
  total: z.number(),
  passed: z.number(),
  passRate: z.number(),
  byCategory: z.array(
    z.object({ category: z.string(), total: z.number(), passed: z.number(), passRate: z.number() }),
  ),
  threshold: z.number(),
  gatePassed: z.boolean(),
  tokens: z.object({ input: z.number(), output: z.number() }),
  estCostUsd: z.number(),
  cases: z
    .array(z.object({ id: z.string(), category: z.string(), pass: z.boolean() }).passthrough())
    .default([]),
});

export type PublishedEvalRun = z.infer<typeof runSchema>;

const CACHE_TTL_MS = 60_000;

export class EvalRunReader {
  private readonly dir = path.join(APP_ROOT, 'eval-runs');
  private cache: PublishedEvalRun[] | null = null;
  private cachedAt = 0;

  /** All valid runs sorted oldest → newest. Malformed files are skipped. */
  list(): PublishedEvalRun[] {
    const now = Date.now();
    if (this.cache && now - this.cachedAt < CACHE_TTL_MS) return this.cache;

    const runs: PublishedEvalRun[] = [];
    try {
      for (const file of fs.readdirSync(this.dir)) {
        if (!file.endsWith('.json')) continue;
        try {
          const raw = JSON.parse(fs.readFileSync(path.join(this.dir, file), 'utf8'));
          runs.push(runSchema.parse(raw));
        } catch (err) {
          console.warn(`[lab] skipping malformed eval run ${file}:`, (err as Error).message);
        }
      }
    } catch {
      // Directory missing (fresh clone before any run) — an honest empty state.
    }
    runs.sort((a, b) => a.startedAt.localeCompare(b.startedAt));
    this.cache = runs;
    this.cachedAt = now;
    return runs;
  }

  latest(): PublishedEvalRun | null {
    const runs = this.list();
    return runs.length ? runs[runs.length - 1] : null;
  }
}
