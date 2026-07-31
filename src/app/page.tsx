'use client'
import { AuthProvider, useAuth } from '@/components/app/auth-provider'
import { LoginScreen } from '@/components/app/login-screen'
import { Dashboard } from '@/components/app/dashboard'
import { Loader2 } from 'lucide-react'

function App() {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="size-8 animate-spin text-emerald-600" />
      </div>
    )
  }
  return user ? <Dashboard /> : <LoginScreen />
}

export default function Home() {
  return (
    <AuthProvider>
      <App />
    </AuthProvider>
  )
}
