'use client'
import { AuthProvider, useAuth } from '@/components/app/auth-provider'
import { Dashboard } from '@/components/app/dashboard'
import { Loader2 } from 'lucide-react'

function App() {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#131314]">
        <Loader2 className="size-8 animate-spin text-[#563d7c]" />
      </div>
    )
  }
  // No login page — go straight to dashboard (auto-authenticated)
  return <Dashboard />
}

export default function Home() {
  return (
    <AuthProvider>
      <App />
    </AuthProvider>
  )
}
