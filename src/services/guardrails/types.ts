/**
 * Guardrail contracts. Guards may be sync (regex/heuristic — free) or async
 * (a future LLM-judge guard slots in without changing the pipeline).
 */
export interface GuardInput {
  text: string;
  direction: 'input' | 'output';
}

export interface GuardVerdict {
  /** Flag name recorded in the trace (null = clean). */
  flag: string | null;
  /** True to stop the turn before it reaches the model. */
  blocked: boolean;
  /** Friendly reply shown instead of a model answer when blocked. */
  message?: string;
}

export interface Guard {
  readonly name: string;
  check(input: GuardInput): GuardVerdict | Promise<GuardVerdict>;
}
