import http from 'node:http'
import { URL } from 'node:url'
import { db, dbPath } from './db.mjs'

const PORT = Number(process.env.API_PORT || 4000)

function json(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
  })
  res.end(JSON.stringify(data))
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', c => data += c)
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}) } catch (e) { reject(e) } })
  })
}
function todayKst() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}
function daysBetween(start, end) {
  const startDate = new Date(`${start}T00:00:00+09:00`)
  const endDate = new Date(`${end}T00:00:00+09:00`)
  return Math.floor((endDate.getTime() - startDate.getTime()) / 86400000)
}
function getChallenge() {
  return db.prepare('SELECT * FROM challenges WHERE id = 1').get()
}
function currentDay(challenge = getChallenge()) {
  return Math.max(1, Math.min(challenge.target_days, daysBetween(challenge.start_date, todayKst()) + 1))
}
function requestedDay(url) {
  const challenge = getChallenge()
  const day = Number(url.searchParams.get('day') || currentDay(challenge))
  return Math.max(1, Math.min(challenge.target_days, Number.isFinite(day) ? day : currentDay(challenge)))
}
function formatMinutes(min) { return `${Math.floor(min/60)}h ${String(min%60).padStart(2,'0')}m` }
function emptyMetric(day, challenge = getChallenge()) {
  const date = new Date(`${challenge.start_date}T00:00:00+09:00`)
  date.setDate(date.getDate() + day - 1)
  return {
    day_number: day,
    date: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date),
    pc_minutes: 0,
    phone_minutes: 0,
    focus_minutes: 0,
    sleep_minutes: 0,
    steps: 0,
    exercise_minutes: 0,
    development_minutes: 0,
    github_commits: 0,
  }
}
function getMetric(day) { return db.prepare('SELECT * FROM daily_metrics WHERE day_number = ?').get(day) || emptyMetric(day) }
function ensureMetric(day) {
  const existing = db.prepare('SELECT * FROM daily_metrics WHERE day_number = ?').get(day)
  if (existing) return existing
  const challenge = getChallenge()
  const metric = emptyMetric(day, challenge)
  db.prepare(`INSERT INTO daily_metrics
    (challenge_id, day_number, date, pc_minutes, phone_minutes, focus_minutes, sleep_minutes, steps, exercise_minutes, development_minutes, github_commits)
    VALUES (?, ?, ?, 0, 0, 0, 0, 0, 0, 0, 0)`).run(challenge.id, day, metric.date)
  return db.prepare('SELECT * FROM daily_metrics WHERE day_number = ?').get(day)
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return json(res, 204, {})
  const url = new URL(req.url, `http://${req.headers.host}`)
  try {
    if (url.pathname === '/api/health') return json(res, 200, { ok: true, database: dbPath })

    if (url.pathname === '/api/challenge') {
      const challenge = getChallenge()
      const day = currentDay(challenge)
      const completedDays = db.prepare('SELECT COUNT(DISTINCT day_number) AS count FROM daily_metrics').get().count
      return json(res, 200, { ...challenge, currentDay: day, completedDays, remainingDays: Math.max(0, challenge.target_days - day) })
    }

    if (url.pathname === '/api/dashboard/today') {
      const day = requestedDay(url)
      const metric = getMetric(day)
      const prev = getMetric(Math.max(1, day - 1))
      const apps = db.prepare('SELECT app_name AS name, source, minutes FROM app_usage WHERE day_number = ? ORDER BY minutes DESC LIMIT 8').all(day)
      const events = db.prepare('SELECT time, label, type FROM timeline_events WHERE day_number = ? ORDER BY time').all(day)
      const recent = db.prepare('SELECT * FROM daily_metrics WHERE day_number <= ? ORDER BY day_number DESC LIMIT 7').all(day).reverse()
      return json(res, 200, {
        day,
        date: metric.date,
        metrics: {
          pc: { minutes: metric.pc_minutes, display: formatMinutes(metric.pc_minutes), delta: metric.pc_minutes - prev.pc_minutes },
          phone: { minutes: metric.phone_minutes, display: formatMinutes(metric.phone_minutes), delta: metric.phone_minutes - prev.phone_minutes },
          focus: { minutes: metric.focus_minutes, display: formatMinutes(metric.focus_minutes), delta: metric.focus_minutes - prev.focus_minutes },
          sleep: { minutes: metric.sleep_minutes, display: formatMinutes(metric.sleep_minutes), delta: metric.sleep_minutes - prev.sleep_minutes },
          steps: { value: metric.steps, delta: metric.steps - prev.steps },
          exercise: { minutes: metric.exercise_minutes, delta: metric.exercise_minutes - prev.exercise_minutes },
          development: { minutes: metric.development_minutes, display: formatMinutes(metric.development_minutes), delta: metric.development_minutes - prev.development_minutes },
          github: { commits: metric.github_commits, delta: metric.github_commits - prev.github_commits }
        }, apps, events, recent
      })
    }

    if (url.pathname === '/api/timeline') {
      const rows = db.prepare(`SELECT d.*, c.focus_score, c.satisfaction_score, c.note
        FROM daily_metrics d LEFT JOIN checkins c ON c.day_number = d.day_number ORDER BY d.day_number`).all()
      return json(res, 200, rows)
    }

    if (url.pathname === '/api/analytics') {
      const days = Math.max(1, Math.min(100, Number(url.searchParams.get('days') || 30)))
      const day = currentDay()
      const rows = db.prepare('SELECT * FROM daily_metrics WHERE day_number <= ? ORDER BY day_number DESC LIMIT ?').all(day, days).reverse()
      const topApps = db.prepare(`SELECT app_name AS name, SUM(minutes) AS minutes FROM app_usage WHERE day_number IN (
          SELECT day_number FROM daily_metrics WHERE day_number <= ? ORDER BY day_number DESC LIMIT ?
        ) GROUP BY app_name ORDER BY minutes DESC LIMIT 8`).all(day, days)
      return json(res, 200, { days, rows, topApps })
    }

    if (url.pathname === '/api/devices') {
      return json(res, 200, db.prepare('SELECT * FROM devices ORDER BY id').all())
    }

    if (url.pathname === '/api/study/categories' && req.method === 'GET') {
      const categories = db.prepare('SELECT id, name FROM study_categories ORDER BY id').all()
      return json(res, 200, categories)
    }

    if (url.pathname === '/api/study/categories' && req.method === 'POST') {
      const body = await readBody(req)
      const name = String(body.name || '').trim()
      if (!name) return json(res, 400, { error: '카테고리 이름이 필요합니다' })
      db.prepare('INSERT OR IGNORE INTO study_categories (name, created_at) VALUES (?, ?)').run(name, new Date().toISOString())
      return json(res, 201, db.prepare('SELECT id, name FROM study_categories WHERE name = ?').get(name))
    }

    if (url.pathname === '/api/focus/sessions' && req.method === 'GET') {
      const day = requestedDay(url)
      return json(res, 200, db.prepare('SELECT * FROM focus_sessions WHERE day_number = ? ORDER BY started_at').all(day))
    }

    if (url.pathname === '/api/focus/sessions' && req.method === 'POST') {
      const body = await readBody(req)
      const day = Number(body.day_number || currentDay())
      const category = String(body.category || '기타')
      const note = String(body.note || '')
      const started = body.started_at || new Date().toISOString()
      const ended = body.ended_at || new Date().toISOString()
      const duration = Number(body.duration_minutes || 0)
      db.prepare('INSERT OR IGNORE INTO study_categories (name, created_at) VALUES (?, ?)').run(category, new Date().toISOString())
      const result = db.prepare('INSERT INTO focus_sessions (day_number, category, note, started_at, ended_at, duration_minutes) VALUES (?, ?, ?, ?, ?, ?)').run(day, category, note, started, ended, duration)
      ensureMetric(day)
      db.prepare('UPDATE daily_metrics SET focus_minutes = focus_minutes + ? WHERE day_number = ?').run(duration, day)
      return json(res, 201, { id: Number(result.lastInsertRowid), day_number: day, category, note, started_at: started, ended_at: ended, duration_minutes: duration })
    }

    if (url.pathname === '/api/checkins' && req.method === 'GET') {
      const day = requestedDay(url)
      return json(res, 200, db.prepare('SELECT * FROM checkins WHERE day_number = ?').get(day) || null)
    }

    if (url.pathname === '/api/checkins' && req.method === 'POST') {
      const body = await readBody(req)
      const day = Number(body.day_number || currentDay())
      const focus = Math.max(1, Math.min(10, Number(body.focus_score || 5)))
      const satisfaction = Math.max(1, Math.min(10, Number(body.satisfaction_score || 5)))
      const note = String(body.note || '')
      db.prepare(`INSERT INTO checkins (day_number, focus_score, satisfaction_score, note, created_at)
        VALUES (?, ?, ?, ?, ?) ON CONFLICT(day_number) DO UPDATE SET focus_score=excluded.focus_score, satisfaction_score=excluded.satisfaction_score, note=excluded.note, created_at=excluded.created_at`)
        .run(day, focus, satisfaction, note, new Date().toISOString())
      return json(res, 200, db.prepare('SELECT * FROM checkins WHERE day_number = ?').get(day))
    }

    if (url.pathname === '/api/result') {
      const totals = db.prepare(`SELECT
        COALESCE(SUM(pc_minutes), 0) pc_minutes, COALESCE(SUM(phone_minutes), 0) phone_minutes, COALESCE(SUM(focus_minutes), 0) focus_minutes,
        COALESCE(SUM(sleep_minutes), 0) sleep_minutes, COALESCE(SUM(steps), 0) steps, COALESCE(SUM(exercise_minutes), 0) exercise_minutes,
        COALESCE(SUM(development_minutes), 0) development_minutes, COALESCE(SUM(github_commits), 0) github_commits
        FROM daily_metrics`).get()
      const first = getMetric(1), last = getMetric(currentDay())
      const rows = db.prepare('SELECT * FROM daily_metrics ORDER BY day_number').all()
      return json(res, 200, { totals, first, last, rows })
    }

    return json(res, 404, { error: '찾을 수 없습니다' })
  } catch (error) {
    console.error(error)
    return json(res, 500, { error: error.message })
  }
})

server.listen(PORT, () => {
  console.log(`100 DAYS API 실행 중: http://localhost:${PORT}`)
  console.log(`SQLite DB: ${dbPath}`)
})

