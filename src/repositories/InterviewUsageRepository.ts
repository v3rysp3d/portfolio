import type { SqliteConnection } from '../db/Database';

/** Aggregated usage for a single UTC day — the global cost backstop. */
export interface DailyUsage {
  requestCount: number;
  sessionCount: number;
  inputTokens: number;
  outputTokens: number;
}

const ZERO: DailyUsage = { requestCount: 0, sessionCount: 0, inputTokens: 0, outputTokens: 0 };

interface UsageRow {
  request_count: number;
  session_count: number;
  input_tokens: number;
  output_tokens: number;
}

/**
 * Tracks per-day usage so the service can refuse work once a daily ceiling is
 * hit. Keyed on SQLite's `date('now')` (UTC) so the "current day" is consistent
 * with every other timestamp the app writes.
 */
export class InterviewUsageRepository {
  constructor(private readonly db: SqliteConnection) {}

  /** Usage so far today (UTC). Returns zeros when there is no row yet. */
  getToday(): DailyUsage {
    const row = this.db
      .prepare(
        `SELECT request_count, session_count, input_tokens, output_tokens
           FROM interview_usage WHERE day = date('now')`,
      )
      .get() as UsageRow | undefined;
    if (!row) return { ...ZERO };
    return {
      requestCount: row.request_count,
      sessionCount: row.session_count,
      inputTokens: row.input_tokens,
      outputTokens: row.output_tokens,
    };
  }

  /** All-time totals across every recorded day (for the /lab dashboard). */
  totals(): DailyUsage {
    const row = this.db
      .prepare(
        `SELECT COALESCE(SUM(request_count), 0) AS request_count,
                COALESCE(SUM(session_count), 0) AS session_count,
                COALESCE(SUM(input_tokens), 0) AS input_tokens,
                COALESCE(SUM(output_tokens), 0) AS output_tokens
           FROM interview_usage`,
      )
      .get() as UsageRow;
    return {
      requestCount: row.request_count,
      sessionCount: row.session_count,
      inputTokens: row.input_tokens,
      outputTokens: row.output_tokens,
    };
  }

  /** Atomically adds to today's counters, creating the row on first write. */
  addToday(delta: Partial<DailyUsage>): void {
    const d = { ...ZERO, ...delta };
    this.db
      .prepare(
        `INSERT INTO interview_usage (day, request_count, session_count, input_tokens, output_tokens)
         VALUES (date('now'), ?, ?, ?, ?)
         ON CONFLICT(day) DO UPDATE SET
           request_count = request_count + excluded.request_count,
           session_count = session_count + excluded.session_count,
           input_tokens  = input_tokens  + excluded.input_tokens,
           output_tokens = output_tokens + excluded.output_tokens`,
      )
      .run(d.requestCount, d.sessionCount, d.inputTokens, d.outputTokens);
  }
}
