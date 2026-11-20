import crypto from 'node:crypto';
import type { InterviewConfig } from '../config/env';
import type { InterviewRequest } from '../models/InterviewRequest';
import type { InterviewSession } from '../models/InterviewSession';
import type { InterviewMessage, InterviewMessageWithMeta, MessageMeta } from '../models/InterviewMessage';
import type { InterviewRequestRepository } from '../repositories/InterviewRequestRepository';
import type { InterviewSessionRepository } from '../repositories/InterviewSessionRepository';
import type { InterviewMessageRepository } from '../repositories/InterviewMessageRepository';
import type { InterviewUsageRepository, DailyUsage } from '../repositories/InterviewUsageRepository';
import { hashPrompt } from '../utils/promptHash';
import type { PersonaService } from './PersonaService';
import type { LlmProvider, LlmMessage } from './llm/LlmProvider';
import type { EmailService } from './email/EmailService';
import type { TraceRecorder } from './observability/TraceRecorder';

export interface RequestAccessInput {
  email: string;
  name: string | null;
  purpose: string | null;
  ip: string | null;
  userAgent: string | null;
}

export type RequestAccessResult =
  | { status: 'sent' }
  | { status: 'disabled' }
  | { status: 'capacity' };

export type ReviewState = 'pending' | 'approved' | 'declined' | 'expired' | 'notfound';
export interface ReviewResult {
  state: ReviewState;
  request: InterviewRequest | null;
}

export type DecisionResult =
  | { status: 'approved' | 'declined'; request: InterviewRequest }
  | { status: 'already'; request: InterviewRequest }
  | { status: 'expired'; request: InterviewRequest }
  | { status: 'capacity'; request: InterviewRequest }
  | { status: 'notfound' };

export type SessionEntryResult =
  | { status: 'ok'; session: InterviewSession }
  | { status: 'invalid' }
  | { status: 'revoked' }
  | { status: 'expired' };

export type SendMessageResult =
  | { status: 'ok'; reply: string; remainingTurns: number; meta: MessageMeta }
  | { status: 'limit' }
  | { status: 'expired' }
  | { status: 'revoked' }
  | { status: 'disabled' }
  | { status: 'capacity' }
  | { status: 'error' };

/**
 * Orchestrates the whole gated-interview lifecycle: request → approve/decline →
 * session → chat. This is where every cost control is enforced — manual
 * approval, per-session turn caps, session TTLs, a bounded history window, and a
 * hard global daily token/session ceiling — before any model call is made.
 *
 * Tokens are minted as 32 random bytes and persisted only as SHA-256 hashes;
 * the raw token lives in the email link and is matched by hashing what's
 * presented. Nothing here ever touches the network except via the injected
 * LLM and email collaborators.
 */
export class InterviewService {
  constructor(
    private readonly requests: InterviewRequestRepository,
    private readonly sessions: InterviewSessionRepository,
    private readonly messages: InterviewMessageRepository,
    private readonly usage: InterviewUsageRepository,
    private readonly persona: PersonaService,
    private readonly llm: LlmProvider,
    private readonly email: EmailService,
    private readonly traces: TraceRecorder,
    private readonly cfg: InterviewConfig,
  ) {}

  get enabled(): boolean {
    return this.cfg.enabled;
  }

  // ── Access requests ─────────────────────────────────────────────────────────

  async requestAccess(input: RequestAccessInput): Promise<RequestAccessResult> {
    if (!this.cfg.enabled) return { status: 'disabled' };
    if (this.usage.getToday().requestCount >= this.cfg.dailyRequestCap) {
      return { status: 'capacity' };
    }

    const { raw, hash } = this.mintToken();
    const request = this.requests.create({
      email: input.email,
      name: input.name,
      purpose: input.purpose,
      approvalTokenHash: hash,
      ip: input.ip,
      userAgent: input.userAgent,
      expiresAt: this.hoursFromNow(this.cfg.approvalTtlHours),
    });
    this.usage.addToday({ requestCount: 1 });

    await this.email.sendApprovalRequest({
      to: this.cfg.approverEmail,
      requesterEmail: request.email,
      requesterName: request.name,
      purpose: request.purpose,
      reviewUrl: `${this.cfg.appBaseUrl}/interview/review/${raw}`,
    });

    return { status: 'sent' };
  }

  /** Loads a request for the review page (no side effects). */
  review(rawToken: string): ReviewResult {
    const request = this.requests.findByApprovalTokenHash(this.hashToken(rawToken));
    if (!request) return { state: 'notfound', request: null };
    if (request.status === 'pending' && this.isPast(request.expiresAt)) {
      this.requests.updateStatus(request.id, 'expired');
      return { state: 'expired', request };
    }
    return { state: request.status, request };
  }

  /** Approves a pending request: creates the session and emails the link. */
  async approve(rawToken: string): Promise<DecisionResult> {
    const request = this.requests.findByApprovalTokenHash(this.hashToken(rawToken));
    if (!request) return { status: 'notfound' };
    if (request.status !== 'pending') return { status: 'already', request };
    if (this.isPast(request.expiresAt)) {
      this.requests.updateStatus(request.id, 'expired');
      return { status: 'expired', request };
    }
    if (this.usage.getToday().sessionCount >= this.cfg.dailySessionCap) {
      return { status: 'capacity', request };
    }

    const { raw, hash } = this.mintToken();
    const expiresAt = this.hoursFromNow(this.cfg.sessionTtlHours);
    this.sessions.create({
      requestId: request.id,
      email: request.email,
      accessTokenHash: hash,
      maxTurns: this.cfg.maxTurns,
      expiresAt,
    });
    this.requests.updateStatus(request.id, 'approved');
    this.usage.addToday({ sessionCount: 1 });

    await this.email.sendInvite({
      to: request.email,
      interviewUrl: `${this.cfg.appBaseUrl}/interview/s/${raw}`,
      expiresAtLabel: `around ${new Date(expiresAt).toUTCString()}`,
      maxTurns: this.cfg.maxTurns,
    });

    return { status: 'approved', request };
  }

  /** Declines a pending request. */
  decline(rawToken: string): DecisionResult {
    const request = this.requests.findByApprovalTokenHash(this.hashToken(rawToken));
    if (!request) return { status: 'notfound' };
    if (request.status !== 'pending') return { status: 'already', request };
    this.requests.updateStatus(request.id, 'declined');
    return { status: 'declined', request };
  }

  // ── Sessions ─────────────────────────────────────────────────────────────────

  /** Validates a magic-link token and returns the session to bind. */
  enterSession(rawToken: string): SessionEntryResult {
    const session = this.sessions.findByAccessTokenHash(this.hashToken(rawToken));
    if (!session) return { status: 'invalid' };
    return this.gateSession(session);
  }

  /** Re-validates a session held in the express session by id. */
  loadActiveSession(id: number): SessionEntryResult {
    const session = this.sessions.findById(id);
    if (!session) return { status: 'invalid' };
    return this.gateSession(session);
  }

  private gateSession(session: InterviewSession): SessionEntryResult {
    if (session.status === 'revoked') return { status: 'revoked' };
    if (session.status === 'expired' || this.isPast(session.expiresAt)) {
      if (session.status !== 'expired') this.sessions.updateStatus(session.id, 'expired');
      return { status: 'expired' };
    }
    return { status: 'ok', session };
  }

  remainingTurns(session: InterviewSession): number {
    return Math.max(0, session.maxTurns - session.turnsUsed);
  }

  transcript(sessionId: number): InterviewMessage[] {
    return this.messages.findBySession(sessionId);
  }

  /** Transcript with per-turn telemetry for the chat view's meta lines. */
  transcriptWithMeta(sessionId: number): InterviewMessageWithMeta[] {
    return this.messages.findBySessionWithMeta(sessionId);
  }

  // ── The chat turn (all caps enforced here) ────────────────────────────────────

  async sendMessage(session: InterviewSession, userText: string): Promise<SendMessageResult> {
    if (!this.cfg.enabled) return { status: 'disabled' };

    const gate = this.gateSession(session);
    if (gate.status !== 'ok') {
      return gate.status === 'revoked' ? { status: 'revoked' } : { status: 'expired' };
    }
    if (session.turnsUsed >= session.maxTurns) return { status: 'limit' };

    const today = this.usage.getToday();
    if (today.inputTokens + today.outputTokens >= this.cfg.dailyTokenCap) {
      return { status: 'capacity' };
    }

    // Bounded history window keeps per-call input tokens predictable.
    const history: LlmMessage[] = this.messages
      .findRecentBySession(session.id, this.cfg.historyTurns * 2)
      .map((m) => ({ role: m.role, content: m.content }));

    const system = this.persona.buildSystemPrompt();
    const promptVersionHash = hashPrompt(system);

    let reply: string;
    let inputTokens = 0;
    let outputTokens = 0;
    let meta: MessageMeta;
    let traceId: number | null = null;
    try {
      const startedAt = Date.now();
      const result = await this.llm.complete(system, [
        ...history,
        { role: 'user', content: userText },
      ]);
      const latencyMs = Date.now() - startedAt;
      inputTokens = result.inputTokens;
      outputTokens = result.outputTokens;
      // Guard blocks return their own friendly refusal text; keep the generic
      // one only for a bare model refusal with no message.
      reply = result.refused
        ? result.text ||
          "I'd rather not answer that one — let's keep this to questions about my background and how I work. What would you like to know?"
        : result.text || "Sorry, I didn't catch that — could you rephrase?";

      traceId = this.traces.record({ sessionId: session.id, result, latencyMs, promptVersionHash });
      meta = {
        tier: result.tier ?? 'haiku',
        model: result.model,
        outputTokens: result.outputTokens,
        latencyMs,
        cacheReadTokens: result.cacheReadTokens,
        refused: result.refused,
        guardrailFlags: result.guardrailFlags ?? [],
      };
    } catch {
      // Don't persist the turn or count usage on a model failure.
      return { status: 'error' };
    }

    // Persist the completed turn and account for its cost. Guard-blocked
    // turns count too (0 tokens) — free probing is deliberately discouraged.
    this.messages.create({ sessionId: session.id, role: 'user', content: userText, inputTokens: 0, outputTokens: 0 });
    this.messages.create({
      sessionId: session.id,
      role: 'assistant',
      content: reply,
      inputTokens,
      outputTokens,
      traceId,
    });
    this.sessions.recordTurn(session.id, inputTokens, outputTokens);
    this.usage.addToday({ inputTokens, outputTokens });

    return {
      status: 'ok',
      reply,
      remainingTurns: Math.max(0, session.maxTurns - session.turnsUsed - 1),
      meta,
    };
  }

  // ── Admin ─────────────────────────────────────────────────────────────────────

  listRequests(limit = 100): InterviewRequest[] {
    return this.requests.findRecent(limit);
  }

  listSessions(limit = 100): InterviewSession[] {
    return this.sessions.findRecent(limit);
  }

  getSession(id: number): InterviewSession | null {
    return this.sessions.findById(id);
  }

  revokeSession(id: number): void {
    this.sessions.updateStatus(id, 'revoked');
  }

  todayUsage(): DailyUsage {
    return this.usage.getToday();
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private mintToken(): { raw: string; hash: string } {
    const raw = crypto.randomBytes(32).toString('base64url');
    return { raw, hash: this.hashToken(raw) };
  }

  private hashToken(raw: string): string {
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  private hoursFromNow(hours: number): string {
    return new Date(Date.now() + hours * 3_600_000).toISOString();
  }

  private isPast(iso: string): boolean {
    const t = Date.parse(iso);
    return Number.isFinite(t) && t < Date.now();
  }
}
