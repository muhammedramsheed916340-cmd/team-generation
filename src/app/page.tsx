'use client'
import { AuthProvider, useAuth } from '@/components/app/auth-provider'
import { Dashboard } from '@/components/app/dashboard'
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

function App() {
  const { user, loading, retry } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#131314]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-8 animate-spin text-[#563d7c]" />
          <p className="text-[#9aa0a6] text-sm">Loading Team Generation...</p>
        </div>
      </div>
    )
  }

  // If auto-login failed, show dashboard anyway with a retry banner
  // (matches and predictions work without auth; transfer/generate need auth)
  return (
    <>
      {!user && (
        <div className="bg-[#d93025]/10 border-b border-[#d93025]/30 text-[#d93025] text-xs px-4 py-2 flex items-center justify-center gap-3">
          <AlertCircle className="size-3.5" />
          <span>Session not established — some features may be limited</span>
          <Button size="sm" variant="ghost" className="h-6 text-xs text-[#d93025] hover:bg-[#d93025]/20" onClick={retry}>
            <RefreshCw className="size-3" /> Retry
          </Button>
        </div>
      )}
      <Dashboard />
    </>
  )
}

export default function Home() {
  return (
    <AuthProvider>
      <App />
    </AuthProvider>
  )
}
