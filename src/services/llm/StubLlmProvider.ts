import type { LlmMessage, LlmProvider, LlmResult } from './LlmProvider';

/** Rough token estimate (~4 chars/token) for offline accounting. */
function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

/**
 * A no-cost, no-network provider used when there is no API key (or
 * `LLM_PROVIDER=stub`). It returns a canned, persona-flavoured reply so the
 * entire request → approve → interview flow — including turn counting and the
 * daily token cap — can be exercised locally without spending anything.
 */
export class StubLlmProvider implements LlmProvider {
  readonly name = 'stub';

  async complete(system: string, messages: LlmMessage[]): Promise<LlmResult> {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    const question = (lastUser?.content ?? '').trim();

    const text =
      `*(Demo mode — no live model is connected, so this is a placeholder reply.)*\n\n` +
      `Good question${question ? ` about "${truncate(question, 80)}"` : ''}. ` +
      `Speaking as Nathan: I'd lean on what I actually enjoy — building real systems end to ` +
      `end, from embedded Rust through to the cloud — and I'd be honest about what I do and ` +
      `don't yet know. Set a real Anthropic API key (and LLM_PROVIDER=anthropic) to hear the ` +
      `genuine AI version of me answer this.`;

    const inputTokens = messages.reduce((n, m) => n + estimateTokens(m.content), estimateTokens(system));
    return {
      text,
      inputTokens,
      outputTokens: estimateTokens(text),
      refused: false,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
      model: 'stub',
      tier: 'stub',
    };
  }
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}
