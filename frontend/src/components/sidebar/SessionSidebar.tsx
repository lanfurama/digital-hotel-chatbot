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
  isOpen?: boolean
  onClose?: () => void
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

export default function SessionSidebar({
  currentSessionId, onSelectSession, onNewChat, user, onLogout, isOpen = false, onClose,
}: Props) {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading]   = useState(true)
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  useEffect(() => {
    chat.sessions().then(setSessions).catch(() => {}).finally(() => setLoading(false))
  }, [currentSessionId])

  const handleSelect = (id: string) => { onSelectSession(id); onClose?.() }
  const handleNew    = () => { onNewChat(); onClose?.() }

  const handleDeleteSession = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    await chat.deleteSession(id)
    setSessions(prev => prev.filter(s => s.id !== id))
  }

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 md:hidden anim-fade-in"
          style={{ background: 'rgba(0,0,0,0.3)' }}
          onClick={onClose}
        />
      )}

      <aside
        className={[
          'fixed md:relative inset-y-0 left-0 z-40 md:z-auto',
          'w-[260px] flex flex-col h-full flex-shrink-0',
          'transition-transform duration-300 ease-[cubic-bezier(.32,.72,0,1)]',
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        ].join(' ')}
        style={{
          background: '#F2F1F6',
          borderRight: '1px solid rgba(30,30,50,0.1)',
        }}
      >
        {/* Header */}
        <div
          className="px-4 pt-5 pb-3 flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(30,30,50,0.08)' }}
        >
          {/* Brand */}
          <div className="flex items-center gap-3 mb-4">
            <div
              className="w-8 h-8 rounded-[10px] flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(145deg, #007AFF, #5E5CE6)' }}
            >
              <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 3a1 1 0 0 1 1 1v.27A8.002 8.002 0 0 1 20 12h1a1 1 0 1 1 0 2H3a1 1 0 1 1 0-2h1a8.002 8.002 0 0 1 7-7.73V4a1 1 0 0 1 1-1ZM5 16h14v1.5H5V16ZM4 19h16v1.5H4V19Z" />
              </svg>
            </div>
            <span className="text-[15px] font-semibold text-black tracking-[-0.3px]">Hotel Chatbot</span>
            {/* Mobile close */}
            <button
              className="ml-auto md:hidden w-7 h-7 rounded-full flex items-center justify-center transition-colors"
              style={{ background: 'rgba(30,30,50,0.07)', color: 'rgba(30,30,50,0.5)' }}
              onClick={onClose}
              onMouseEnter={e => (e.currentTarget.style.color = '#000')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(60,60,67,0.6)')}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* New chat */}
          <button
            onClick={handleNew}
            className="w-full flex items-center gap-2 text-[14px] font-medium px-3 py-2.5 rounded-2xl transition-all duration-150 active:scale-[0.98]"
            style={{ background: 'rgba(0,122,255,0.08)', color: '#007AFF' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,122,255,0.13)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,122,255,0.08)')}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Cuộc trò chuyện mới
          </button>

          {/* Nav links */}
          <div className="flex gap-1.5 mt-2 flex-wrap">
            <NavLink href="/tasks" label="Tasks" icon={
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            } />
            <NavLink href="/reminders" label="Nhắc nhở" icon={
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            } />
            {user.role === 'admin' && (
              <NavLink href="/admin" label="Admin" icon={
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              } />
            )}
          </div>
        </div>

        {/* Sessions list */}
        <div className="flex-1 overflow-y-auto py-2 px-2" style={{ background: '#EAEAEF' }}>
          {loading ? (
            <div className="space-y-1.5 px-1 pt-1">
              {[1,2,3,4].map(i => (
                <div key={i} className="h-[52px] rounded-2xl bg-white opacity-60" />
              ))}
            </div>
          ) : sessions.length === 0 ? (
            <p className="text-center text-[13px] mt-8 px-4" style={{ color: 'rgba(60,60,67,0.35)' }}>
              Chưa có cuộc hội thoại nào
            </p>
          ) : (
            <ul>
              {sessions.map(s => {
                const active = s.id === currentSessionId
                const hovered = hoveredId === s.id
                return (
                  <li key={s.id}>
                    <div
                      className="relative mb-0.5 rounded-2xl transition-all duration-150"
                      style={{ background: active ? '#F2F1F6' : hovered ? 'rgba(242,241,246,0.7)' : 'transparent' }}
                      onMouseEnter={() => setHoveredId(s.id)}
                      onMouseLeave={() => setHoveredId(null)}
                    >
                      <button
                        onClick={() => handleSelect(s.id)}
                        className="w-full text-left px-3 py-2.5 flex flex-col gap-0.5 active:scale-[0.98] pr-8"
                      >
                        <span
                          className="truncate text-[13px] font-medium leading-tight"
                          style={{ color: active ? '#007AFF' : '#18181B' }}
                        >
                          {s.title ?? 'Cuộc trò chuyện mới'}
                        </span>
                        <span className="text-[11px]" style={{ color: 'rgba(60,60,67,0.4)' }}>
                          {timeAgo(s.updated_at)}
                        </span>
                      </button>

                      {/* Delete button — hiện khi hover, ẩn nếu đang active */}
                      {hovered && !active && (
                        <button
                          onClick={e => handleDeleteSession(e, s.id)}
                          title="Xoá hội thoại"
                          className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center"
                          style={{ color: 'rgba(60,60,67,0.4)', background: 'rgba(30,30,50,0.07)' }}
                          onMouseEnter={e => (e.currentTarget.style.color = '#FF3B30')}
                          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(60,60,67,0.4)')}
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* User footer */}
        <div
          className="px-3 py-3 flex items-center gap-2.5 flex-shrink-0"
          style={{ borderTop: '1px solid rgba(30,30,50,0.08)', background: '#F2F1F6' }}
        >
          {user.avatar_url ? (
            <img src={user.avatar_url} alt={user.name} className="w-8 h-8 rounded-full flex-shrink-0" />
          ) : (
            <div
              className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-[13px] font-semibold text-white"
              style={{ background: 'linear-gradient(135deg, #007AFF, #5E5CE6)' }}
            >
              {user.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-black truncate">{user.name}</p>
            <p className="text-[11px] capitalize truncate" style={{ color: 'rgba(60,60,67,0.45)' }}>{user.role}</p>
          </div>
          <button
            title="Đăng xuất"
            onClick={onLogout}
            className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-colors"
            style={{ background: 'rgba(30,30,50,0.07)', color: 'rgba(30,30,50,0.45)' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#FF3B30')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(30,30,50,0.45)')}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </aside>
    </>
  )
}

function NavLink({ href, label, icon }: { href: string; label: string; icon: React.ReactNode }) {
  return (
    <a
      href={href}
      className="flex-1 flex items-center justify-center gap-1.5 text-[11px] py-2 rounded-xl transition-colors"
      style={{ background: 'rgba(30,30,50,0.06)', color: 'rgba(30,30,50,0.45)' }}
      onMouseEnter={e => {
        ;(e.currentTarget as HTMLElement).style.color = '#007AFF'
        ;(e.currentTarget as HTMLElement).style.background = 'rgba(0,122,255,0.08)'
      }}
      onMouseLeave={e => {
        ;(e.currentTarget as HTMLElement).style.color = 'rgba(30,30,50,0.45)'
        ;(e.currentTarget as HTMLElement).style.background = 'rgba(30,30,50,0.06)'
      }}
    >
      {icon}
      <span>{label}</span>
    </a>
  )
}
