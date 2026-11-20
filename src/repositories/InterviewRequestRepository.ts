import type { SqliteConnection } from '../db/Database';
import {
  mapInterviewRequestRow,
  type InterviewRequest,
  type InterviewRequestRow,
  type InterviewRequestStatus,
} from '../models/InterviewRequest';

export interface NewInterviewRequest {
  email: string;
  name: string | null;
  purpose: string | null;
  approvalTokenHash: string;
  ip: string | null;
  userAgent: string | null;
  expiresAt: string; // ISO-8601 UTC
}

/** Data-access for interview access requests. */
export class InterviewRequestRepository {
  constructor(private readonly db: SqliteConnection) {}

  create(input: NewInterviewRequest): InterviewRequest {
    const info = this.db
      .prepare(
        `INSERT INTO interview_requests
           (email, name, purpose, approval_token_hash, ip, user_agent, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.email,
        input.name,
        input.purpose,
        input.approvalTokenHash,
        input.ip,
        input.userAgent,
        input.expiresAt,
      );
    const created = this.findById(Number(info.lastInsertRowid));
    if (!created) throw new Error('Failed to load interview request immediately after insert');
    return created;
  }

  findById(id: number): InterviewRequest | null {
    const row = this.db.prepare('SELECT * FROM interview_requests WHERE id = ?').get(id) as
      | InterviewRequestRow
      | undefined;
    return row ? mapInterviewRequestRow(row) : null;
  }

  findByApprovalTokenHash(hash: string): InterviewRequest | null {
    const row = this.db
      .prepare('SELECT * FROM interview_requests WHERE approval_token_hash = ?')
      .get(hash) as InterviewRequestRow | undefined;
    return row ? mapInterviewRequestRow(row) : null;
  }

  /** Records the decision (approved/declined/expired) and stamps decided_at. */
  updateStatus(id: number, status: InterviewRequestStatus): void {
    this.db
      .prepare("UPDATE interview_requests SET status = ?, decided_at = datetime('now') WHERE id = ?")
      .run(status, id);
  }

  /** Most recent requests first — for the admin panel. */
  findRecent(limit = 100): InterviewRequest[] {
    const rows = this.db
      .prepare('SELECT * FROM interview_requests ORDER BY id DESC LIMIT ?')
      .all(limit) as InterviewRequestRow[];
    return rows.map(mapInterviewRequestRow);
  }
}
