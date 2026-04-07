import type { Message, StreamingMessage } from '@/types/chat'

interface Props {
  message: Message | StreamingMessage
}

function isStreaming(m: Message | StreamingMessage): m is StreamingMessage {
  return 'isStreaming' in m
}

export default function MessageBubble({ message }: Props) {
  const isUser = message.role === 'user'
  const content = message.content ?? ''
  const streaming = isStreaming(message) && message.isStreaming
  const sources = isStreaming(message) ? message.sources : undefined
  const activeTools = isStreaming(message) ? message.activeTools : undefined
  const model = isStreaming(message) ? message.model : (message as Message).model_used

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold ${
        isUser ? 'bg-indigo-600' : 'bg-slate-600'
      }`}>
        {isUser ? 'B' : 'AI'}
      </div>

      {/* Bubble */}
      <div className={`max-w-[75%] space-y-1.5 ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
        {/* Sources badge */}
        {sources && sources.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {sources.map((s, i) => (
              <span key={i} className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                {s.title}
              </span>
            ))}
          </div>
        )}

        {/* Tool call badges */}
        {activeTools && activeTools.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {activeTools.map((tool, i) => (
              <span key={i} className="inline-flex items-center gap-1 text-xs bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full animate-pulse">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Đang thực hiện: {tool}
              </span>
            ))}
          </div>
        )}

        {/* Content */}
        <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
          isUser
            ? 'bg-indigo-600 text-white rounded-tr-sm'
            : 'bg-white border border-gray-100 text-gray-800 shadow-sm rounded-tl-sm'
        }`}>
          {content}
          {streaming && (
            <span className="inline-block w-0.5 h-4 bg-current ml-0.5 animate-pulse align-middle" />
          )}
          {!content && streaming && (
            <span className="text-gray-400 italic text-xs">Đang tra cứu...</span>
          )}
        </div>

        {/* Meta */}
        {!isUser && model && !streaming && (
          <p className="text-xs text-gray-400 px-1">
            {model.includes('haiku') ? 'Haiku' : 'Sonnet'}
            {isStreaming(message) && message.latency_ms ? ` · ${message.latency_ms}ms` : ''}
          </p>
        )}
      </div>
    </div>
  )
}
