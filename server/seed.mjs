import { db, isSeeded } from './db.mjs'

function pad(n) { return String(n).padStart(2, '0') }
function dateForDay(day) {
  const d = new Date(Date.UTC(2026, 6, 5 + day - 1))
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())}`
}
function wave(day, base, amp, period, jitter=0) {
  return Math.round(base + Math.sin(day / period) * amp + ((day * 37) % 11 - 5) * jitter)
}

export function seed() {
  if (isSeeded()) return false
  db.prepare('INSERT INTO challenges (id, name, start_date, target_days) VALUES (1, ?, ?, 100)').run('100 DAYS', '2026-07-05')

  const insertMetric = db.prepare(`INSERT INTO daily_metrics
    (challenge_id, day_number, date, pc_minutes, phone_minutes, focus_minutes, sleep_minutes, steps, exercise_minutes, development_minutes, github_commits)
    VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
  const insertUsage = db.prepare('INSERT INTO app_usage (day_number, source, app_name, minutes) VALUES (?, ?, ?, ?)')
  const insertEvent = db.prepare('INSERT INTO timeline_events (day_number, time, label, type) VALUES (?, ?, ?, ?)')
  const insertCheckin = db.prepare('INSERT INTO checkins (day_number, focus_score, satisfaction_score, note, created_at) VALUES (?, ?, ?, ?, ?)')
  const insertStudyCategory = db.prepare('INSERT OR IGNORE INTO study_categories (name, created_at) VALUES (?, ?)')

  db.exec('BEGIN')
  try {
    for (let day = 1; day <= 100; day++) {
      const pc = Math.max(80, wave(day, 330, 95, 5.2, 4))
      const phone = Math.max(70, wave(day, 285 - day * 0.65, 70, 6.4, 3))
      const focus = Math.max(20, wave(day, 105 + day * 1.65, 48, 4.7, 2))
      const sleep = Math.max(250, Math.min(540, wave(day, 390 + day * 0.35, 42, 7.5, 1)))
      const steps = Math.max(1200, wave(day, 7100 + day * 18, 2100, 4.1, 50))
      const exercise = Math.max(0, wave(day, 24, 22, 3.7, 1))
      const dev = Math.max(0, wave(day, 92 + day * 1.05, 55, 5.3, 2))
      const commits = Math.max(0, Math.round(2 + day / 18 + Math.sin(day / 3) * 3))
      insertMetric.run(day, dateForDay(day), pc, phone, focus, sleep, steps, exercise, dev, commits)

      const vscode = Math.min(pc, Math.max(15, Math.round(dev * .8)))
      const youtube = Math.max(5, Math.round(phone * (.28 - Math.min(day, 80) * .0012)))
      const chrome = Math.max(10, Math.round(pc * .19))
      const instagram = Math.max(0, Math.round(phone * .16))
      const discord = Math.max(0, Math.round(pc * .09))
      for (const [source, name, minutes] of [
        ['desktop','VS Code',vscode], ['phone','YouTube',youtube], ['desktop','Chrome',chrome], ['phone','Instagram',instagram], ['desktop','Discord',discord]
      ]) insertUsage.run(day, source, name, minutes)

      if (day <= 37) {
        const events = [
          ['07:10','Wake up','health'], ['08:00','School','life'], ['16:21','VS Code','development'],
          ['18:03','YouTube','screen'], ['19:32','Focus Session','focus'], ['22:14','GitHub Commit','github'], ['01:12','Sleep','sleep']
        ]
        for (const e of events) insertEvent.run(day, ...e)
        insertCheckin.run(day, Math.max(1, Math.min(10, 5 + Math.round(Math.sin(day/4)*2 + day/40))), Math.max(1, Math.min(10, 6 + Math.round(Math.cos(day/5)*1.5))), day === 37 ? 'React 내부 동작 공부 완료. 집중은 꽤 잘 됐다.' : `DAY ${day} 테스트 기록`, `${dateForDay(day)}T23:50:00+09:00`)
      }
    }

    const insertDevice = db.prepare('INSERT INTO devices (kind, name, platform, status, last_sync, source) VALUES (?, ?, ?, ?, ?, ?)')
    insertDevice.run('laptop', 'Sunwoo Laptop', 'Windows 11', 'connected', new Date().toISOString(), 'Desktop Tracker')
    insertDevice.run('phone', 'Galaxy Phone', 'Android', 'connected', new Date().toISOString(), 'Android Companion')
    insertDevice.run('watch', 'Galaxy Watch', 'Wear OS', 'connected', new Date().toISOString(), 'Health Connect')
    insertDevice.run('github', '@sunwoo-demo', 'GitHub', 'connected', new Date().toISOString(), 'GitHub API')

    const insertFocus = db.prepare('INSERT INTO focus_sessions (day_number, category, started_at, ended_at, duration_minutes) VALUES (?, ?, ?, ?, ?)')
    insertFocus.run(37, 'Development', '2026-08-10T09:21:00+09:00', '2026-08-10T10:13:00+09:00', 52)
    insertFocus.run(37, 'Development', '2026-08-10T16:10:00+09:00', '2026-08-10T17:42:00+09:00', 92)
    insertFocus.run(37, 'Coding Test', '2026-08-10T22:03:00+09:00', '2026-08-10T22:41:00+09:00', 38)
    for (const name of ['개발', '코딩 테스트', '학교 공부', '자격증', '독서', '운동', '휴식', '기타']) {
      insertStudyCategory.run(name, new Date().toISOString())
    }
    db.exec('COMMIT')
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  }
  return true
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(seed() ? 'Mock database seeded.' : 'Database already contains mock data.')
}
