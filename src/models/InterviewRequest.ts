/** Status of an access request through its lifecycle. */
export type InterviewRequestStatus = 'pending' | 'approved' | 'declined' | 'expired';

/** A would-be interviewer's request for access to the AI interview. */
export interface InterviewRequest {
  id: number;
  email: string;
  name: string | null;
  purpose: string | null;
  status: InterviewRequestStatus;
  approvalTokenHash: string;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
  expiresAt: string;
  decidedAt: string | null;
}

export interface InterviewRequestRow {
  id: number;
  email: string;
  name: string | null;
  purpose: string | null;
  status: string;
  approval_token_hash: string;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
  expires_at: string;
  decided_at: string | null;
}

export function mapInterviewRequestRow(row: InterviewRequestRow): InterviewRequest {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    purpose: row.purpose,
    status: row.status as InterviewRequestStatus,
    approvalTokenHash: row.approval_token_hash,
    ip: row.ip,
    userAgent: row.user_agent,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    decidedAt: row.decided_at,
  };
}
