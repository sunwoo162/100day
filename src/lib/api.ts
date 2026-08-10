const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api'

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
  dashboard: (day = 37) => request(`/dashboard/today?day=${day}`),
  timeline: () => request('/timeline'),
  analytics: (days = 30) => request(`/analytics?days=${days}`),
  devices: () => request('/devices'),
  focusSessions: (day = 37) => request(`/focus/sessions?day=${day}`),
  addFocusSession: (data: unknown) => request('/focus/sessions', { method: 'POST', body: JSON.stringify(data) }),
  checkin: (day = 37) => request(`/checkins?day=${day}`),
  saveCheckin: (data: unknown) => request('/checkins', { method: 'POST', body: JSON.stringify(data) }),
  result: () => request('/result'),
}
