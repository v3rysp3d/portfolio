-- Observability: one trace row per interview turn (model, tokens, cache,
-- latency, guardrail flags, estimated cost, prompt version). Aggregates feed
-- the public /lab dashboard; no message content is ever stored here.

CREATE TABLE IF NOT EXISTS traces (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER REFERENCES interview_sessions(id) ON DELETE SET NULL,
  ts TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  model_tier TEXT NOT NULL,          -- 'haiku' | 'sonnet' | 'none' (guard-blocked) | 'stub'
  model_id TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cache_read_tokens INTEGER NOT NULL DEFAULT 0,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  refused INTEGER NOT NULL DEFAULT 0,
  guardrail_flags TEXT,              -- JSON array of flag names, or NULL
  est_cost_usd REAL NOT NULL DEFAULT 0,
  prompt_version_hash TEXT NOT NULL,
  eval_score REAL
);

CREATE INDEX IF NOT EXISTS idx_traces_session ON traces(session_id, id);
CREATE INDEX IF NOT EXISTS idx_traces_ts ON traces(ts);

-- Server-rendered transcripts join each assistant message to its trace for
-- the per-turn telemetry line. Nullable: pre-004 rows simply render no meta.
ALTER TABLE interview_messages ADD COLUMN trace_id INTEGER REFERENCES traces(id);
