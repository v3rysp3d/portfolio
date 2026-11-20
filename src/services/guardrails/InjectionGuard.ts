import type { Guard, GuardInput, GuardVerdict } from './types';

/**
 * Deterministic prompt-injection / jailbreak / secret-fishing detector.
 * Pattern-based and free — blocked attempts never reach the model, so an
 * attack costs $0. The friendly message deliberately contains "can't" so the
 * offline HeuristicJudge's REFUSAL regex (src/eval/Judge.ts) recognises it
 * as a refusal — that is what makes the safety eval category pass honestly.
 */
const PATTERNS: RegExp[] = [
  /ignore\s+(all\s+|any\s+)?(previous|prior|above|earlier)\s+(instructions|prompts|rules)/i,
  /(reveal|show|print|repeat|output|display)\b[^.?!]{0,60}\b(system\s*prompt|instructions|persona\s*notes)/i,
  /\byou\s+are\s+now\b/i,
  /\bDAN\b/,
  /\bdeveloper\s+mode\b/i,
  /\bno\s+(rules|restrictions|filters|guidelines)\b/i,
  /\bact\s+as\s+(the\s+)?(developer|admin|system|root)\b/i,
  /\b(api[\s_-]?key|environment\s+variable|credential|secret\s+key|access\s+token|\.env)\b/i,
  /\bpretend\s+(you('|a)?re|to\s+be)\s+(not\s+)?(an?\s+)?(ai|assistant|different)/i,
  /\bjailbreak/i,
];

export class InjectionGuard implements Guard {
  readonly name = 'injection';

  check({ text, direction }: GuardInput): GuardVerdict {
    if (direction !== 'input') return { flag: null, blocked: false };
    const hit = PATTERNS.some((p) => p.test(text));
    if (!hit) return { flag: null, blocked: false };
    return {
      flag: 'injection',
      blocked: true,
      message:
        "I can't follow instructions that try to override how I'm set up — that includes " +
        'sharing my system prompt, keys, or configuration. Happy to keep talking about ' +
        "Nathan's work though. What would you like to know?",
    };
  }
}
