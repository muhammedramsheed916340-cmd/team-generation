'use client'
/**
 * Auto-auth provider. No login page — creates/uses a default user automatically.
 * The app is directly accessible without credentials.
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
}

const Ctx = createContext<AuthCtx>(null!)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const init = async () => {
      try {
        // Auto-login: get or create a default session user (no credentials needed)
        const res: any = await api.post('/api/auth/auto-login', {})
        if (!cancelled) {
          // Store the token so all subsequent API calls are authenticated
          setToken(res.accessToken, res.refreshToken, res.user)
          setUser(res.user)
        }
      } catch {
        if (!cancelled) setUser(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    init()
    return () => { cancelled = true }
  }, [])

  const refresh = async () => {
    try {
      const u: any = await api.get('/api/auth/me')
      setUser(u)
    } catch { /* ignore */ }
  }

  return <Ctx.Provider value={{ user, loading, refresh }}>{children}</Ctx.Provider>
}

export function useAuth() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
