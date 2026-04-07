const BASE = process.env.NEXT_PUBLIC_API_URL ?? '/api/v1'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail ?? 'Request thất bại')
  }
  return res.json()
}

// Auth
export const auth = {
  me: () => request<import('@/types/chat').User>('/auth/me'),
  googleLoginUrl: () => request<{ url: string }>('/auth/google'),
  refresh: () => request<{ access_token: string }>('/auth/refresh', { method: 'POST' }),
  logout: () => request('/auth/logout', { method: 'POST' }),
}

// Chat
export const chat = {
  sessions: () => request<import('@/types/chat').Session[]>('/chat/sessions'),
  messages: (sessionId: string) =>
    request<import('@/types/chat').Message[]>(`/chat/sessions/${sessionId}/messages`),
  deleteSession: (sessionId: string) =>
    request(`/chat/sessions/${sessionId}`, { method: 'DELETE' }),
}

// Tasks & Projects
export const tasks = {
  list: (params?: { project_id?: string; assigned_to_me?: boolean }) => {
    const qs = new URLSearchParams()
    if (params?.project_id) qs.set('project_id', params.project_id)
    if (params?.assigned_to_me) qs.set('assigned_to_me', 'true')
    return request<import('@/types/task').Task[]>(`/tasks?${qs}`)
  },
  create: (body: object) => request<import('@/types/task').Task>('/tasks', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: object) => request<import('@/types/task').Task>(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (id: string) => request(`/tasks/${id}`, { method: 'DELETE' }),
  projects: () => request<import('@/types/task').Project[]>('/projects'),
}

// Reminders
export const reminders = {
  list: () => request<import('@/types/task').Reminder[]>('/reminders'),
  create: (body: object) => request<import('@/types/task').Reminder>('/reminders', { method: 'POST', body: JSON.stringify(body) }),
  delete: (id: string) => request(`/reminders/${id}`, { method: 'DELETE' }),
}

// Admin
export const admin = {
  stats: () => request<Record<string, number>>('/admin/stats'),
  users: () => request<import('@/types/chat').User[]>('/admin/users'),
  changeRole: (userId: string, role: string) =>
    request(`/admin/users/${userId}/role?role=${role}`, { method: 'PUT' }),
  auditLogs: (limit = 100) => request<object[]>(`/admin/audit-logs?limit=${limit}`),
}

// Widget clients
export const clients = {
  list: () => request<import('@/types/client').ClientOut[]>('/widget/clients'),
  create: (body: object) => request<import('@/types/client').ClientOut>('/widget/clients', { method: 'POST', body: JSON.stringify(body) }),
  disable: (id: string) => request(`/widget/clients/${id}`, { method: 'DELETE' }),
  triggerCrawl: (id: string, url: string) =>
    request(`/widget/clients/${id}/crawl?url=${encodeURIComponent(url)}`, { method: 'POST' }),
  crawlJobs: (id: string) => request<object[]>(`/widget/clients/${id}/crawl-jobs`),
}

// Raw fetch cho SSE (POST)
export function fetchSSE(message: string, sessionId?: string): Promise<Response> {
  return fetch(`${BASE}/chat/message`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, session_id: sessionId ?? null }),
  })
}
