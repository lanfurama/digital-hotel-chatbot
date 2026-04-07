'use client'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { auth } from '@/lib/api'

function Background() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none" aria-hidden>
      {/* Top gradient wash */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(160deg, #E4E8F5 0%, #EAE6F5 35%, #EAEAEF 65%, #EAEAEF 100%)',
        }}
      />
      {/* Blue blob top-right */}
      <div
        className="absolute rounded-full anim-blob"
        style={{
          width: 500, height: 500,
          top: '-18%', right: '-12%',
          background: 'radial-gradient(circle, rgba(0,122,255,0.12) 0%, transparent 68%)',
          animationDuration: '11s',
        }}
      />
      {/* Purple blob bottom-left */}
      <div
        className="absolute rounded-full anim-blob"
        style={{
          width: 420, height: 420,
          bottom: '-10%', left: '-10%',
          background: 'radial-gradient(circle, rgba(94,92,230,0.1) 0%, transparent 68%)',
          animationDelay: '5s', animationDuration: '14s',
        }}
      />
      {/* Teal accent */}
      <div
        className="absolute rounded-full anim-blob"
        style={{
          width: 260, height: 260,
          top: '50%', right: '8%',
          background: 'radial-gradient(circle, rgba(50,173,230,0.08) 0%, transparent 70%)',
          animationDelay: '3s', animationDuration: '9s',
        }}
      />
    </div>
  )
}

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const searchParams          = useSearchParams()

  useEffect(() => {
    if (searchParams.get('error') === 'oauth_failed') {
      setError('Đăng nhập thất bại. Vui lòng thử lại.')
    }
  }, [searchParams])

  const handleGoogleLogin = async () => {
    setLoading(true); setError(null)
    try {
      const { url } = await auth.googleLoginUrl()
      window.location.href = url
    } catch {
      setError('Không thể kết nối đến server. Vui lòng thử lại.')
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center p-5 overflow-hidden">
      <Background />

      <div className="relative z-10 w-full max-w-[340px] anim-fade-up">
        {/* Card */}
        <div
          className="rounded-[28px] px-7 py-9"
          style={{
            background: 'rgba(245,244,248,0.88)',
            border: '1px solid rgba(30,30,50,0.08)',
            backdropFilter: 'saturate(180%) blur(24px)',
            WebkitBackdropFilter: 'saturate(180%) blur(24px)',
            boxShadow: '0 8px 40px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)',
          }}
        >
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div
              className="w-[72px] h-[72px] rounded-[22px] flex items-center justify-center"
              style={{
                background: 'linear-gradient(145deg, #007AFF 0%, #5E5CE6 100%)',
                boxShadow: '0 6px 24px rgba(0,122,255,0.3)',
              }}
            >
              <svg className="w-9 h-9 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 3a1 1 0 0 1 1 1v.27A8.002 8.002 0 0 1 20 12h1a1 1 0 1 1 0 2H3a1 1 0 1 1 0-2h1a8.002 8.002 0 0 1 7-7.73V4a1 1 0 0 1 1-1ZM5 16h14v1.5H5V16ZM4 19h16v1.5H4V19Z" />
              </svg>
            </div>
          </div>

          {/* Text */}
          <div className="text-center mb-7">
            <h1 className="text-[22px] font-semibold text-black tracking-[-0.4px]">
              Hotel Chatbot
            </h1>
            <p className="text-[13px] mt-1" style={{ color: 'rgba(60,60,67,0.6)' }}>
              Trợ lý AI nội bộ · Digital Team
            </p>
          </div>

          {/* Error */}
          {error && (
            <div
              className="mb-5 rounded-2xl px-4 py-3 text-[13px] anim-scale-in"
              style={{
                background: 'rgba(255,59,48,0.08)',
                border: '1px solid rgba(255,59,48,0.18)',
                color: '#D70015',
              }}
            >
              {error}
            </div>
          )}

          {/* Google button */}
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 rounded-2xl py-[14px] px-5 text-[15px] font-medium transition-all duration-150 disabled:opacity-50 active:scale-[0.98]"
            style={{
              background: '#F0EFF4',
              border: '1.5px solid rgba(30,30,50,0.1)',
              color: '#18181B',
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#E8E7ED')}
            onMouseLeave={e => (e.currentTarget.style.background = '#F0EFF4')}
          >
            {loading ? (
              <div
                className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: '#007AFF transparent transparent transparent' }}
              />
            ) : (
              <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            )}
            <span>{loading ? 'Đang chuyển hướng...' : 'Tiếp tục với Google'}</span>
          </button>

          <p className="mt-5 text-center text-[12px]" style={{ color: 'rgba(60,60,67,0.35)' }}>
            Chỉ tài khoản Google công ty được phép đăng nhập
          </p>
        </div>
      </div>
    </div>
  )
}
