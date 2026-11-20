-- Initial schema for the portfolio site.
-- All writes go through prepared statements in the repository layer; this file
-- only defines structure. Booleans are stored as INTEGER 0/1, list/JSON values
-- as TEXT, and timestamps as ISO-8601 TEXT (UTC) via datetime('now').

PRAGMA foreign_keys = ON;

-- Admin accounts. Designed for multiple rows so multi-admin support is a pure
-- data change later, even though one account is seeded today.
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  last_login_at TEXT
);

-- Single-row profile (the "about me" content). The CHECK constraint pins it to
-- id = 1 so there is always exactly one canonical profile.
CREATE TABLE IF NOT EXISTS profile (
  id           INTEGER PRIMARY KEY CHECK (id = 1),
  name         TEXT NOT NULL,
  headline     TEXT NOT NULL,
  location     TEXT,
  email        TEXT,
  bio          TEXT,
  github_url   TEXT,
  linkedin_url TEXT,
  website_url  TEXT,
  resume_url   TEXT,
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Portfolio projects. tech_stack is a JSON array of strings.
CREATE TABLE IF NOT EXISTS projects (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT NOT NULL UNIQUE,
  title       TEXT NOT NULL,
  summary     TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  role        TEXT,
  period      TEXT,
  tech_stack  TEXT NOT NULL DEFAULT '[]',
  category    TEXT,
  repo_url    TEXT,
  demo_url    TEXT,
  image_url   TEXT,
  featured    INTEGER NOT NULL DEFAULT 0,
  visible     INTEGER NOT NULL DEFAULT 1,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Work / education history.
CREATE TABLE IF NOT EXISTS experiences (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  company    TEXT NOT NULL,
  role       TEXT NOT NULL,
  location   TEXT,
  start_date TEXT,
  end_date   TEXT,
  summary    TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- Skills grouped by category.
CREATE TABLE IF NOT EXISTS skills (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  category   TEXT NOT NULL DEFAULT 'General',
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_projects_visible    ON projects(visible);
CREATE INDEX IF NOT EXISTS idx_projects_sort_order ON projects(sort_order);
CREATE INDEX IF NOT EXISTS idx_experiences_sort    ON experiences(sort_order);
CREATE INDEX IF NOT EXISTS idx_skills_category     ON skills(category, sort_order);
