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

export default function ChatPage() {
  const router = useRouter()
  const { user, loading, logout } = useAuth()

  const [sessionId, setSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [streaming, setStreaming] = useState<StreamingMessage | null>(null)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const bottomRef = useRef<HTMLDivElement>(null)

  // Redirect nếu chưa đăng nhập
  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login')
    }
  }, [loading, user, router])

  // Auto scroll xuống cuối
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streaming?.content])

  // Load messages khi chọn session
  const handleSelectSession = async (id: string) => {
    setSessionId(id)
    setStreaming(null)
    setError(null)
    try {
      const msgs = await chatApi.messages(id)
      setMessages(msgs)
    } catch {
      setError('Không tải được tin nhắn')
    }
  }

  const handleNewChat = () => {
    setSessionId(null)
    setMessages([])
    setStreaming(null)
    setError(null)
  }

  const handleSend = async (message: string) => {
    if (isSending) return
    setIsSending(true)
    setError(null)

    // Hiện message user ngay lập tức (optimistic)
    const tempUserMsg: Message = {
      id: crypto.randomUUID(),
      session_id: sessionId ?? '',
      role: 'user',
      content: message,
      model_used: null,
      latency_ms: null,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, tempUserMsg])

    // Khởi tạo streaming message
    const streamMsg: StreamingMessage = {
      role: 'assistant',
      content: '',
      isStreaming: true,
    }
    setStreaming(streamMsg)

    try {
      const response = await fetchSSE(message, sessionId ?? undefined)

      if (!response.ok) {
        throw new Error('Request thất bại')
      }

      let newSessionId = sessionId
      let finalContent = ''

      await parseSSEStream(
        response,
        (event) => {
          if (event.type === 'model') {
            setStreaming((prev) => prev ? { ...prev, model: event.model } : prev)
          } else if (event.type === 'sources') {
            setStreaming((prev) => prev ? { ...prev, sources: event.sources } : prev)
          } else if (event.type === 'tool_call') {
            setStreaming((prev) => prev ? { ...prev, activeTools: [...(prev.activeTools ?? []), event.tool] } : prev)
          } else if (event.type === 'tool_result') {
            setStreaming((prev) => prev ? { ...prev, activeTools: [] } : prev)
          } else if (event.type === 'token') {
            finalContent += event.content
            setStreaming((prev) =>
              prev ? { ...prev, content: prev.content + event.content } : prev
            )
          } else if (event.type === 'done') {
            newSessionId = event.session_id
            setStreaming((prev) =>
              prev ? { ...prev, isStreaming: false, latency_ms: event.latency_ms } : prev
            )
          } else if (event.type === 'error') {
            setError(event.message)
          }
        },
        () => {
          // Stream done: chuyển streaming → messages list
          setStreaming(null)
          if (newSessionId) {
            setSessionId(newSessionId)
            // Reload messages từ server để có id chính xác
            chatApi.messages(newSessionId).then(setMessages).catch(() => {})
          }
        },
      )
    } catch (err) {
      setError('Gửi tin nhắn thất bại. Vui lòng thử lại.')
      setStreaming(null)
      // Xóa optimistic message
      setMessages((prev) => prev.filter((m) => m.id !== tempUserMsg.id))
    } finally {
      setIsSending(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <SessionSidebar
        currentSessionId={sessionId}
        onSelectSession={handleSelectSession}
        onNewChat={handleNewChat}
        user={user}
        onLogout={logout}
      />

      {/* Main chat area */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="bg-white border-b border-gray-100 px-6 py-3 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800 text-sm">
            {sessionId ? 'Cuộc trò chuyện' : 'Cuộc trò chuyện mới'}
          </h2>
          {sessionId && (
            <button
              onClick={handleNewChat}
              className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Mới
            </button>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="max-w-3xl mx-auto space-y-6">
            {/* Empty state */}
            {messages.length === 0 && !streaming && (
              <div className="text-center py-16">
                <div className="w-14 h-14 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-7 h-7 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-700">Xin chào, {user.name.split(' ').pop()}!</h3>
                <p className="text-gray-400 mt-1 text-sm">Hỏi bất cứ điều gì về quy trình, tài liệu hoặc công việc.</p>
                <div className="mt-6 flex flex-wrap gap-2 justify-center">
                  {['Quy trình check-in là gì?', 'Tạo task cho tôi', 'Tóm tắt chính sách giá phòng'].map((q) => (
                    <button
                      key={q}
                      onClick={() => handleSend(q)}
                      disabled={isSending}
                      className="text-sm bg-white border border-gray-200 hover:border-indigo-300 hover:text-indigo-600 text-gray-600 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Message list */}
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}

            {/* Streaming message */}
            {streaming && <MessageBubble message={streaming} />}

            {/* Error */}
            {error && (
              <div className="flex justify-center">
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-2 rounded-lg">
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
