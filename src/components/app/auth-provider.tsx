'use client'
/**
 * Auto-auth provider. No login page — creates/uses a default user automatically.
 * Resilient: if auto-login fails, still renders the app (public data works without auth).
 */
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { api, setToken } from '@/lib/api-client'

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
  refresh: () => Promise<void>
  retry: () => void
}

const Ctx = createContext<AuthCtx>(null!)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  const doAutoLogin = async () => {
    try {
      const res: any = await api.post('/api/auth/auto-login', {})
      if (res?.accessToken) {
        setToken(res.accessToken, res.refreshToken, res.user)
        setUser(res.user)
        return true
      }
      return false
    } catch (e) {
      console.error('auto-login failed:', e)
      return false
    }
  }

  useEffect(() => {
    let cancelled = false
    const init = async () => {
      // Safety timeout: never spin more than 5 seconds
      const timeout = setTimeout(() => {
        if (!cancelled) setLoading(false)
      }, 5000)

      const ok = await doAutoLogin()
      clearTimeout(timeout)
      if (!cancelled) {
        setLoading(false)
      }
    }
    init()
    return () => { cancelled = true }
  }, [])

  const retry = () => {
    setLoading(true)
    void doAutoLogin().then(() => setLoading(false))
  }

  const refresh = async () => {
    try {
      const u: any = await api.get('/api/auth/me')
      setUser(u)
    } catch { /* ignore */ }
  }

  return <Ctx.Provider value={{ user, loading, refresh, retry }}>{children}</Ctx.Provider>
}

export function useAuth() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
