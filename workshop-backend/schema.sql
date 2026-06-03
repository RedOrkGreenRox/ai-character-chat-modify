-- AI Character Chat Workshop — D1 schema
-- Run statements one by one in Cloudflare D1 Console, or via wrangler:
--   wrangler d1 execute workshop-db --remote --file=schema.sql

CREATE TABLE IF NOT EXISTS users (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  primary_provider  TEXT NOT NULL,
  primary_uid       TEXT NOT NULL,
  handle            TEXT NOT NULL,
  avatar_url        TEXT,
  role              TEXT NOT NULL DEFAULT 'user',
  tos_accepted_at   INTEGER,
  tos_version       TEXT,
  github_login      TEXT,
  github_uid        TEXT,
  github_token_enc  TEXT,
  github_scope      TEXT,
  github_linked_at  INTEGER,
  created_at        INTEGER NOT NULL,
  banned_at         INTEGER,
  ban_reason        TEXT,
  UNIQUE(primary_provider, primary_uid)
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_github_uid ON users(github_uid);

CREATE TABLE IF NOT EXISTS sessions (
  token       TEXT PRIMARY KEY,
  user_id     INTEGER NOT NULL,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS oauth_states (
  state        TEXT PRIMARY KEY,
  provider     TEXT NOT NULL,
  intent       TEXT NOT NULL,
  user_id      INTEGER,
  created_at   INTEGER NOT NULL,
  expires_at   INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_oauth_expires ON oauth_states(expires_at);

CREATE TABLE IF NOT EXISTS items (
  id              TEXT PRIMARY KEY,
  kind            TEXT NOT NULL,
  name            TEXT NOT NULL,
  author_id       INTEGER NOT NULL,
  version         TEXT NOT NULL,
  summary         TEXT,
  tags            TEXT,
  language        TEXT,
  license         TEXT,
  nsfw            INTEGER NOT NULL DEFAULT 0,
  size            INTEGER NOT NULL,
  gist_id         TEXT NOT NULL,
  gist_file       TEXT NOT NULL,
  gist_owner      TEXT NOT NULL,
  content_sha     TEXT,
  content_url     TEXT,
  preview_url     TEXT,
  status          TEXT NOT NULL DEFAULT 'live',
  status_reason   TEXT,
  install_count   INTEGER NOT NULL DEFAULT 0,
  vote_score      INTEGER NOT NULL DEFAULT 0,
  report_count    INTEGER NOT NULL DEFAULT 0,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL,
  last_checked_at INTEGER,
  FOREIGN KEY(author_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_items_kind_status ON items(kind, status);
CREATE INDEX IF NOT EXISTS idx_items_author ON items(author_id);
CREATE INDEX IF NOT EXISTS idx_items_updated ON items(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_items_score ON items(vote_score DESC);

CREATE TABLE IF NOT EXISTS votes (
  user_id    INTEGER NOT NULL,
  item_id    TEXT NOT NULL,
  value      INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, item_id),
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(item_id) REFERENCES items(id)
);

CREATE TABLE IF NOT EXISTS installs (
  user_id      INTEGER NOT NULL,
  item_id      TEXT NOT NULL,
  version      TEXT NOT NULL,
  installed_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, item_id),
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(item_id) REFERENCES items(id)
);

CREATE TABLE IF NOT EXISTS reports (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL,
  item_id     TEXT NOT NULL,
  reason      TEXT NOT NULL,
  details     TEXT,
  status      TEXT NOT NULL DEFAULT 'open',
  created_at  INTEGER NOT NULL,
  resolved_at INTEGER,
  resolved_by INTEGER,
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(item_id) REFERENCES items(id)
);

CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status, created_at DESC);
