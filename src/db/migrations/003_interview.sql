-- "Interview my AI self" feature.
-- A visitor requests access; Nathan approves; an approved interviewer chats with
-- an AI persona of Nathan. Access is manually gated and usage is heavily capped.
--
-- Conventions match 001_init: booleans as INTEGER 0/1, timestamps as ISO-8601
-- TEXT (UTC) via datetime('now'). Secret tokens are stored ONLY as SHA-256
-- hashes — the raw token lives in the email/URL and is never persisted.

PRAGMA foreign_keys = ON;

-- A request for access to the interview. One row per submission.
CREATE TABLE IF NOT EXISTS interview_requests (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  email               TEXT NOT NULL,
  name                TEXT,
  purpose             TEXT,
  -- 'pending' | 'approved' | 'declined' | 'expired'
  status              TEXT NOT NULL DEFAULT 'pending',
  -- SHA-256 hash of the single-use approval token Nathan clicks.
  approval_token_hash TEXT NOT NULL UNIQUE,
  ip                  TEXT,
  user_agent          TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at          TEXT NOT NULL,
  decided_at          TEXT
);

-- An approved interview. Created when Nathan approves a request. The magic link
-- carries the raw access token; only its hash is stored here.
CREATE TABLE IF NOT EXISTS interview_sessions (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id        INTEGER NOT NULL REFERENCES interview_requests(id) ON DELETE CASCADE,
  email             TEXT NOT NULL,
  -- SHA-256 hash of the magic-link access token.
  access_token_hash TEXT NOT NULL UNIQUE,
  -- 'active' | 'completed' | 'revoked' | 'expired'
  status            TEXT NOT NULL DEFAULT 'active',
  turns_used        INTEGER NOT NULL DEFAULT 0,
  max_turns         INTEGER NOT NULL,
  input_tokens      INTEGER NOT NULL DEFAULT 0,
  output_tokens     INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at        TEXT NOT NULL,
  last_active_at    TEXT
);

-- Full transcript, one row per message.
CREATE TABLE IF NOT EXISTS interview_messages (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id    INTEGER NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  -- 'user' | 'assistant'
  role          TEXT NOT NULL,
  content       TEXT NOT NULL,
  input_tokens  INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Per-day global usage counters — the hard cost backstop. One row per UTC day.
CREATE TABLE IF NOT EXISTS interview_usage (
  day           TEXT PRIMARY KEY,            -- 'YYYY-MM-DD' (UTC)
  request_count INTEGER NOT NULL DEFAULT 0,
  session_count INTEGER NOT NULL DEFAULT 0,
  input_tokens  INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_interview_requests_status ON interview_requests(status);
CREATE INDEX IF NOT EXISTS idx_interview_sessions_status ON interview_sessions(status);
CREATE INDEX IF NOT EXISTS idx_interview_messages_session ON interview_messages(session_id, id);
