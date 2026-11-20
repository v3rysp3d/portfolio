/** A single chat turn passed to the model (system prompt is separate). */
export interface LlmMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** Normalised result of one model completion. */
export interface LlmResult {
  /** The assistant's reply text (empty when refused). */
  text: string;
  /** Total input tokens processed (including any cached tokens). */
  inputTokens: number;
  /** Output tokens generated. */
  outputTokens: number;
  /** True when the model declined to respond for safety reasons. */
  refused: boolean;
  /** Input tokens served from the prompt cache (billed ~0.1×). */
  cacheReadTokens: number;
  /** Input tokens written to the prompt cache (billed 1.25×). */
  cacheCreationTokens: number;
  /** Model id that produced this result ('stub' / 'guardrail' when no model ran). */
  model: string;
  /** Routing tier, stamped by ModelRouter/guards: 'haiku' | 'sonnet' | 'stub' | 'none'. */
  tier?: string;
  /** Guardrail flags raised on this turn (e.g. ['injection']). */
  guardrailFlags?: string[];
}

/**
 * Abstraction over the chat model so the provider is swappable (Anthropic in
 * production, a no-cost stub locally). Implementations run entirely server-side;
 * no provider credential ever reaches the browser.
 */
export interface LlmProvider {
  /** Short identifier for logging/diagnostics (never includes secrets). */
  readonly name: string;
  complete(system: string, messages: LlmMessage[]): Promise<LlmResult>;
}
