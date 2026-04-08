import type { Message, StreamingMessage } from '@/types/chat'
import { chatTheme } from '@/lib/chat-theme'
import { formatMessageDateTime } from '@/lib/format-message-time'
import { formatChatModelLabel } from '@/lib/model-display'

interface Props {
  message: Message | StreamingMessage
}

function isStreaming(m: Message | StreamingMessage): m is StreamingMessage {
  return 'isStreaming' in m
}

function TypingDots() {
  return (
    <span className="inline-flex items-end gap-1 h-4">
      <span className="typing-dot" />
      <span className="typing-dot" />
      <span className="typing-dot" />
    </span>
  )
}

export default function MessageBubble({ message }: Props) {
  const isUser      = message.role === 'user'
  const content     = message.content ?? ''
  const streaming   = isStreaming(message) && message.isStreaming
  const sources     = isStreaming(message) ? message.sources : undefined
  const activeTools = isStreaming(message) ? message.activeTools : undefined
  const model = isStreaming(message) ? message.model : (message as Message).model_used
  const modelLabel = formatChatModelLabel(model ?? undefined)
  const latencyMs = isStreaming(message)
    ? message.latency_ms
    : (message as Message).latency_ms
  const createdAt = isStreaming(message)
    ? message.created_at
    : (message as Message).created_at
  const timeLabel = formatMessageDateTime(createdAt ?? null)

  return (
    <div className={`flex gap-2.5 anim-fade-up ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* AI Avatar */}
      {!isUser && (
        <div
          className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5 shadow-sm ring-2 ring-white"
          style={{ background: `linear-gradient(145deg, ${chatTheme.accent}, ${chatTheme.accentDark})` }}
        >
          <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 3a1 1 0 0 1 1 1v.27A8.002 8.002 0 0 1 20 12h1a1 1 0 1 1 0 2H3a1 1 0 1 1 0-2h1a8.002 8.002 0 0 1 7-7.73V4a1 1 0 0 1 1-1ZM5 16h14v1.5H5V16ZM4 19h16v1.5H4V19Z" />
          </svg>
        </div>
      )}

      <div className={`flex flex-col gap-1 max-w-[76%] ${isUser ? 'items-end' : 'items-start'}`}>

        {/* Source badges */}
        {sources && sources.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {sources.map((s, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full"
                style={{
                  background: chatTheme.accentSoft,
                  border: `1px solid ${chatTheme.accentBorder}`,
                  color: chatTheme.accent,
                }}
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                {s.title}
              </span>
            ))}
          </div>
        )}

        {/* Tool badges */}
        {activeTools && activeTools.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {activeTools.map((tool, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full"
                style={{
                  background: 'rgba(120,113,108,0.08)',
                  border: '1px solid rgba(120,113,108,0.2)',
                  color: '#57534E',
                }}
              >
                <svg className="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {tool}
              </span>
            ))}
          </div>
        )}

        {/* Bubble */}
        <div
          className="px-4 py-2.5 rounded-[18px] text-[15px] leading-relaxed whitespace-pre-wrap break-words"
          style={
            isUser
              ? {
                  background: `linear-gradient(145deg, ${chatTheme.accent} 0%, ${chatTheme.accentDark} 100%)`,
                  color: '#fff',
                  borderBottomRightRadius: 4,
                  boxShadow: `0 4px 14px -2px ${chatTheme.accentGlow}`,
                }
              : {
                  background: chatTheme.composer,
                  color: '#1c1917',
                  borderBottomLeftRadius: 4,
                  border: '1px solid rgba(120,113,108,0.12)',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                }
          }
        >
          {!content && streaming ? (
            <TypingDots />
          ) : (
            <>
              {content}
              {streaming && (
                <span
                  className="inline-block w-[2px] h-[14px] ml-0.5 align-middle rounded-full anim-blink"
                  style={{ background: isUser ? 'rgba(255,255,255,0.75)' : chatTheme.accent }}
                />
              )}
            </>
          )}
        </div>

        {timeLabel && (
          <time
            dateTime={createdAt ?? undefined}
            className={[
              'block w-full text-[11px] px-1 text-stone-500 tabular-nums',
              isUser ? 'text-end' : 'text-start',
            ].join(' ')}
            title={createdAt ?? undefined}
          >
            {timeLabel}
          </time>
        )}

        {!isUser && modelLabel && !streaming && (
          <p className="text-[11px] px-1 text-stone-500 tabular-nums">
            {modelLabel}
            {latencyMs != null ? (
              <span className="opacity-70"> · {latencyMs}ms</span>
            ) : null}
          </p>
        )}
      </div>
    </div>
  )
}
