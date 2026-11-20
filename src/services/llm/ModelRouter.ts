import type { DifficultyClassifier } from './DifficultyClassifier';
import type { LlmMessage, LlmProvider, LlmResult } from './LlmProvider';

/**
 * Routes each turn to the cheap tier (Haiku) by default and escalates hard
 * turns to the standard tier (Sonnet). Implements LlmProvider, so
 * InterviewService is unchanged whether the router is on or off — it is OFF
 * by default (LLM_ROUTER=false) because escalated turns cost more.
 */
export class ModelRouter implements LlmProvider {
  readonly name = 'router';

  constructor(
    private readonly cheap: LlmProvider,
    private readonly standard: LlmProvider,
    private readonly classifier: DifficultyClassifier,
  ) {}

  async complete(system: string, messages: LlmMessage[]): Promise<LlmResult> {
    const difficulty = await this.classifier.classify(messages);
    const provider = difficulty === 'standard' ? this.standard : this.cheap;
    const result = await provider.complete(system, messages);
    return { ...result, tier: difficulty === 'standard' ? 'sonnet' : 'haiku' };
  }
}
