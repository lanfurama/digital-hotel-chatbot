'use client'
import { useEffect, useState } from 'react'
import { chat } from '@/lib/api'
import type { Session, User } from '@/types/chat'

interface Props {
  currentSessionId: string | null
  onSelectSession: (id: string) => void
  onNewChat: () => void
  user: User
  onLogout: () => void
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Vừa xong'
  if (mins < 60) return `${mins} phút trước`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} giờ trước`
  return `${Math.floor(hrs / 24)} ngày trước`
}

export default function SessionSidebar({ currentSessionId, onSelectSession, onNewChat, user, onLogout }: Props) {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    chat.sessions()
      .then(setSessions)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [currentSessionId]) // Reload khi session thay đổi

  return (
    <aside className="w-64 bg-slate-900 flex flex-col h-full flex-shrink-0">
      {/* Header */}
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <span className="text-white font-semibold text-sm">Hotel Chatbot</span>
        </div>
        <button
          onClick={onNewChat}
          className="w-full flex items-center gap-2 text-sm text-slate-300 hover:text-white hover:bg-slate-700 px-3 py-2 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Cuộc trò chuyện mới
        </button>
        <div className="flex gap-1 mt-2">
          <a href="/tasks" className="flex-1 flex items-center justify-center gap-1 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-700 py-1.5 rounded-lg transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            Tasks
          </a>
          {user.role === 'admin' && (
            <a href="/admin" className="flex-1 flex items-center justify-center gap-1 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-700 py-1.5 rounded-lg transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
              Admin
            </a>
          )}
        </div>
      </div>

      {/* Sessions list */}
      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="text-slate-500 text-xs text-center mt-4">Đang tải...</div>
        ) : sessions.length === 0 ? (
          <div className="text-slate-500 text-xs text-center mt-4">Chưa có cuộc hội thoại</div>
        ) : (
          <ul className="space-y-0.5">
            {sessions.map((s) => (
              <li key={s.id}>
                <button
                  onClick={() => onSelectSession(s.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors group ${
                    s.id === currentSessionId
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  <p className="truncate font-medium leading-tight">
                    {s.title ?? 'Cuộc trò chuyện mới'}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">{timeAgo(s.updated_at)}</p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* User profile */}
      <div className="p-3 border-t border-slate-700">
        <div className="flex items-center gap-2">
          {user.avatar_url ? (
            <img src={user.avatar_url} alt={user.name} className="w-8 h-8 rounded-full flex-shrink-0" />
          ) : (
            <div className="w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold">
              {user.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-medium truncate">{user.name}</p>
            <p className="text-slate-400 text-xs truncate">{user.role}</p>
          </div>
          <button
            onClick={onLogout}
            title="Đăng xuất"
            className="text-slate-500 hover:text-slate-300 flex-shrink-0 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  )
}
