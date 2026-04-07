'use client'
import { useEffect, useState } from 'react'
import { auth } from '@/lib/api'
import type { User } from '@/types/chat'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    auth.me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  const logout = async () => {
    await auth.logout()
    setUser(null)
    window.location.href = '/login'
  }

  return { user, loading, logout }
}
