'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { chat as chatApi, fetchSSE } from '@/lib/api'
import { parseSSEStream } from '@/lib/sse'
import SessionSidebar from '@/components/sidebar/SessionSidebar'
import MessageBubble from '@/components/chat/MessageBubble'
import ChatInput from '@/components/chat/ChatInput'
import { chatTheme } from '@/lib/chat-theme'
import type { Message, StreamingMessage } from '@/types/chat'

const SUGGESTION_ANIM = ['', 'delay-1', 'delay-2', 'delay-3'] as const

const SUGGESTIONS = [
  'Quy trình check-in là gì?',
  'Tạo task cho tôi',
  'Tóm tắt chính sách giá phòng',
  'Hướng dẫn xử lý khiếu nại',
]

export default function ChatPage() {
  const router = useRouter()
  const { user, loading, logout } = useAuth()

  const [sessionId, setSessionId]     = useState<string | null>(null)
  const [messages, setMessages]       = useState<Message[]>([])
  const [streaming, setStreaming]     = useState<StreamingMessage | null>(null)
  const [isSending, setIsSending]     = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [loading, user, router])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streaming?.content])

  const handleSelectSession = async (id: string) => {
    setSessionId(id); setStreaming(null); setError(null)
    try { setMessages(await chatApi.messages(id)) }
    catch { setError('Không tải được tin nhắn') }
  }

  const handleNewChat = () => {
    setSessionId(null); setMessages([]); setStreaming(null); setError(null)
  }

  const handleSend = async (message: string) => {
    if (isSending) return
    setIsSending(true); setError(null)

    const tempUserMsg: Message = {
      id: crypto.randomUUID(), session_id: sessionId ?? '',
      role: 'user', content: message,
      model_used: null, latency_ms: null, created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, tempUserMsg])
    setStreaming({
      role: 'assistant',
      content: '',
      isStreaming: true,
      created_at: new Date().toISOString(),
    })

    try {
      const response = await fetchSSE(message, sessionId ?? undefined)
      if (!response.ok) throw new Error()

      let newSessionId = sessionId
      await parseSSEStream(response, event => {
        if (event.type === 'model')        setStreaming(p => p ? { ...p, model: event.model } : p)
        else if (event.type === 'sources') setStreaming(p => p ? { ...p, sources: event.sources } : p)
        else if (event.type === 'tool_call') setStreaming(p => p ? { ...p, activeTools: [...(p.activeTools ?? []), event.tool] } : p)
        else if (event.type === 'tool_result') setStreaming(p => p ? { ...p, activeTools: [] } : p)
        else if (event.type === 'token')   setStreaming(p => p ? { ...p, content: p.content + event.content } : p)
        else if (event.type === 'done')    { newSessionId = event.session_id; setStreaming(p => p ? { ...p, isStreaming: false, latency_ms: event.latency_ms } : p) }
        else if (event.type === 'error')   setError(event.message)
      }, () => {
        setStreaming(null)
        if (newSessionId) {
          setSessionId(newSessionId)
          chatApi.messages(newSessionId).then(setMessages).catch(() => {})
        }
      })
    } catch {
      setError('Gửi tin nhắn thất bại. Vui lòng thử lại.')
      setStreaming(null)
      setMessages(prev => prev.filter(m => m.id !== tempUserMsg.id))
    } finally {
      setIsSending(false)
    }
  }

  /* Loading */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#EDE9E4]">
        <div
          className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: `${chatTheme.accent} transparent transparent transparent` }}
        />
      </div>
    )
  }

  if (!user) return null

  const firstName = user.name.split(' ').pop() ?? user.name

  return (
    <div className="flex h-screen overflow-hidden bg-[#EDE9E4]">
      {/* Sidebar */}
      <SessionSidebar
        currentSessionId={sessionId}
        onSelectSession={handleSelectSession}
        onNewChat={handleNewChat}
        user={user}
        onLogout={logout}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">

        <header
          className="flex items-center gap-3 px-4 py-3 flex-shrink-0 border-b border-stone-200/90"
          style={{
            background: chatTheme.surfaceWarm,
            backgroundImage: `linear-gradient(180deg, ${chatTheme.surfaceWarm} 0%, rgba(245,243,240,0.85) 100%)`,
            backdropFilter: 'saturate(160%) blur(16px)',
            WebkitBackdropFilter: 'saturate(160%) blur(16px)',
          }}
        >
          <button
            type="button"
            className="md:hidden w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-stone-200/60 text-stone-600 active:scale-95 transition-all duration-200"
            onClick={() => setSidebarOpen(true)}
            aria-label="Mở menu"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h10" />
            </svg>
          </button>

          <div className="flex-1 min-w-0">
            <h2 className="text-[15px] font-semibold text-stone-900 tracking-tight truncate">
              {sessionId ? 'Cuộc trò chuyện' : 'Cuộc trò chuyện mới'}
            </h2>
            <p className="text-[11px] text-stone-500 truncate hidden sm:block">
              {sessionId ? 'Tiếp tục hội thoại với trợ lý khách sạn' : 'Hỏi quy trình, tài liệu hoặc tạo task'}
            </p>
          </div>

          {sessionId && (
            <button
              type="button"
              onClick={handleNewChat}
              className="flex items-center gap-1.5 text-[13px] font-medium px-3 py-2 rounded-xl flex-shrink-0 border border-amber-900/10 shadow-sm transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
              style={{ backgroundColor: chatTheme.accentSoft, color: chatTheme.accent }}
            >
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              Mới
            </button>
          )}
        </header>

        <div
          className="flex-1 overflow-y-auto px-4 py-6 bg-[#EDE9E4]"
          style={{
            backgroundImage: 'radial-gradient(ellipse 120% 80% at 50% -20%, rgba(186,117,23,0.06), transparent 55%)',
          }}
        >
          <div className="max-w-3xl mx-auto space-y-3">

            {/* Empty state */}
            {messages.length === 0 && !streaming && (
              <div className="flex flex-col items-center text-center py-14 sm:py-16 anim-fade-up">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5 shadow-sm"
                  style={{
                    background: `linear-gradient(145deg, ${chatTheme.accent} 0%, ${chatTheme.accentDark} 100%)`,
                    boxShadow: `0 10px 28px -4px ${chatTheme.accentGlow}`,
                  }}
                >
                  <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M12 3a1 1 0 0 1 1 1v.27A8.002 8.002 0 0 1 20 12h1a1 1 0 1 1 0 2H3a1 1 0 1 1 0-2h1a8.002 8.002 0 0 1 7-7.73V4a1 1 0 0 1 1-1ZM5 16h14v1.5H5V16ZM4 19h16v1.5H4V19Z" />
                  </svg>
                </div>

                <h3 className="text-2xl font-semibold text-stone-900 tracking-tight mb-2">
                  Xin chào, {firstName}!
                </h3>
                <p className="text-[15px] max-w-sm leading-relaxed text-stone-600 px-2">
                  Hỏi bất cứ điều gì về quy trình, tài liệu hoặc nghiệp vụ khách sạn.
                </p>

                <div className="flex flex-wrap gap-2 justify-center mt-8 max-w-lg px-2">
                  {SUGGESTIONS.map((q, i) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => handleSend(q)}
                      disabled={isSending}
                      className={[
                        'text-[13px] px-3.5 py-2.5 rounded-2xl border border-stone-200/90 bg-white/85 text-stone-700 shadow-sm',
                        'transition-all duration-200 ease-in-out hover:bg-amber-50/90 hover:border-amber-900/15 hover:text-[#9a6212] hover:shadow',
                        'disabled:opacity-40 disabled:pointer-events-none active:scale-[0.98] anim-fade-up',
                        SUGGESTION_ANIM[i] ?? '',
                      ].join(' ')}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map(msg => <MessageBubble key={msg.id} message={msg} />)}
            {streaming && <MessageBubble message={streaming} />}

            {error && (
              <div className="flex justify-center anim-scale-in">
                <div
                  className="text-[13px] px-4 py-2.5 rounded-2xl"
                  style={{
                    background: 'rgba(255,59,48,0.07)',
                    border: '1px solid rgba(255,59,48,0.18)',
                    color: '#D70015',
                  }}
                >
                  {error}
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        </div>

        {/* Input */}
        <ChatInput onSend={handleSend} disabled={isSending} />
      </main>
    </div>
  )
}
