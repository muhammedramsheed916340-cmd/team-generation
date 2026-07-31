'use client'
import { useState } from 'react'
import { useAuth } from './auth-provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Trophy, Loader2, ShieldCheck, Zap, TrendingUp, Send, Brain } from 'lucide-react'
import { toast } from 'sonner'
import { ApiError } from '@/lib/api-client'

export function LoginScreen() {
  const { login } = useAuth()
  const [email, setEmail] = useState('demo@teamgen.in')
  const [password, setPassword] = useState('demo123')
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await login(email, password)
      toast.success('Welcome to Team Generation!')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const quick = (em: string, pw: string) => { setEmail(em); setPassword(pw) }

  return (
    <div className="min-h-screen flex flex-col bg-[#131314] text-[#e8eaed]">
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-5xl grid md:grid-cols-2 gap-8 items-center">
          {/* Hero */}
          <div className="hidden md:flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <div className="size-14 rounded-xl bg-gradient-to-br from-[#563d7c] to-[#7c5bb5] flex items-center justify-center shadow-lg">
                <Trophy className="size-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Team Generation</h1>
                <p className="text-sm text-[#9aa0a6]">Dream11 Team Generator Software</p>
              </div>
            </div>
            <h2 className="text-3xl font-bold leading-tight text-white">
              India's Best Software to Create <span className="text-[#7c5bb5]">Grand League</span> Winning Teams
            </h2>
            <p className="text-[#9aa0a6]">
              Generate optimized Dream11 teams using GL, SL & H2H strategies. AI predictions,
              live match simulation, and direct transfer to Dream11 & My11Circle.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Feature icon={<Sparkles className="size-4" />} title="AI Engine" desc="GL/SL/H2H logic" />
              <Feature icon={<Brain className="size-4" />} title="Predictions" desc="Win probability" />
              <Feature icon={<Send className="size-4" />} title="Direct Transfer" desc="Dream11 + My11Circle" />
              <Feature icon={<ShieldCheck className="size-4" />} title="Secure OTP" desc="Encrypted sessions" />
            </div>
          </div>

          {/* Login card */}
          <div className="bg-[#202124] border border-[#3c4043] rounded-xl p-6 shadow-2xl">
            <div className="flex items-center gap-2 mb-4 md:hidden">
              <div className="size-10 rounded-lg bg-gradient-to-br from-[#563d7c] to-[#7c5bb5] flex items-center justify-center">
                <Trophy className="size-6 text-white" />
              </div>
              <span className="font-bold text-white">Team Generation</span>
            </div>
            <h2 className="text-xl font-bold text-white mb-1">Sign in</h2>
            <p className="text-sm text-[#9aa0a6] mb-4">Enter your credentials to access the dashboard</p>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-[#9aa0a6]">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="bg-[#131314] border-[#3c4043] text-white" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-[#9aa0a6]">Password</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="bg-[#131314] border-[#3c4043] text-white" />
              </div>
              <Button type="submit" className="w-full bg-[#563d7c] hover:bg-[#6b4ba3] text-white" disabled={loading}>
                {loading ? <Loader2 className="size-4 animate-spin" /> : 'Sign in'}
              </Button>
              <div className="flex gap-2 w-full">
                <Button type="button" variant="outline" size="sm" className="flex-1 border-[#3c4043] text-[#e8eaed] hover:bg-[#28292c]" onClick={() => quick('demo@teamgen.in', 'demo123')}>
                  Demo User
                </Button>
                <Button type="button" variant="outline" size="sm" className="flex-1 border-[#3c4043] text-[#e8eaed] hover:bg-[#28292c]" onClick={() => quick('admin@teamgen.in', 'admin123')}>
                  Admin
                </Button>
              </div>
            </form>
          </div>
        </div>
      </main>
      <footer className="border-t border-[#3c4043] py-4 text-center text-xs text-[#9aa0a6]">
        Developed by <span className="text-[#563d7c] font-semibold">Believer01</span> · CEO Bobby · ©2021
      </footer>
    </div>
  )
}

function Feature({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="rounded-lg border border-[#3c4043] bg-[#202124] p-3">
      <div className="size-8 rounded-md bg-[#563d7c]/20 text-[#7c5bb5] flex items-center justify-center mb-2">{icon}</div>
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="text-xs text-[#9aa0a6]">{desc}</p>
    </div>
  )
}

function Sparkles({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .962 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.962 0z"/></svg>
}
