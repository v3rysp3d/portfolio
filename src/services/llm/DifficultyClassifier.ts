import type { LlmMessage, LlmProvider } from './LlmProvider';

export type Difficulty = 'cheap' | 'standard';

export interface DifficultyClassifier {
  readonly name: string;
  classify(messages: LlmMessage[]): Promise<Difficulty>;
}

/**
 * Free heuristic classifier (the default). Escalates when the question is
 * long, explicitly asks for depth, or stacks multiple questions — the cases
 * where a small model's answer reads noticeably thinner.
 */
export class HeuristicClassifier implements DifficultyClassifier {
  readonly name = 'heuristic';

  private static readonly DEPTH = new RegExp(
    [
      'walk me through',
      'in detail',
      'architecture',
      'trade-?offs?',
      'design\\s+(a|the|this)?\\s*system',
      'step[\\s-]by[\\s-]step',
      'compare\\s+and\\s+contrast',
      'deep[\\s-]dive',
    ].join('|'),
    'i',
  );

  async classify(messages: LlmMessage[]): Promise<Difficulty> {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    const text = lastUser?.content ?? '';
    const questionMarks = (text.match(/\?/g) ?? []).length;
    if (text.length > 400 || questionMarks >= 2 || HeuristicClassifier.DEPTH.test(text)) {
      return 'standard';
    }
    return 'cheap';
  }
}

/**
 * Model-based classifier — one cheap single-token call per message, so it
 * only exists behind LLM_ROUTER_CLASSIFIER=llm (an explicit paid opt-in).
 */
export class LlmClassifier implements DifficultyClassifier {
  readonly name = 'llm';

  constructor(private readonly provider: LlmProvider) {}

  async classify(messages: LlmMessage[]): Promise<Difficulty> {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    try {
      const result = await this.provider.complete(
        'Classify the difficulty of answering this interview question well. ' +
          'Reply with exactly one word: EASY or HARD.',
        [{ role: 'user', content: lastUser?.content ?? '' }],
      );
      return /hard/i.test(result.text) ? 'standard' : 'cheap';
    } catch {
      return 'cheap'; // classification failure must never block or upbill a turn
    }
  }
}
