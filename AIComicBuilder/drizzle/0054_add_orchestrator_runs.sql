CREATE TABLE IF NOT EXISTS orchestrator_runs (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL DEFAULT '',
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  episode_id TEXT REFERENCES episodes(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}',
  provider_profile_id TEXT,
  idempotency_key TEXT,
  request_fingerprint TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned',
  requires_approval INTEGER NOT NULL DEFAULT 1,
  dry_run INTEGER NOT NULL DEFAULT 1,
  approved_at INTEGER,
  started_at INTEGER,
  completed_at INTEGER,
  cancel_requested_at INTEGER,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 2,
  result TEXT,
  error TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS orchestrator_runs_user_idempotency_key_unique
  ON orchestrator_runs(user_id, idempotency_key);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS orchestrator_runs_status_idx
  ON orchestrator_runs(status);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS orchestrator_runs_project_created_idx
  ON orchestrator_runs(project_id, created_at);
