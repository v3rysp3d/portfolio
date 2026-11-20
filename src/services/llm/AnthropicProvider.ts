import Anthropic from '@anthropic-ai/sdk';
import type { LlmMessage, LlmProvider, LlmResult } from './LlmProvider';

export interface AnthropicProviderOptions {
  apiKey: string;
  model: string;
  maxTokens: number;
}

/**
 * Claude-backed provider. Calls Anthropic's Messages API entirely on the server.
 *
 * Cost controls live here too: a small `max_tokens` bounds every reply, and the
 * (large, stable) persona system prompt is sent with `cache_control` so repeat
 * turns within the 5-minute cache window are billed at ~0.1× input cost.
 *
 * The API key is held only in this object's closure (from the frozen config).
 * It is never logged, never serialised, and — because the browser only ever
 * talks to our own endpoint — never leaves the server.
 */
export class AnthropicProvider implements LlmProvider {
  readonly name = 'anthropic';
  private readonly client: Anthropic;
  private readonly model: string;
  private readonly maxTokens: number;

  constructor(opts: AnthropicProviderOptions) {
    this.client = new Anthropic({ apiKey: opts.apiKey });
    this.model = opts.model;
    this.maxTokens = opts.maxTokens;
  }

  async complete(system: string, messages: LlmMessage[]): Promise<LlmResult> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: this.maxTokens,
      // Cache the stable persona prompt; volatile turns follow in `messages`.
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });

    const usage = response.usage;
    const cacheReadTokens = usage.cache_read_input_tokens ?? 0;
    const cacheCreationTokens = usage.cache_creation_input_tokens ?? 0;
    // inputTokens stays the all-in total so existing usage accounting is unchanged.
    const inputTokens = usage.input_tokens + cacheReadTokens + cacheCreationTokens;
    const outputTokens = usage.output_tokens;
    const base = { inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens, model: this.model };

    if (response.stop_reason === 'refusal') {
      return { ...base, text: '', refused: true };
    }

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('')
      .trim();

    return { ...base, text, refused: false };
  }
}
