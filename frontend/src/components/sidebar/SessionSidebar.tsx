'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { chat } from '@/lib/api'
import type { Session, User } from '@/types/chat'

/** Hospitality accent — context-aware (lifestyle / hotel). */
const ACCENT = '#BA7517'
const ACCENT_DIM = 'rgba(186, 117, 23, 0.12)'
const ACCENT_RING = 'rgba(186, 117, 23, 0.18)'

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
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    chat.sessions().then(setSessions).catch(() => {}).finally(() => setLoading(false))
  }, [currentSessionId])

  const handleSelect = (id: string) => { onSelectSession(id); onClose?.() }
  const handleNew = () => { onNewChat(); onClose?.() }

  const handleDeleteSession = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    await chat.deleteSession(id)
    setSessions(prev => prev.filter(s => s.id !== id))
  }

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 md:hidden anim-fade-in"
          aria-hidden
          onClick={onClose}
        />
      )}

      <aside
        className={[
          'fixed md:relative inset-y-0 left-0 z-40 md:z-auto',
          'w-[280px] flex flex-col h-full flex-shrink-0',
          'bg-[#F5F3F0] border-r border-stone-200/90',
          'transition-transform duration-300 ease-[cubic-bezier(.32,.72,0,1)]',
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        ].join(' ')}
      >
        <div className="px-4 pt-5 pb-4 flex-shrink-0 border-b border-stone-200/80">
          <div className="flex items-center gap-3 mb-5">
            <div
              className="w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm"
              style={{
                background: `linear-gradient(145deg, ${ACCENT} 0%, #8f5a12 100%)`,
              }}
            >
              <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M12 3a1 1 0 0 1 1 1v.27A8.002 8.002 0 0 1 20 12h1a1 1 0 1 1 0 2H3a1 1 0 1 1 0-2h1a8.002 8.002 0 0 1 7-7.73V4a1 1 0 0 1 1-1ZM5 16h14v1.5H5V16ZM4 19h16v1.5H4V19Z" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold text-stone-900 tracking-tight truncate">Hotel Chatbot</p>
              <p className="text-[11px] text-stone-500 truncate">Lễ tân kỹ thuật số</p>
            </div>
            <button
              type="button"
              className="ml-auto md:hidden w-8 h-8 rounded-xl flex items-center justify-center bg-stone-200/60 text-stone-600 hover:bg-stone-300/70 hover:text-stone-900 transition-colors duration-200"
              onClick={onClose}
              aria-label="Đóng menu"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <button
            type="button"
            onClick={handleNew}
            className="w-full flex items-center justify-center gap-2 text-sm font-medium px-3 py-2.5 rounded-2xl border border-amber-900/10 transition-all duration-200 ease-in-out hover:scale-[1.01] active:scale-[0.99] shadow-sm"
            style={{ backgroundColor: ACCENT_DIM, color: ACCENT }}
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.25} d="M12 4v16m8-8H4" />
            </svg>
            Cuộc trò chuyện mới
          </button>

          <nav className="flex gap-2 mt-3 flex-wrap" aria-label="Trang liên quan">
            <NavLink href="/tasks" label="Tasks" icon={
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            } />
            <NavLink href="/reminders" label="Nhắc nhở" icon={
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            } />
            {user.role === 'admin' && (
              <NavLink href="/admin" label="Admin" icon={
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              } />
            )}
          </nav>
        </div>

        <div className="flex-1 overflow-y-auto py-3 px-3 bg-[#EDE9E4]/75">
          <p className="text-[11px] font-medium text-stone-500 uppercase tracking-wide px-1 mb-2">Gần đây</p>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map(i => (
                <div
                  key={i}
                  className="h-[56px] rounded-2xl bg-white/70 border border-black/5 shadow-sm animate-pulse"
                />
              ))}
            </div>
          ) : sessions.length === 0 ? (
            <div className="rounded-2xl bg-white/60 border border-black/5 shadow-sm px-4 py-8 text-center">
              <div
                className="w-10 h-10 rounded-2xl mx-auto mb-3 flex items-center justify-center"
                style={{ backgroundColor: ACCENT_DIM }}
              >
                <svg className="w-5 h-5" fill="none" stroke={ACCENT} viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-stone-700">Chưa có hội thoại</p>
              <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                Bắt đầu cuộc mới để hỏi khách sạn, task hoặc nhắc nhở.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {sessions.map(s => {
                const active = s.id === currentSessionId
                return (
                  <li key={s.id} className="group">
                    <div
                      className={[
                        'relative rounded-2xl border transition-all duration-200 ease-in-out',
                        active
                          ? 'bg-white shadow-sm border'
                          : 'bg-white/65 border border-black/[0.06] hover:bg-white hover:border-black/[0.08] hover:shadow-sm',
                      ].join(' ')}
                      style={
                        active
                          ? { borderColor: ACCENT_RING, boxShadow: `0 1px 2px rgba(0,0,0,0.04), 0 0 0 2px ${ACCENT_RING}` }
                          : undefined
                      }
                    >
                      <button
                        type="button"
                        onClick={() => handleSelect(s.id)}
                        className="w-full text-left px-3 py-3 flex flex-col gap-0.5 pr-10 rounded-2xl active:scale-[0.99] transition-transform duration-150"
                      >
                        <span
                          className={[
                            'truncate text-[13px] font-medium leading-snug',
                            active ? '' : 'text-stone-800',
                          ].join(' ')}
                          style={active ? { color: ACCENT } : undefined}
                        >
                          {s.title ?? 'Cuộc trò chuyện mới'}
                        </span>
                        <span className="text-[11px] text-stone-500">
                          {timeAgo(s.updated_at)}
                        </span>
                      </button>

                      {!active && (
                        <button
                          type="button"
                          onClick={e => handleDeleteSession(e, s.id)}
                          title="Xoá hội thoại"
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-xl flex items-center justify-center text-stone-400 bg-stone-100/90 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto hover:bg-red-50 hover:text-red-600 focus:opacity-100 focus:pointer-events-auto transition-all duration-200"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
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

        <div className="px-3 py-3 flex items-center gap-3 flex-shrink-0 border-t border-stone-200/80 bg-[#F5F3F0]">
          {user.avatar_url ? (
            <img src={user.avatar_url} alt={user.name} className="w-9 h-9 rounded-full flex-shrink-0 object-cover ring-2 ring-white shadow-sm" />
          ) : (
            <div
              className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-[13px] font-semibold text-white shadow-sm"
              style={{ background: `linear-gradient(135deg, ${ACCENT} 0%, #8f5a12 100%)` }}
              aria-hidden
            >
              {user.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-stone-900 truncate">{user.name}</p>
            <p className="text-[11px] capitalize text-stone-500 truncate">{user.role}</p>
          </div>
          <button
            type="button"
            title="Đăng xuất"
            onClick={onLogout}
            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 bg-stone-200/60 text-stone-600 hover:bg-red-50 hover:text-red-600 transition-colors duration-200"
            aria-label="Đăng xuất"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
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
  const pathname = usePathname()
  const active = pathname === href

  return (
    <Link
      href={href}
      className={[
        'flex-1 min-w-[calc(50%-4px)] flex items-center justify-center gap-1.5 text-[11px] font-medium py-2 px-2 rounded-xl border transition-all duration-200 ease-in-out',
        active
          ? 'border-amber-900/15 bg-amber-50/90 text-[#9a6212] shadow-sm'
          : 'border-transparent bg-black/[0.035] text-stone-600 hover:bg-black/[0.05] hover:text-stone-900',
      ].join(' ')}
    >
      {icon}
      <span className="truncate">{label}</span>
    </Link>
  )
}
