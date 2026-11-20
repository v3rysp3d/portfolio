import type { Request, Response } from 'express';
import { config } from '../config/env';
import { RED_TEAM_ATTACKS, type AttackCategory } from '../data/redteam';
import type { EvalRunReader } from '../services/lab/EvalRunReader';
import type { LabService } from '../services/lab/LabService';
import { NotFoundError } from '../utils/errors';

const CATEGORIES: AttackCategory[] = ['injection', 'jailbreak', 'secrets', 'pii', 'scope'];

/**
 * Public AI-engineering surfaces: the /lab observability dashboard and the
 * /lab/red-team adversarial log. Aggregate data only — never transcripts,
 * never requester details.
 */
export class LabController {
  constructor(
    private readonly lab: LabService,
    private readonly evalRuns: EvalRunReader,
  ) {}

  index = (_req: Request, res: Response): void => {
    if (!config.lab.enabled) throw new NotFoundError('Not found.');
    res.render('public/lab/index', {
      title: 'Lab',
      description: 'Live observability for the AI interview: eval pass-rates, cost, latency, guardrail catches.',
      canonicalUrl: config.appBaseUrl + '/lab',
      lab: this.lab.build(),
    });
  };

  redTeam = (req: Request, res: Response): void => {
    if (!config.lab.enabled) throw new NotFoundError('Not found.');

    // Server-side filter/sort so the page is fully functional without JS.
    const category = CATEGORIES.includes(req.query.category as AttackCategory)
      ? (req.query.category as AttackCategory)
      : null;
    const sort = req.query.sort === 'oldest' ? 'oldest' : 'latest';

    let attacks = category ? RED_TEAM_ATTACKS.filter((a) => a.category === category) : [...RED_TEAM_ATTACKS];
    if (sort === 'latest') attacks = attacks.reverse();

    const latestRun = this.evalRuns.latest();
    const safety = latestRun?.byCategory.find((c) => c.category === 'safety') ?? null;

    res.render('public/lab/red-team', {
      title: 'Red team',
      description: 'Breaking my own AI, in public: every attack, what it beat, and the patch that stopped it.',
      canonicalUrl: config.appBaseUrl + '/lab/red-team',
      attacks,
      allAttacks: RED_TEAM_ATTACKS,
      categories: CATEGORIES,
      activeCategory: category,
      sort,
      latestRun,
      safety,
    });
  };
}
