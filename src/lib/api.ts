const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api'

export type DashboardMetric = {
  minutes?: number
  display?: string
  value?: number
  commits?: number
  delta: number
}

export type DashboardData = {
  day: number
  date: string
  metrics: Record<'pc' | 'phone' | 'focus' | 'steps' | 'exercise' | 'development' | 'github', DashboardMetric>
  apps: { name: string; source: string; minutes: number }[]
  appClassifications: AppClassification[]
  events: { time: string; label: string; type: string }[]
  recent: TimelineEntry[]
}

export type ChallengeData = {
  id: number
  name: string
  start_date: string
  target_days: number
  currentDay: number
  completedDays: number
  remainingDays: number
}

export type TimelineEntry = {
  day_number: number
  date: string
  pc_minutes: number
  phone_minutes: number
  focus_minutes: number
  steps: number
  exercise_minutes: number
  development_minutes: number
  github_commits: number
}

export type AnalyticsData = {
  days: number
  rows: TimelineEntry[]
  topApps: { name: string; minutes: number }[]
}

export type DeviceData = {
  id: number
  kind: string
  name: string
  platform: string
  status: string
  last_sync: string | null
  source: string | null
}

export type AuthUser = {
  id: number
  email: string | null
  name: string
  avatarUrl: string | null
  providers: string[]
}

export type DevicePairingData = {
  token: string
  expires_at: string
}

export type FocusSession = {
  id: number
  day_number: number
  category: string
  note: string
  started_at: string
  ended_at: string | null
  duration_minutes: number
}

export type StudyCategory = {
  id: number
  name: string
}

export type StudySettings = {
  daily_focus_goal_minutes: number
}

export type AppClassification = {
  name: string
  category: 'focus' | 'development'
}

export type ResultData = {
  totals: {
    pc_minutes: number
    phone_minutes: number
    focus_minutes: number
    steps: number
    exercise_minutes: number
    development_minutes: number
    github_commits: number
  }
  first: TimelineEntry
  last: TimelineEntry
  rows: TimelineEntry[]
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
  })
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`)
  if (res.status === 204) return undefined as T
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}

export const api = {
  health: () => request<{ ok: boolean; database: string }>('/health'),
  me: () => request<{ user: AuthUser | null }>('/auth/me'),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),
  challenge: () => request<ChallengeData>('/challenge'),
  dashboard: (day = 37) => request<DashboardData>(`/dashboard/today?day=${day}`),
  timeline: () => request<TimelineEntry[]>('/timeline'),
  analytics: (days = 30) => request<AnalyticsData>(`/analytics?days=${days}`),
  devices: () => request<DeviceData[]>('/devices'),
  createDevicePairing: (data: { kind: string; name: string; platform: string }) => request<DevicePairingData>('/devices/pairing', { method: 'POST', body: JSON.stringify(data) }),
  connectDevice: (data: { token: string }) => request<DeviceData>('/devices/connect', { method: 'POST', body: JSON.stringify(data) }),
  disconnectDevice: (id: number) => request<void>(`/devices/${id}`, { method: 'DELETE' }),
  trackBrowser: (data: { minutes: number; app_name: string }) => request<{ ok: boolean }>('/track/browser', { method: 'POST', body: JSON.stringify(data) }),
  appClassifications: () => request<AppClassification[]>('/app-classifications'),
  addAppClassification: (data: { app_name: string; category: 'focus' | 'development' }) => request<AppClassification>('/app-classifications', { method: 'POST', body: JSON.stringify(data) }),
  deleteAppClassification: (appName: string, category: 'focus' | 'development') => request<void>(`/app-classifications/${encodeURIComponent(appName)}/${category}`, { method: 'DELETE' }),
  studyCategories: () => request<StudyCategory[]>('/study/categories'),
  addStudyCategory: (data: { name: string }) => request<StudyCategory>('/study/categories', { method: 'POST', body: JSON.stringify(data) }),
  studySettings: () => request<StudySettings>('/study/settings'),
  updateStudySettings: (data: StudySettings) => request<StudySettings>('/study/settings', { method: 'POST', body: JSON.stringify(data) }),
  focusSessions: (day = 37) => request<FocusSession[]>(`/focus/sessions?day=${day}`),
  addFocusSession: (data: unknown) => request<FocusSession>('/focus/sessions', { method: 'POST', body: JSON.stringify(data) }),
  result: () => request<ResultData>('/result'),
}
