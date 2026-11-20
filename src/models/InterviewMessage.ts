export type InterviewRole = 'user' | 'assistant';

/** A single transcript entry within an interview session. */
export interface InterviewMessage {
  id: number;
  sessionId: number;
  role: InterviewRole;
  content: string;
  inputTokens: number;
  outputTokens: number;
  createdAt: string;
}

/** Per-turn telemetry attached to an assistant message (from its trace). */
export interface MessageMeta {
  tier: string;
  model: string;
  outputTokens: number;
  latencyMs: number;
  cacheReadTokens: number;
  refused: boolean;
  guardrailFlags: string[];
}

/** Transcript entry with optional telemetry (null for pre-trace history). */
export type InterviewMessageWithMeta = InterviewMessage & { meta: MessageMeta | null };

export interface InterviewMessageRow {
  id: number;
  session_id: number;
  role: string;
  content: string;
  input_tokens: number;
  output_tokens: number;
  created_at: string;
}

export function mapInterviewMessageRow(row: InterviewMessageRow): InterviewMessage {
  return {
    id: row.id,
    sessionId: row.session_id,
    role: row.role as InterviewRole,
    content: row.content,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    createdAt: row.created_at,
  };
}
