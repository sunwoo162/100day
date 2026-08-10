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
  metrics: Record<'pc' | 'phone' | 'focus' | 'sleep' | 'steps' | 'exercise' | 'development' | 'github', DashboardMetric>
  apps: { name: string; source: string; minutes: number }[]
  events: { time: string; label: string; type: string }[]
}

export type TimelineEntry = {
  day_number: number
  date: string
  pc_minutes: number
  phone_minutes: number
  focus_minutes: number
  sleep_minutes: number
  steps: number
  exercise_minutes: number
  development_minutes: number
  github_commits: number
  focus_score: number | null
  satisfaction_score: number | null
  note: string | null
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

export type FocusSession = {
  id: number
  day_number: number
  category: string
  started_at: string
  ended_at: string | null
  duration_minutes: number
}

export type CheckinData = {
  id: number
  day_number: number
  focus_score: number
  satisfaction_score: number
  note: string
  created_at: string
} | null

export type ResultData = {
  totals: {
    pc_minutes: number
    phone_minutes: number
    focus_minutes: number
    sleep_minutes: number
    steps: number
    exercise_minutes: number
    development_minutes: number
    github_commits: number
  }
  first: TimelineEntry
  last: TimelineEntry
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
  })
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`)
  return res.json()
}

export const api = {
  health: () => request<{ ok: boolean; database: string }>('/health'),
  challenge: () => request('/challenge'),
  dashboard: (day = 37) => request<DashboardData>(`/dashboard/today?day=${day}`),
  timeline: () => request<TimelineEntry[]>('/timeline'),
  analytics: (days = 30) => request<AnalyticsData>(`/analytics?days=${days}`),
  devices: () => request<DeviceData[]>('/devices'),
  focusSessions: (day = 37) => request<FocusSession[]>(`/focus/sessions?day=${day}`),
  addFocusSession: (data: unknown) => request<FocusSession>('/focus/sessions', { method: 'POST', body: JSON.stringify(data) }),
  checkin: (day = 37) => request<CheckinData>(`/checkins?day=${day}`),
  saveCheckin: (data: unknown) => request<NonNullable<CheckinData>>('/checkins', { method: 'POST', body: JSON.stringify(data) }),
  result: () => request<ResultData>('/result'),
}
