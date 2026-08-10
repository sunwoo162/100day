import { DatabaseSync } from 'node:sqlite'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(__dirname, 'data')
fs.mkdirSync(dataDir, { recursive: true })
const dbPath = path.join(dataDir, '100days.db')

export const db = new DatabaseSync(dbPath)
db.exec('PRAGMA foreign_keys = ON;')

db.exec(`
CREATE TABLE IF NOT EXISTS challenges (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  start_date TEXT NOT NULL,
  target_days INTEGER NOT NULL DEFAULT 100
);
CREATE TABLE IF NOT EXISTS daily_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
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
  UNIQUE(challenge_id, day_number),
  FOREIGN KEY(challenge_id) REFERENCES challenges(id)
);
CREATE TABLE IF NOT EXISTS app_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  day_number INTEGER NOT NULL,
  source TEXT NOT NULL,
  app_name TEXT NOT NULL,
  minutes INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS timeline_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  day_number INTEGER NOT NULL,
  time TEXT NOT NULL,
  label TEXT NOT NULL,
  type TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS devices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  platform TEXT NOT NULL,
  status TEXT NOT NULL,
  last_sync TEXT,
  source TEXT
);
CREATE TABLE IF NOT EXISTS focus_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  day_number INTEGER NOT NULL,
  category TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  started_at TEXT NOT NULL,
  ended_at TEXT,
  duration_minutes INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS study_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS checkins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  day_number INTEGER NOT NULL UNIQUE,
  focus_score INTEGER NOT NULL,
  satisfaction_score INTEGER NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
`)

const focusColumns = db.prepare('PRAGMA table_info(focus_sessions)').all().map(column => column.name)
if (!focusColumns.includes('note')) db.exec("ALTER TABLE focus_sessions ADD COLUMN note TEXT NOT NULL DEFAULT ''")

if (db.prepare('SELECT COUNT(*) AS count FROM study_categories').get().count === 0) {
  const insertCategory = db.prepare('INSERT INTO study_categories (name, created_at) VALUES (?, ?)')
  for (const name of ['개발', '코딩 테스트', '학교 공부', '자격증', '독서', '운동', '휴식', '기타']) {
    insertCategory.run(name, new Date().toISOString())
  }
}

export function isSeeded() {
  return db.prepare('SELECT COUNT(*) AS count FROM daily_metrics').get().count > 0
}

export { dbPath }
