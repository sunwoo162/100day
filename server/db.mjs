import { DatabaseSync } from 'node:sqlite'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import './env.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(__dirname, 'data')
fs.mkdirSync(dataDir, { recursive: true })
const dbPath = path.join(dataDir, '100days.db')

export const db = new DatabaseSync(dbPath)
db.exec('PRAGMA foreign_keys = ON;')

function todayKst() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

db.exec(`
CREATE TABLE IF NOT EXISTS challenges (
  id INTEGER PRIMARY KEY,
  user_id INTEGER,
  name TEXT NOT NULL,
  start_date TEXT NOT NULL,
  target_days INTEGER NOT NULL DEFAULT 100,
  UNIQUE(user_id)
);
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE,
  name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS oauth_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  provider TEXT NOT NULL,
  provider_user_id TEXT NOT NULL,
  email TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(provider, provider_user_id),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS daily_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  challenge_id INTEGER NOT NULL,
  day_number INTEGER NOT NULL,
  date TEXT NOT NULL,
  pc_minutes INTEGER NOT NULL DEFAULT 0,
  phone_minutes INTEGER NOT NULL DEFAULT 0,
  focus_minutes INTEGER NOT NULL DEFAULT 0,
  sleep_minutes INTEGER NOT NULL DEFAULT 0,
  steps INTEGER NOT NULL DEFAULT 0,
  exercise_minutes INTEGER NOT NULL DEFAULT 0,
  development_minutes INTEGER NOT NULL DEFAULT 0,
  github_commits INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id, challenge_id, day_number),
  UNIQUE(challenge_id, day_number),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(challenge_id) REFERENCES challenges(id)
);
CREATE TABLE IF NOT EXISTS app_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  day_number INTEGER NOT NULL,
  source TEXT NOT NULL,
  app_name TEXT NOT NULL,
  minutes INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS timeline_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  day_number INTEGER NOT NULL,
  time TEXT NOT NULL,
  label TEXT NOT NULL,
  type TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS devices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  platform TEXT NOT NULL,
  status TEXT NOT NULL,
  device_token TEXT UNIQUE,
  last_sync TEXT,
  source TEXT,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS focus_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  day_number INTEGER NOT NULL,
  category TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  started_at TEXT NOT NULL,
  ended_at TEXT,
  duration_minutes INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS study_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(user_id, name),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS device_pairings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  platform TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
`)

for (const [table, definition] of [
  ['challenges', 'user_id INTEGER'],
  ['daily_metrics', 'user_id INTEGER'],
  ['app_usage', 'user_id INTEGER'],
  ['timeline_events', 'user_id INTEGER'],
  ['devices', 'user_id INTEGER'],
  ['focus_sessions', 'user_id INTEGER'],
  ['study_categories', 'user_id INTEGER'],
]) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all().map(column => column.name)
  if (!columns.includes('user_id')) db.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`)
}

const studyCategorySql = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'study_categories'").get()?.sql || ''
if (studyCategorySql.includes('name TEXT NOT NULL UNIQUE')) {
  db.exec(`
    ALTER TABLE study_categories RENAME TO study_categories_old;
    CREATE TABLE study_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(user_id, name),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    INSERT INTO study_categories (user_id, name, created_at)
      SELECT user_id, name, created_at FROM study_categories_old;
    DROP TABLE study_categories_old;
  `)
}

const focusColumns = db.prepare('PRAGMA table_info(focus_sessions)').all().map(column => column.name)
if (!focusColumns.includes('note')) db.exec("ALTER TABLE focus_sessions ADD COLUMN note TEXT NOT NULL DEFAULT ''")

const deviceColumns = db.prepare('PRAGMA table_info(devices)').all().map(column => column.name)
if (!deviceColumns.includes('device_token')) db.exec('ALTER TABLE devices ADD COLUMN device_token TEXT')
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_devices_device_token ON devices(device_token)')

if (db.prepare('SELECT COUNT(*) AS count FROM challenges').get().count === 0) {
  db.prepare('INSERT INTO challenges (id, user_id, name, start_date, target_days) VALUES (1, NULL, ?, ?, 100)')
    .run('하루핏', process.env.CHALLENGE_START_DATE || todayKst())
}

export function isSeeded() {
  return db.prepare('SELECT COUNT(*) AS count FROM daily_metrics').get().count > 0
}

export { dbPath }
