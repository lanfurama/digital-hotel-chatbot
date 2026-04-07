export type Role = 'user' | 'assistant' | 'tool'

export interface Message {
  id: string
  session_id: string
  role: Role
  content: string | null
  model_used: string | null
  latency_ms: number | null
  created_at: string
}

export interface Session {
  id: string
  title: string | null
  channel: string
  token_count: number
  is_active: boolean
  started_at: string
  updated_at: string
}

export interface User {
  id: string
  name: string
  email: string
  role: string
  department: string | null
  avatar_url: string | null
}

// SSE event types from backend
export type SSEEvent =
  | { type: 'model'; model: string }
  | { type: 'sources'; sources: Array<{ title: string; score: number }> }
  | { type: 'token'; content: string }
  | { type: 'tool_call'; tool: string }
  | { type: 'tool_result'; result: string }
  | { type: 'done'; session_id: string; message_id: string; latency_ms: number; tokens: number }
  | { type: 'error'; message: string }

// Local streaming message (in-progress)
export interface StreamingMessage {
  role: 'assistant'
  content: string
  model?: string
  sources?: Array<{ title: string; score: number }>
  activeTools?: string[]
  isStreaming: boolean
  latency_ms?: number
}
