import type { Guard, GuardVerdict } from './types';

export interface PipelineResult {
  blocked: boolean;
  flags: string[];
  /** First blocking guard's friendly message (null when not blocked). */
  message: string | null;
}

/**
 * Runs every guard in order and collects all raised flags; the first
 * blocking guard's message wins. Guards are cheap, so all of them always
 * run — a turn can carry multiple flags in its trace.
 */
export class GuardrailPipeline {
  constructor(private readonly guards: Guard[]) {}

  async checkInput(text: string): Promise<PipelineResult> {
    return this.run(text, 'input');
  }

  async checkOutput(text: string): Promise<PipelineResult> {
    return this.run(text, 'output');
  }

  private async run(text: string, direction: 'input' | 'output'): Promise<PipelineResult> {
    const flags: string[] = [];
    let blocked = false;
    let message: string | null = null;

    for (const guard of this.guards) {
      const verdict: GuardVerdict = await guard.check({ text, direction });
      if (verdict.flag) flags.push(verdict.flag);
      if (verdict.blocked && !blocked) {
        blocked = true;
        message = verdict.message ?? null;
      }
    }
    return { blocked, flags, message };
  }
}
