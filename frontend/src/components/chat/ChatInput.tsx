'use client'
import { useRef, useState, KeyboardEvent } from 'react'

interface Props {
  onSend: (message: string) => void
  disabled: boolean
}

export default function ChatInput({ onSend, disabled }: Props) {
  const [value, setValue]     = useState('')
  const [focused, setFocused] = useState(false)
  const textareaRef           = useRef<HTMLTextAreaElement>(null)

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
      className="flex-shrink-0 px-4 pb-4 pt-2"
      style={{ borderTop: '1px solid rgba(30,30,50,0.08)', background: '#EAEAEF' }}
    >
      <div className="max-w-3xl mx-auto">
        <div
          className="flex items-end gap-2 rounded-[22px] px-4 py-2.5 transition-all duration-200"
          style={{
            background: '#F2F1F6',
            border: focused
              ? '1.5px solid rgba(0,122,255,0.4)'
              : '1.5px solid rgba(30,30,50,0.1)',
            boxShadow: focused
              ? '0 0 0 3px rgba(0,122,255,0.08), 0 1px 8px rgba(0,0,0,0.06)'
              : '0 1px 6px rgba(0,0,0,0.05)',
            opacity: disabled ? 0.55 : 1,
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
            placeholder="Nhắn tin..."
            disabled={disabled}
            rows={1}
            className="flex-1 resize-none bg-transparent text-[15px] text-black outline-none py-1 max-h-40"
            style={{
              lineHeight: '1.55',
              color: '#000',
            }}
          />
          <style>{`textarea::placeholder { color: rgba(60,60,67,0.35); }`}</style>

          <button
            onClick={submit}
            disabled={!hasValue || disabled}
            className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 mb-[-1px]"
            style={
              hasValue && !disabled
                ? {
                    background: 'linear-gradient(145deg, #007AFF, #5E5CE6)',
                    color: '#fff',
                    boxShadow: '0 2px 10px rgba(0,122,255,0.35)',
                  }
                : {
                    background: 'rgba(30,30,50,0.08)',
                    color: 'rgba(30,30,50,0.28)',
                  }
            }
            onMouseEnter={e => { if (hasValue && !disabled) (e.currentTarget as HTMLElement).style.transform = 'scale(1.08)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)' }}
          >
            {disabled ? (
              <div
                className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: '#007AFF transparent transparent transparent' }}
              />
            ) : (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            )}
          </button>
        </div>

        <p className="text-center text-[11px] mt-1.5" style={{ color: 'rgba(60,60,67,0.3)' }}>
          AI có thể mắc lỗi · Kiểm tra trước khi sử dụng
        </p>
      </div>
    </div>
  )
}
