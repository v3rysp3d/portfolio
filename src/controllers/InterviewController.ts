import type { Request, Response } from 'express';
import type { Session } from 'express-session';
import { config } from '../config/env';
import { findAttack, type RedTeamAttack } from '../data/redteam';
import type { InterviewService } from '../services/InterviewService';
import type { LabService } from '../services/lab/LabService';
import { accessRequestSchema, interviewMessageSchema, fieldErrors } from '../utils/validation';

/**
 * Public-facing controller for the "Interview my AI self" feature:
 * the landing/request form, Nathan's approve/decline review page, magic-link
 * entry, the chat UI, and the rate-limited message endpoint.
 *
 * Approval is split into a GET that renders a confirmation page (no side effect)
 * and a POST that performs the action, so an email client pre-fetching the link
 * can never auto-approve. Magic-link entry regenerates the session and binds the
 * interview id server-side, so the raw token leaves the URL immediately.
 */
export class InterviewController {
  constructor(
    private readonly interviews: InterviewService,
    private readonly lab: LabService | null,
  ) {}

  // ── Landing + request ──────────────────────────────────────────────────────

  showLanding = (req: Request, res: Response): void => {
    if (!this.interviews.enabled) {
      res.status(503).render('public/interview/closed', { title: 'Interview', reason: 'disabled' });
      return;
    }
    // ?attack=<id> from the red-team log: validate against the whitelist —
    // never echo raw query text. The id is remembered so an approved session
    // can pre-fill the attack prompt (never auto-submitted).
    const attack: RedTeamAttack | null =
      typeof req.query.attack === 'string' ? findAttack(req.query.attack) : null;
    if (attack) req.session.pendingAttack = attack.id;

    res.render('public/interview/landing', {
      title: 'Interview me',
      values: { email: '', name: '', purpose: '' },
      errors: {} as Record<string, string>,
      maxInputChars: config.interview.maxInputChars,
      attack,
      proofTiles: config.lab.enabled && this.lab ? this.lab.proofTiles() : null,
    });
  };

  requestAccess = async (req: Request, res: Response): Promise<void> => {
    if (!this.interviews.enabled) {
      res.status(503).render('public/interview/closed', { title: 'Interview', reason: 'disabled' });
      return;
    }

    const parsed = accessRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).render('public/interview/landing', {
        title: 'Interview me',
        values: {
          email: typeof req.body?.email === 'string' ? req.body.email : '',
          name: typeof req.body?.name === 'string' ? req.body.name : '',
          purpose: typeof req.body?.purpose === 'string' ? req.body.purpose : '',
        },
        errors: fieldErrors(parsed.error),
        maxInputChars: config.interview.maxInputChars,
      });
      return;
    }

    // Honeypot: real users never fill `website`. Pretend success for bots.
    if (parsed.data.website) {
      res.render('public/interview/request-sent', { title: 'Request received' });
      return;
    }

    const result = await this.interviews.requestAccess({
      email: parsed.data.email,
      name: parsed.data.name,
      purpose: parsed.data.purpose,
      ip: req.ip ?? null,
      userAgent: req.get('user-agent') ?? null,
    });

    if (result.status === 'sent') {
      res.render('public/interview/request-sent', { title: 'Request received' });
      return;
    }
    res
      .status(503)
      .render('public/interview/closed', { title: 'Interview', reason: result.status });
  };

  // ── Review (Nathan) ─────────────────────────────────────────────────────────

  showReview = (req: Request, res: Response): void => {
    const { state, request } = this.interviews.review(req.params.token);
    if (state === 'pending' && request) {
      res.render('public/interview/review', {
        title: 'Review interview request',
        request,
        token: req.params.token,
      });
      return;
    }
    res.status(state === 'notfound' ? 404 : 200).render('public/interview/review-result', {
      title: 'Interview request',
      outcome: state, // 'approved' | 'declined' | 'expired' | 'notfound'
      request,
    });
  };

  submitReview = async (req: Request, res: Response): Promise<void> => {
    const action = req.body?.action === 'approve' ? 'approve' : 'decline';
    const result =
      action === 'approve'
        ? await this.interviews.approve(req.params.token)
        : this.interviews.decline(req.params.token);

    const outcome = result.status === 'approved' || result.status === 'declined'
      ? result.status
      : result.status; // 'already' | 'expired' | 'capacity' | 'notfound'

    res.status(result.status === 'notfound' ? 404 : 200).render('public/interview/review-result', {
      title: 'Interview request',
      outcome,
      request: 'request' in result ? result.request : null,
    });
  };

  // ── Interview entry + chat ────────────────────────────────────────────────────

  enterSession = async (req: Request, res: Response): Promise<void> => {
    const result = this.interviews.enterSession(req.params.token);
    if (result.status !== 'ok') {
      res.status(410).render('public/interview/closed', { title: 'Interview', reason: result.status });
      return;
    }

    // Bind the interview to a fresh session (anti-fixation) and drop the token
    // from the URL by redirecting to the clean chat path.
    await this.regenerate(req.session);
    req.session.interviewId = result.session.id;
    await this.save(req.session);
    res.redirect('/interview/chat');
  };

  showChat = (req: Request, res: Response): void => {
    const id = req.session.interviewId;
    if (!id) {
      res.redirect('/interview');
      return;
    }
    const result = this.interviews.loadActiveSession(id);
    if (result.status !== 'ok') {
      delete req.session.interviewId;
      res.status(410).render('public/interview/closed', { title: 'Interview', reason: result.status });
      return;
    }
    // Pre-fill a validated red-team attack (?attack=<id> or one remembered
    // from the landing page). Whitelist lookup only; never auto-submitted.
    const attackId =
      typeof req.query.attack === 'string' ? req.query.attack : req.session.pendingAttack;
    const attack = attackId ? findAttack(attackId) : null;
    if (req.session.pendingAttack) delete req.session.pendingAttack;

    res.render('public/interview/chat', {
      title: 'Interview',
      transcript: this.interviews.transcriptWithMeta(result.session.id),
      remainingTurns: this.interviews.remainingTurns(result.session),
      maxTurns: result.session.maxTurns,
      maxInputChars: config.interview.maxInputChars,
      prefill: attack?.prompt ?? null,
      prefillAttackId: attack?.id ?? null,
    });
  };

  postMessage = async (req: Request, res: Response): Promise<void> => {
    const wantsJson = (req.get('accept') ?? '').includes('application/json');
    const id = req.session.interviewId;
    if (!id) {
      this.respondClosed(res, wantsJson, 'invalid');
      return;
    }

    const sessionResult = this.interviews.loadActiveSession(id);
    if (sessionResult.status !== 'ok') {
      delete req.session.interviewId;
      this.respondClosed(res, wantsJson, sessionResult.status);
      return;
    }

    const parsed = interviewMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      const message = fieldErrors(parsed.error).message ?? 'Please type a question.';
      if (wantsJson) {
        res.status(422).json({ ok: false, error: message });
      } else {
        req.session.flash = [{ type: 'error', message }];
        res.redirect('/interview/chat');
      }
      return;
    }

    const result = await this.interviews.sendMessage(sessionResult.session, parsed.data.message);

    if (result.status === 'ok') {
      if (wantsJson) {
        res.json({
          ok: true,
          reply: result.reply,
          remainingTurns: result.remainingTurns,
          meta: result.meta,
        });
      } else {
        res.redirect('/interview/chat');
      }
      return;
    }

    // Non-OK outcomes.
    const messages: Record<string, string> = {
      limit: 'You have reached the question limit for this interview. Thanks for your time!',
      capacity: "The interview is at capacity for today — please try again tomorrow.",
      error: 'Something went wrong reaching the model. Please try again in a moment.',
      disabled: 'The interview is currently unavailable.',
      expired: 'This interview link has expired.',
      revoked: 'This interview session is no longer active.',
    };
    const note = messages[result.status] ?? 'The interview is unavailable.';

    if (wantsJson) {
      const retryable = result.status === 'error';
      res.status(retryable ? 502 : 200).json({ ok: false, reason: result.status, error: note });
      return;
    }
    if (result.status === 'limit' || result.status === 'error') {
      req.session.flash = [{ type: result.status === 'limit' ? 'info' : 'error', message: note }];
      res.redirect('/interview/chat');
      return;
    }
    this.respondClosed(res, false, result.status);
  };

  private respondClosed(res: Response, wantsJson: boolean, reason: string): void {
    if (wantsJson) {
      res.status(410).json({ ok: false, reason, error: 'This interview is no longer available.' });
      return;
    }
    res.status(410).render('public/interview/closed', { title: 'Interview', reason });
  }

  private regenerate(session: Session): Promise<void> {
    return new Promise((resolve, reject) => {
      session.regenerate((err) => (err ? reject(err) : resolve()));
    });
  }

  private save(session: Session): Promise<void> {
    return new Promise((resolve, reject) => {
      session.save((err) => (err ? reject(err) : resolve()));
    });
  }
}
