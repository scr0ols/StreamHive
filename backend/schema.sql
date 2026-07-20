-- StreamHive database schema. Run this against a fresh Postgres database
-- (e.g. a new Neon project/branch) to set up all tables from scratch.
-- Matches the live Neon schema exactly as of 2026-07-20 (introspected via
-- information_schema, not hand-reconstructed from memory).
--
-- Note: IDs and timestamps are all TEXT (crypto.randomUUID()/randomBytes hex
-- strings, ISO 8601 date strings), not native Postgres UUID/TIMESTAMPTZ
-- types. That's an established convention in this codebase (see db.js and
-- the query/serialize code in src/index.js), not an oversight — keep any
-- new table consistent with it rather than mixing native types in.
--
-- No migration tool yet (single-file schema, no history) — table changes
-- so far have been applied by hand directly against the dev database and
-- then reflected back into this file.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  twitch_id TEXT NOT NULL UNIQUE,
  login TEXT NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS templates (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  channels TEXT NOT NULL,
  audio_mode TEXT NOT NULL,
  active_channel TEXT,
  volumes TEXT,
  chat_bar_open INTEGER NOT NULL DEFAULT 1,
  is_public INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
