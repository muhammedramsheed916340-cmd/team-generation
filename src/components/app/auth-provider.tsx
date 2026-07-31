'use client'
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { authApi, setToken, clearToken, getStoredUser } from '@/lib/api-client'

interface AuthUser {
  id: string
  email: string
  name: string
  role: string
  credits: number
}

interface AuthCtx {
  user: AuthUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  refresh: () => Promise<void>
}

const Ctx = createContext<AuthCtx>(null!)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => (typeof window !== 'undefined' ? getStoredUser() : null))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const init = async () => {
      try {
        const u: any = await authApi.me()
        if (!cancelled) setUser(u)
      } catch {
        if (!cancelled) { clearToken(); setUser(null) }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    init()
    return () => { cancelled = true }
  }, [])

  const login = async (email: string, password: string) => {
    const res = await authApi.login(email, password)
    setToken(res.accessToken, res.refreshToken, res.user)
    setUser(res.user)
  }

  const logout = () => { clearToken(); setUser(null) }

  const refresh = async () => {
    try { const u: any = await authApi.me(); setUser(u) } catch { /* ignore */ }
  }

  return <Ctx.Provider value={{ user, loading, login, logout, refresh }}>{children}</Ctx.Provider>
}

export function useAuth() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
