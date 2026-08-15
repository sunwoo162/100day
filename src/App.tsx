import { useState, useEffect, useRef } from 'react'
import { api, type AnalyticsData, type AppClassification, type AuthUser, type ChallengeData, type DashboardData, type DeviceData, type DevicePairingData, type FocusSession, type ResultData, type StudyCategory, type TimelineEntry } from './lib/api'

type Page = 'dashboard' | 'timeline' | 'analytics' | 'focus' | 'devices' | 'result'

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

const PAGE_PATH: Record<Page, string> = {
  dashboard: '/main',
  timeline: '/timeline',
  analytics: '/analytics',
  focus: '/study',
  devices: '/devices',
  result: '/result',
}

const PATH_PAGE: Record<string, Page> = {
  '/': 'dashboard',
  '/main': 'dashboard',
  '/dashboard': 'dashboard',
  '/timeline': 'timeline',
  '/analytics': 'analytics',
  '/study': 'focus',
  '/focus': 'focus',
  '/devices': 'devices',
  '/result': 'result',
}

function appPathname() {
  const base = import.meta.env.BASE_URL || '/'
  const pathname = window.location.pathname
  const withoutBase = base !== '/' && pathname.startsWith(base)
    ? pathname.slice(base.length - 1)
    : pathname
  const normalized = withoutBase.replace(/\/+$/, '') || '/'
  return PATH_PAGE[normalized] ? normalized : '/'
}

function pageFromLocation(): Page {
  return PATH_PAGE[appPathname()] || 'dashboard'
}

function urlForPage(page: Page) {
  const base = import.meta.env.BASE_URL || '/'
  const path = PAGE_PATH[page]
  if (base === '/') return path
  return `${base.replace(/\/$/, '')}${path}`
}

function fmtMinutes(min: number) {
  const totalSeconds = Math.round((Number(min) || 0) * 60)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  if (h <= 0 && m <= 0) return `${s}초`
  if (h <= 0) return `${m}분 ${String(s).padStart(2, '0')}초`
  return `${h}시간 ${String(m).padStart(2, '0')}분 ${String(s).padStart(2, '0')}초`
}

function fmtDelta(delta: number, unit = '분') {
  if (delta === 0) return '어제와 같음'
  if (unit === '분') return `어제보다 ${delta > 0 ? '+' : '-'}${fmtMinutes(Math.abs(delta))}`
  return `어제보다 ${delta > 0 ? '+' : '-'}${Math.abs(delta).toLocaleString()}${unit}`
}

function parseGoalMinutes(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return 0
  const [hoursRaw, minutesRaw] = trimmed.split(':')
  if (minutesRaw !== undefined) {
    const hours = Number(hoursRaw)
    const minutes = Number(minutesRaw)
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 0
    return Math.max(0, Math.min(1440, Math.round(hours * 60 + minutes)))
  }
  const numeric = Number(trimmed)
  if (!Number.isFinite(numeric)) return 0
  return Math.max(0, Math.min(1440, Math.round(numeric * 60)))
}

function goalMinutesToInput(minutes: number) {
  const safe = Math.max(1, Math.min(1440, Math.round(minutes || 240)))
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`
}

function formatChartDateLabel(dateText: string) {
  const date = new Date(`${dateText}T00:00:00`)
  if (Number.isNaN(date.getTime())) return dateText.slice(5).replace('-', '/')
  return `${date.getMonth() + 1}/${date.getDate()}`
}

function formatChartTickMinutes(minutes: number) {
  if (minutes >= 60) {
    const hours = minutes / 60
    return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`
  }
  return `${Math.round(minutes)}m`
}

function parseHourValue(display: string) {
  const hours = display.match(/(\d+)h/)?.[1] ?? '0'
  const mins = display.match(/(\d+)m/)?.[1] ?? '0'
  const secs = display.match(/(\d+)s/)?.[1] ?? '0'
  return `${Number(hours)}시간 ${String(Number(mins)).padStart(2, '0')}분 ${String(Number(secs)).padStart(2, '0')}초`
}

function browserUsageName() {
  return '하루핏 웹'
}

function isDesktopShell() {
  const hasDesktopFlag = window.location.search.includes('desktop=1')
  if (hasDesktopFlag) {
    window.localStorage.setItem('harufit.desktopShell', '1')
  }
  return /\bElectron\//.test(navigator.userAgent) || hasDesktopFlag || window.localStorage.getItem('harufit.desktopShell') === '1'
}

function apiBaseUrl() {
  const configured = import.meta.env.VITE_API_BASE_URL || '/api'
  if (/^https?:\/\//.test(configured)) return configured.replace(/\/$/, '')
  return `${window.location.origin}${configured.startsWith('/') ? configured : `/${configured}`}`.replace(/\/$/, '')
}

function downloadBaseUrl() {
  return apiBaseUrl().replace(/\/api$/, '')
}

function windowsTrackerCommand(pairingToken: string) {
  const downloadUrl = `${downloadBaseUrl()}/downloads/windows-pc-tracker.ps1`
  const apiUrl = apiBaseUrl()
  return `powershell -NoProfile -ExecutionPolicy Bypass -Command "$u='${downloadUrl}'; $p=Join-Path $env:TEMP 'harufit-tracker.ps1'; Invoke-WebRequest -UseBasicParsing $u -OutFile $p; powershell -NoProfile -ExecutionPolicy Bypass -File $p -ApiBase '${apiUrl}' -PairingToken '${pairingToken}' -InstallStartup"`
}

function windowsInstallerUrl() {
  return `${downloadBaseUrl()}/downloads/harufit-windows`
}

function desktopOpenUrl() {
  return 'harufit://open'
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

function LoginPage() {
  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams()
  const authFailed = searchParams.get('auth') === 'failed'
  const login = (provider: 'github' | 'google') => {
    window.location.href = `/api/auth/${provider}`
  }

  return (
    <div style={{ minHeight: '100vh', background: C.canvas, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Pretendard', system-ui, sans-serif", padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 420, background: C.raised, border: `1px solid ${C.border}`, borderRadius: 16, padding: 34, boxShadow: '0 24px 80px rgba(0,0,0,0.28)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 30 }}>
          <LogoMark />
          <div>
            <div style={{ fontSize: 26, fontWeight: 900, color: C.white, letterSpacing: '-0.02em', lineHeight: 1 }}>하루핏</div>
          </div>
        </div>
        <button onClick={() => login('github')} style={{ width: '100%', padding: '13px 16px', borderRadius: 10, border: '1px solid #30363d', background: '#24292f', color: C.white, cursor: 'pointer', fontSize: 13, fontWeight: 800, marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <IcoGitHubBrand />
          <span>GitHub로 계속하기</span>
        </button>
        <button onClick={() => login('google')} style={{ width: '100%', padding: '13px 16px', borderRadius: 10, border: '1px solid #dadce0', background: '#ffffff', color: '#202124', cursor: 'pointer', fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <IcoGoogleBrand />
          <span>Google로 계속하기</span>
        </button>
        {authFailed && (
          <div style={{ marginTop: 14, padding: '10px 12px', borderRadius: 8, border: `1px solid ${C.border2}`, background: '#141414', color: C.mintMuted, fontSize: 12, lineHeight: 1.5, textAlign: 'center' }}>
            로그인에 실패했습니다.
          </div>
        )}
      </div>
    </div>
  )
}

function PublicDownloadPage() {
  const login = (provider: 'github' | 'google') => {
    window.location.href = `/api/auth/${provider}`
  }

  return (
    <div style={{ minHeight: '100vh', background: C.canvas, color: C.white, fontFamily: "'Pretendard', system-ui, sans-serif", overflow: 'hidden' }}>
      <div style={{ minHeight: '100vh', display: 'grid', gridTemplateRows: 'auto 1fr', padding: '24px clamp(20px, 5vw, 56px)' }}>
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <LogoMark />
            <div>
              <div style={{ fontSize: 16, fontWeight: 900, color: C.white, letterSpacing: '-0.02em' }}>하루핏</div>
              <div style={{ fontSize: 10, color: C.alt, fontFamily: "'JetBrains Mono', monospace" }}>desktop activity tracker</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={() => login('google')} style={{ padding: '9px 13px', borderRadius: 999, border: `1px solid ${C.border2}`, background: 'transparent', color: C.muted, fontFamily: "'Pretendard', system-ui, sans-serif", fontSize: 11, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' }}>기록 보기</button>
            <a href={windowsInstallerUrl()} style={{ textDecoration: 'none', padding: '10px 16px', borderRadius: 999, background: C.mint, color: C.ink, fontSize: 12, fontWeight: 900, whiteSpace: 'nowrap' }}>Windows 다운로드</a>
          </div>
        </header>

        <main style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(360px, 520px)', gap: 'clamp(28px, 6vw, 76px)', alignItems: 'center', padding: '46px 0 36px' }}>
          <section>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 9px', borderRadius: 8, background: 'rgba(0,232,197,0.1)', border: `1px solid rgba(0,232,197,0.16)`, marginBottom: 18 }}>
              <IcoDevice c={C.mint} />
              <span style={{ fontSize: 10, color: C.mint, fontFamily: "'JetBrains Mono', monospace", fontWeight: 900, letterSpacing: '0.1em' }}>WINDOWS FIRST</span>
            </div>
            <h1 style={{ margin: 0, fontSize: 'clamp(40px, 6.4vw, 74px)', lineHeight: 1.08, letterSpacing: 0, fontWeight: 950, color: C.white }}>
              오늘의 시간을<br />측정해보세요
            </h1>
            <p style={{ margin: '22px 0 0', maxWidth: 560, fontSize: 15, lineHeight: 1.9, color: C.muted }}>
              하루핏 PC 앱을 설치하고 앱 안에서 로그인하세요. 사용 중인 Windows 앱, 창 제목, 개발 시간을 자동으로 기록하고 대시보드로 보여줍니다.
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 28 }}>
              <a href={windowsInstallerUrl()} style={{ textDecoration: 'none', padding: '14px 22px', borderRadius: 999, background: C.mint, color: C.ink, fontSize: 14, fontWeight: 950, boxShadow: '0 18px 42px rgba(0,232,197,0.16)' }}>Windows 앱 다운로드</a>
              <button onClick={() => login('google')} style={{ padding: '13px 18px', borderRadius: 999, border: `1px solid ${C.border2}`, background: C.raised, color: C.soft, fontFamily: "'Pretendard', system-ui, sans-serif", fontSize: 13, fontWeight: 850, cursor: 'pointer' }}>Google로 기록 보기</button>
            </div>
          </section>

          <section style={{ background: 'linear-gradient(145deg, rgba(0,232,197,0.12), rgba(26,26,26,1) 38%, rgba(13,13,13,1))', border: `1px solid rgba(0,232,197,0.16)`, borderRadius: 18, padding: 24, boxShadow: '0 34px 100px rgba(0,0,0,0.32)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
              <div>
                <div style={{ fontSize: 12, color: C.soft, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.08em', fontWeight: 900 }}>LIVE APPS</div>
                <div style={{ fontSize: 11, color: C.alt, marginTop: 4 }}>설치 후 자동 측정</div>
              </div>
              <div style={{ width: 38, height: 38, borderRadius: 12, background: C.mint, color: C.ink, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 950 }}>H</div>
            </div>
            {[
              ['Code - 하루핏', '1시간 12분', 92],
              ['Chrome - 문서', '38분', 52],
              ['Terminal - pnpm', '24분', 34],
            ].map(([name, time, pct]) => (
              <div key={name} style={{ marginBottom: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, marginBottom: 7 }}>
                  <span style={{ color: C.white, fontSize: 13, fontWeight: 800 }}>{name}</span>
                  <span style={{ color: C.alt, fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>{time}</span>
                </div>
                <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 99 }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: C.mint, borderRadius: 99 }} />
                </div>
              </div>
            ))}
          </section>
        </main>
      </div>
    </div>
  )
}

export default function App() {
  const [page, setPage] = useState<Page>(() => pageFromLocation())
  const [menuOpen, setMenuOpen] = useState(false)
  const [challenge, setChallenge] = useState<ChallengeData | null>(null)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [autoPairComputer, setAutoPairComputer] = useState(false)
  const [resultLockedOpen, setResultLockedOpen] = useState(false)

  useEffect(() => {
    api.me()
      .then(({ user }) => setUser(user))
      .catch(() => setUser(null))
      .finally(() => setAuthLoading(false))
  }, [])

  useEffect(() => {
    const onPopState = () => setPage(pageFromLocation())
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    if (!user) return
    api.challenge().then(setChallenge).catch(() => setChallenge(null))
  }, [user])

  const logout = async () => {
    await api.logout().catch(() => {})
    setUser(null)
    setChallenge(null)
    navigatePage('dashboard', true)
  }

  const navigatePage = (nextPage: Page, replace = false) => {
    setPage(nextPage)
    const nextUrl = urlForPage(nextPage)
    if (window.location.pathname !== nextUrl) {
      const method = replace ? 'replaceState' : 'pushState'
      window.history[method]({}, '', nextUrl)
    }
  }

  useEffect(() => {
    if (!challenge || page !== 'result' || challenge.currentDay >= 100) return
    setResultLockedOpen(true)
    navigatePage('dashboard', true)
  }, [challenge, page])

  if (authLoading) return <LoadingBlock label="로그인 상태를 확인하는 중입니다" />
  if (!user) return isDesktopShell() ? <LoginPage /> : <PublicDownloadPage />

  const currentDay = challenge?.currentDay ?? 1
  const remainingResultDays = Math.max(0, 100 - currentDay)
  const openResult = () => {
    if (currentDay < 100) {
      setResultLockedOpen(true)
      setMenuOpen(false)
      return
    }
    navigatePage('result')
    setMenuOpen(false)
  }
  return (
    <div style={{ display: 'flex', height: '100vh', background: C.canvas, overflow: 'hidden', fontFamily: "'Pretendard', system-ui, sans-serif" }}>
      <Sidebar page={page} setPage={navigatePage} open={menuOpen} setOpen={setMenuOpen} currentDay={currentDay} user={user} onLogout={logout} onResultClick={openResult} />
      <main style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }} className="scrollbar-none">
        <MobileTopbar page={page} onMenu={() => setMenuOpen(true)} />
        {page === 'dashboard' && <DashboardPage user={user} setPage={navigatePage} currentDay={currentDay} onConnectDevice={() => { setAutoPairComputer(true); navigatePage('devices') }} />}
        {page === 'timeline'  && <TimelinePage currentDay={currentDay} />}
        {page === 'analytics' && <AnalyticsPage />}
        {page === 'focus'     && <FocusPage currentDay={currentDay} />}
        {page === 'devices'   && <DevicesPage autoPairComputer={autoPairComputer} onAutoPairHandled={() => setAutoPairComputer(false)} />}
        {page === 'result'    && <ResultPage />}
      </main>
      {menuOpen && <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 39 }} />}
      {resultLockedOpen && (
        <div onClick={() => setResultLockedOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.76)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 90, padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 'min(420px, 100%)', background: C.raised, border: `1px solid ${C.border2}`, borderRadius: 18, padding: 30, textAlign: 'center', boxShadow: '0 28px 90px rgba(0,0,0,0.44)' }}>
            <div style={{ color: C.white, fontSize: 24, fontWeight: 900, marginBottom: 10 }}>{remainingResultDays}일 남았어요</div>
            <div style={{ color: C.alt, fontSize: 13, lineHeight: 1.8, marginBottom: 22 }}>100일을 향해서 화이팅</div>
            <button onClick={() => setResultLockedOpen(false)} style={{ width: '100%', border: 'none', borderRadius: 12, background: C.mint, color: C.ink, padding: '12px 14px', fontSize: 13, fontWeight: 900, cursor: 'pointer' }}>확인</button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════
   SIDEBAR
═══════════════════════════════════════════════ */
function Sidebar({ page, setPage, open, setOpen, currentDay, user, onLogout, onResultClick }: { page: Page; setPage: (p: Page) => void; open: boolean; setOpen: (v: boolean) => void; currentDay: number; user: AuthUser; onLogout: () => void; onResultClick: () => void }) {
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
            <div style={{ fontSize: 13, fontWeight: 900, color: C.white, letterSpacing: '0.08em' }}>하루핏</div>
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
        <div style={{ padding: '8px 10px 14px', marginBottom: 8, borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            {user.avatarUrl ? <img src={user.avatarUrl} alt="" style={{ width: 24, height: 24, borderRadius: '50%' }} /> : <div style={{ width: 24, height: 24, borderRadius: '50%', background: C.chip }} />}
            <div style={{ minWidth: 0 }}>
              <div style={{ color: C.white, fontSize: 11, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</div>
              <div style={{ color: C.alt, fontSize: 9, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email || 'OAuth 계정'}</div>
            </div>
          </div>
          <button onClick={onLogout} style={{ width: '100%', padding: '6px 8px', borderRadius: 7, border: `1px solid ${C.border2}`, background: 'transparent', color: C.alt, cursor: 'pointer', fontSize: 11 }}>
            로그아웃
          </button>
        </div>
        <NavBtn active={page === 'result'} onClick={onResultClick}>
          <IcoTrophy c={page === 'result' ? C.mint : '#4a4a4a'} />
          <span>백일 결과</span>
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
  const titles: Record<Page, string> = { dashboard: '개요', timeline: '타임라인', analytics: '분석', focus: '공부', devices: '기기', result: '백일 결과' }
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
function DashboardPage({ user, setPage, currentDay, onConnectDevice }: { user: AuthUser; setPage: (p: Page) => void; currentDay: number; onConnectDevice: () => void }) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState('')
  const [appPicker, setAppPicker] = useState<'focus' | 'development' | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const liveStartRef = useRef(Date.now())
  const lastPcMinutesRef = useRef<number | null>(null)
  const desktopShell = isDesktopShell()

  useEffect(() => {
    let cancelled = false
    const load = () => {
      api.dashboard(currentDay)
        .then((next) => {
          if (cancelled) return
          setData(next)
          setError('')
        })
        .catch((err) => {
          if (!cancelled) setError(err.message)
        })
    }
    load()
    const interval = window.setInterval(load, 1000)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [currentDay])

  const reloadDashboard = () => api.dashboard(currentDay).then(setData).catch((err) => setError(err.message))

  const addClassification = async (appName: string, category: 'focus' | 'development') => {
    await api.addAppClassification({ app_name: appName, category })
    await reloadDashboard()
  }

  const removeClassification = async (item: AppClassification) => {
    await api.deleteAppClassification(item.name, item.category)
    await reloadDashboard()
  }

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [])

  if (error) return <ErrorBlock message={error} />
  if (!data) return <LoadingBlock />

  const m = data.metrics
  if (lastPcMinutesRef.current !== m.pc.minutes) {
    lastPcMinutesRef.current = m.pc.minutes ?? 0
    liveStartRef.current = now
  }
  const liveMinutes = desktopShell && !document.hidden ? Math.max(0, (now - liveStartRef.current) / 60000) : 0
  const pcDisplayMinutes = (m.pc.minutes ?? 0) + liveMinutes
  const recent = data.recent ?? []
  const hasRecent = recent.length > 0
  const spark = {
    pc: recent.map((row) => row.pc_minutes / 60),
    focus: recent.map((row) => row.focus_minutes / 60),
    development: recent.map((row) => row.development_minutes / 60),
    github: recent.map((row) => row.github_commits),
  }
  const stats = [
    { id: 'pc', label: 'PC', value: fmtMinutes(pcDisplayMinutes), sub: fmtDelta(m.pc.delta), up: m.pc.delta >= 0, spark: spark.pc, max: 10, color: C.mint },
    { id: 'focus', label: '공부', value: parseHourValue(m.focus.display || '0h 00m'), sub: fmtDelta(m.focus.delta), up: m.focus.delta >= 0, spark: spark.focus, max: 5, color: C.mint, action: '앱 등록하기' },
    { id: 'dev', label: '개발', value: parseHourValue(m.development.display || '0h 00m'), sub: fmtDelta(m.development.delta), up: m.development.delta >= 0, spark: spark.development, max: 5, color: C.mintBright, action: '앱 등록하기' },
    { id: 'git', label: 'GitHub', value: `커밋 ${m.github.commits || 0}개`, sub: fmtDelta(m.github.delta, ''), up: m.github.delta >= 0, spark: spark.github, max: 12, color: C.mint, action: user.providers?.includes('github') ? '' : '연결하기' },
  ]

  const appTotals = new Map<string, { name: string; minutes: number }>()
  data.apps.forEach((app) => appTotals.set(app.name, { name: app.name, minutes: app.minutes }))
  const appRows = [...appTotals.values()].filter((app) => app.minutes > 0).sort((a, b) => b.minutes - a.minutes).slice(0, 8)
  const totalAppMinutes = Math.max(1 / 60, appRows.reduce((sum, app) => sum + app.minutes, 0))
  const apps = appRows.map((app) => ({
    name: app.name,
    dur: fmtMinutes(app.minutes),
    pct: Math.round((app.minutes / totalAppMinutes) * 100),
    color: C.mint,
  }))
  const timeline = data.events.map((event) => ({
    time: event.time,
    label: event.label
      .replace('Wake up', '기상')
      .replace('School', '학교')
      .replace('Focus Session', '집중 세션')
      .replace('GitHub Commit', 'GitHub 커밋')
      .replace('Sleep', '휴식'),
    dot: event.type === 'development' ? C.mint : event.type === 'focus' ? C.mintBright : event.type === 'health' ? C.mintMuted : '#3a3a3a',
  }))

  const deviceTotal = pcDisplayMinutes
  const devPcts = deviceTotal > 0 ? [1] : [0]

  return (
    <div style={{ padding: '32px 36px' }}>
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
      {!desktopShell && (
        <div style={{ marginBottom: 14, borderRadius: 12, border: `1px solid rgba(0,232,197,0.16)`, background: 'rgba(0,232,197,0.06)', padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 12, color: C.white, fontWeight: 900, marginBottom: 3 }}>웹에서는 기록을 추가하지 않아요</div>
            <div style={{ fontSize: 11, color: C.alt, lineHeight: 1.6 }}>PC 시간과 앱 사용량은 Windows 앱에서만 측정되고, 웹에서는 같은 계정에 저장된 기록만 보여줍니다.</div>
          </div>
          <a href={desktopOpenUrl()} style={{ textDecoration: 'none', padding: '9px 14px', borderRadius: 999, background: C.mint, color: C.ink, fontSize: 11, fontWeight: 900, whiteSpace: 'nowrap' }}>앱 열기</a>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 28 }}>
        {stats.map((s) => (
          <div key={s.id} style={{ background: C.raised, borderRadius: 14, padding: '18px 18px 14px', border: `1px solid ${C.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: C.soft, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.08em', fontWeight: 700 }}>{s.label.toUpperCase()}</div>
              {s.action && (
                <button onClick={() => s.id === 'git' ? (window.location.href = '/api/auth/github') : setAppPicker(s.id === 'focus' ? 'focus' : 'development')} style={{ border: `1px solid ${C.border2}`, background: 'rgba(0,232,197,0.08)', color: C.mint, borderRadius: 999, padding: '5px 8px', fontSize: 10, fontWeight: 800, cursor: 'pointer', fontFamily: "'Pretendard', system-ui, sans-serif", whiteSpace: 'nowrap' }}>
                  {s.action}
                </button>
              )}
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: C.white, letterSpacing: '-0.02em', marginBottom: 4, lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 10, color: s.up ? C.mintMuted : C.faint, marginBottom: 12 }}>{s.sub}</div>
            {hasRecent ? <Sparkline data={s.spark} color={s.color} max={s.max} /> : <EmptyChart height={28} />}
          </div>
        ))}
      </div>

      {/* Lower row */}
      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 1fr', gap: 16 }}>
        {/* Device ring */}
        <div style={{ background: C.raised, borderRadius: 14, padding: '20px', border: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ fontSize: 11, color: C.soft, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.08em', marginBottom: 16, alignSelf: 'flex-start', fontWeight: 700 }}>기기</div>
          <DeviceRing pcts={devPcts} />
          <div style={{ marginTop: 18, width: '100%' }}>
            {[
              { label: '노트북', val: fmtMinutes(pcDisplayMinutes), color: C.mint },
            ].map((d) => (
              <div key={d.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 9 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <div style={{ width: 6, height: 6, borderRadius: 1, background: d.color }} />
                  <span style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>{d.label}</span>
                </div>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: C.muted }}>{d.val}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Timeline */}
        <div style={{ background: C.raised, borderRadius: 14, padding: '20px', border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 11, color: C.soft, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.08em', marginBottom: 18, fontWeight: 700 }}>오늘 타임라인</div>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, marginBottom: 18 }}>
            <div style={{ fontSize: 11, color: C.soft, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.08em', fontWeight: 700 }}>앱 사용량</div>
            <div style={{ fontSize: 10, color: C.alt }}>총 {fmtMinutes(totalAppMinutes)}</div>
          </div>
          {apps.map((a, i) => (
            <div key={a.name} style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AppIconMini name={a.name} />
                  <span style={{ fontSize: 12, color: i === 0 ? C.white : C.muted }}>{a.name}</span>
                </div>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: C.alt }}>{a.dur} · {a.pct}%</span>
              </div>
              <div style={{ height: 3, background: C.border, borderRadius: 2 }}>
                <div style={{ width: `${a.pct}%`, height: '100%', background: a.color, borderRadius: 2, transition: 'width 0.7s' }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom CTA */}
      {desktopShell ? (
        <div style={{ marginTop: 16, background: 'linear-gradient(135deg, rgba(0,232,197,0.06) 0%, rgba(0,232,197,0.02) 100%)', borderRadius: 14, padding: '18px 24px', border: `1px solid rgba(0,232,197,0.12)`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.white, marginBottom: 2 }}>공부 기록</div>
            <div style={{ fontSize: 11, color: C.alt }}>노트북/휴대폰 없이 하는 일을 타이머로 저장하세요.</div>
          </div>
          <button onClick={() => setPage('focus')} style={{ padding: '9px 20px', borderRadius: 50, background: C.mint, color: C.ink, fontFamily: "'Pretendard', system-ui, sans-serif", fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer', letterSpacing: '0.04em' }}>
            Start →
          </button>
        </div>
      ) : (
        <div style={{ marginTop: 16, background: 'linear-gradient(135deg, rgba(0,232,197,0.12), rgba(26,26,26,1) 42%, rgba(13,13,13,1))', borderRadius: 16, padding: '26px', border: `1px solid rgba(0,232,197,0.18)`, display: 'grid', gridTemplateColumns: '1fr auto', gap: 24, alignItems: 'center' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 8px', borderRadius: 7, background: 'rgba(0,232,197,0.1)', border: `1px solid rgba(0,232,197,0.16)`, marginBottom: 12 }}>
              <IcoDevice c={C.mint} />
              <span style={{ fontSize: 10, color: C.mint, fontFamily: "'JetBrains Mono', monospace", fontWeight: 800, letterSpacing: '0.08em' }}>HARUFIT DESKTOP</span>
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: C.white, letterSpacing: '-0.03em', marginBottom: 8 }}>Windows 앱 설치</div>
            <div style={{ fontSize: 12, color: C.alt, lineHeight: 1.8, maxWidth: 620 }}>
              하루핏 PC 앱은 현재 보고 있는 앱과 창 제목을 자동 기록합니다. 설치 후 로그인만 하면 PC 시간, 앱 사용량, 개발 시간이 계정에 저장됩니다.
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
              {['활성 앱 측정', '유휴 시간 제외', '백그라운드 동기화'].map((label) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 10px', borderRadius: 999, background: 'rgba(0,0,0,0.24)', border: `1px solid ${C.border}` }}>
                  <span style={{ width: 5, height: 5, borderRadius: 99, background: C.mint }} />
                  <span style={{ fontSize: 10, color: C.muted, fontWeight: 700 }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gap: 10, minWidth: 210 }}>
            <a href={desktopOpenUrl()} style={{ textDecoration: 'none', textAlign: 'center', padding: '13px 20px', borderRadius: 999, background: C.mint, color: C.ink, fontFamily: "'Pretendard', system-ui, sans-serif", fontSize: 13, fontWeight: 900, boxShadow: '0 16px 34px rgba(0,232,197,0.14)' }}>하루핏 열기</a>
            <a href={windowsInstallerUrl()} style={{ textDecoration: 'none', textAlign: 'center', padding: '10px 18px', borderRadius: 999, border: `1px solid ${C.border2}`, background: 'rgba(0,0,0,0.18)', color: C.muted, fontFamily: "'Pretendard', system-ui, sans-serif", fontSize: 11, fontWeight: 800 }}>Windows 다운로드</a>
          </div>
        </div>
      )}
      {appPicker && data && (
        <AppPickerModal
          category={appPicker}
          apps={appRows}
          selected={data.appClassifications.filter(item => item.category === appPicker)}
          onAdd={(appName) => addClassification(appName, appPicker)}
          onRemove={removeClassification}
          onClose={() => setAppPicker(null)}
        />
      )}
    </div>
  )
}

function AppPickerModal({
  category,
  apps,
  selected,
  onAdd,
  onRemove,
  onClose,
}: {
  category: 'focus' | 'development'
  apps: { name: string; minutes: number }[]
  selected: AppClassification[]
  onAdd: (appName: string) => Promise<void>
  onRemove: (item: AppClassification) => Promise<void>
  onClose: () => void
}) {
  const [customName, setCustomName] = useState('')
  const [saving, setSaving] = useState('')
  const selectedNames = new Set(selected.map(item => item.name))
  const title = category === 'development' ? '개발 앱 등록' : '공부 앱 등록'
  const available = apps.filter(app => !selectedNames.has(app.name))

  const add = async (name: string) => {
    const appName = name.trim()
    if (!appName || saving) return
    setSaving(appName)
    try {
      await onAdd(appName)
      setCustomName('')
    } finally {
      setSaving('')
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.68)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 24 }} onClick={onClose}>
      <div style={{ width: 'min(520px, 100%)', maxHeight: '82vh', overflow: 'auto', background: C.raised, border: `1px solid ${C.border2}`, borderRadius: 14, padding: 22, boxShadow: '0 30px 90px rgba(0,0,0,0.42)' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 18 }}>
          <div>
            <div style={{ color: C.white, fontSize: 18, fontWeight: 900 }}>{title}</div>
            <div style={{ color: C.alt, fontSize: 11, marginTop: 5 }}>선택한 앱 사용 시간이 {category === 'development' ? '개발' : '공부'} 시간에 더해집니다.</div>
          </div>
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: 10, border: `1px solid ${C.border2}`, background: C.surface, color: C.muted, cursor: 'pointer', fontSize: 18 }}>×</button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
          <input value={customName} onChange={e => setCustomName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') add(customName) }} placeholder="앱 이름 직접 입력: chrome, Code, Discord" style={{ flex: 1, background: C.surface, border: `1px solid ${C.border2}`, borderRadius: 9, color: C.white, padding: '11px 12px', outline: 'none', fontSize: 12 }} />
          <button onClick={() => add(customName)} style={{ border: 'none', background: C.mint, color: C.ink, borderRadius: 9, padding: '0 14px', fontWeight: 900, cursor: 'pointer' }}>추가</button>
        </div>

        {selected.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ color: C.soft, fontSize: 11, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.08em', marginBottom: 8 }}>등록됨</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {selected.map(item => (
                <button key={item.name} onClick={() => onRemove(item)} style={{ border: `1px solid rgba(0,232,197,0.28)`, background: 'rgba(0,232,197,0.1)', color: C.mint, borderRadius: 999, padding: '7px 10px', cursor: 'pointer', fontSize: 11, fontWeight: 800 }}>
                  {item.name} ×
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ color: C.soft, fontSize: 11, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.08em', marginBottom: 8 }}>오늘 사용한 앱</div>
        <div style={{ display: 'grid', gap: 7 }}>
          {available.length > 0 ? available.map(app => (
            <button key={app.name} onClick={() => add(app.name)} disabled={saving === app.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: `1px solid ${C.border}`, background: C.surface, color: C.muted, borderRadius: 9, padding: '10px 12px', cursor: 'pointer', textAlign: 'left' }}>
              <span style={{ color: C.white, fontSize: 12, fontWeight: 800 }}>{app.name}</span>
              <span style={{ color: C.alt, fontFamily: "'JetBrains Mono', monospace", fontSize: 10 }}>{fmtMinutes(app.minutes)}</span>
            </button>
          )) : (
            <div style={{ color: C.alt, fontSize: 12, padding: '16px 4px' }}>아직 선택할 앱 기록이 없습니다.</div>
          )}
        </div>
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

  useEffect(() => {
    setSel(currentDay)
  }, [currentDay])

  const completedDays = currentDay
  const d = rows.find((row) => row.day_number === sel) ?? rows[0]
  const rowByDay = new Map(rows.map((row) => [row.day_number, row]))
  const usageMinutes = (row?: TimelineEntry) => row ? row.pc_minutes + row.phone_minutes + row.focus_minutes + row.development_minutes + row.exercise_minutes : 0
  const heatColor = (minutes: number, future: boolean) => {
    if (future) return '#111'
    if (minutes <= 0) return '#141414'
    if (minutes >= 360) return C.mint
    if (minutes >= 240) return '#00bfa5'
    if (minutes >= 120) return '#087d70'
    return '#15524d'
  }
  if (error) return <ErrorBlock message={error} />

  return (
    <div style={{ padding: '32px 36px' }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 44, fontWeight: 900, color: C.white, letterSpacing: '-0.03em', lineHeight: 1 }}>하루핏</div>
        <div style={{ display: 'flex', gap: 20, marginTop: 8 }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: C.mint }}>{completedDays}일 완료</span>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: C.alt }}>{100 - completedDays}일 남음</span>
        </div>
      </div>

      <div className="timeline-layout" style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20 }}>
        {/* Grid */}
        <div style={{ background: C.raised, borderRadius: 14, padding: '24px', border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 10, color: '#4a4a4a', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.08em', marginBottom: 16 }}>전체 날짜</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 6 }}>
            {Array.from({ length: 100 }, (_, i) => i + 1).map((n) => {
              const row = rowByDay.get(n)
              const minutes = usageMinutes(row)
              const today = n === completedDays
              const future = n > completedDays
              const selected = sel === n
              return (
                <button key={n} onClick={() => !future && setSel(n)} style={{
                  aspectRatio: '1', borderRadius: 6, border: 'none',
                  cursor: future ? 'default' : 'pointer',
                  background: heatColor(minutes, future),
                  color: future ? '#4a4a4a' : minutes > 0 && today ? C.ink : minutes > 0 ? C.white : C.faint,
                  fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
                  fontWeight: today ? 700 : 400,
                  opacity: future ? 0.3 : 1,
                  outline: selected && !today ? `1px solid ${C.mint}` : 'none',
                  outlineOffset: 1,
                  transition: 'all 100ms', padding: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }} title={`${n}일차 · ${fmtMinutes(minutes)}`}>
                  {n}
                </button>
              )
            })}
          </div>
          {/* legend */}
          <div style={{ display: 'flex', gap: 14, marginTop: 16, flexWrap: 'wrap' }}>
            {[{ col: '#141414', lbl: '기록 없음' }, { col: '#15524d', lbl: '2시간 미만' }, { col: '#087d70', lbl: '2~4시간' }, { col: '#00bfa5', lbl: '4~6시간' }, { col: C.mint, lbl: '6시간 이상' }].map(l => (
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

          {d ? [['총 사용 시간', fmtMinutes(usageMinutes(d))], ['PC', fmtMinutes(d.pc_minutes)], ['공부', fmtMinutes(d.focus_minutes)], ['개발', fmtMinutes(d.development_minutes)]].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: `1px solid ${C.border}` }}>
              <span style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>{k}</span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: C.muted }}>{v}</span>
            </div>
          )) : <div style={{ fontSize: 12, color: C.alt, padding: '12px 0' }}>아직 저장된 기록이 없습니다.</div>}

          {/* GitHub mini heatrow */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: '#4a4a4a', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.08em', marginBottom: 6 }}>커밋</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CommitPips count={d?.github_commits ?? 0} />
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: C.mint }}>{d?.github_commits ?? 0}</span>
            </div>
          </div>

        </div>
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

  const rows = data.rows
  const hasRows = rows.length > 0
  const screenPc = rows.map((row) => row.pc_minutes)
  const focusData = rows.map((row) => row.focus_minutes)
  const developmentData = rows.map((row) => row.development_minutes)
  const dateLabels = rows.map((row) => formatChartDateLabel(row.date))
  const ghData = rows.map((row) => row.github_commits)
  const avg = (arr: number[]) => arr.length ? arr.reduce((a, v) => a + v, 0) / arr.length : 0
  const chartMax = (arr: number[]) => Math.max(1, ...arr)

  const insights = buildInsights(rows)

  const totalAppMinutes = Math.max(1, data.topApps.reduce((sum, app) => sum + app.minutes, 0))
  const apps = data.topApps.map((app) => ({
    name: app.name,
    pct: Math.round((app.minutes / totalAppMinutes) * 100),
    time: fmtMinutes(app.minutes),
    color: C.mint,
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
        <ChartCard title="PC 시간" subtitle="일자별 사용 시간">
          <div style={{ display: 'flex', gap: 14, marginBottom: 12 }}>
            <Legend color={C.mint} label="PC" />
          </div>
          {hasRows ? <LineChartSVG data={screenPc} labels={dateLabels} maxVal={chartMax(screenPc)} color={C.mint} h={150} /> : <EmptyChart height={150} />}
        </ChartCard>

        {/* Focus */}
        <ChartCard title="공부 시간" subtitle="일자별 공부 시간">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 26, fontWeight: 800, color: C.white }}>{fmtMinutes(avg(focusData))}</span>
            <span style={{ fontSize: 10, color: C.mint }}>평균</span>
          </div>
          {hasRows ? <LineChartSVG data={focusData} labels={dateLabels} maxVal={chartMax(focusData)} color={C.mint} h={150} /> : <EmptyChart height={150} />}
        </ChartCard>

        {/* Development */}
        <ChartCard title="개발 시간" subtitle="일자별 개발 시간">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 26, fontWeight: 800, color: C.white }}>{fmtMinutes(avg(developmentData))}</span>
            <span style={{ fontSize: 10, color: C.mint }}>평균</span>
          </div>
          {hasRows ? <LineChartSVG data={developmentData} labels={dateLabels} maxVal={chartMax(developmentData)} color={C.mintBright} h={150} /> : <EmptyChart height={150} />}
        </ChartCard>
      </div>

      {/* GitHub heatmap */}
      <div style={{ background: C.raised, borderRadius: 14, padding: '20px 24px', border: `1px solid ${C.border}`, marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: C.soft, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.08em', marginBottom: 14, fontWeight: 700 }}>GITHUB 활동 · {data.days}일</div>
        {hasRows ? <GithubHeatmap data={ghData} /> : <EmptyChart height={54} />}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* App usage */}
        <ChartCard title="상위 앱" subtitle={`총 ${fmtMinutes(totalAppMinutes)} 중 비율`}>
          {apps.length ? apps.map(a => (
            <div key={a.name} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AppIconMini name={a.name} />
                  <span style={{ fontSize: 12, color: C.muted }}>{a.name}</span>
                </div>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: C.alt }}>{a.time} · {a.pct}%</span>
              </div>
              <div style={{ height: 3, background: C.border, borderRadius: 2 }}>
                <div style={{ width: `${a.pct}%`, height: '100%', background: a.color, borderRadius: 2 }} />
              </div>
            </div>
          )) : <EmptyChart height={84} />}
        </ChartCard>

        {/* Insights */}
        <ChartCard title="인사이트" subtitle="감지된 패턴">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {insights.length ? insights.map((ins, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, padding: '10px 12px', background: C.surface, borderRadius: 10, border: `1px solid ${C.border}` }}>
                <span style={{ fontSize: 12, color: C.mint, fontWeight: 700, minWidth: 14 }}>{ins.icon}</span>
                <p style={{ margin: 0, fontSize: 11, color: C.muted, lineHeight: 1.6 }}>{ins.text}</p>
              </div>
            )) : <EmptyChart height={84} />}
          </div>
        </ChartCard>
      </div>
    </div>
  )
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div style={{ background: C.raised, borderRadius: 14, padding: '20px', border: `1px solid ${C.border}` }}>
      <div style={{ fontSize: 11, color: C.soft, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.08em', fontWeight: 700 }}>{title}</div>
      <div style={{ fontSize: 12, color: C.faint, marginBottom: 14, marginTop: 2 }}>{subtitle}</div>
      {children}
    </div>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={{ width: 8, height: 2, borderRadius: 1, background: color }} />
      <span style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>{label}</span>
    </div>
  )
}

function EmptyChart({ height }: { height: number; label?: string }) {
  return (
    <svg width="100%" viewBox={`0 0 300 ${height}`} preserveAspectRatio="none" style={{ display: 'block', height }}>
      <line x1="0" y1={height / 2} x2="300" y2={height / 2} stroke={C.mint} strokeWidth="2" strokeLinecap="round" opacity="0.75" />
    </svg>
  )
}

function buildInsights(rows: TimelineEntry[]) {
  if (rows.length < 2) return []
  const first = rows[0]
  const last = rows[rows.length - 1]
  const insights: { icon: string; text: string }[] = []
  const studyDiff = last.focus_minutes - first.focus_minutes
  const devDiff = last.development_minutes - first.development_minutes
  const commitTotal = rows.reduce((sum, row) => sum + row.github_commits, 0)
  if (studyDiff !== 0) insights.push({ icon: studyDiff > 0 ? '↑' : '↓', text: `기간 첫 기록 대비 공부 시간이 ${fmtMinutes(Math.abs(studyDiff))} ${studyDiff > 0 ? '늘었습니다.' : '줄었습니다.'}` })
  if (devDiff !== 0) insights.push({ icon: devDiff > 0 ? '↑' : '↓', text: `기간 첫 기록 대비 개발 시간이 ${fmtMinutes(Math.abs(devDiff))} ${devDiff > 0 ? '늘었습니다.' : '줄었습니다.'}` })
  if (commitTotal > 0) insights.push({ icon: '•', text: `선택 기간에 GitHub 커밋 ${commitTotal}개가 기록됐습니다.` })
  return insights
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
  const [goalMins, setGoalMins] = useState(240)
  const [goalInput, setGoalInput] = useState('4:00')
  const [goalSaving, setGoalSaving] = useState(false)
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
    api.studySettings()
      .then((settings) => {
        setGoalMins(settings.daily_focus_goal_minutes)
        setGoalInput(goalMinutesToInput(settings.daily_focus_goal_minutes))
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
  const saveGoal = async () => {
    const parsed = parseGoalMinutes(goalInput)
    if (!parsed) {
      setError('목표 시간은 1분 이상으로 입력하세요')
      setGoalInput(goalMinutesToInput(goalMins))
      return
    }
    setGoalSaving(true)
    try {
      const saved = await api.updateStudySettings({ daily_focus_goal_minutes: parsed })
      setGoalMins(saved.daily_focus_goal_minutes)
      setGoalInput(goalMinutesToInput(saved.daily_focus_goal_minutes))
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : '목표 시간 저장 실패')
    } finally {
      setGoalSaving(false)
    }
  }

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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: C.alt }}>오늘 목표</span>
            <input
              value={goalInput}
              onChange={e => setGoalInput(e.target.value)}
              onBlur={saveGoal}
              onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
              placeholder="4:00"
              style={{ width: 64, padding: '5px 7px', background: C.surface, border: `1px solid ${C.border2}`, borderRadius: 7, color: C.white, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, outline: 'none' }}
            />
            <button onClick={saveGoal} disabled={goalSaving} style={{ border: 'none', borderRadius: 999, background: 'rgba(0,232,197,0.08)', color: C.mint, padding: '5px 9px', fontSize: 10, fontWeight: 800, cursor: goalSaving ? 'default' : 'pointer', fontFamily: "'Pretendard', system-ui, sans-serif" }}>
              {goalSaving ? '저장 중' : '저장'}
            </button>
          </div>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: totalMins >= goalMins ? C.mint : C.muted }}>
            {Math.floor(totalMins / 60)}시간 {totalMins % 60}분 / {Math.floor(goalMins / 60)}시간 {String(goalMins % 60).padStart(2, '0')}분
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
function DevicesPage({ autoPairComputer, onAutoPairHandled }: { autoPairComputer?: boolean; onAutoPairHandled?: () => void }) {
  const [qr, setQr] = useState(false)
  const [devices, setDevices] = useState<DeviceData[]>([])
  const [pairing, setPairing] = useState<DevicePairingData | null>(null)
  const [pendingDevice, setPendingDevice] = useState<{ kind: string; name: string; platform: string } | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [connectToken, setConnectToken] = useState('')
  const [lockedDevice, setLockedDevice] = useState<{ title: string; description: string } | null>(null)
  const desktopShell = isDesktopShell()

  const refresh = () => api.devices().then(setDevices).catch((err) => setError(err.message))

  useEffect(() => { refresh() }, [])

  useEffect(() => {
    if (!autoPairComputer) return
    onAutoPairHandled?.()
    startPairing({ kind: 'computer', name: '노트북 트래커', platform: 'Windows' })
  }, [autoPairComputer])

  const startPairing = async (device: { kind: string; name: string; platform: string }) => {
    setError('')
    setCopied(false)
    setPendingDevice(device)
    try {
      const created = await api.createDevicePairing(device)
      setPairing(created)
      setQr(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : '기기 연결 코드 생성 실패')
    }
  }

  const copyPairingToken = async () => {
    if (!pairing?.token) return
    await navigator.clipboard.writeText(pairing.token)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1400)
  }

  const completePairing = async () => {
    if (!pairing) return
    setError('')
    try {
      await api.connectDevice({ token: pairing.token })
      setQr(false)
      setPairing(null)
      setPendingDevice(null)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : '기기 연결 실패')
    }
  }

  const connectWithToken = async () => {
    const token = connectToken.trim()
    if (!token) {
      setError('연결 코드를 입력하세요')
      return
    }
    setError('')
    try {
      await api.connectDevice({ token })
      setConnectToken('')
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : '기기 연결 실패')
    }
  }

  const disconnect = async (id: number) => {
    setError('')
    try {
      await api.disconnectDevice(id)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : '기기 연결 해제 실패')
    }
  }

  const illustration = (kind: string) => {
    if (kind === 'phone') return () => <IlluPhone />
    if (kind === 'watch') return () => <IlluWatch />
    if (kind === 'github') return () => <IlluGit />
    return () => <IlluLaptop />
  }
  const connected = devices.map((device) => ({
    id: device.id,
    name: device.name,
    sub: device.platform,
    sync: shortTime(device.last_sync),
    Illu: illustration(device.kind),
  }))
  const pairingGuide = (() => {
    if (pendingDevice?.kind === 'computer') {
      return {
        title: '노트북 연결 코드',
        description: '아래 명령을 한 번 실행하면 현재 로그인한 계정에 연결되고 Windows 시작 시 자동 실행됩니다.',
        command: pairing ? windowsTrackerCommand(pairing.token) : '',
      }
    }
    if (pendingDevice?.kind === 'phone') {
      return {
        title: '휴대폰 연결 코드',
        description: 'Android 연동 앱에서 이 코드를 입력하고 사용정보 접근 권한을 허용하면 휴대폰 사용 기록이 이 계정에 저장됩니다.',
        command: '',
      }
    }
    return {
      title: '기기 연결 코드',
      description: '다른 기기에서 이 코드를 입력하면 현재 로그인한 계정에 연결됩니다.',
      command: '',
    }
  })()

  return (
    <div style={{ padding: '32px 36px' }}>
      <div style={{ fontSize: 32, fontWeight: 900, color: C.white, letterSpacing: '-0.02em', marginBottom: 28 }}>연결된 기기</div>
      {error && <div style={{ color: C.mintMuted, fontSize: 12, marginBottom: 16 }}>{error}</div>}

      {!desktopShell && <div style={{ background: 'linear-gradient(135deg, rgba(0,232,197,0.12), rgba(26,26,26,1) 42%, rgba(13,13,13,1))', borderRadius: 16, padding: '26px', border: `1px solid rgba(0,232,197,0.18)`, marginBottom: 18, display: 'grid', gridTemplateColumns: '1fr auto', gap: 24, alignItems: 'center' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 8px', borderRadius: 7, background: 'rgba(0,232,197,0.1)', border: `1px solid rgba(0,232,197,0.16)`, marginBottom: 12 }}>
            <IcoDevice c={C.mint} />
            <span style={{ fontSize: 10, color: C.mint, fontFamily: "'JetBrains Mono', monospace", fontWeight: 800, letterSpacing: '0.08em' }}>HARUFIT DESKTOP</span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: C.white, letterSpacing: '-0.03em', marginBottom: 8 }}>Windows 앱 설치</div>
          <div style={{ fontSize: 12, color: C.alt, lineHeight: 1.8, maxWidth: 620 }}>
            하루핏 PC 앱은 현재 보고 있는 앱과 창 제목을 자동 기록합니다. 설치 후 로그인만 하면 PC 시간, 앱 사용량, 개발 시간이 계정에 저장됩니다.
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
            {['활성 앱 측정', '유휴 시간 제외', '백그라운드 동기화'].map((label) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 10px', borderRadius: 999, background: 'rgba(0,0,0,0.24)', border: `1px solid ${C.border}` }}>
                <span style={{ width: 5, height: 5, borderRadius: 99, background: C.mint }} />
                <span style={{ fontSize: 10, color: C.muted, fontWeight: 700 }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: 'grid', gap: 10, minWidth: 210 }}>
          <a href={windowsInstallerUrl()} style={{ textDecoration: 'none', textAlign: 'center', padding: '13px 20px', borderRadius: 999, background: C.mint, color: C.ink, fontFamily: "'Pretendard', system-ui, sans-serif", fontSize: 13, fontWeight: 900, boxShadow: '0 16px 34px rgba(0,232,197,0.14)' }}>Windows 다운로드</a>
          <button onClick={() => startPairing({ kind: 'computer', name: '노트북 트래커', platform: 'Windows' })} style={{ padding: '10px 18px', borderRadius: 999, border: `1px solid ${C.border2}`, background: 'rgba(0,0,0,0.18)', color: C.muted, fontFamily: "'Pretendard', system-ui, sans-serif", fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>명령어로 연결</button>
        </div>
      </div>}

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
              <button onClick={() => disconnect(d.id)} style={{ flex: 1, padding: '7px', borderRadius: 7, border: `1px solid ${C.border2}`, background: 'transparent', color: C.faint, fontSize: 11, cursor: 'pointer', fontFamily: "'Pretendard', system-ui, sans-serif" }}>연결 해제</button>
            </div>
          </div>
        ))}
      </div>

      <div style={{ background: C.raised, borderRadius: 14, padding: '22px', border: `1px solid ${C.border}`, marginBottom: 14 }}>
        <div style={{ fontSize: 10, color: '#4a4a4a', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.08em', marginBottom: 14 }}>다른 기기 코드로 연결</div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'stretch', flexWrap: 'wrap' }}>
          <input
            value={connectToken}
            onChange={(event) => setConnectToken(event.target.value)}
            placeholder="연결 코드 입력"
            style={{
              flex: '1 1 260px',
              minWidth: 0,
              padding: '12px 14px',
              borderRadius: 10,
              border: `1px solid ${C.border2}`,
              background: C.surface,
              color: C.white,
              outline: 'none',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 13,
            }}
          />
          <button
            onClick={connectWithToken}
            style={{
              flex: '0 0 auto',
              padding: '0 18px',
              minHeight: 44,
              borderRadius: 10,
              border: 'none',
              background: C.mint,
              color: C.ink,
              fontFamily: "'Pretendard', system-ui, sans-serif",
              fontSize: 13,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            연결
          </button>
        </div>
      </div>

      <div style={{ background: C.raised, borderRadius: 14, padding: '22px', border: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 10, color: '#4a4a4a', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.08em', marginBottom: 18 }}>계정에 기기 추가</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
          {[
            { label: 'PC/노트북 연결', sub: 'Windows 시간 측정', kind: 'computer', name: '노트북 트래커', platform: 'Windows', Illu: () => <IlluLaptop dim /> },
            { label: '휴대폰 연결', sub: 'v2 Android 앱 필요', kind: 'phone', locked: true, lockText: '휴대폰 사용시간은 웹에서 읽을 수 없어서 Android 앱과 Usage Access 권한이 필요합니다.', Illu: () => <IlluPhone dim /> },
            { label: '태블릿 연결', sub: 'v2 Android/iPad 앱 필요', kind: 'tablet', locked: true, lockText: '태블릿 사용시간도 OS 권한이 필요해서 v2 네이티브 앱에서 연결합니다.', Illu: () => <IlluPhone dim /> },
            { label: '워치 연결', sub: 'v2 Health Connect 필요', kind: 'watch', locked: true, lockText: '워치는 휴대폰 앱이 Health Connect 권한을 받아 걸음과 운동 데이터를 가져오는 방식으로 연결합니다.', Illu: () => <IlluWatch dim /> },
          ].map((item) => (
            <button key={item.label} onClick={() => item.locked ? setLockedDevice({ title: item.label, description: item.lockText || '' }) : startPairing(item)} style={{
              padding: '16px', background: C.surface, borderRadius: 12,
              border: `1px dashed ${item.locked ? C.border : C.border2}`, cursor: 'pointer', textAlign: 'left',
              opacity: item.locked ? 0.62 : 1,
              transition: 'border-color 120ms',
            }}>
              <div style={{ marginBottom: 10 }}><item.Illu /></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, fontFamily: "'Pretendard', system-ui, sans-serif" }}>{item.label}</div>
                {item.locked && <div style={{ fontSize: 9, color: C.mint, border: `1px solid ${C.border2}`, borderRadius: 5, padding: '2px 5px', fontFamily: "'JetBrains Mono', monospace" }}>v2</div>}
              </div>
              <div style={{ fontSize: 10, color: '#3a3a3a', fontFamily: "'Pretendard', system-ui, sans-serif" }}>{item.sub}</div>
            </button>
          ))}
        </div>
      </div>

      {qr && (
        <div onClick={() => setQr(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: C.raised, borderRadius: 20, padding: '34px', border: `1px solid ${C.border2}`, textAlign: 'left', maxWidth: 430, width: 'calc(100% - 32px)' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.white, marginBottom: 8 }}>{pairingGuide.title}</div>
            <div style={{ fontSize: 12, color: C.alt, marginBottom: 22, lineHeight: 1.8 }}>
              {pairingGuide.description}<br />
              연결 코드는 10분 동안 유효합니다.
            </div>
            <div style={{ background: C.surface, borderRadius: 12, padding: '14px 16px', marginBottom: 20, border: `1px solid ${C.border2}` }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", color: C.mint, fontSize: 18, fontWeight: 800, wordBreak: 'break-all' }}>{pairing?.token || '생성 중'}</div>
              <div style={{ fontSize: 10, color: C.alt, marginTop: 8 }}>{pairing ? new Date(pairing.expires_at).toLocaleTimeString('ko-KR') : ''} 만료</div>
            </div>
            {pairingGuide.command && (
              <div style={{ background: '#0b0b0b', border: `1px solid ${C.border}`, borderRadius: 10, padding: 12, marginBottom: 18 }}>
                <div style={{ fontSize: 10, color: C.alt, marginBottom: 8 }}>노트북에서 실행</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", color: C.muted, fontSize: 11, lineHeight: 1.6, wordBreak: 'break-all' }}>{pairingGuide.command}</div>
              </div>
            )}
            <div style={{ fontSize: 10, color: C.alt, fontFamily: "'JetBrains Mono', monospace", marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <PulsingDot />&nbsp;기기 연결 대기 중...
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setQr(false)} style={{ flex: 1, padding: '9px 14px', borderRadius: 8, border: `1px solid ${C.border2}`, background: 'transparent', color: C.alt, fontFamily: "'Pretendard', system-ui, sans-serif", fontSize: 12, cursor: 'pointer' }}>취소</button>
              <button onClick={copyPairingToken} style={{ flex: 1, padding: '9px 14px', borderRadius: 8, border: `1px solid ${C.border2}`, background: C.surface, color: C.muted, fontFamily: "'Pretendard', system-ui, sans-serif", fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{copied ? '복사됨' : '코드 복사'}</button>
              <button onClick={completePairing} style={{ flex: 1, padding: '9px 14px', borderRadius: 8, border: 'none', background: C.mint, color: C.ink, fontFamily: "'Pretendard', system-ui, sans-serif", fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>현재 기기로 테스트</button>
            </div>
          </div>
        </div>
      )}

      {lockedDevice && (
        <div onClick={() => setLockedDevice(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: C.raised, borderRadius: 20, padding: '34px', border: `1px solid ${C.border2}`, textAlign: 'left', maxWidth: 430, width: 'calc(100% - 32px)' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.white, marginBottom: 8 }}>{lockedDevice.title}</div>
            <div style={{ color: C.alt, fontSize: 12, lineHeight: 1.8, marginBottom: 18 }}>{lockedDevice.description}</div>
            <div style={{ display: 'grid', gap: 10, marginBottom: 22 }}>
              {[
                'v1에서는 PC/노트북 Windows 트래커부터 실제 측정합니다.',
                '휴대폰, 태블릿, 워치는 OS 권한이 필요한 네이티브 앱 기능으로 분리합니다.',
                'v2 앱에서 권한 승인 후 이 계정으로 자동 기록을 전송합니다.',
              ].map((text, index) => (
                <div key={text} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ width: 22, height: 22, borderRadius: 7, background: 'rgba(0,232,197,0.12)', color: C.mint, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{index + 1}</div>
                  <div style={{ color: C.muted, fontSize: 12, lineHeight: 1.7 }}>{text}</div>
                </div>
              ))}
            </div>
            <button onClick={() => setLockedDevice(null)} style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: 'none', background: C.mint, color: C.ink, fontFamily: "'Pretendard', system-ui, sans-serif", fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>확인</button>
          </div>
        </div>
      )}
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

  if (error) return <ErrorBlock message={error} />
  if (!data) return <LoadingBlock />

  const summaryData = data.rows.map((row) => row.focus_minutes / 60)
  const hasRows = data.rows.length > 0
  const trackedMinutes = data.totals.pc_minutes + data.totals.focus_minutes + data.totals.development_minutes
  const totalHours = Math.round(trackedMinutes / 60)
  const activityTotals = [
    { label: 'PC 사용', minutes: data.totals.pc_minutes, color: C.mint },
    { label: '공부', minutes: data.totals.focus_minutes, color: C.mintBright },
    { label: '개발', minutes: data.totals.development_minutes, color: C.mint },
  ]
  const maxActivityMinutes = Math.max(1, ...activityTotals.map((item) => item.minutes))
  const activityStats = [
    ...activityTotals.map((item) => ({ label: item.label, val: fmtMinutes(item.minutes), pct: Math.round((item.minutes / maxActivityMinutes) * 100), color: item.color })),
    { label: 'GitHub', val: `${data.totals.github_commits.toLocaleString()}커밋`, pct: 0, color: C.mint },
  ]
  const compare = [
    { label: '공부 시간', d1: fmtMinutes(data.first.focus_minutes), d100: fmtMinutes(data.last.focus_minutes) },
    { label: '개발 시간', d1: fmtMinutes(data.first.development_minutes), d100: fmtMinutes(data.last.development_minutes) },
  ]

  return (
    <div style={{ padding: '48px 40px' }}>
      {/* Hero */}
      <div style={{ textAlign: 'center', marginBottom: 64 }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: C.alt, letterSpacing: '0.3em', marginBottom: 16 }}>하루핏</div>
        <div style={{ fontSize: 88, fontWeight: 900, color: C.white, letterSpacing: '-0.04em', lineHeight: 0.9, marginBottom: 16 }}>완료</div>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 16, color: C.mint, marginBottom: 48 }}>100 / 100</div>

        <div style={{ fontSize: 60, fontWeight: 900, color: C.white, letterSpacing: '-0.03em', lineHeight: 1 }}>{totalHours.toLocaleString()}</div>
        <div style={{ fontSize: 14, fontWeight: 900, color: C.white, letterSpacing: '0.1em', marginBottom: 4 }}>시간</div>
        <div style={{ fontSize: 11, color: C.alt }}>1~100일 동안 기록된 활동 총합입니다</div>

        {/* mini trend */}
        <div style={{ maxWidth: 500, margin: '28px auto 0', opacity: 0.6 }}>
          {hasRows ? <AreaChart data={summaryData} maxVal={10} color={C.mint} h={40} /> : <EmptyChart height={40} />}
        </div>
        <div style={{ fontSize: 10, color: '#333', fontFamily: "'JetBrains Mono', monospace", marginTop: 4 }}>공부 시간 — 실제 기록 기반</div>
      </div>

      {/* Totals */}
      <div style={{ background: C.raised, borderRadius: 14, padding: '28px', border: `1px solid ${C.border}`, marginBottom: 40 }}>
        <div style={{ fontSize: 11, color: C.soft, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.08em', marginBottom: 20, fontWeight: 700 }}>1~100일 활동 총합</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
          {activityStats.map((s) => (
            <div key={s.label} style={{ background: C.surface, borderRadius: 12, padding: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: s.pct ? 12 : 0 }}>
                <span style={{ fontSize: 12, color: C.muted, fontWeight: 700 }}>{s.label}</span>
                <span style={{ fontSize: 22, fontWeight: 900, color: s.color, letterSpacing: '-0.02em' }}>{s.val}</span>
              </div>
              {s.pct > 0 && (
                <div style={{ height: 4, background: C.border, borderRadius: 4 }}>
                  <div style={{ width: `${s.pct}%`, height: '100%', background: s.color, borderRadius: 4 }} />
                </div>
              )}
            </div>
          ))}
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
  if (!data.length) return <EmptyChart height={28} />
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
  if (!data.length) return <EmptyChart height={h} />
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
  if (!a.length && !b.length) return <EmptyChart height={h} />
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

function LineChartSVG({ data, labels, maxVal, color, h }: { data: number[]; labels?: string[]; maxVal: number; color: string; h: number }) {
  if (!data.length) return <EmptyChart height={h} />
  const W = 420
  const padLeft = 36
  const padRight = 8
  const padTop = 10
  const padBottom = 24
  const chartW = W - padLeft - padRight
  const chartH = h - padTop - padBottom
  const denom = Math.max(1, data.length - 1)
  const max = Math.max(1, maxVal)
  const points = data.map((v, i) => {
    const x = padLeft + (i / denom) * chartW
    const y = padTop + chartH - (v / max) * chartH
    return { x, y, v }
  })
  const line = points.map((p) => `${p.x},${p.y}`).join(' ')
  const active = points.filter((p) => p.v > 0)
  const yTicks = [max, max / 2, 0]
  const labelStep = Math.max(1, Math.ceil(data.length / 6))

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${h}`} preserveAspectRatio="none" style={{ display: 'block', height: h }}>
      {yTicks.map((tick) => {
        const y = padTop + chartH - (tick / max) * chartH
        return (
          <g key={tick}>
            <line
              x1={padLeft}
              x2={W - padRight}
              y1={y}
              y2={y}
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
            <text x={padLeft - 8} y={y + 3} textAnchor="end" fill={C.alt} fontSize="9" fontFamily="'JetBrains Mono', monospace">
              {formatChartTickMinutes(tick)}
            </text>
          </g>
        )
      })}
      {points.map((p, i) => {
        const show = i === 0 || i === points.length - 1 || i % labelStep === 0
        if (!show) return null
        return (
          <text key={`label-${i}`} x={p.x} y={h - 5} textAnchor="middle" fill={C.alt} fontSize="9" fontFamily="'JetBrains Mono', monospace">
            {labels?.[i] ?? String(i + 1)}
          </text>
        )
      })}
      <polyline
        points={line}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {active.map((p, i) => (
        <circle
          key={`${p.x}-${i}`}
          cx={p.x}
          cy={p.y}
          r={i === active.length - 1 ? 3.2 : 2.4}
          fill={C.raised}
          stroke={color}
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  )
}

function BarChartSVG({ data, maxVal, color, accent, h }: { data: number[]; maxVal: number; color: string; accent?: string; h: number }) {
  if (!data.length) return <EmptyChart height={h} />
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

function IcoGitHubBrand() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .5A11.5 11.5 0 0 0 8.36 22.9c.58.11.79-.25.79-.56v-2.18c-3.22.7-3.9-1.38-3.9-1.38-.53-1.35-1.29-1.71-1.29-1.71-1.06-.72.08-.71.08-.71 1.17.08 1.78 1.2 1.78 1.2 1.04 1.78 2.73 1.27 3.4.97.1-.75.41-1.27.74-1.56-2.57-.29-5.27-1.28-5.27-5.72 0-1.26.45-2.3 1.19-3.11-.12-.29-.52-1.47.11-3.06 0 0 .97-.31 3.17 1.19A10.9 10.9 0 0 1 12 5.88c.98 0 1.96.13 2.88.39 2.2-1.5 3.17-1.19 3.17-1.19.63 1.59.23 2.77.11 3.06.74.81 1.19 1.85 1.19 3.11 0 4.45-2.7 5.42-5.28 5.71.42.36.79 1.07.79 2.16v3.22c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" />
    </svg>
  )
}

function IcoGoogleBrand() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.88 2.69-6.62Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.8.54-1.83.86-3.05.86-2.35 0-4.34-1.58-5.05-3.71H.94v2.33A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.95 10.71A5.41 5.41 0 0 1 3.67 9c0-.59.1-1.16.28-1.71V4.96H.94A9 9 0 0 0 0 9c0 1.45.35 2.82.94 4.04l3.01-2.33Z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .94 4.96l3.01 2.33C4.66 5.16 6.65 3.58 9 3.58Z" />
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
function IcoTrophy({ c }: { c: string }) {
  return <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M4.5 1.5h6v6a3 3 0 0 1-6 0V1.5z" stroke={c} strokeWidth="1.1"/><path d="M4.5 4.5H3a1.5 1.5 0 1 0 0 3h1.5M10.5 4.5H12a1.5 1.5 0 1 1 0 3h-1.5" stroke={c} strokeWidth="1.1"/><path d="M7.5 10.5v2M5 12.5h5" stroke={c} strokeWidth="1.1" strokeLinecap="round"/></svg>
}
function IcoMenu({ c }: { c: string }) {
  return <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M2.5 4.5h13M2.5 9h13M2.5 13.5h13" stroke={c} strokeWidth="1.3" strokeLinecap="round"/></svg>
}



