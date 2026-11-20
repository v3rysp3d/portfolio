import type { GuardrailPipeline } from '../guardrails/GuardrailPipeline';
import type { LlmMessage, LlmProvider, LlmResult } from './LlmProvider';

/**
 * Decorator that runs the guardrail pipeline around any LlmProvider. Used by
 * BOTH production (app.ts) and the eval harness (src/eval/run.ts) — that
 * parity is the point: the safety numbers on /lab describe exactly what runs
 * in the live chat.
 *
 * When an input guard blocks, the inner provider is never called: the attack
 * costs $0 and the friendly refusal is returned with tier 'none'.
 */
export class GuardedLlmProvider implements LlmProvider {
  readonly name: string;

  constructor(
    private readonly inner: LlmProvider,
    private readonly pipeline: GuardrailPipeline,
    private readonly enabled: boolean,
  ) {
    this.name = `guarded(${inner.name})`;
  }

  async complete(system: string, messages: LlmMessage[]): Promise<LlmResult> {
    if (!this.enabled) return this.inner.complete(system, messages);

    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    const inputCheck = await this.pipeline.checkInput(lastUser?.content ?? '');

    if (inputCheck.blocked) {
      return {
        text: inputCheck.message ?? "I can't help with that one — let's stick to the interview.",
        inputTokens: 0,
        outputTokens: 0,
        refused: true,
        cacheReadTokens: 0,
        cacheCreationTokens: 0,
        model: 'guardrail',
        tier: 'none',
        guardrailFlags: inputCheck.flags,
      };
    }

    const result = await this.inner.complete(system, messages);
    const outputCheck = await this.pipeline.checkOutput(result.text);
    const flags = [...inputCheck.flags, ...outputCheck.flags];
    return flags.length ? { ...result, guardrailFlags: [...(result.guardrailFlags ?? []), ...flags] } : result;
  }
}
