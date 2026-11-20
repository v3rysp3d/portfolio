/** Status of an approved interview through its lifecycle. */
export type InterviewSessionStatus = 'active' | 'completed' | 'revoked' | 'expired';

/** An approved, rate-limited interview session bound to a single email. */
export interface InterviewSession {
  id: number;
  requestId: number;
  email: string;
  accessTokenHash: string;
  status: InterviewSessionStatus;
  turnsUsed: number;
  maxTurns: number;
  inputTokens: number;
  outputTokens: number;
  createdAt: string;
  expiresAt: string;
  lastActiveAt: string | null;
}

export interface InterviewSessionRow {
  id: number;
  request_id: number;
  email: string;
  access_token_hash: string;
  status: string;
  turns_used: number;
  max_turns: number;
  input_tokens: number;
  output_tokens: number;
  created_at: string;
  expires_at: string;
  last_active_at: string | null;
}

export function mapInterviewSessionRow(row: InterviewSessionRow): InterviewSession {
  return {
    id: row.id,
    requestId: row.request_id,
    email: row.email,
    accessTokenHash: row.access_token_hash,
    status: row.status as InterviewSessionStatus,
    turnsUsed: row.turns_used,
    maxTurns: row.max_turns,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    lastActiveAt: row.last_active_at,
  };
}
