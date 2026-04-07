'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { chat as chatApi, fetchSSE } from '@/lib/api'
import { parseSSEStream } from '@/lib/sse'
import SessionSidebar from '@/components/sidebar/SessionSidebar'
import MessageBubble from '@/components/chat/MessageBubble'
import ChatInput from '@/components/chat/ChatInput'
import type { Message, StreamingMessage } from '@/types/chat'

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
    setStreaming({ role: 'assistant', content: '', isStreaming: true })

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
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#F2F2F7' }}>
        <div
          className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: '#007AFF transparent transparent transparent' }}
        />
      </div>
    )
  }

  if (!user) return null

  const firstName = user.name.split(' ').pop() ?? user.name

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#EAEAEF' }}>
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

        {/* Navigation bar — frosted glass */}
        <div
          className="flex items-center gap-2 px-4 py-3 flex-shrink-0"
          style={{
            background: 'rgba(234,234,239,0.88)',
            backdropFilter: 'saturate(180%) blur(20px)',
            WebkitBackdropFilter: 'saturate(180%) blur(20px)',
            borderBottom: '1px solid rgba(30,30,50,0.1)',
          }}
        >
          {/* Hamburger */}
          <button
            className="md:hidden w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 active:opacity-50 transition-opacity"
            style={{ background: 'rgba(30,30,50,0.08)', color: 'rgba(30,30,50,0.6)' }}
            onClick={() => setSidebarOpen(true)}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h10" />
            </svg>
          </button>

          <h2 className="flex-1 text-[15px] font-semibold text-black tracking-[-0.2px] truncate">
            {sessionId ? 'Cuộc trò chuyện' : 'Cuộc trò chuyện mới'}
          </h2>

          {sessionId && (
            <button
              onClick={handleNewChat}
              className="flex items-center gap-1.5 text-[13px] font-medium px-3 py-1.5 rounded-xl transition-all active:opacity-50 flex-shrink-0"
              style={{ background: 'rgba(0,122,255,0.1)', color: '#007AFF' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,122,255,0.16)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,122,255,0.1)')}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              Mới
            </button>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-5" style={{ background: '#EAEAEF' }}>
          <div className="max-w-3xl mx-auto space-y-3">

            {/* Empty state */}
            {messages.length === 0 && !streaming && (
              <div className="flex flex-col items-center text-center py-16 anim-fade-up">
                <div
                  className="w-16 h-16 rounded-[22px] flex items-center justify-center mb-5"
                  style={{
                    background: 'linear-gradient(145deg, #007AFF 0%, #5E5CE6 100%)',
                    boxShadow: '0 8px 28px rgba(0,122,255,0.25)',
                  }}
                >
                  <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 3a1 1 0 0 1 1 1v.27A8.002 8.002 0 0 1 20 12h1a1 1 0 1 1 0 2H3a1 1 0 1 1 0-2h1a8.002 8.002 0 0 1 7-7.73V4a1 1 0 0 1 1-1ZM5 16h14v1.5H5V16ZM4 19h16v1.5H4V19Z" />
                  </svg>
                </div>

                <h3 className="text-[22px] font-semibold text-black tracking-[-0.4px] mb-1.5">
                  Xin chào, {firstName}!
                </h3>
                <p className="text-[15px] max-w-xs leading-relaxed" style={{ color: 'rgba(30,30,50,0.55)' }}>
                  Hỏi bất cứ điều gì về quy trình, tài liệu hoặc nghiệp vụ khách sạn.
                </p>

                <div className="flex flex-wrap gap-2 justify-center mt-6 max-w-sm">
                  {SUGGESTIONS.map((q, i) => (
                    <button
                      key={q}
                      onClick={() => handleSend(q)}
                      disabled={isSending}
                      className={`text-[13px] px-3.5 py-2 rounded-2xl transition-all duration-150 disabled:opacity-40 active:scale-95 anim-fade-up delay-${i + 1}`}
                      style={{
                        background: '#F0EFF5',
                        border: '1px solid rgba(30,30,50,0.09)',
                        color: 'rgba(30,30,50,0.65)',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                      }}
                      onMouseEnter={e => {
                        ;(e.currentTarget as HTMLElement).style.background = 'rgba(0,122,255,0.07)'
                        ;(e.currentTarget as HTMLElement).style.color = '#007AFF'
                        ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,122,255,0.2)'
                      }}
                      onMouseLeave={e => {
                        ;(e.currentTarget as HTMLElement).style.background = '#F0EFF5'
                        ;(e.currentTarget as HTMLElement).style.color = 'rgba(30,30,50,0.65)'
                        ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(30,30,50,0.09)'
                      }}
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
