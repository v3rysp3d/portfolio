import { labelForHash, PROMPT_VERSIONS, type PromptVersion } from '../../data/promptVersions';
import type { InterviewUsageRepository } from '../../repositories/InterviewUsageRepository';
import type { TraceRepository, TierMix } from '../../repositories/TraceRepository';
import type { EvalRunReader, PublishedEvalRun } from './EvalRunReader';

const WINDOW_DAYS = 30;
const STALE_AFTER_DAYS = 7;

export interface ProofTile {
  value: string;
  label: string;
  sub: string;
  src: string;
  accent?: boolean;
}

export interface LabViewModel {
  latestRun: PublishedEvalRun | null;
  latestRunLabel: string | null;
  runSeries: Array<{ x: string; label: string; v: number; mode: string }>;
  stale: boolean;
  telemetry: {
    windowDays: number;
    turnCount: number;
    costPerConversation: number | null;
    cacheHitRate: number | null;
    latencyP50: number | null;
    latencyP95: number | null;
    guardrailFlaggedCount: number;
    refusedCount: number;
    estCostUsd: number;
    firstTraceAt: string | null;
    routingMix: TierMix[];
    routerEnabled: boolean;
  };
  totals: { inputTokens: number; outputTokens: number; sessionCount: number };
  promptVersions: PromptVersion[];
}

/**
 * Builds the aggregate-only /lab view model. Every number traces to a real
 * source (committed eval-run files, the traces table, interview_usage) and
 * missing data renders as an explicit empty state — never a fabricated value.
 */
export class LabService {
  constructor(
    private readonly evalRuns: EvalRunReader,
    private readonly traces: TraceRepository,
    private readonly usage: InterviewUsageRepository,
    private readonly routerEnabled: boolean,
  ) {}

  build(): LabViewModel {
    const runs = this.evalRuns.list();
    const latestRun = runs.length ? runs[runs.length - 1] : null;

    const runSeries = runs.map((run) => ({
      x: run.startedAt.slice(0, 10),
      label: labelForHash(run.promptHash),
      v: Math.round(run.passRate * 1000) / 10,
      mode: run.mode,
    }));

    const stale =
      !latestRun ||
      Date.now() - Date.parse(latestRun.startedAt) > STALE_AFTER_DAYS * 24 * 3_600_000;

    const agg = this.traces.aggregateSince(WINDOW_DAYS);
    const latency = this.traces.latencyPercentiles(WINDOW_DAYS);
    const totals = this.usage.totals();

    return {
      latestRun,
      latestRunLabel: latestRun ? labelForHash(latestRun.promptHash) : null,
      runSeries,
      stale,
      telemetry: {
        windowDays: WINDOW_DAYS,
        turnCount: agg.turnCount,
        costPerConversation: this.traces.costPerSession(WINDOW_DAYS),
        cacheHitRate: agg.inputTokens > 0 ? agg.cacheReadTokens / agg.inputTokens : null,
        latencyP50: latency.p50,
        latencyP95: latency.p95,
        guardrailFlaggedCount: agg.guardrailFlaggedCount,
        refusedCount: agg.refusedCount,
        estCostUsd: agg.estCostUsd,
        firstTraceAt: agg.firstTraceAt,
        routingMix: this.traces.routingMix(WINDOW_DAYS),
        routerEnabled: this.routerEnabled,
      },
      totals: {
        inputTokens: totals.inputTokens,
        outputTokens: totals.outputTokens,
        sessionCount: totals.sessionCount,
      },
      promptVersions: [...PROMPT_VERSIONS].reverse(),
    };
  }

  /**
   * Compact four-tile summary for the home/interview proof strips. Graceful
   * "—" placeholders when a source has no data yet — never a made-up number.
   */
  proofTiles(): ProofTile[] {
    const latest = this.evalRuns.latest();
    const agg = this.traces.aggregateSince(WINDOW_DAYS);
    const latency = this.traces.latencyPercentiles(WINDOW_DAYS);
    const costPerConv = this.traces.costPerSession(WINDOW_DAYS);

    return [
      {
        value: latest ? `${(latest.passRate * 100).toFixed(0)}%` : '—',
        label: 'Eval pass',
        sub: latest ? `${latest.passed}/${latest.total} · ${latest.mode}` : 'no runs yet',
        src: 'eval_runs.pass_rate',
        accent: true,
      },
      {
        value: costPerConv === null ? '—' : `$${costPerConv.toFixed(3)}`,
        label: 'Cost / conv',
        sub: agg.turnCount ? `${agg.turnCount} turns · 30d` : 'metrics warming up',
        src: 'traces.est_cost_usd',
      },
      {
        value: agg.turnCount ? String(agg.guardrailFlaggedCount) : '—',
        label: 'Guardrail catches',
        sub: 'blocked before any model call',
        src: 'traces.guardrail_flags',
      },
      {
        value: latency.p95 === null ? '—' : latency.p95 >= 1000 ? `${(latency.p95 / 1000).toFixed(1)}s` : `${latency.p95}ms`,
        label: 'P95 latency',
        sub: latency.p50 === null ? 'metrics warming up' : `p50 ${latency.p50}ms`,
        src: 'traces.latency_ms',
      },
    ];
  }
}
