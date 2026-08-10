import { useState, useEffect, useRef } from 'react'
import { api, type AnalyticsData, type ChallengeData, type DashboardData, type DeviceData, type FocusSession, type ResultData, type StudyCategory, type TimelineEntry } from './lib/api'

type Page = 'dashboard' | 'timeline' | 'analytics' | 'focus' | 'devices' | 'checkin' | 'result'

/* ── colour tokens ── */
const C = {
  canvas: '#0d0d0d',
  surface: '#131313',
  raised: '#1a1a1a',
  chip: '#222222',
  mint: '#00e8c5',
  mintBright: '#21fce3',
  mintMuted: '#7be3d3',
  ink: '#171b21',
  white: '#ffffff',
  soft: '#e6e6e6',
  muted: '#bfbfbf',
  faint: '#979797',
  alt: '#8e8e94',
  border: '#1e1e1e',
  border2: '#252525',
}

const NAV: { id: Page; label: string; Icon: (p: { active: boolean }) => React.ReactElement }[] = [
  { id: 'dashboard', label: '개요',  Icon: ({ active }) => <IcoGrid   c={active ? C.mint : '#4a4a4a'} /> },
  { id: 'timeline',  label: '타임라인',  Icon: ({ active }) => <IcoCalendar c={active ? C.mint : '#4a4a4a'} /> },
  { id: 'analytics', label: '분석', Icon: ({ active }) => <IcoChart  c={active ? C.mint : '#4a4a4a'} /> },
  { id: 'focus',     label: '공부',     Icon: ({ active }) => <IcoTimer  c={active ? C.mint : '#4a4a4a'} /> },
  { id: 'devices',   label: '기기',   Icon: ({ active }) => <IcoDevice c={active ? C.mint : '#4a4a4a'} /> },
]

function fmtMinutes(min: number) {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h <= 0) return `${m}분`
  return `${h}시간 ${String(m).padStart(2, '0')}분`
}

function fmtDelta(delta: number, unit = '분') {
  if (delta === 0) return '어제와 같음'
  return `어제보다 ${delta > 0 ? '+' : '-'}${Math.abs(delta).toLocaleString()}${unit}`
}

function parseHourValue(display: string) {
  const hours = display.match(/(\d+)h/)?.[1] ?? '0'
  const mins = display.match(/(\d+)m/)?.[1] ?? '0'
  return `${Number(hours)}시간 ${String(Number(mins)).padStart(2, '0')}분`
}

function shortTime(iso: string | null) {
  if (!iso) return '아직 없음'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '알 수 없음'
  const diff = Math.max(0, Date.now() - date.getTime())
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '방금 전'
  if (mins < 60) return `${mins}분 전`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}시간 전`
  return `${Math.floor(hours / 24)}일 전`
}

function LoadingBlock({ label = '데이터를 불러오는 중입니다' }: { label?: string }) {
  return <div style={{ padding: 36, color: C.alt, fontSize: 13 }}>{label}</div>
}

function ErrorBlock({ message }: { message: string }) {
  return <div style={{ padding: 36, color: C.mintMuted, fontSize: 13 }}>{message}</div>
}

export default function App() {
  const [page, setPage] = useState<Page>('dashboard')
  const [menuOpen, setMenuOpen] = useState(false)
  const [challenge, setChallenge] = useState<ChallengeData | null>(null)

  useEffect(() => {
    api.challenge().then(setChallenge).catch(() => setChallenge(null))
  }, [])

  const currentDay = challenge?.currentDay ?? 1
  return (
    <div style={{ display: 'flex', height: '100vh', background: C.canvas, overflow: 'hidden', fontFamily: "'Pretendard', system-ui, sans-serif" }}>
      <Sidebar page={page} setPage={setPage} open={menuOpen} setOpen={setMenuOpen} currentDay={currentDay} />
      <main style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }} className="scrollbar-none">
        <MobileTopbar page={page} onMenu={() => setMenuOpen(true)} />
        {page === 'dashboard' && <DashboardPage setPage={setPage} currentDay={currentDay} />}
        {page === 'timeline'  && <TimelinePage currentDay={currentDay} />}
        {page === 'analytics' && <AnalyticsPage />}
        {page === 'focus'     && <FocusPage currentDay={currentDay} />}
        {page === 'devices'   && <DevicesPage />}
        {page === 'checkin'   && <CheckinPage setPage={setPage} currentDay={currentDay} />}
        {page === 'result'    && <ResultPage />}
      </main>
      {menuOpen && <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 39 }} />}
    </div>
  )
}

/* ═══════════════════════════════════════════════
   SIDEBAR
═══════════════════════════════════════════════ */
function Sidebar({ page, setPage, open, setOpen, currentDay }: { page: Page; setPage: (p: Page) => void; open: boolean; setOpen: (v: boolean) => void; currentDay: number }) {
  return (
    <aside data-open={open} style={{
      width: 210, minWidth: 210, background: C.surface,
      display: 'flex', flexDirection: 'column',
      borderRight: `1px solid ${C.border}`, zIndex: 50,
    }}>
      {/* Logo */}
      <div style={{ padding: '26px 20px 22px', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <LogoMark />
          <div>
            <div style={{ fontSize: 13, fontWeight: 900, color: C.white, letterSpacing: '0.08em' }}>100 DAYS</div>
            <div style={{ fontSize: 10, color: C.alt, fontFamily: "'JetBrains Mono', monospace", marginTop: 1 }}>{currentDay}일차 / 100</div>
          </div>
        </div>
        {/* mini progress */}
        <div style={{ marginTop: 14, height: 2, background: C.border2, borderRadius: 1 }}>
          <div style={{ width: `${currentDay}%`, height: '100%', background: C.mint, borderRadius: 1 }} />
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 10px' }}>
        {NAV.map(({ id, label, Icon }) => (
          <NavBtn key={id} active={page === id} onClick={() => { setPage(id); setOpen(false) }}>
            <Icon active={page === id} />
            <span>{label}</span>
          </NavBtn>
        ))}
      </nav>

      {/* Bottom */}
      <div style={{ padding: '10px 10px 24px', borderTop: `1px solid ${C.border}` }}>
        <NavBtn active={page === 'checkin'} onClick={() => { setPage('checkin'); setOpen(false) }}>
          <IcoCheck c={page === 'checkin' ? C.mint : '#4a4a4a'} />
          <span>오늘 체크인</span>
        </NavBtn>
        <NavBtn active={page === 'result'} onClick={() => { setPage('result'); setOpen(false) }}>
          <IcoTrophy c={page === 'result' ? C.mint : '#4a4a4a'} />
          <span>100일 결과</span>
        </NavBtn>
      </div>
    </aside>
  )
}

function NavBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      width: '100%', display: 'flex', alignItems: 'center', gap: 9,
      padding: '9px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
      background: active ? C.raised : 'transparent',
      color: active ? C.mint : C.alt,
      fontFamily: "'Pretendard', system-ui, sans-serif",
      fontSize: 13, fontWeight: active ? 600 : 400,
      marginBottom: 2, transition: 'all 120ms', textAlign: 'left',
    }}>
      {children}
    </button>
  )
}

function MobileTopbar({ page, onMenu }: { page: Page; onMenu: () => void }) {
  const titles: Record<Page, string> = { dashboard: '개요', timeline: '타임라인', analytics: '분석', focus: '공부', devices: '기기', checkin: '오늘 체크인', result: '100일 결과' }
  return (
    <div className="mobile-header" style={{ display: 'none', padding: '14px 20px', borderBottom: `1px solid ${C.border}`, background: C.surface, alignItems: 'center', gap: 12 }}>
      <button onClick={onMenu} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><IcoMenu c={C.muted} /></button>
      <span style={{ fontWeight: 700, fontSize: 15, color: C.white }}>{titles[page]}</span>
    </div>
  )
}

/* ═══════════════════════════════════════════════
   DASHBOARD
═══════════════════════════════════════════════ */
function DashboardPage({ setPage, currentDay }: { setPage: (p: Page) => void; currentDay: number }) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.dashboard(currentDay).then(setData).catch((err) => setError(err.message))
  }, [currentDay])

  const spark7 = [4.1, 5.2, 6.3, 5.8, 7.1, 6.4, 6.2]
  const spark7b = [5.3, 4.8, 5.6, 6.1, 4.9, 5.0, 4.1]
  const spark7c = [1.8, 2.4, 2.1, 3.2, 2.9, 3.1, 3.3]
  const spark7d = [7.5, 6.8, 7.2, 5.9, 7.1, 6.5, 6.7]
  const spark7e = [6200, 7400, 5800, 8100, 7900, 6700, 8421]
  const spark7f = [20, 35, 0, 42, 27, 60, 27]
  const spark7g = [1.2, 1.8, 2.1, 2.4, 2.0, 2.3, 2.5]
  const spark7h = [2, 4, 5, 6, 3, 8, 7]

  if (error) return <ErrorBlock message={error} />
  if (!data) return <LoadingBlock />

  const m = data.metrics
  const stats = [
    { id: 'pc', label: 'PC', value: parseHourValue(m.pc.display || '0h 00m'), sub: fmtDelta(m.pc.delta), up: m.pc.delta >= 0, spark: spark7, max: 10, color: C.mint },
    { id: 'phone', label: '휴대폰', value: parseHourValue(m.phone.display || '0h 00m'), sub: fmtDelta(m.phone.delta), up: m.phone.delta <= 0, spark: spark7b, max: 10, color: C.faint },
    { id: 'focus', label: '집중', value: parseHourValue(m.focus.display || '0h 00m'), sub: fmtDelta(m.focus.delta), up: m.focus.delta >= 0, spark: spark7c, max: 5, color: C.mint },
    { id: 'sleep', label: '수면', value: parseHourValue(m.sleep.display || '0h 00m'), sub: fmtDelta(m.sleep.delta), up: m.sleep.delta >= 0, spark: spark7d, max: 9, color: C.mintMuted },
    { id: 'steps', label: '걸음', value: (m.steps.value || 0).toLocaleString(), sub: fmtDelta(m.steps.delta, ''), up: m.steps.delta >= 0, spark: spark7e, max: 12000, color: C.mint },
    { id: 'ex', label: '운동', value: fmtMinutes(m.exercise.minutes || 0), sub: fmtDelta(m.exercise.delta), up: m.exercise.delta >= 0, spark: spark7f, max: 90, color: C.mintMuted },
    { id: 'dev', label: '개발', value: parseHourValue(m.development.display || '0h 00m'), sub: fmtDelta(m.development.delta), up: m.development.delta >= 0, spark: spark7g, max: 5, color: C.mintBright },
    { id: 'git', label: 'GitHub', value: `커밋 ${m.github.commits || 0}개`, sub: fmtDelta(m.github.delta, ''), up: m.github.delta >= 0, spark: spark7h, max: 12, color: C.mint },
  ]

  const maxAppMinutes = Math.max(1, ...data.apps.map((app) => app.minutes))
  const apps = data.apps.map((app, i) => ({
    name: app.name,
    dur: fmtMinutes(app.minutes),
    pct: Math.round((app.minutes / maxAppMinutes) * 100),
    color: i === 0 ? C.mint : '#2e2e2e',
  }))
  const timeline = data.events.map((event) => ({
    time: event.time,
    label: event.label
      .replace('Wake up', '기상')
      .replace('School', '학교')
      .replace('Focus Session', '집중 세션')
      .replace('GitHub Commit', 'GitHub 커밋')
      .replace('Sleep', '수면'),
    dot: event.type === 'development' ? C.mint : event.type === 'focus' ? C.mintBright : event.type === 'health' ? C.mintMuted : '#3a3a3a',
  }))

  /* device ring data: laptop=6h21, phone=4h13, watch=active all day */
  const deviceTotal = 6.35 + 4.22 + 8.67
  const devPcts = [6.35 / deviceTotal, 4.22 / deviceTotal, 8.67 / deviceTotal]

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1080 }}>
      {/* Header */}
      <div style={{ marginBottom: 36 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: C.alt, letterSpacing: '0.12em' }}>{data.date}</span>
          <span style={{ width: 3, height: 3, borderRadius: '50%', background: C.border2, display: 'inline-block' }} />
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: C.faint }}>100일 중 {data.day}일차</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 68, fontWeight: 900, color: C.white, lineHeight: 1, letterSpacing: '-0.03em' }}>{data.day}일차</span>
          <div style={{ paddingBottom: 8 }}>
            <ProgressRing pct={data.day} size={52} stroke={3} color={C.mint} trackColor={C.border2} label={`${data.day}%`} />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
          <div style={{ flex: 1, maxWidth: 360, height: 2, background: C.border2, borderRadius: 1 }}>
            <div style={{ width: `${data.day}%`, height: '100%', background: C.mint, borderRadius: 1 }} />
          </div>
          <span style={{ fontSize: 11, color: C.alt }}>{100 - data.day}일 남음</span>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 28 }}>
        {stats.map((s) => (
          <div key={s.id} style={{ background: C.raised, borderRadius: 14, padding: '18px 18px 14px', border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 10, color: '#4a4a4a', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.08em', marginBottom: 10 }}>{s.label.toUpperCase()}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: C.white, letterSpacing: '-0.02em', marginBottom: 4, lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 10, color: s.up ? C.mintMuted : C.faint, marginBottom: 12 }}>{s.sub}</div>
            <Sparkline data={s.spark} color={s.color} max={s.max} />
          </div>
        ))}
      </div>

      {/* Lower row */}
      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 1fr', gap: 16 }}>
        {/* Device ring */}
        <div style={{ background: C.raised, borderRadius: 14, padding: '20px', border: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ fontSize: 10, color: '#4a4a4a', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.08em', marginBottom: 16, alignSelf: 'flex-start' }}>기기</div>
          <DeviceRing pcts={devPcts} />
          <div style={{ marginTop: 18, width: '100%' }}>
            {[
              { label: '노트북', val: parseHourValue(m.pc.display || '0h 00m'), color: C.mint },
              { label: '휴대폰',  val: parseHourValue(m.phone.display || '0h 00m'), color: C.mintMuted },
              { label: '수면/워치',  val: parseHourValue(m.sleep.display || '0h 00m'), color: '#333' },
            ].map((d) => (
              <div key={d.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 9 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <div style={{ width: 6, height: 6, borderRadius: 1, background: d.color }} />
                  <span style={{ fontSize: 11, color: C.alt }}>{d.label}</span>
                </div>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: C.muted }}>{d.val}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Timeline */}
        <div style={{ background: C.raised, borderRadius: 14, padding: '20px', border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 10, color: '#4a4a4a', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.08em', marginBottom: 18 }}>오늘 타임라인</div>
          <div style={{ position: 'relative', paddingLeft: 60 }}>
            <div style={{ position: 'absolute', left: 42, top: 4, bottom: 4, width: 1, background: C.border }} />
            {timeline.map((t, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 17, position: 'relative' }}>
                <span style={{ position: 'absolute', left: -60, fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: C.alt, whiteSpace: 'nowrap' }}>{t.time}</span>
                <div style={{ position: 'absolute', left: -20, width: 7, height: 7, borderRadius: '50%', background: t.dot, border: `1px solid ${C.border2}`, zIndex: 1 }} />
                <span style={{ fontSize: 12, color: C.muted }}>{t.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* App usage */}
        <div style={{ background: C.raised, borderRadius: 14, padding: '20px', border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 10, color: '#4a4a4a', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.08em', marginBottom: 18 }}>앱 사용량</div>
          {apps.map((a, i) => (
            <div key={a.name} style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AppIconMini name={a.name} />
                  <span style={{ fontSize: 12, color: i === 0 ? C.white : C.muted }}>{a.name}</span>
                </div>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: C.alt }}>{a.dur}</span>
              </div>
              <div style={{ height: 3, background: C.border, borderRadius: 2 }}>
                <div style={{ width: `${a.pct}%`, height: '100%', background: a.color, borderRadius: 2, transition: 'width 0.7s' }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Check-in CTA */}
      <div style={{ marginTop: 16, background: 'linear-gradient(135deg, rgba(0,232,197,0.06) 0%, rgba(0,232,197,0.02) 100%)', borderRadius: 14, padding: '18px 24px', border: `1px solid rgba(0,232,197,0.12)`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.white, marginBottom: 2 }}>오늘 체크인</div>
          <div style={{ fontSize: 11, color: C.alt }}>집중도와 만족도를 기록하세요. 30초면 됩니다</div>
        </div>
        <button onClick={() => setPage('checkin')} style={{ padding: '9px 20px', borderRadius: 50, background: C.mint, color: C.ink, fontFamily: "'Pretendard', system-ui, sans-serif", fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer', letterSpacing: '0.04em' }}>
          Start →
        </button>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════
   TIMELINE PAGE
═══════════════════════════════════════════════ */
function TimelinePage({ currentDay }: { currentDay: number }) {
  const [sel, setSel] = useState(currentDay)
  const [rows, setRows] = useState<TimelineEntry[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    api.timeline().then(setRows).catch((err) => setError(err.message))
  }, [])

  const completedDays = currentDay
  const d = rows.find((row) => row.day_number === sel) ?? rows[0]
  if (error) return <ErrorBlock message={error} />

  return (
    <div style={{ padding: '32px 36px' }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 44, fontWeight: 900, color: C.white, letterSpacing: '-0.03em', lineHeight: 1 }}>100 DAYS</div>
        <div style={{ display: 'flex', gap: 20, marginTop: 8 }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: C.mint }}>{completedDays}일 완료</span>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: C.alt }}>{100 - completedDays}일 남음</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20 }}>
        {/* Grid */}
        <div style={{ background: C.raised, borderRadius: 14, padding: '24px', border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 10, color: '#4a4a4a', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.08em', marginBottom: 16 }}>전체 날짜</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 6 }}>
            {Array.from({ length: 100 }, (_, i) => i + 1).map((n) => {
              const done = n < completedDays
              const today = n === completedDays
              const future = n > completedDays
              return (
                <button key={n} onClick={() => !future && setSel(n)} style={{
                  aspectRatio: '1', borderRadius: 6, border: 'none',
                  cursor: future ? 'default' : 'pointer',
                  background: today ? C.mint : sel === n && !today ? C.chip : done ? '#1e1e1e' : '#111',
                  color: today ? C.ink : done ? C.muted : '#2e2e2e',
                  fontSize: 10, fontFamily: "'JetBrains Mono', monospace",
                  fontWeight: today ? 700 : 400,
                  opacity: future ? 0.3 : 1,
                  outline: sel === n && !today ? `1px solid ${C.mint}` : 'none',
                  outlineOffset: 1,
                  transition: 'all 100ms', padding: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {n}
                </button>
              )
            })}
          </div>
          {/* legend */}
          <div style={{ display: 'flex', gap: 16, marginTop: 16 }}>
            {[{ col: C.mint, lbl: '오늘' }, { col: '#1e1e1e', lbl: '완료' }, { col: '#111', lbl: '예정' }].map(l => (
              <div key={l.lbl} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: l.col }} />
                <span style={{ fontSize: 10, color: C.alt }}>{l.lbl}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Detail panel */}
        <div style={{ background: C.raised, borderRadius: 14, padding: '22px', border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 10, color: '#4a4a4a', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.08em', marginBottom: 4 }}>선택한 날짜</div>
          <div style={{ fontSize: 34, fontWeight: 900, color: C.white, letterSpacing: '-0.03em', marginBottom: 18 }}>{sel}일차</div>

          {d ? [['PC', fmtMinutes(d.pc_minutes)], ['휴대폰', fmtMinutes(d.phone_minutes)], ['공부', fmtMinutes(d.focus_minutes)], ['수면', fmtMinutes(d.sleep_minutes)], ['걸음', d.steps.toLocaleString()]].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: `1px solid ${C.border}` }}>
              <span style={{ fontSize: 11, color: C.alt }}>{k}</span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: C.muted }}>{v}</span>
            </div>
          )) : <div style={{ fontSize: 12, color: C.alt, padding: '12px 0' }}>아직 저장된 기록이 없습니다.</div>}

          <div style={{ marginTop: 16, marginBottom: 12 }}>
            <DotScore label="Focus" value={d.focusScore} color={C.mint} />
            <DotScore label="Satisfaction" value={d.sat} color={C.mintMuted} />
          </div>

          {/* GitHub mini heatrow */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: '#4a4a4a', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.08em', marginBottom: 6 }}>커밋</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CommitPips count={d.commits} />
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: C.mint }}>{d?.github_commits ?? 0}</span>
            </div>
          </div>

          <div style={{ background: C.surface, borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ fontSize: 10, color: '#4a4a4a', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.08em', marginBottom: 6 }}>메모</div>
            <p style={{ fontSize: 12, color: C.muted, margin: 0, lineHeight: 1.7 }}>{d?.note || '아직 기록된 메모가 없습니다.'}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function DotScore({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
      <span style={{ fontSize: 11, color: C.alt }}>{label}</span>
      <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} style={{ width: 7, height: 7, borderRadius: 1, background: i < value ? color : C.border2, transition: 'background 120ms' }} />
        ))}
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: C.alt, marginLeft: 4 }}>{value}</span>
      </div>
    </div>
  )
}

function CommitPips({ count }: { count: number }) {
  return (
    <div style={{ display: 'flex', gap: 3 }}>
      {Array.from({ length: 12 }, (_, i) => (
        <div key={i} style={{ width: 9, height: 9, borderRadius: 2, background: i < count ? C.mint : C.border2 }} />
      ))}
    </div>
  )
}

/* ═══════════════════════════════════════════════
   ANALYTICS
═══════════════════════════════════════════════ */
function AnalyticsPage() {
  const [period, setPeriod] = useState<'7' | '30' | '100'>('30')
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.analytics(Number(period)).then(setData).catch((err) => setError(err.message))
  }, [period])

  if (error) return <ErrorBlock message={error} />
  if (!data) return <LoadingBlock />

  const rows = data.rows.length ? data.rows : [{ pc_minutes: 0, phone_minutes: 0, sleep_minutes: 0, focus_minutes: 0, steps: 0, github_commits: 0 } as TimelineEntry]
  const screenPc = rows.map((row) => row.pc_minutes / 60)
  const screenPhone = rows.map((row) => row.phone_minutes / 60)
  const sleepData = rows.map((row) => row.sleep_minutes / 60)
  const focusData = rows.map((row) => row.focus_minutes / 60)
  const stepsData = rows.map((row) => row.steps)
  const ghData = rows.map((row) => row.github_commits)
  const avg = (arr: number[]) => arr.length ? arr.reduce((a, v) => a + v, 0) / arr.length : 0

  const insights = [
    { icon: '↑', text: '7시간 이상 자면 집중도가 24% 더 좋아집니다.' },
    { icon: '★', text: '가장 생산적인 요일은 화요일입니다.' },
    { icon: '↓', text: '37일 동안 평균 휴대폰 사용량이 18% 줄었습니다.' },
    { icon: '↑', text: '처음 10일 대비 VS Code 사용량이 31% 늘었습니다.' },
  ]

  const maxAppMinutes = Math.max(1, ...data.topApps.map((app) => app.minutes))
  const apps = data.topApps.map((app, i) => ({
    name: app.name,
    pct: Math.round((app.minutes / maxAppMinutes) * 100),
    hours: Math.round(app.minutes / 60),
    color: i === 0 ? C.mint : '#2a2a2a',
  }))

  return (
    <div style={{ padding: '32px 36px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <span style={{ fontSize: 32, fontWeight: 900, color: C.white, letterSpacing: '-0.02em' }}>분석</span>
        <div style={{ display: 'flex', gap: 3, background: C.raised, borderRadius: 8, padding: 3, border: `1px solid ${C.border}` }}>
          {(['7', '30', '100'] as const).map(p => (
            <button key={p} onClick={() => setPeriod(p)} style={{
              padding: '5px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
              background: period === p ? C.mint : 'transparent',
              color: period === p ? C.ink : C.alt,
              fontFamily: "'Pretendard', system-ui, sans-serif",
              fontSize: 12, fontWeight: period === p ? 700 : 400,
              transition: 'all 120ms',
            }}>
              {p}일
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Screen time */}
        <ChartCard title="화면 시간" subtitle="PC vs 휴대폰 · 시간/일">
          <div style={{ display: 'flex', gap: 14, marginBottom: 12 }}>
            <Legend color={C.mint} label="PC" />
            <Legend color="#3a3a3a" label="휴대폰" />
          </div>
          <DualLineChart a={screenPc} b={screenPhone} maxVal={10} colorA={C.mint} colorB="#4a4a4a" h={90} />
        </ChartCard>

        {/* Sleep */}
        <ChartCard title="수면" subtitle="시간 / 밤">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 26, fontWeight: 800, color: C.white }}>{avg(sleepData).toFixed(1)}시간</span>
            <span style={{ fontSize: 10, color: C.mintMuted }}>평균</span>
          </div>
          <AreaChart data={sleepData} maxVal={9} color={C.mintMuted} h={90} />
        </ChartCard>

        {/* Focus */}
        <ChartCard title="집중 시간" subtitle="시간 / 일">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 26, fontWeight: 800, color: C.white }}>{avg(focusData).toFixed(1)}시간</span>
            <span style={{ fontSize: 10, color: C.mint }}>평균</span>
          </div>
          <BarChartSVG data={focusData} maxVal={5} color={C.mint} h={90} />
        </ChartCard>

        {/* Steps */}
        <ChartCard title="걸음 수" subtitle="일일 걸음 수">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 26, fontWeight: 800, color: C.white }}>{(avg(stepsData) / 1000).toFixed(1)}천</span>
            <span style={{ fontSize: 10, color: C.mint }}>평균</span>
          </div>
          <BarChartSVG data={stepsData.map(v => v / 1000)} maxVal={10} color="#2a2a2a" accent={C.mint} h={90} />
        </ChartCard>
      </div>

      {/* GitHub heatmap */}
      <div style={{ background: C.raised, borderRadius: 14, padding: '20px 24px', border: `1px solid ${C.border}`, marginBottom: 16 }}>
        <div style={{ fontSize: 10, color: '#4a4a4a', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.08em', marginBottom: 14 }}>GITHUB 활동 · {data.days}일</div>
        <GithubHeatmap data={ghData} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* App usage */}
        <ChartCard title="상위 앱" subtitle="누적 시간">
          {apps.map(a => (
            <div key={a.name} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AppIconMini name={a.name} />
                  <span style={{ fontSize: 12, color: C.muted }}>{a.name}</span>
                </div>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: C.alt }}>{a.hours}시간</span>
              </div>
              <div style={{ height: 3, background: C.border, borderRadius: 2 }}>
                <div style={{ width: `${a.pct}%`, height: '100%', background: a.color, borderRadius: 2 }} />
              </div>
            </div>
          ))}
        </ChartCard>

        {/* Insights */}
        <ChartCard title="인사이트" subtitle="감지된 패턴">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {insights.map((ins, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, padding: '10px 12px', background: C.surface, borderRadius: 10, border: `1px solid ${C.border}` }}>
                <span style={{ fontSize: 12, color: C.mint, fontWeight: 700, minWidth: 14 }}>{ins.icon}</span>
                <p style={{ margin: 0, fontSize: 11, color: C.muted, lineHeight: 1.6 }}>{ins.text}</p>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>
    </div>
  )
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div style={{ background: C.raised, borderRadius: 14, padding: '20px', border: `1px solid ${C.border}` }}>
      <div style={{ fontSize: 10, color: '#4a4a4a', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.08em' }}>{title}</div>
      <div style={{ fontSize: 11, color: '#333', marginBottom: 14, marginTop: 1 }}>{subtitle}</div>
      {children}
    </div>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={{ width: 8, height: 2, borderRadius: 1, background: color }} />
      <span style={{ fontSize: 10, color: C.alt }}>{label}</span>
    </div>
  )
}

function GithubHeatmap({ data }: { data: number[] }) {
  const max = Math.max(1, ...data)
  const opacity = (v: number) => v === 0 ? 0.06 : 0.15 + (v / max) * 0.85
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {data.map((v, i) => (
        <div key={i} title={`${i + 1}일차: 커밋 ${v}개`} style={{
          width: 14, height: 14, borderRadius: 3,
          background: C.mint, opacity: opacity(v),
          cursor: 'default',
        }} />
      ))}
      {/* future cells */}
      {Array.from({ length: 63 }, (_, i) => (
        <div key={`f${i}`} style={{ width: 14, height: 14, borderRadius: 3, background: C.border, opacity: 0.5 }} />
      ))}
    </div>
  )
}

/* ═══════════════════════════════════════════════
   FOCUS
═══════════════════════════════════════════════ */
function FocusPage({ currentDay }: { currentDay: number }) {
  const [running, setRunning] = useState(false)
  const [secs, setSecs] = useState(0)
  const [cat, setCat] = useState('개발')
  const [newCat, setNewCat] = useState('')
  const [note, setNote] = useState('')
  const [startedAt, setStartedAt] = useState<string | null>(null)
  const [sessions, setSessions] = useState<FocusSession[]>([])
  const [categories, setCategories] = useState<StudyCategory[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const ref = useRef<ReturnType<typeof setInterval> | null>(null)

  const totalMins = sessions.reduce((a, s) => a + s.duration_minutes, 0) + Math.floor(secs / 60)

  useEffect(() => {
    api.focusSessions(currentDay).then(setSessions).catch((err) => setError(err.message))
    api.studyCategories()
      .then((items) => {
        setCategories(items)
        if (items[0]) setCat(items[0].name)
      })
      .catch((err) => setError(err.message))
  }, [currentDay])

  useEffect(() => {
    if (running) ref.current = setInterval(() => setSecs(s => s + 1), 1000)
    else if (ref.current) clearInterval(ref.current)
    return () => { if (ref.current) clearInterval(ref.current) }
  }, [running])

  const fmt = (s: number) => [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map(n => n.toString().padStart(2, '0')).join(':')
  const toClock = (iso: string | null) => iso ? new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }) : '--:--'
  const toggleTimer = async () => {
    if (!running) {
      setStartedAt(new Date().toISOString())
      setSecs(0)
      setRunning(true)
      return
    }

    setRunning(false)
    if (!startedAt || secs < 60) {
      setSecs(0)
      return
    }

    setSaving(true)
    try {
      const saved = await api.addFocusSession({
        day_number: currentDay,
        category: cat,
        note,
        started_at: startedAt,
        ended_at: new Date().toISOString(),
        duration_minutes: Math.max(1, Math.round(secs / 60)),
      })
      setSessions((items) => [...items, saved])
      setStartedAt(null)
      setNote('')
      setSecs(0)
    } catch (err) {
      setError(err instanceof Error ? err.message : '집중 세션 저장 실패')
    } finally {
      setSaving(false)
    }
  }
  const addCategory = async () => {
    const name = newCat.trim()
    if (!name) return
    try {
      const saved = await api.addStudyCategory({ name })
      setCategories((items) => items.some((item) => item.name === saved.name) ? items : [...items, saved])
      setCat(saved.name)
      setNewCat('')
    } catch (err) {
      setError(err instanceof Error ? err.message : '카테고리 추가 실패')
    }
  }
  const goalMins = 240

  return (
    <div style={{ padding: '40px 36px', maxWidth: 600, margin: '0 auto' }}>
      {error && <div style={{ color: C.mintMuted, fontSize: 12, marginBottom: 16 }}>{error}</div>}
      {/* Big timer */}
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div style={{ fontSize: 10, color: '#4a4a4a', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.2em', marginBottom: 28 }}>공부 기록</div>

        {/* ring around timer */}
        <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
          <FocusRing pct={Math.min(secs / (goalMins * 60), 1)} running={running} />
          <div style={{ position: 'absolute', textAlign: 'center' }}>
            <div style={{
              fontSize: 44, fontWeight: 900, fontFamily: "'JetBrains Mono', monospace",
              color: running ? C.mint : C.white,
              letterSpacing: '-0.04em', lineHeight: 1,
              transition: 'color 0.3s',
            }}>
              {fmt(secs)}
            </div>
            {running && <div style={{ fontSize: 11, color: C.alt, marginTop: 6 }}>{cat}{note ? ` · ${note}` : ''}</div>}
          </div>
        </div>

        {!running && (
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 10, color: '#4a4a4a', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.1em', marginBottom: 12 }}>지금 하는 일</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
              {categories.map(c => (
                <button key={c.id} onClick={() => setCat(c.name)} style={{
                  padding: '7px 14px', borderRadius: 30, cursor: 'pointer', transition: 'all 120ms',
                  border: `1px solid ${cat === c.name ? C.mint : C.border2}`,
                  background: cat === c.name ? 'rgba(0,232,197,0.08)' : 'transparent',
                  color: cat === c.name ? C.mint : C.alt,
                  fontFamily: "'Pretendard', system-ui, sans-serif", fontSize: 12,
                }}>
                  {c.name}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <input value={newCat} onChange={e => setNewCat(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addCategory() }}
                placeholder="새 활동 추가: 예) 수학 문제풀이"
                style={{ flex: 1, padding: '10px 12px', background: C.raised, border: `1px solid ${C.border2}`, borderRadius: 8, color: C.white, fontFamily: "'Pretendard', system-ui, sans-serif", fontSize: 12, outline: 'none' }}
              />
              <button onClick={addCategory} style={{ padding: '0 14px', borderRadius: 8, border: 'none', background: C.chip, color: C.mint, cursor: 'pointer', fontFamily: "'Pretendard', system-ui, sans-serif", fontSize: 12 }}>추가</button>
            </div>
            <input value={note} onChange={e => setNote(e.target.value)}
              placeholder="노트북/휴대폰 없이 하는 일을 적어두기"
              style={{ width: '100%', marginTop: 10, padding: '10px 12px', background: C.raised, border: `1px solid ${C.border2}`, borderRadius: 8, color: C.white, fontFamily: "'Pretendard', system-ui, sans-serif", fontSize: 12, outline: 'none' }}
            />
          </div>
        )}

        <button onClick={toggleTimer} disabled={saving} style={{
          padding: '13px 48px', borderRadius: 50, border: 'none', cursor: 'pointer',
          background: running ? 'transparent' : C.mint,
          color: running ? C.white : C.ink,
          outline: running ? `1px solid ${C.border2}` : 'none',
          fontFamily: "'Pretendard', system-ui, sans-serif",
          fontSize: 13, fontWeight: 700, letterSpacing: '0.06em',
          transition: 'all 120ms',
        }}>
          {saving ? '저장 중...' : running ? '중지하고 저장' : '공부 시작'}
        </button>
      </div>

      {/* Daily goal bar */}
      <div style={{ background: C.raised, borderRadius: 14, padding: '16px 20px', border: `1px solid ${C.border}`, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 11, color: C.alt }}>오늘 목표</span>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: totalMins >= goalMins ? C.mint : C.muted }}>
            {Math.floor(totalMins / 60)}시간 {totalMins % 60}분 / 4시간 00분
          </span>
        </div>
        <div style={{ height: 4, background: C.border, borderRadius: 2 }}>
          <div style={{ width: `${Math.min((totalMins / goalMins) * 100, 100)}%`, height: '100%', background: totalMins >= goalMins ? C.mintBright : C.mint, borderRadius: 2, transition: 'width 0.5s' }} />
        </div>
      </div>

      {/* Sessions */}
      <div style={{ fontSize: 10, color: '#4a4a4a', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.08em', marginBottom: 12 }}>오늘 공부 기록</div>
      {sessions.map((s, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px', background: C.raised, borderRadius: 12,
          border: `1px solid ${C.border}`, marginBottom: 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 3, height: 40, borderRadius: 2, background: s.category === '개발' || s.category === 'Development' ? C.mint : C.mintMuted, marginRight: 10, alignSelf: 'center' }} />
            <div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: C.alt, marginBottom: 3 }}>{toClock(s.started_at)} - {toClock(s.ended_at)}</div>
              <div style={{ fontSize: 13, color: C.muted }}>{s.category.replace('Development', '개발').replace('Coding Test', '코딩 테스트')}</div>
              {s.note && <div style={{ fontSize: 11, color: C.alt, marginTop: 3 }}>{s.note}</div>}
            </div>
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 16, color: C.mint, fontWeight: 600 }}>{fmtMinutes(s.duration_minutes)}</div>
        </div>
      ))}
    </div>
  )
}

/* ═══════════════════════════════════════════════
   DEVICES
═══════════════════════════════════════════════ */
function DevicesPage() {
  const [qr, setQr] = useState(false)
  const [devices, setDevices] = useState<DeviceData[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    api.devices().then(setDevices).catch((err) => setError(err.message))
  }, [])

  const illustration = (kind: string) => {
    if (kind === 'phone') return () => <IlluPhone />
    if (kind === 'watch') return () => <IlluWatch />
    if (kind === 'github') return () => <IlluGit />
    return () => <IlluLaptop />
  }
  const connected = devices.map((device) => ({
    name: device.name,
    sub: device.platform,
    sync: shortTime(device.last_sync),
    Illu: illustration(device.kind),
  }))

  return (
    <div style={{ padding: '32px 36px' }}>
      <div style={{ fontSize: 32, fontWeight: 900, color: C.white, letterSpacing: '-0.02em', marginBottom: 28 }}>연결된 기기</div>
      {error && <div style={{ color: C.mintMuted, fontSize: 12, marginBottom: 16 }}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14, marginBottom: 32 }}>
        {connected.map((d) => (
          <div key={d.name} style={{ background: C.raised, borderRadius: 14, padding: '22px', border: `1px solid ${C.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
              <d.Illu />
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(0,232,197,0.07)', padding: '4px 8px', borderRadius: 6 }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: C.mint }} />
                <span style={{ fontSize: 9, color: C.mint, fontFamily: "'JetBrains Mono', monospace" }}>실시간</span>
              </div>
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.white, marginBottom: 2 }}>{d.name}</div>
            <div style={{ fontSize: 11, color: C.alt, marginBottom: 12 }}>{d.sub}</div>
            <div style={{ fontSize: 10, color: '#333', fontFamily: "'JetBrains Mono', monospace", marginBottom: 16 }}>동기화 {d.sync}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={{ flex: 1, padding: '7px', borderRadius: 7, border: `1px solid ${C.border2}`, background: 'transparent', color: C.alt, fontSize: 11, cursor: 'pointer', fontFamily: "'Pretendard', system-ui, sans-serif" }}>설정</button>
              <button style={{ flex: 1, padding: '7px', borderRadius: 7, border: `1px solid ${C.border2}`, background: 'transparent', color: '#3a3a3a', fontSize: 11, cursor: 'pointer', fontFamily: "'Pretendard', system-ui, sans-serif" }}>연결 해제</button>
            </div>
          </div>
        ))}
      </div>

      <div style={{ background: C.raised, borderRadius: 14, padding: '22px', border: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 10, color: '#4a4a4a', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.08em', marginBottom: 18 }}>추가 연결</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
          {[
            { label: '트래커 설치', sub: 'macOS / Windows', Illu: () => <IlluLaptop dim /> },
            { label: 'Android 앱',     sub: '연동 앱',   Illu: () => <IlluPhone  dim />, action: () => setQr(true) },
            { label: 'Health Connect',  sub: 'Wear OS',         Illu: () => <IlluWatch  dim /> },
            { label: 'GitHub',          sub: 'OAuth 연결',   Illu: () => <IlluGit    dim /> },
          ].map((item) => (
            <button key={item.label} onClick={item.action} style={{
              padding: '16px', background: C.surface, borderRadius: 12,
              border: `1px dashed ${C.border2}`, cursor: 'pointer', textAlign: 'left',
              transition: 'border-color 120ms',
            }}>
              <div style={{ marginBottom: 10 }}><item.Illu /></div>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 2, fontFamily: "'Pretendard', system-ui, sans-serif" }}>{item.label}</div>
              <div style={{ fontSize: 10, color: '#3a3a3a', fontFamily: "'Pretendard', system-ui, sans-serif" }}>{item.sub}</div>
            </button>
          ))}
        </div>
      </div>

      {qr && (
        <div onClick={() => setQr(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: C.raised, borderRadius: 20, padding: '36px', border: `1px solid ${C.border2}`, textAlign: 'center', maxWidth: 320 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.white, marginBottom: 6 }}>휴대폰 연결</div>
            <div style={{ fontSize: 11, color: C.alt, marginBottom: 24, lineHeight: 1.9 }}>
              1. 100 DAYS 모바일 앱을 여세요<br />
              2. 이 QR 코드를 스캔하세요<br />
              3. 필요한 권한을 허용하세요
            </div>
            <div style={{ background: C.white, borderRadius: 12, padding: 16, display: 'inline-block', marginBottom: 20 }}>
              <QRCode />
            </div>
            <div style={{ fontSize: 10, color: C.alt, fontFamily: "'JetBrains Mono', monospace", marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <PulsingDot />&nbsp;기기 연결 대기 중...
            </div>
            <button onClick={() => setQr(false)} style={{ padding: '9px 24px', borderRadius: 8, border: `1px solid ${C.border2}`, background: 'transparent', color: C.alt, fontFamily: "'Pretendard', system-ui, sans-serif", fontSize: 12, cursor: 'pointer' }}>취소</button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════
   DAILY CHECK-IN
═══════════════════════════════════════════════ */
function CheckinPage({ setPage, currentDay }: { setPage: (p: Page) => void; currentDay: number }) {
  const [focus, setFocus] = useState(0)
  const [sat, setSat] = useState(0)
  const [note, setNote] = useState('')
  const [done, setDone] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.checkin(currentDay)
      .then((checkin) => {
        if (!checkin) return
        setFocus(checkin.focus_score)
        setSat(checkin.satisfaction_score)
        setNote(checkin.note)
        setDone(true)
      })
      .catch((err) => setError(err.message))
  }, [currentDay])

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      await api.saveCheckin({
        day_number: currentDay,
        focus_score: focus,
        satisfaction_score: sat,
        note,
      })
      setDone(true)
      setTimeout(() => setPage('dashboard'), 900)
    } catch (err) {
      setError(err instanceof Error ? err.message : '체크인 저장 실패')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ padding: '40px 36px', maxWidth: 500 }}>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: C.alt, letterSpacing: '0.15em', marginBottom: 6 }}>오늘 체크인</div>
      <div style={{ fontSize: 28, fontWeight: 900, color: C.white, marginBottom: 4, letterSpacing: '-0.02em' }}>{currentDay}일차</div>
      <div style={{ fontSize: 11, color: C.alt, marginBottom: 40 }}>30초 안에 끝납니다.</div>
      {error && <div style={{ color: C.mintMuted, fontSize: 12, marginBottom: 18 }}>{error}</div>}

      <ScoreInput label="오늘 얼마나 집중했나요?" value={focus} set={setFocus} color={C.mint} />
      <ScoreInput label="오늘 만족도는 어떤가요?" value={sat} set={setSat} color={C.mintMuted} />

      <div style={{ marginBottom: 36 }}>
        <div style={{ fontSize: 13, color: C.muted, marginBottom: 10 }}>오늘을 한 줄로 남기기</div>
        <input value={note} onChange={e => setNote(e.target.value)}
          placeholder="오늘 하루를 한 문장으로..."
          style={{
            width: '100%', padding: '13px 15px', background: C.raised,
            border: `1px solid ${C.border2}`, borderRadius: 10, color: C.white,
            fontFamily: "'Pretendard', system-ui, sans-serif", fontSize: 14,
            outline: 'none', transition: 'border-color 120ms',
          }}
        />
      </div>

      <button onClick={save} disabled={focus === 0 || sat === 0 || saving} style={{
        width: '100%', padding: '15px', borderRadius: 50, border: 'none', cursor: focus && sat && !saving ? 'pointer' : 'not-allowed',
        background: done ? C.mintMuted : focus && sat ? C.mint : '#1e1e1e',
        color: done || (focus && sat) ? C.ink : C.alt,
        fontFamily: "'Pretendard', system-ui, sans-serif",
        fontSize: 13, fontWeight: 700, letterSpacing: '0.05em',
        transition: 'all 200ms',
      }}>
        {saving ? '저장 중...' : done ? '✓  저장됨' : '오늘 저장'}
      </button>
    </div>
  )
}

function ScoreInput({ label, value, set, color }: { label: string; value: number; set: (n: number) => void; color: string }) {
  return (
    <div style={{ marginBottom: 30 }}>
      <div style={{ fontSize: 13, color: C.muted, marginBottom: 14 }}>{label}</div>
      <div style={{ display: 'flex', gap: 6 }}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
          <button key={n} onClick={() => set(n)} style={{
            flex: 1, padding: '10px 0', borderRadius: 7, border: 'none', cursor: 'pointer',
            background: n <= value ? color : C.raised,
            color: n <= value ? C.ink : '#3a3a3a',
            fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: n <= value ? 700 : 400,
            transition: 'all 100ms',
          }}>
            {n}
          </button>
        ))}
      </div>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: value ? color : '#2a2a2a', marginTop: 7 }}>
        {value ? `${value} / 10` : '선택하세요'}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════
   RESULT PAGE
═══════════════════════════════════════════════ */
function ResultPage() {
  const [data, setData] = useState<ResultData | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.result().then(setData).catch((err) => setError(err.message))
  }, [])

  /* spark summary bars for result */
  const summaryData = [3,4,4,5,5,4,6,5,6,7,6,7,8,7,8,8,9,8,9,9,9,10,9,10,10,10,9,10,10,10,10,10,9,10,10,10,10]

  if (error) return <ErrorBlock message={error} />
  if (!data) return <LoadingBlock />

  const totalHours = Math.round((data.totals.pc_minutes + data.totals.phone_minutes + data.totals.focus_minutes + data.totals.sleep_minutes + data.totals.exercise_minutes) / 60)
  const bigStats = [
    { label: '수면', val: `${Math.round(data.totals.sleep_minutes / 60)}시간`, color: C.mintMuted },
    { label: 'PC', val: `${Math.round(data.totals.pc_minutes / 60)}시간`, color: C.mint },
    { label: '휴대폰', val: `${Math.round(data.totals.phone_minutes / 60)}시간`, color: C.faint },
    { label: '집중', val: `${Math.round(data.totals.focus_minutes / 60)}시간`, color: C.mintBright },
    { label: '개발', val: `${Math.round(data.totals.development_minutes / 60)}시간`, color: C.mint },
    { label: '운동', val: `${Math.round(data.totals.exercise_minutes / 60)}시간`, color: C.mintMuted },
  ]
  const pct = (first: number, last: number, invert = false) => {
    const delta = first ? Math.round(((last - first) / first) * 100) : 0
    const good = invert ? delta <= 0 : delta >= 0
    return { delta: `${delta >= 0 ? '↑' : '↓'} ${Math.abs(delta)}%`, good }
  }
  const phone = pct(data.first.phone_minutes, data.last.phone_minutes, true)
  const focus = pct(data.first.focus_minutes, data.last.focus_minutes)
  const dev = pct(data.first.development_minutes, data.last.development_minutes)
  const sleep = pct(data.first.sleep_minutes, data.last.sleep_minutes)
  const compare = [
    { label: '휴대폰 사용량', d1: fmtMinutes(data.first.phone_minutes), d100: fmtMinutes(data.last.phone_minutes), ...phone },
    { label: '집중 시간', d1: fmtMinutes(data.first.focus_minutes), d100: fmtMinutes(data.last.focus_minutes), ...focus },
    { label: '개발 시간', d1: fmtMinutes(data.first.development_minutes), d100: fmtMinutes(data.last.development_minutes), ...dev },
    { label: '수면', d1: fmtMinutes(data.first.sleep_minutes), d100: fmtMinutes(data.last.sleep_minutes), ...sleep },
  ]

  return (
    <div style={{ padding: '48px 40px' }}>
      {/* Hero */}
      <div style={{ textAlign: 'center', marginBottom: 64 }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: C.alt, letterSpacing: '0.3em', marginBottom: 16 }}>100 DAYS</div>
        <div style={{ fontSize: 88, fontWeight: 900, color: C.white, letterSpacing: '-0.04em', lineHeight: 0.9, marginBottom: 16 }}>완료</div>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 16, color: C.mint, marginBottom: 48 }}>100 / 100</div>

        <div style={{ fontSize: 60, fontWeight: 900, color: C.white, letterSpacing: '-0.03em', lineHeight: 1 }}>{totalHours.toLocaleString()}</div>
        <div style={{ fontSize: 14, fontWeight: 900, color: C.white, letterSpacing: '0.1em', marginBottom: 4 }}>시간</div>
        <div style={{ fontSize: 11, color: C.alt }}>삶의 100일을 기록했습니다</div>

        {/* mini trend */}
        <div style={{ maxWidth: 500, margin: '28px auto 0', opacity: 0.6 }}>
          <AreaChart data={summaryData} maxVal={10} color={C.mint} h={40} />
        </div>
        <div style={{ fontSize: 10, color: '#333', fontFamily: "'JetBrains Mono', monospace", marginTop: 4 }}>집중 점수 — 1일차 → 100일차</div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 12 }}>
        {bigStats.map(s => (
          <div key={s.label} style={{ background: C.raised, borderRadius: 14, padding: '22px', border: `1px solid ${C.border}`, textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: '#4a4a4a', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.08em', marginBottom: 6 }}>{s.label.toUpperCase()}</div>
            <div style={{ fontSize: 36, fontWeight: 900, color: s.color, letterSpacing: '-0.03em' }}>{s.val}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 40 }}>
        <div style={{ background: C.raised, borderRadius: 14, padding: '20px 24px', border: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: C.alt }}>총 걸음 수</span>
          <span style={{ fontSize: 28, fontWeight: 900, color: C.white, letterSpacing: '-0.02em' }}>{data.totals.steps.toLocaleString()}</span>
        </div>
        <div style={{ background: C.raised, borderRadius: 14, padding: '20px 24px', border: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: C.alt }}>GitHub 커밋</span>
          <span style={{ fontSize: 28, fontWeight: 900, color: C.mint, letterSpacing: '-0.02em' }}>{data.totals.github_commits.toLocaleString()}</span>
        </div>
      </div>

      {/* DAY 1 vs 100 */}
      <div style={{ background: C.raised, borderRadius: 14, padding: '28px', border: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 10, color: '#4a4a4a', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.08em', marginBottom: 22 }}>1일차 → 100일차</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
          {compare.map(c => (
            <div key={c.label} style={{ background: C.surface, borderRadius: 12, padding: '18px' }}>
              <div style={{ fontSize: 11, color: C.alt, marginBottom: 14 }}>{c.label}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: '#3a3a3a', marginBottom: 3 }}>1일차</div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: '#444' }}>{c.d1}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: '#3a3a3a', marginBottom: 3 }}>100일차</div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: C.white }}>{c.d100}</div>
                </div>
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color: c.good ? C.mint : C.faint, letterSpacing: '-0.01em' }}>{c.delta}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════
   SVG CHARTS
═══════════════════════════════════════════════ */
function Sparkline({ data, color, max }: { data: number[]; color: string; max: number }) {
  const W = 120, H = 28
  const denom = Math.max(1, data.length - 1)
  const pts = data.map((v, i) => `${(i / denom) * W},${H - (v / max) * H}`).join(' ')
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block', height: 28 }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
      {/* last dot */}
      {(() => {
        const lx = W, ly = H - (data[data.length - 1] / max) * H
        return <circle cx={lx} cy={ly} r="2" fill={color} />
      })()}
    </svg>
  )
}

function AreaChart({ data, maxVal, color, h }: { data: number[]; maxVal: number; color: string; h: number }) {
  const W = 300
  const denom = Math.max(1, data.length - 1)
  const pts = data.map((v, i) => `${(i / denom) * W},${h - (v / maxVal) * h}`)
  const line = pts.join(' ')
  const area = `0,${h} ${line} ${W},${h}`
  const id = `ag${color.replace('#', '')}`
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${h}`} preserveAspectRatio="none" style={{ display: 'block', height: h }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#${id})`} />
      <polyline points={line} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function DualLineChart({ a, b, maxVal, colorA, colorB, h }: { a: number[]; b: number[]; maxVal: number; colorA: string; colorB: string; h: number }) {
  const W = 300
  const pts = (arr: number[]) => {
    const denom = Math.max(1, arr.length - 1)
    return arr.map((v, i) => `${(i / denom) * W},${h - (v / maxVal) * h}`).join(' ')
  }
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${h}`} preserveAspectRatio="none" style={{ display: 'block', height: h }}>
      <polyline points={pts(a)} fill="none" stroke={colorA} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points={pts(b)} fill="none" stroke={colorB} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function BarChartSVG({ data, maxVal, color, accent, h }: { data: number[]; maxVal: number; color: string; accent?: string; h: number }) {
  const W = 300
  const gap = 3
  const bw = (W - gap * (data.length - 1)) / data.length
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${h}`} preserveAspectRatio="none" style={{ display: 'block', height: h }}>
      {data.map((v, i) => {
        const bh = Math.max(2, (v / maxVal) * h)
        const isMax = v === Math.max(...data)
        return (
          <rect key={i}
            x={i * (bw + gap)} y={h - bh}
            width={bw} height={bh} rx="2"
            fill={isMax && accent ? accent : color}
          />
        )
      })}
    </svg>
  )
}

function ProgressRing({ pct, size, stroke, color, trackColor, label }: { pct: number; size: number; stroke: number; color: string; trackColor: string; label: string }) {
  const r = (size - stroke * 2) / 2
  const circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={trackColor} strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
      <text x={size / 2} y={size / 2 + 4} textAnchor="middle" fill={color}
        fontSize="10" fontFamily="JetBrains Mono, monospace" fontWeight="600"
        style={{ transform: `rotate(90deg) translate(0, -${size}px)` }}>{label}</text>
    </svg>
  )
}

function DeviceRing({ pcts }: { pcts: number[] }) {
  const size = 100, stroke = 12, r = (size - stroke * 2) / 2
  const circ = 2 * Math.PI * r
  const colors = [C.mint, C.mintMuted, '#2a2a2a']
  let offset = 0
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.border} strokeWidth={stroke} />
      {pcts.map((p, i) => {
        const dash = p * circ
        const gap = circ - dash
        const seg = (
          <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none"
            stroke={colors[i]} strokeWidth={stroke}
            strokeDasharray={`${dash} ${gap}`}
            strokeDashoffset={-offset}
            strokeLinecap="butt"
          />
        )
        offset += dash + (i < pcts.length - 1 ? 3 : 0)
        return seg
      })}
    </svg>
  )
}

function FocusRing({ pct, running }: { pct: number; running: boolean }) {
  const size = 220, stroke = 4, r = (size - stroke * 2) / 2
  const circ = 2 * Math.PI * r
  const dash = pct * circ
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.border} strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={running ? C.mint : C.border2}
        strokeWidth={stroke}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.8s, stroke 0.3s' }}
      />
    </svg>
  )
}

/* ═══════════════════════════════════════════════
   DEVICE ILLUSTRATIONS (SVG)
═══════════════════════════════════════════════ */
function IlluLaptop({ dim }: { dim?: boolean }) {
  const c = dim ? '#333' : C.mint
  return (
    <svg width="40" height="32" viewBox="0 0 40 32" fill="none">
      <rect x="6" y="4" width="28" height="18" rx="2" stroke={c} strokeWidth="1.2" />
      <rect x="9" y="7" width="22" height="12" rx="1" fill={dim ? '#1a1a1a' : 'rgba(0,232,197,0.08)'} />
      <line x1="12" y1="10" x2="20" y2="10" stroke={c} strokeWidth="0.8" strokeLinecap="round" opacity="0.4" />
      <line x1="12" y1="13" x2="18" y2="13" stroke={c} strokeWidth="0.8" strokeLinecap="round" opacity="0.4" />
      <path d="M2 22h36l-3 4H5l-3-4z" stroke={c} strokeWidth="1.2" fill="none" />
      <line x1="14" y1="22" x2="26" y2="22" stroke={c} strokeWidth="1" opacity="0.3" />
    </svg>
  )
}

function IlluPhone({ dim }: { dim?: boolean }) {
  const c = dim ? '#333' : C.mintMuted
  return (
    <svg width="28" height="42" viewBox="0 0 28 42" fill="none">
      <rect x="2" y="2" width="24" height="38" rx="4" stroke={c} strokeWidth="1.2" />
      <rect x="5" y="7" width="18" height="24" rx="1" fill={dim ? '#1a1a1a' : 'rgba(123,227,211,0.08)'} />
      <circle cx="14" cy="35" r="2.5" stroke={c} strokeWidth="1" />
      <line x1="10" y1="4" x2="18" y2="4" stroke={c} strokeWidth="1.4" strokeLinecap="round" opacity="0.4" />
      <line x1="8" y1="14" x2="20" y2="14" stroke={c} strokeWidth="0.7" strokeLinecap="round" opacity="0.3" />
      <line x1="8" y1="17" x2="16" y2="17" stroke={c} strokeWidth="0.7" strokeLinecap="round" opacity="0.3" />
    </svg>
  )
}

function IlluWatch({ dim }: { dim?: boolean }) {
  const c = dim ? '#333' : C.mint
  return (
    <svg width="34" height="44" viewBox="0 0 34 44" fill="none">
      <rect x="6" y="11" width="22" height="22" rx="6" stroke={c} strokeWidth="1.2" />
      <rect x="10" y="15" width="14" height="14" rx="2" fill={dim ? '#1a1a1a' : 'rgba(0,232,197,0.06)'} />
      <path d="M11 8 Q17 4 23 8" stroke={c} strokeWidth="1.2" fill="none" />
      <path d="M11 36 Q17 40 23 36" stroke={c} strokeWidth="1.2" fill="none" />
      <line x1="17" y1="18" x2="17" y2="22" stroke={c} strokeWidth="1" strokeLinecap="round" opacity="0.7" />
      <line x1="17" y1="22" x2="20" y2="24" stroke={c} strokeWidth="1" strokeLinecap="round" opacity="0.7" />
      <circle cx="17" cy="22" r="1.2" fill={c} opacity="0.8" />
      <rect x="29" y="16" width="3" height="8" rx="1.5" fill={c} opacity="0.3" />
    </svg>
  )
}

function IlluGit({ dim }: { dim?: boolean }) {
  const c = dim ? '#333' : C.mint
  return (
    <svg width="40" height="36" viewBox="0 0 40 36" fill="none">
      <circle cx="10" cy="10" r="4" stroke={c} strokeWidth="1.2" />
      <circle cx="30" cy="10" r="4" stroke={c} strokeWidth="1.2" />
      <circle cx="10" cy="26" r="4" stroke={c} strokeWidth="1.2" fill={dim ? '#1a1a1a' : 'rgba(0,232,197,0.1)'} />
      <path d="M14 10 Q20 10 20 16 Q20 22 26 22" stroke={c} strokeWidth="1.2" fill="none" />
      <line x1="10" y1="14" x2="10" y2="22" stroke={c} strokeWidth="1.2" />
      <circle cx="20" cy="16" r="2" fill={c} opacity="0.5" />
    </svg>
  )
}

function AppIconMini({ name }: { name: string }) {
  const configs: Record<string, { bg: string; letter: string; color: string }> = {
    'VS Code':   { bg: 'rgba(0,232,197,0.12)', letter: 'V', color: C.mint },
    'YouTube':   { bg: '#1e1e1e', letter: 'Y', color: '#666' },
    'Chrome':    { bg: '#1e1e1e', letter: 'C', color: '#666' },
    'Instagram': { bg: '#1e1e1e', letter: 'I', color: '#666' },
    'Discord':   { bg: '#1e1e1e', letter: 'D', color: '#666' },
  }
  const cfg = configs[name] ?? { bg: '#1e1e1e', letter: name[0], color: '#666' }
  return (
    <div style={{ width: 20, height: 20, borderRadius: 5, background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: cfg.color }}>{cfg.letter}</span>
    </div>
  )
}

function LogoMark() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="8" fill={C.mint} />
      <rect x="8" y="20" width="3" height="6" rx="1" fill={C.ink} />
      <rect x="13" y="14" width="3" height="12" rx="1" fill={C.ink} />
      <rect x="18" y="9" width="3" height="17" rx="1" fill={C.ink} />
      <rect x="23" y="6" width="3" height="20" rx="1" fill={C.ink} />
    </svg>
  )
}

function QRCode() {
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="#171b21">
      {/* corners */}
      <rect x="8" y="8" width="28" height="28" rx="3" />
      <rect x="12" y="12" width="20" height="20" rx="2" fill="white" />
      <rect x="16" y="16" width="12" height="12" rx="1" />

      <rect x="84" y="8" width="28" height="28" rx="3" />
      <rect x="88" y="12" width="20" height="20" rx="2" fill="white" />
      <rect x="92" y="16" width="12" height="12" rx="1" />

      <rect x="8" y="84" width="28" height="28" rx="3" />
      <rect x="12" y="88" width="20" height="20" rx="2" fill="white" />
      <rect x="16" y="92" width="12" height="12" rx="1" />

      {/* data dots */}
      {[
        [42,8],[48,8],[54,8],[42,14],[54,14],[42,20],[48,20],
        [42,42],[48,42],[60,42],[72,42],[78,42],
        [42,48],[60,48],[78,48],
        [42,54],[48,54],[54,54],[66,54],[72,54],[78,54],
        [42,60],[60,60],[66,60],
        [42,66],[48,66],[60,66],[72,66],[78,66],
        [60,8],[66,8],[72,8],[78,8],
        [60,14],[72,14],
        [60,20],[66,20],[78,20],
        [84,42],[90,42],[96,42],[102,42],[108,42],
        [84,48],[96,48],[108,48],
        [84,54],[90,54],[102,54],
        [84,60],[96,60],[102,60],[108,60],
        [84,66],[90,66],[96,66],
        [8,42],[14,42],[20,42],[26,42],[32,42],
        [8,48],[20,48],[32,48],
        [8,54],[14,54],[20,54],[26,54],
        [8,60],[20,60],[32,60],
        [8,66],[14,66],[26,66],[32,66],
        [42,84],[48,84],[60,84],[66,84],[78,84],
        [54,90],[66,90],[78,90],
        [42,96],[48,96],[60,96],[72,96],
        [42,102],[54,102],[66,102],[72,102],[78,102],
        [42,108],[48,108],[54,108],[66,108],[78,108],
      ].map(([x, y], i) => <rect key={i} x={x} y={y} width="5" height="5" rx="1" />)}
    </svg>
  )
}

function PulsingDot() {
  return (
    <span style={{ position: 'relative', display: 'inline-flex', width: 8, height: 8 }}>
      <span style={{
        position: 'absolute', inset: 0, borderRadius: '50%',
        background: C.mint, opacity: 0.4,
        animation: 'ping 1.4s cubic-bezier(0,0,0.2,1) infinite',
      }} />
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.mint, display: 'block' }} />
      <style>{`@keyframes ping{75%,100%{transform:scale(2);opacity:0}}`}</style>
    </span>
  )
}

/* ═══════════════════════════════════════════════
   ICONS (16 × 16)
═══════════════════════════════════════════════ */
function IcoGrid({ c }: { c: string }) {
  return <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><rect x="1" y="1" width="5.5" height="5.5" rx="1.5" fill={c}/><rect x="8.5" y="1" width="5.5" height="5.5" rx="1.5" fill={c}/><rect x="1" y="8.5" width="5.5" height="5.5" rx="1.5" fill={c}/><rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1.5" fill={c}/></svg>
}
function IcoCalendar({ c }: { c: string }) {
  return <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><rect x="1.5" y="3" width="12" height="10.5" rx="1.5" stroke={c} strokeWidth="1.1"/><path d="M5 1.5v3M10 1.5v3M1.5 7h12" stroke={c} strokeWidth="1.1" strokeLinecap="round"/></svg>
}
function IcoChart({ c }: { c: string }) {
  return <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M1.5 11.5L5 8l3 2 4.5-5" stroke={c} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/><path d="M1.5 13.5h12" stroke={c} strokeWidth="1.1" strokeLinecap="round"/></svg>
}
function IcoTimer({ c }: { c: string }) {
  return <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><circle cx="7.5" cy="9" r="5" stroke={c} strokeWidth="1.1"/><path d="M7.5 6.5V9.2" stroke={c} strokeWidth="1.3" strokeLinecap="round"/><path d="M5.5 1.5h4" stroke={c} strokeWidth="1.1" strokeLinecap="round"/><path d="M7.5 1.5V3" stroke={c} strokeWidth="1.1" strokeLinecap="round"/></svg>
}
function IcoDevice({ c }: { c: string }) {
  return <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><rect x="1.5" y="2.5" width="8" height="10" rx="1.5" stroke={c} strokeWidth="1.1"/><path d="M11 4.5h1a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-1" stroke={c} strokeWidth="1.1"/></svg>
}
function IcoCheck({ c }: { c: string }) {
  return <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M2.5 7.5L6 11l6.5-7" stroke={c} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
}
function IcoTrophy({ c }: { c: string }) {
  return <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M4.5 1.5h6v6a3 3 0 0 1-6 0V1.5z" stroke={c} strokeWidth="1.1"/><path d="M4.5 4.5H3a1.5 1.5 0 1 0 0 3h1.5M10.5 4.5H12a1.5 1.5 0 1 1 0 3h-1.5" stroke={c} strokeWidth="1.1"/><path d="M7.5 10.5v2M5 12.5h5" stroke={c} strokeWidth="1.1" strokeLinecap="round"/></svg>
}
function IcoMenu({ c }: { c: string }) {
  return <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M2.5 4.5h13M2.5 9h13M2.5 13.5h13" stroke={c} strokeWidth="1.3" strokeLinecap="round"/></svg>
}



