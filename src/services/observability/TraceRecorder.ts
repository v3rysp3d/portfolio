import type { LlmResult } from '../llm/LlmProvider';
import { turnCost } from '../llm/pricing';
import type { TraceRepository } from '../../repositories/TraceRepository';

/**
 * Writes one telemetry row per interview turn. Called by InterviewService at
 * the same point it already does usage accounting; guard-blocked turns are
 * traced too (tier 'none', zero tokens, $0). Never stores message content.
 */
export class TraceRecorder {
  constructor(private readonly traces: TraceRepository) {}

  record(args: {
    sessionId: number | null;
    result: LlmResult;
    latencyMs: number;
    promptVersionHash: string;
  }): number | null {
    const { result } = args;
    try {
      return this.traces.create({
        sessionId: args.sessionId,
        modelTier: result.tier ?? deriveTier(result.model),
        modelId: result.model,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        cacheReadTokens: result.cacheReadTokens,
        latencyMs: args.latencyMs,
        refused: result.refused,
        guardrailFlags: result.guardrailFlags?.length ? result.guardrailFlags : null,
        estCostUsd: turnCost({
          model: result.model,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          cacheReadTokens: result.cacheReadTokens,
          cacheCreationTokens: result.cacheCreationTokens,
        }),
        promptVersionHash: args.promptVersionHash,
      });
    } catch (err) {
      // Telemetry must never break the chat turn itself.
      console.error('[trace] failed to record turn:', err);
      return null;
    }
  }
}

function deriveTier(model: string): string {
  const m = model.toLowerCase();
  if (m === 'guardrail') return 'none';
  if (m.includes('sonnet')) return 'sonnet';
  if (m.includes('haiku')) return 'haiku';
  if (m === 'stub') return 'stub';
  return 'other';
}
