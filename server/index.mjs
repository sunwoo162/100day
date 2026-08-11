import http from 'node:http'
import { URL } from 'node:url'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { db, dbPath } from './db.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const distDir = path.join(rootDir, 'dist')
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
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS'
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
const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.webp': 'image/webp',
}
function staticFile(res, filePath) {
  const ext = path.extname(filePath)
  res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'application/octet-stream' })
  fs.createReadStream(filePath).pipe(res)
}
function serveStatic(req, res, url) {
  if (!['GET', 'HEAD'].includes(req.method || '')) return json(res, 405, { error: '허용되지 않는 메서드입니다' })
  const rawPath = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)
  const requested = path.normalize(path.join(distDir, rawPath))
  if (!requested.startsWith(distDir)) return json(res, 403, { error: '잘못된 경로입니다' })
  const filePath = fs.existsSync(requested) && fs.statSync(requested).isFile() ? requested : path.join(distDir, 'index.html')
  if (!fs.existsSync(filePath)) return json(res, 404, { error: '빌드된 프론트엔드가 없습니다. npm run build를 실행하세요.' })
  if (req.method === 'HEAD') {
    res.writeHead(200, { 'Content-Type': contentTypes[path.extname(filePath)] || 'application/octet-stream' })
    return res.end()
  }
  return staticFile(res, filePath)
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
function getUserChallenge(userId) {
  let challenge = db.prepare('SELECT * FROM challenges WHERE user_id = ?').get(userId)
  if (challenge) return challenge
  const result = db.prepare('INSERT INTO challenges (user_id, name, start_date, target_days) VALUES (?, ?, ?, 100)')
    .run(userId, '하루핏', process.env.CHALLENGE_START_DATE || todayKst())
  return db.prepare('SELECT * FROM challenges WHERE id = ?').get(Number(result.lastInsertRowid))
}
function currentDay(challenge) {
  return Math.max(1, Math.min(challenge.target_days, daysBetween(challenge.start_date, todayKst()) + 1))
}
function requestedDay(url, challenge) {
  const day = Number(url.searchParams.get('day') || currentDay(challenge))
  return Math.max(1, Math.min(challenge.target_days, Number.isFinite(day) ? day : currentDay(challenge)))
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
  return db.prepare(`SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token = ? AND s.expires_at > ?`).get(token, new Date().toISOString()) || null
}
function requireUser(req, res) {
  const user = currentUser(req)
  if (!user) {
    json(res, 401, { error: '로그인이 필요합니다' })
    return null
  }
  ensureUserDefaults(user.id)
  return user
}
function emptyMetric(day, challenge) {
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
function getMetric(userId, challenge, day) {
  return db.prepare('SELECT * FROM daily_metrics WHERE user_id = ? AND challenge_id = ? AND day_number = ?').get(userId, challenge.id, day) || emptyMetric(day, challenge)
}
function ensureMetric(userId, challenge, day) {
  const existing = db.prepare('SELECT * FROM daily_metrics WHERE user_id = ? AND challenge_id = ? AND day_number = ?').get(userId, challenge.id, day)
  if (existing) return existing
  const metric = emptyMetric(day, challenge)
  db.prepare(`INSERT INTO daily_metrics
    (user_id, challenge_id, day_number, date, pc_minutes, phone_minutes, focus_minutes, sleep_minutes, steps, exercise_minutes, development_minutes, github_commits)
    VALUES (?, ?, ?, ?, 0, 0, 0, 0, 0, 0, 0, 0)`).run(userId, challenge.id, day, metric.date)
  return db.prepare('SELECT * FROM daily_metrics WHERE user_id = ? AND challenge_id = ? AND day_number = ?').get(userId, challenge.id, day)
}
function ensureUserDefaults(userId) {
  getUserChallenge(userId)
  if (db.prepare('SELECT COUNT(*) AS count FROM study_categories WHERE user_id = ?').get(userId).count === 0) {
    const insertCategory = db.prepare('INSERT INTO study_categories (user_id, name, created_at) VALUES (?, ?, ?)')
    for (const name of ['개발', '코딩 테스트', '학교 공부', '자격증', '독서', '운동', '휴식', '기타']) {
      insertCategory.run(userId, name, new Date().toISOString())
    }
  }
}
function createSession(userId) {
  const token = crypto.randomBytes(32).toString('base64url')
  const expires = new Date(Date.now() + SESSION_DAYS * 86400000)
  db.prepare('INSERT INTO sessions (user_id, token, expires_at, created_at) VALUES (?, ?, ?, ?)')
    .run(userId, token, expires.toISOString(), new Date().toISOString())
  return { token, expires }
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
  const body = new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, code, redirect_uri: callbackUrl(provider) })
  const response = await fetch(config.tokenUrl, { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' }, body })
  if (!response.ok) throw new Error(`OAuth 토큰 요청 실패: ${response.status}`)
  const token = await response.json()
  if (!token.access_token) throw new Error('OAuth 토큰을 받지 못했습니다')
  return token.access_token
}
async function fetchOAuthProfile(provider, accessToken) {
  if (provider === 'github') {
    const userRes = await fetch('https://api.github.com/user', { headers: { Authorization: `Bearer ${accessToken}`, 'User-Agent': 'nayibaegil' } })
    if (!userRes.ok) throw new Error(`GitHub 프로필 요청 실패: ${userRes.status}`)
    const profile = await userRes.json()
    let email = profile.email
    if (!email) {
      const emailRes = await fetch('https://api.github.com/user/emails', { headers: { Authorization: `Bearer ${accessToken}`, 'User-Agent': 'nayibaegil' } })
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
function upsertOAuthUser({ provider, providerUserId, email, name, avatarUrl }) {
  const now = new Date().toISOString()
  const account = db.prepare('SELECT * FROM oauth_accounts WHERE provider = ? AND provider_user_id = ?').get(provider, providerUserId)
  if (account) {
    db.prepare('UPDATE users SET email = COALESCE(?, email), name = ?, avatar_url = COALESCE(?, avatar_url), updated_at = ? WHERE id = ?')
      .run(email || null, name, avatarUrl || null, now, account.user_id)
    ensureUserDefaults(account.user_id)
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
  ensureUserDefaults(user.id)
  return user
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
      const challenge = getUserChallenge(user.id)
      const day = currentDay(challenge)
      const completedDays = db.prepare('SELECT COUNT(DISTINCT day_number) AS count FROM daily_metrics WHERE user_id = ? AND challenge_id = ?').get(user.id, challenge.id).count
      return json(res, 200, { ...challenge, currentDay: day, completedDays, remainingDays: Math.max(0, challenge.target_days - day) })
    }

    if (url.pathname === '/api/dashboard/today') {
      const user = requireUser(req, res); if (!user) return
      const challenge = getUserChallenge(user.id)
      const day = requestedDay(url, challenge)
      const metric = getMetric(user.id, challenge, day)
      const prev = getMetric(user.id, challenge, Math.max(1, day - 1))
      const apps = db.prepare('SELECT app_name AS name, source, minutes FROM app_usage WHERE user_id = ? AND day_number = ? ORDER BY minutes DESC LIMIT 8').all(user.id, day)
      const events = db.prepare('SELECT time, label, type FROM timeline_events WHERE user_id = ? AND day_number = ? ORDER BY time').all(user.id, day)
      const recent = db.prepare('SELECT * FROM daily_metrics WHERE user_id = ? AND challenge_id = ? AND day_number <= ? ORDER BY day_number DESC LIMIT 7').all(user.id, challenge.id, day).reverse()
      return json(res, 200, {
        day,
        date: metric.date,
        metrics: {
          pc: { minutes: metric.pc_minutes, display: formatMinutes(metric.pc_minutes), delta: metric.pc_minutes - prev.pc_minutes },
          phone: { minutes: metric.phone_minutes, display: formatMinutes(metric.phone_minutes), delta: metric.phone_minutes - prev.phone_minutes },
          focus: { minutes: metric.focus_minutes, display: formatMinutes(metric.focus_minutes), delta: metric.focus_minutes - prev.focus_minutes },
          steps: { value: metric.steps, delta: metric.steps - prev.steps },
          exercise: { minutes: metric.exercise_minutes, delta: metric.exercise_minutes - prev.exercise_minutes },
          development: { minutes: metric.development_minutes, display: formatMinutes(metric.development_minutes), delta: metric.development_minutes - prev.development_minutes },
          github: { commits: metric.github_commits, delta: metric.github_commits - prev.github_commits }
        }, apps, events, recent
      })
    }

    if (url.pathname === '/api/timeline') {
      const user = requireUser(req, res); if (!user) return
      const challenge = getUserChallenge(user.id)
      const rows = db.prepare('SELECT * FROM daily_metrics WHERE user_id = ? AND challenge_id = ? ORDER BY day_number').all(user.id, challenge.id)
      return json(res, 200, rows)
    }

    if (url.pathname === '/api/analytics') {
      const user = requireUser(req, res); if (!user) return
      const challenge = getUserChallenge(user.id)
      const days = Math.max(1, Math.min(100, Number(url.searchParams.get('days') || 30)))
      const day = currentDay(challenge)
      const rows = db.prepare('SELECT * FROM daily_metrics WHERE user_id = ? AND challenge_id = ? AND day_number <= ? ORDER BY day_number DESC LIMIT ?').all(user.id, challenge.id, day, days).reverse()
      const topApps = db.prepare(`SELECT app_name AS name, SUM(minutes) AS minutes FROM app_usage WHERE day_number IN (
          SELECT day_number FROM daily_metrics WHERE user_id = ? AND challenge_id = ? AND day_number <= ? ORDER BY day_number DESC LIMIT ?
        ) AND user_id = ? GROUP BY app_name ORDER BY minutes DESC LIMIT 8`).all(user.id, challenge.id, day, days, user.id)
      return json(res, 200, { days, rows, topApps })
    }

    if (url.pathname === '/api/devices') {
      const user = requireUser(req, res); if (!user) return
      return json(res, 200, db.prepare('SELECT * FROM devices WHERE user_id = ? ORDER BY id').all(user.id))
    }

    if (url.pathname === '/api/devices/pairing' && req.method === 'POST') {
      const user = requireUser(req, res); if (!user) return
      const body = await readBody(req)
      const kind = String(body.kind || 'computer')
      const name = String(body.name || '새 기기').trim()
      const platform = String(body.platform || 'Unknown').trim()
      const token = crypto.randomBytes(18).toString('base64url')
      const expires = new Date(Date.now() + 10 * 60 * 1000)
      db.prepare('INSERT INTO device_pairings (user_id, token, kind, name, platform, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(user.id, token, kind, name, platform, expires.toISOString(), new Date().toISOString())
      return json(res, 201, { token, expires_at: expires.toISOString() })
    }

    if (url.pathname === '/api/devices/connect' && req.method === 'POST') {
      const body = await readBody(req)
      const token = String(body.token || '').trim()
      const pairing = db.prepare('SELECT * FROM device_pairings WHERE token = ? AND used_at IS NULL AND expires_at > ?').get(token, new Date().toISOString())
      if (!pairing) return json(res, 400, { error: '유효하지 않거나 만료된 연결 코드입니다' })
      const now = new Date().toISOString()
      const result = db.prepare('INSERT INTO devices (user_id, kind, name, platform, status, last_sync, source) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(pairing.user_id, pairing.kind, pairing.name, pairing.platform, 'connected', now, 'pairing')
      db.prepare('UPDATE device_pairings SET used_at = ? WHERE id = ?').run(now, pairing.id)
      return json(res, 201, db.prepare('SELECT * FROM devices WHERE id = ?').get(Number(result.lastInsertRowid)))
    }

    const deleteDevice = url.pathname.match(/^\/api\/devices\/(\d+)$/)
    if (deleteDevice && req.method === 'DELETE') {
      const user = requireUser(req, res); if (!user) return
      db.prepare('DELETE FROM devices WHERE id = ? AND user_id = ?').run(Number(deleteDevice[1]), user.id)
      return json(res, 200, { ok: true })
    }

    if (url.pathname === '/api/study/categories' && req.method === 'GET') {
      const user = requireUser(req, res); if (!user) return
      const categories = db.prepare('SELECT id, name FROM study_categories WHERE user_id = ? ORDER BY id').all(user.id)
      return json(res, 200, categories)
    }

    if (url.pathname === '/api/study/categories' && req.method === 'POST') {
      const user = requireUser(req, res); if (!user) return
      const body = await readBody(req)
      const name = String(body.name || '').trim()
      if (!name) return json(res, 400, { error: '카테고리 이름이 필요합니다' })
      db.prepare('INSERT OR IGNORE INTO study_categories (user_id, name, created_at) VALUES (?, ?, ?)').run(user.id, name, new Date().toISOString())
      return json(res, 201, db.prepare('SELECT id, name FROM study_categories WHERE user_id = ? AND name = ?').get(user.id, name))
    }

    if (url.pathname === '/api/focus/sessions' && req.method === 'GET') {
      const user = requireUser(req, res); if (!user) return
      const challenge = getUserChallenge(user.id)
      const day = requestedDay(url, challenge)
      return json(res, 200, db.prepare('SELECT * FROM focus_sessions WHERE user_id = ? AND day_number = ? ORDER BY started_at').all(user.id, day))
    }

    if (url.pathname === '/api/focus/sessions' && req.method === 'POST') {
      const user = requireUser(req, res); if (!user) return
      const challenge = getUserChallenge(user.id)
      const body = await readBody(req)
      const day = Number(body.day_number || currentDay(challenge))
      const category = String(body.category || '기타')
      const note = String(body.note || '')
      const started = body.started_at || new Date().toISOString()
      const ended = body.ended_at || new Date().toISOString()
      const duration = Number(body.duration_minutes || 0)
      db.prepare('INSERT OR IGNORE INTO study_categories (user_id, name, created_at) VALUES (?, ?, ?)').run(user.id, category, new Date().toISOString())
      const result = db.prepare('INSERT INTO focus_sessions (user_id, day_number, category, note, started_at, ended_at, duration_minutes) VALUES (?, ?, ?, ?, ?, ?, ?)').run(user.id, day, category, note, started, ended, duration)
      ensureMetric(user.id, challenge, day)
      db.prepare('UPDATE daily_metrics SET focus_minutes = focus_minutes + ? WHERE user_id = ? AND challenge_id = ? AND day_number = ?').run(duration, user.id, challenge.id, day)
      return json(res, 201, { id: Number(result.lastInsertRowid), day_number: day, category, note, started_at: started, ended_at: ended, duration_minutes: duration })
    }

    if (url.pathname === '/api/result') {
      const user = requireUser(req, res); if (!user) return
      const challenge = getUserChallenge(user.id)
      const totals = db.prepare(`SELECT
        COALESCE(SUM(pc_minutes), 0) pc_minutes, COALESCE(SUM(phone_minutes), 0) phone_minutes, COALESCE(SUM(focus_minutes), 0) focus_minutes,
        COALESCE(SUM(steps), 0) steps, COALESCE(SUM(exercise_minutes), 0) exercise_minutes,
        COALESCE(SUM(development_minutes), 0) development_minutes, COALESCE(SUM(github_commits), 0) github_commits
        FROM daily_metrics WHERE user_id = ? AND challenge_id = ?`).get(user.id, challenge.id)
      const first = getMetric(user.id, challenge, 1), last = getMetric(user.id, challenge, currentDay(challenge))
      const rows = db.prepare('SELECT * FROM daily_metrics WHERE user_id = ? AND challenge_id = ? ORDER BY day_number').all(user.id, challenge.id)
      return json(res, 200, { totals, first, last, rows })
    }

    if (url.pathname.startsWith('/api/')) return json(res, 404, { error: '찾을 수 없습니다' })
    return serveStatic(req, res, url)
  } catch (error) {
    console.error(error)
    return json(res, 500, { error: error.message })
  }
})

server.listen(PORT, () => {
  console.log(`하루핏 API 실행 중: http://localhost:${PORT}`)
  console.log(`SQLite DB: ${dbPath}`)
})

