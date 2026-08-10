import http from 'node:http'
import { URL } from 'node:url'
import crypto from 'node:crypto'
import { db, dbPath } from './db.mjs'
import { seed } from './seed.mjs'

seed()
const PORT = Number(process.env.API_PORT || 4000)
const WEB_ORIGIN = process.env.WEB_ORIGIN || 'http://localhost:5173'
const API_ORIGIN = process.env.API_ORIGIN || `http://localhost:${PORT}`
const SESSION_COOKIE = 'sid'
const SESSION_DAYS = 30

function json(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': WEB_ORIGIN,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
  })
  res.end(JSON.stringify(data))
}
function redirect(res, location, cookies = []) {
  res.writeHead(302, {
    Location: location,
    'Set-Cookie': cookies,
    'Access-Control-Allow-Origin': WEB_ORIGIN,
    'Access-Control-Allow-Credentials': 'true',
  })
  res.end()
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', c => data += c)
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}) } catch (e) { reject(e) } })
  })
}
function formatMinutes(min) { return `${Math.floor(min/60)}h ${String(min%60).padStart(2,'0')}m` }
function parseCookies(req) {
  return Object.fromEntries(String(req.headers.cookie || '').split(';').map(part => {
    const [key, ...value] = part.trim().split('=')
    return [key, decodeURIComponent(value.join('='))]
  }).filter(([key]) => key))
}
function sessionCookie(token, expires) {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Expires=${expires.toUTCString()}`
}
function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
}
function publicUser(user) {
  if (!user) return null
  return { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatar_url }
}
function currentUser(req) {
  const token = parseCookies(req)[SESSION_COOKIE]
  if (!token) return null
  const user = db.prepare(`SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token = ? AND s.expires_at > ?`).get(token, new Date().toISOString())
  return user || null
}
function requireUser(req, res) {
  const user = currentUser(req)
  if (!user) {
    json(res, 401, { error: '로그인이 필요합니다' })
    return null
  }
  ensureUserDemoData(user.id)
  return user
}
function getMetric(userId, day=37) {
  return db.prepare('SELECT * FROM daily_metrics WHERE user_id = ? AND day_number = ?').get(userId, day)
}
function createSession(userId) {
  const token = crypto.randomBytes(32).toString('base64url')
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000)
  db.prepare('INSERT INTO sessions (user_id, token, expires_at, created_at) VALUES (?, ?, ?, ?)')
    .run(userId, token, expires.toISOString(), new Date().toISOString())
  return { token, expires }
}
function upsertOAuthUser({ provider, providerUserId, email, name, avatarUrl }) {
  const now = new Date().toISOString()
  const account = db.prepare('SELECT * FROM oauth_accounts WHERE provider = ? AND provider_user_id = ?').get(provider, providerUserId)
  if (account) {
    db.prepare('UPDATE users SET email = COALESCE(?, email), name = ?, avatar_url = COALESCE(?, avatar_url), updated_at = ? WHERE id = ?')
      .run(email, name, avatarUrl, now, account.user_id)
    return db.prepare('SELECT * FROM users WHERE id = ?').get(account.user_id)
  }

  let user = email ? db.prepare('SELECT * FROM users WHERE email = ?').get(email) : null
  if (!user) {
    const result = db.prepare('INSERT INTO users (email, name, avatar_url, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
      .run(email || null, name, avatarUrl || null, now, now)
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(result.lastInsertRowid))
  }
  db.prepare('INSERT INTO oauth_accounts (user_id, provider, provider_user_id, email, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(user.id, provider, providerUserId, email || null, now, now)
  ensureUserDemoData(user.id)
  return user
}
function ensureUserDemoData(userId) {
  if (db.prepare('SELECT COUNT(*) AS count FROM daily_metrics WHERE user_id = ?').get(userId).count > 0) return
  db.prepare(`INSERT INTO daily_metrics
    (user_id, challenge_id, day_number, date, pc_minutes, phone_minutes, focus_minutes, sleep_minutes, steps, exercise_minutes, development_minutes, github_commits)
    SELECT ?, challenge_id, day_number, date, pc_minutes, phone_minutes, focus_minutes, sleep_minutes, steps, exercise_minutes, development_minutes, github_commits
    FROM daily_metrics WHERE user_id IS NULL`).run(userId)
  db.prepare(`INSERT INTO app_usage (user_id, day_number, source, app_name, minutes)
    SELECT ?, day_number, source, app_name, minutes FROM app_usage WHERE user_id IS NULL`).run(userId)
  db.prepare(`INSERT INTO timeline_events (user_id, day_number, time, label, type)
    SELECT ?, day_number, time, label, type FROM timeline_events WHERE user_id IS NULL`).run(userId)
  db.prepare(`INSERT INTO devices (user_id, kind, name, platform, status, last_sync, source)
    SELECT ?, kind, name, platform, status, last_sync, source FROM devices WHERE user_id IS NULL`).run(userId)
  db.prepare(`INSERT INTO focus_sessions (user_id, day_number, category, started_at, ended_at, duration_minutes)
    SELECT ?, day_number, category, started_at, ended_at, duration_minutes FROM focus_sessions WHERE user_id IS NULL`).run(userId)
  db.prepare(`INSERT INTO checkins (user_id, day_number, focus_score, satisfaction_score, note, created_at)
    SELECT ?, day_number, focus_score, satisfaction_score, note, created_at FROM checkins WHERE user_id IS NULL`).run(userId)
}
function oauthConfig(provider) {
  if (provider === 'github') return {
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    authUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    scope: 'read:user user:email',
  }
  if (provider === 'google') return {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scope: 'openid email profile',
  }
  return null
}
function callbackUrl(provider) {
  return `${API_ORIGIN}/api/auth/${provider}/callback`
}
async function exchangeCode(provider, code) {
  const config = oauthConfig(provider)
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    redirect_uri: callbackUrl(provider),
  })
  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!response.ok) throw new Error(`OAuth 토큰 요청 실패: ${response.status}`)
  const token = await response.json()
  if (!token.access_token) throw new Error('OAuth 토큰을 받지 못했습니다')
  return token.access_token
}
async function fetchOAuthProfile(provider, accessToken) {
  if (provider === 'github') {
    const userRes = await fetch('https://api.github.com/user', { headers: { Authorization: `Bearer ${accessToken}`, 'User-Agent': '100-days-dashboard' } })
    if (!userRes.ok) throw new Error(`GitHub 프로필 요청 실패: ${userRes.status}`)
    const profile = await userRes.json()
    let email = profile.email
    if (!email) {
      const emailRes = await fetch('https://api.github.com/user/emails', { headers: { Authorization: `Bearer ${accessToken}`, 'User-Agent': '100-days-dashboard' } })
      if (emailRes.ok) {
        const emails = await emailRes.json()
        email = emails.find(item => item.primary && item.verified)?.email || emails.find(item => item.verified)?.email
      }
    }
    return { provider, providerUserId: String(profile.id), email, name: profile.name || profile.login, avatarUrl: profile.avatar_url }
  }
  const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!profileRes.ok) throw new Error(`Google 프로필 요청 실패: ${profileRes.status}`)
  const profile = await profileRes.json()
  return { provider, providerUserId: String(profile.sub), email: profile.email, name: profile.name || profile.email, avatarUrl: profile.picture }
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return json(res, 204, {})
  const url = new URL(req.url, `http://${req.headers.host}`)
  try {
    if (url.pathname === '/api/health') return json(res, 200, { ok: true, database: dbPath })

    if (url.pathname === '/api/auth/me') return json(res, 200, { user: publicUser(currentUser(req)) })

    if (url.pathname === '/api/auth/logout' && req.method === 'POST') {
      const token = parseCookies(req)[SESSION_COOKIE]
      if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token)
      res.writeHead(204, {
        'Set-Cookie': clearSessionCookie(),
        'Access-Control-Allow-Origin': WEB_ORIGIN,
        'Access-Control-Allow-Credentials': 'true',
      })
      return res.end()
    }

    const authStart = url.pathname.match(/^\/api\/auth\/(github|google)$/)
    if (authStart) {
      const provider = authStart[1]
      const config = oauthConfig(provider)
      if (!config?.clientId || !config?.clientSecret) return json(res, 500, { error: `${provider} OAuth 환경변수가 없습니다` })
      const state = crypto.randomBytes(16).toString('base64url')
      const authUrl = new URL(config.authUrl)
      authUrl.searchParams.set('client_id', config.clientId)
      authUrl.searchParams.set('redirect_uri', callbackUrl(provider))
      authUrl.searchParams.set('response_type', 'code')
      authUrl.searchParams.set('scope', config.scope)
      authUrl.searchParams.set('state', state)
      return redirect(res, authUrl.toString(), [`oauth_state=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`])
    }

    const authCallback = url.pathname.match(/^\/api\/auth\/(github|google)\/callback$/)
    if (authCallback) {
      const provider = authCallback[1]
      const code = url.searchParams.get('code')
      const state = url.searchParams.get('state')
      if (!code || !state || parseCookies(req).oauth_state !== state) return redirect(res, `${WEB_ORIGIN}/?auth=failed`)
      const accessToken = await exchangeCode(provider, code)
      const user = upsertOAuthUser(await fetchOAuthProfile(provider, accessToken))
      const session = createSession(user.id)
      return redirect(res, `${WEB_ORIGIN}/`, [
        sessionCookie(session.token, session.expires),
        'oauth_state=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0',
      ])
    }

    if (url.pathname === '/api/challenge') {
      const user = requireUser(req, res); if (!user) return
      const challenge = db.prepare('SELECT * FROM challenges WHERE id = 1').get()
      return json(res, 200, { ...challenge, currentDay: 37, completedDays: 37, remainingDays: 63 })
    }

    if (url.pathname === '/api/dashboard/today') {
      const user = requireUser(req, res); if (!user) return
      const day = Number(url.searchParams.get('day') || 37)
      const metric = getMetric(user.id, day)
      const prev = getMetric(user.id, Math.max(1, day - 1))
      const apps = db.prepare('SELECT app_name AS name, source, minutes FROM app_usage WHERE user_id = ? AND day_number = ? ORDER BY minutes DESC LIMIT 8').all(user.id, day)
      const events = db.prepare('SELECT time, label, type FROM timeline_events WHERE user_id = ? AND day_number = ? ORDER BY time').all(user.id, day)
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
        }, apps, events
      })
    }

    if (url.pathname === '/api/timeline') {
      const user = requireUser(req, res); if (!user) return
      const rows = db.prepare(`SELECT d.*, c.focus_score, c.satisfaction_score, c.note
        FROM daily_metrics d LEFT JOIN checkins c ON c.user_id = d.user_id AND c.day_number = d.day_number
        WHERE d.user_id = ? ORDER BY d.day_number`).all(user.id)
      return json(res, 200, rows)
    }

    if (url.pathname === '/api/analytics') {
      const user = requireUser(req, res); if (!user) return
      const days = Math.max(1, Math.min(100, Number(url.searchParams.get('days') || 30)))
      const rows = db.prepare('SELECT * FROM daily_metrics WHERE user_id = ? AND day_number <= 37 ORDER BY day_number DESC LIMIT ?').all(user.id, days).reverse()
      const topApps = db.prepare(`SELECT app_name AS name, SUM(minutes) AS minutes FROM app_usage WHERE day_number IN (
          SELECT day_number FROM daily_metrics WHERE user_id = ? AND day_number <= 37 ORDER BY day_number DESC LIMIT ?
        ) AND user_id = ? GROUP BY app_name ORDER BY minutes DESC LIMIT 8`).all(user.id, days, user.id)
      return json(res, 200, { days, rows, topApps })
    }

    if (url.pathname === '/api/devices') {
      const user = requireUser(req, res); if (!user) return
      return json(res, 200, db.prepare('SELECT * FROM devices WHERE user_id = ? ORDER BY id').all(user.id))
    }

    if (url.pathname === '/api/focus/sessions' && req.method === 'GET') {
      const user = requireUser(req, res); if (!user) return
      const day = Number(url.searchParams.get('day') || 37)
      return json(res, 200, db.prepare('SELECT * FROM focus_sessions WHERE user_id = ? AND day_number = ? ORDER BY started_at').all(user.id, day))
    }

    if (url.pathname === '/api/focus/sessions' && req.method === 'POST') {
      const user = requireUser(req, res); if (!user) return
      const body = await readBody(req)
      const day = Number(body.day_number || 37)
      const category = String(body.category || '기타')
      const started = body.started_at || new Date().toISOString()
      const ended = body.ended_at || new Date().toISOString()
      const duration = Number(body.duration_minutes || 0)
      const result = db.prepare('INSERT INTO focus_sessions (user_id, day_number, category, started_at, ended_at, duration_minutes) VALUES (?, ?, ?, ?, ?, ?)').run(user.id, day, category, started, ended, duration)
      return json(res, 201, { id: Number(result.lastInsertRowid), day_number: day, category, started_at: started, ended_at: ended, duration_minutes: duration })
    }

    if (url.pathname === '/api/checkins' && req.method === 'GET') {
      const user = requireUser(req, res); if (!user) return
      const day = Number(url.searchParams.get('day') || 37)
      return json(res, 200, db.prepare('SELECT * FROM checkins WHERE user_id = ? AND day_number = ?').get(user.id, day) || null)
    }

    if (url.pathname === '/api/checkins' && req.method === 'POST') {
      const user = requireUser(req, res); if (!user) return
      const body = await readBody(req)
      const day = Number(body.day_number || 37)
      const focus = Math.max(1, Math.min(10, Number(body.focus_score || 5)))
      const satisfaction = Math.max(1, Math.min(10, Number(body.satisfaction_score || 5)))
      const note = String(body.note || '')
      db.prepare(`INSERT INTO checkins (user_id, day_number, focus_score, satisfaction_score, note, created_at)
        VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(user_id, day_number) DO UPDATE SET focus_score=excluded.focus_score, satisfaction_score=excluded.satisfaction_score, note=excluded.note, created_at=excluded.created_at`)
        .run(user.id, day, focus, satisfaction, note, new Date().toISOString())
      return json(res, 200, db.prepare('SELECT * FROM checkins WHERE user_id = ? AND day_number = ?').get(user.id, day))
    }

    if (url.pathname === '/api/result') {
      const user = requireUser(req, res); if (!user) return
      const totals = db.prepare(`SELECT
        SUM(pc_minutes) pc_minutes, SUM(phone_minutes) phone_minutes, SUM(focus_minutes) focus_minutes,
        SUM(sleep_minutes) sleep_minutes, SUM(steps) steps, SUM(exercise_minutes) exercise_minutes,
        SUM(development_minutes) development_minutes, SUM(github_commits) github_commits
        FROM daily_metrics WHERE user_id = ?`).get(user.id)
      const first = getMetric(user.id, 1), last = getMetric(user.id, 100)
      return json(res, 200, { totals, first, last })
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

