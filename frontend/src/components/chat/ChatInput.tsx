'use client'
import { useRef, useState, KeyboardEvent } from 'react'
import { chatTheme } from '@/lib/chat-theme'

interface Props {
  onSend: (message: string) => void
  disabled: boolean
}

export default function ChatInput({ onSend, disabled }: Props) {
  const [value, setValue] = useState('')
  const [focused, setFocused] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const submit = () => {
    const msg = value.trim()
    if (!msg || disabled) return
    onSend(msg)
    setValue('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() }
  }

  const handleInput = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'
  }

  const hasValue = value.trim().length > 0

  return (
    <div
      className="flex-shrink-0 px-4 pb-4 pt-3 border-t border-stone-200/80 bg-[#EDE9E4]"
      style={{
        backgroundImage: `linear-gradient(180deg, rgba(237,233,228,0.6) 0%, ${chatTheme.surface} 32%)`,
      }}
    >
      <div className="max-w-3xl mx-auto">
        <div
          className="flex items-end gap-2 rounded-2xl px-4 py-2.5 transition-all duration-200 ease-in-out border shadow-sm"
          style={{
            background: chatTheme.composer,
            borderColor: focused ? chatTheme.accentBorder : 'rgba(120,113,108,0.16)',
            boxShadow: focused
              ? `0 0 0 3px ${chatTheme.accentFocusRing}, 0 4px 14px rgba(0,0,0,0.06)`
              : '0 1px 4px rgba(0,0,0,0.04)',
            opacity: disabled ? 0.6 : 1,
          }}
        >
          <textarea
            ref={textareaRef}
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Nhắn tin cho trợ lý..."
            disabled={disabled}
            rows={1}
            className="flex-1 resize-none bg-transparent text-[15px] text-stone-900 placeholder:text-stone-400 outline-none py-1 max-h-40 leading-[1.55]"
          />

          <button
            type="button"
            onClick={submit}
            disabled={!hasValue || disabled}
            className={[
              'flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 ease-in-out mb-[-1px]',
              hasValue && !disabled
                ? 'text-white shadow-sm hover:scale-105 active:scale-95'
                : 'bg-stone-200/80 text-stone-400 cursor-not-allowed',
            ].join(' ')}
            style={
              hasValue && !disabled
                ? {
                    background: `linear-gradient(145deg, ${chatTheme.accent} 0%, ${chatTheme.accentDark} 100%)`,
                    boxShadow: `0 4px 14px -2px ${chatTheme.accentGlow}`,
                  }
                : undefined
            }
            aria-label="Gửi tin nhắn"
          >
            {disabled ? (
              <div
                className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: `${chatTheme.accent} transparent transparent transparent` }}
              />
            ) : (
              <svg className="w-4 h-4 translate-x-px" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            )}
          </button>
        </div>

        <p className="text-center text-[11px] mt-2 text-stone-500 tracking-tight">
          AI có thể mắc lỗi — kiểm tra trước khi sử dụng thông tin quan trọng.
        </p>
      </div>
    </div>
  )
}
