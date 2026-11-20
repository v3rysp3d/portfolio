import type { SqliteConnection } from '../db/Database';
import {
  mapInterviewMessageRow,
  type InterviewMessage,
  type InterviewMessageRow,
  type InterviewMessageWithMeta,
  type InterviewRole,
} from '../models/InterviewMessage';

export interface NewInterviewMessage {
  sessionId: number;
  role: InterviewRole;
  content: string;
  inputTokens: number;
  outputTokens: number;
  traceId?: number | null;
}

/** Data-access for interview transcript messages. */
export class InterviewMessageRepository {
  constructor(private readonly db: SqliteConnection) {}

  create(input: NewInterviewMessage): InterviewMessage {
    const info = this.db
      .prepare(
        `INSERT INTO interview_messages (session_id, role, content, input_tokens, output_tokens, trace_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.sessionId,
        input.role,
        input.content,
        input.inputTokens,
        input.outputTokens,
        input.traceId ?? null,
      );
    const created = this.db
      .prepare('SELECT * FROM interview_messages WHERE id = ?')
      .get(Number(info.lastInsertRowid)) as InterviewMessageRow;
    return mapInterviewMessageRow(created);
  }

  /**
   * Full transcript with per-turn telemetry LEFT JOINed from traces. Rows
   * created before migration 004 (or user turns) simply carry meta: null.
   */
  findBySessionWithMeta(sessionId: number): InterviewMessageWithMeta[] {
    const rows = this.db
      .prepare(
        `SELECT m.*,
                t.model_tier AS meta_tier,
                t.model_id AS meta_model,
                t.output_tokens AS meta_output_tokens,
                t.latency_ms AS meta_latency_ms,
                t.cache_read_tokens AS meta_cache_read_tokens,
                t.refused AS meta_refused,
                t.guardrail_flags AS meta_guardrail_flags
         FROM interview_messages m
         LEFT JOIN traces t ON t.id = m.trace_id
         WHERE m.session_id = ?
         ORDER BY m.id ASC`,
      )
      .all(sessionId) as Array<
      InterviewMessageRow & {
        meta_tier: string | null;
        meta_model: string | null;
        meta_output_tokens: number | null;
        meta_latency_ms: number | null;
        meta_cache_read_tokens: number | null;
        meta_refused: number | null;
        meta_guardrail_flags: string | null;
      }
    >;
    return rows.map((row) => ({
      ...mapInterviewMessageRow(row),
      meta:
        row.role === 'assistant' && row.meta_tier !== null
          ? {
              tier: row.meta_tier,
              model: row.meta_model ?? '',
              outputTokens: row.meta_output_tokens ?? 0,
              latencyMs: row.meta_latency_ms ?? 0,
              cacheReadTokens: row.meta_cache_read_tokens ?? 0,
              refused: row.meta_refused === 1,
              guardrailFlags: safeParseFlags(row.meta_guardrail_flags),
            }
          : null,
    }));
  }

  /** Full transcript in chronological order. */
  findBySession(sessionId: number): InterviewMessage[] {
    const rows = this.db
      .prepare('SELECT * FROM interview_messages WHERE session_id = ? ORDER BY id ASC')
      .all(sessionId) as InterviewMessageRow[];
    return rows.map(mapInterviewMessageRow);
  }

  /**
   * The last `limit` messages in chronological order — used to build a bounded
   * history window for the model (keeps per-call input tokens predictable
   * regardless of how long the transcript grows).
   */
  findRecentBySession(sessionId: number, limit: number): InterviewMessage[] {
    const rows = this.db
      .prepare('SELECT * FROM interview_messages WHERE session_id = ? ORDER BY id DESC LIMIT ?')
      .all(sessionId, limit) as InterviewMessageRow[];
    return rows.map(mapInterviewMessageRow).reverse();
  }
}

function safeParseFlags(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((f): f is string => typeof f === 'string') : [];
  } catch {
    return [];
  }
}
