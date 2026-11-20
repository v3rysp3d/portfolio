import type { Request, Response } from 'express';
import { config } from '../config/env';
import type { InterviewService } from '../services/InterviewService';
import { NotFoundError } from '../utils/errors';

/**
 * Admin views for monitoring the interview feature: a list of requests +
 * sessions with today's usage against the caps, a per-session transcript, and
 * the ability to revoke a live session. Mounted under the auth-guarded
 * `/admin` router.
 */
export class InterviewAdminController {
  constructor(private readonly interviews: InterviewService) {}

  list = (_req: Request, res: Response): void => {
    res.render('admin/interviews-index', {
      title: 'Interviews',
      nav: 'admin',
      requests: this.interviews.listRequests(),
      sessions: this.interviews.listSessions(),
      usage: this.interviews.todayUsage(),
      caps: {
        requests: config.interview.dailyRequestCap,
        sessions: config.interview.dailySessionCap,
        tokens: config.interview.dailyTokenCap,
      },
      meta: {
        enabled: config.interview.enabled,
        provider: config.interview.llmProvider,
        model: config.interview.llmModel,
        emailTransport: config.interview.emailTransport,
        maxTurns: config.interview.maxTurns,
      },
    });
  };

  detail = (req: Request, res: Response): void => {
    const id = Number.parseInt(req.params.id, 10);
    const session = Number.isFinite(id) ? this.interviews.getSession(id) : null;
    if (!session) throw new NotFoundError('That interview could not be found.');

    res.render('admin/interview-detail', {
      title: `Interview #${session.id}`,
      nav: 'admin',
      session,
      transcript: this.interviews.transcript(session.id),
    });
  };

  revoke = (req: Request, res: Response): void => {
    const id = Number.parseInt(req.params.id, 10);
    const session = Number.isFinite(id) ? this.interviews.getSession(id) : null;
    if (!session) throw new NotFoundError('That interview could not be found.');

    this.interviews.revokeSession(session.id);
    req.session.flash = [{ type: 'success', message: `Interview #${session.id} revoked.` }];
    res.redirect('/admin/interviews');
  };
}
