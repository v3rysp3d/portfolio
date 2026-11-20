import type { SqliteConnection } from '../db/Database';
import {
  mapInterviewSessionRow,
  type InterviewSession,
  type InterviewSessionRow,
  type InterviewSessionStatus,
} from '../models/InterviewSession';

export interface NewInterviewSession {
  requestId: number;
  email: string;
  accessTokenHash: string;
  maxTurns: number;
  expiresAt: string; // ISO-8601 UTC
}

/** Data-access for approved interview sessions. */
export class InterviewSessionRepository {
  constructor(private readonly db: SqliteConnection) {}

  create(input: NewInterviewSession): InterviewSession {
    const info = this.db
      .prepare(
        `INSERT INTO interview_sessions
           (request_id, email, access_token_hash, max_turns, expires_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(input.requestId, input.email, input.accessTokenHash, input.maxTurns, input.expiresAt);
    const created = this.findById(Number(info.lastInsertRowid));
    if (!created) throw new Error('Failed to load interview session immediately after insert');
    return created;
  }

  findById(id: number): InterviewSession | null {
    const row = this.db.prepare('SELECT * FROM interview_sessions WHERE id = ?').get(id) as
      | InterviewSessionRow
      | undefined;
    return row ? mapInterviewSessionRow(row) : null;
  }

  findByAccessTokenHash(hash: string): InterviewSession | null {
    const row = this.db
      .prepare('SELECT * FROM interview_sessions WHERE access_token_hash = ?')
      .get(hash) as InterviewSessionRow | undefined;
    return row ? mapInterviewSessionRow(row) : null;
  }

  /** Records one completed turn and its token usage, bumping last_active_at. */
  recordTurn(id: number, inputTokens: number, outputTokens: number): void {
    this.db
      .prepare(
        `UPDATE interview_sessions
            SET turns_used     = turns_used + 1,
                input_tokens   = input_tokens + ?,
                output_tokens  = output_tokens + ?,
                last_active_at = datetime('now')
          WHERE id = ?`,
      )
      .run(inputTokens, outputTokens, id);
  }

  updateStatus(id: number, status: InterviewSessionStatus): void {
    this.db.prepare('UPDATE interview_sessions SET status = ? WHERE id = ?').run(status, id);
  }

  /** Most recent sessions first — for the admin panel. */
  findRecent(limit = 100): InterviewSession[] {
    const rows = this.db
      .prepare('SELECT * FROM interview_sessions ORDER BY id DESC LIMIT ?')
      .all(limit) as InterviewSessionRow[];
    return rows.map(mapInterviewSessionRow);
  }
}
