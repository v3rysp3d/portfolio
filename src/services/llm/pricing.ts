/**
 * Single price table for every cost estimate (eval harness, traces, /lab).
 * USD per million tokens, keyed by a substring of the model id. Cache reads
 * bill at ~0.1× input; cache writes at 1.25×.
 */
export interface ModelPrice {
  in: number;
  out: number;
}

export function priceFor(model: string): ModelPrice {
  const m = model.toLowerCase();
  if (m.includes('sonnet')) return { in: 3, out: 15 };
  if (m.includes('opus')) return { in: 5, out: 25 };
  if (m.includes('haiku')) return { in: 1, out: 5 };
  return { in: 0, out: 0 }; // stub / heuristic / guardrail — free
}

/** Flat estimate when the cache split is unknown (eval harness totals). */
export function cost(model: string, inputTokens: number, outputTokens: number): number {
  const p = priceFor(model);
  return (inputTokens / 1_000_000) * p.in + (outputTokens / 1_000_000) * p.out;
}

/** Cache-aware estimate for a single traced turn. */
export function turnCost(args: {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
}): number {
  const p = priceFor(args.model);
  const uncached = Math.max(0, args.inputTokens - args.cacheReadTokens - args.cacheCreationTokens);
  const inputUsd =
    (uncached / 1_000_000) * p.in +
    (args.cacheReadTokens / 1_000_000) * p.in * 0.1 +
    (args.cacheCreationTokens / 1_000_000) * p.in * 1.25;
  return inputUsd + (args.outputTokens / 1_000_000) * p.out;
}
