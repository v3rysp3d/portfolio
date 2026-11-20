import type { SqliteConnection } from '../db/Database';

export interface NewTrace {
  sessionId: number | null;
  modelTier: string;
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  latencyMs: number;
  refused: boolean;
  guardrailFlags: string[] | null;
  estCostUsd: number;
  promptVersionHash: string;
}

export interface TraceAggregates {
  turnCount: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  estCostUsd: number;
  refusedCount: number;
  guardrailFlaggedCount: number;
  firstTraceAt: string | null;
}

export interface TierMix {
  tier: string;
  turns: number;
  estCostUsd: number;
}

/** Data-access for per-turn telemetry rows. Aggregate-only reads feed /lab. */
export class TraceRepository {
  constructor(private readonly db: SqliteConnection) {}

  create(input: NewTrace): number {
    const info = this.db
      .prepare(
        `INSERT INTO traces (
           session_id, model_tier, model_id, input_tokens, output_tokens,
           cache_read_tokens, latency_ms, refused, guardrail_flags,
           est_cost_usd, prompt_version_hash
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.sessionId,
        input.modelTier,
        input.modelId,
        input.inputTokens,
        input.outputTokens,
        input.cacheReadTokens,
        input.latencyMs,
        input.refused ? 1 : 0,
        input.guardrailFlags && input.guardrailFlags.length ? JSON.stringify(input.guardrailFlags) : null,
        input.estCostUsd,
        input.promptVersionHash,
      );
    return Number(info.lastInsertRowid);
  }

  /** Rolling-window aggregates for the dashboard's signal tiles. */
  aggregateSince(days: number): TraceAggregates {
    const row = this.db
      .prepare(
        `SELECT
           COUNT(*) AS turn_count,
           COALESCE(SUM(input_tokens), 0) AS input_tokens,
           COALESCE(SUM(output_tokens), 0) AS output_tokens,
           COALESCE(SUM(cache_read_tokens), 0) AS cache_read_tokens,
           COALESCE(SUM(est_cost_usd), 0) AS est_cost_usd,
           COALESCE(SUM(refused), 0) AS refused_count,
           COALESCE(SUM(CASE WHEN guardrail_flags IS NOT NULL THEN 1 ELSE 0 END), 0) AS flagged_count,
           MIN(ts) AS first_trace_at
         FROM traces
         WHERE ts >= datetime('now', ?)`,
      )
      .get(`-${days} days`) as {
      turn_count: number;
      input_tokens: number;
      output_tokens: number;
      cache_read_tokens: number;
      est_cost_usd: number;
      refused_count: number;
      flagged_count: number;
      first_trace_at: string | null;
    };
    return {
      turnCount: row.turn_count,
      inputTokens: row.input_tokens,
      outputTokens: row.output_tokens,
      cacheReadTokens: row.cache_read_tokens,
      estCostUsd: row.est_cost_usd,
      refusedCount: row.refused_count,
      guardrailFlaggedCount: row.flagged_count,
      firstTraceAt: row.first_trace_at,
    };
  }

  /** p50/p95 latency over the window (tiny volumes — percentile in TS). */
  latencyPercentiles(days: number): { p50: number | null; p95: number | null } {
    const rows = this.db
      .prepare(
        `SELECT latency_ms FROM traces
         WHERE ts >= datetime('now', ?) AND model_tier NOT IN ('none') AND latency_ms > 0
         ORDER BY latency_ms ASC`,
      )
      .all(`-${days} days`) as Array<{ latency_ms: number }>;
    if (!rows.length) return { p50: null, p95: null };
    const at = (q: number): number => rows[Math.min(rows.length - 1, Math.floor(q * rows.length))].latency_ms;
    return { p50: at(0.5), p95: at(0.95) };
  }

  routingMix(days: number): TierMix[] {
    const rows = this.db
      .prepare(
        `SELECT model_tier AS tier, COUNT(*) AS turns, COALESCE(SUM(est_cost_usd), 0) AS est_cost_usd
         FROM traces
         WHERE ts >= datetime('now', ?)
         GROUP BY model_tier
         ORDER BY turns DESC`,
      )
      .all(`-${days} days`) as Array<{ tier: string; turns: number; est_cost_usd: number }>;
    return rows.map((r) => ({ tier: r.tier, turns: r.turns, estCostUsd: r.est_cost_usd }));
  }

  /** Average estimated cost per session over the window. */
  costPerSession(days: number): number | null {
    const row = this.db
      .prepare(
        `SELECT AVG(session_cost) AS avg_cost FROM (
           SELECT SUM(est_cost_usd) AS session_cost
           FROM traces
           WHERE ts >= datetime('now', ?) AND session_id IS NOT NULL
           GROUP BY session_id
         )`,
      )
      .get(`-${days} days`) as { avg_cost: number | null };
    return row.avg_cost;
  }
}
