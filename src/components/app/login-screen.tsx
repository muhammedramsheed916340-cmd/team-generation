'use client'
import { useState } from 'react'
import { useAuth } from './auth-provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Trophy, Loader2, ShieldCheck, Zap, TrendingUp } from 'lucide-react'
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
      toast.success('Welcome back!')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const quick = (em: string, pw: string) => { setEmail(em); setPassword(pw) }

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 flex items-center justify-center p-4 bg-gradient-to-br from-emerald-50 via-background to-amber-50 dark:from-emerald-950/20 dark:via-background dark:to-amber-950/20">
        <div className="w-full max-w-5xl grid md:grid-cols-2 gap-8 items-center">
          {/* Hero */}
          <div className="hidden md:flex flex-col gap-6">
            <div className="flex items-center gap-3">
              <div className="size-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
                <Trophy className="size-7" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">TeamGen Pro</h1>
                <p className="text-sm text-muted-foreground">AI Fantasy Cricket Platform</p>
              </div>
            </div>
            <h2 className="text-4xl font-bold leading-tight">
              Win Grand Leagues with <span className="text-emerald-600">AI-powered</span> team generation
            </h2>
            <p className="text-muted-foreground">
              Generate optimized Dream11 teams using GL, SL & H2H strategies. Sync live matches, auto-update playing XI,
              regenerate on toss, and transfer teams directly to Dream11 & My11Circle.
            </p>
            <div className="grid grid-cols-3 gap-4">
              <Feature icon={<Zap className="size-5" />} title="AI Engine" desc="GL/SL/H2H logic" />
              <Feature icon={<TrendingUp className="size-5" />} title="Live Sync" desc="Real-time matches" />
              <Feature icon={<ShieldCheck className="size-5" />} title="Secure Transfer" desc="Encrypted OTP" />
            </div>
          </div>

          {/* Login card */}
          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Trophy className="size-5 text-emerald-600" /> Sign in</CardTitle>
              <CardDescription>Enter your credentials to access the dashboard</CardDescription>
            </CardHeader>
            <form onSubmit={submit}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-3">
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="size-4 animate-spin" /> : 'Sign in'}
                </Button>
                <div className="flex gap-2 w-full">
                  <Button type="button" variant="outline" size="sm" className="flex-1" onClick={() => quick('demo@teamgen.in', 'demo123')}>
                    Demo User
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="flex-1" onClick={() => quick('admin@teamgen.in', 'admin123')}>
                    Admin
                  </Button>
                </div>
              </CardFooter>
            </form>
          </Card>
        </div>
      </main>
      <footer className="border-t py-4 text-center text-sm text-muted-foreground">
        TeamGen Pro · AI Fantasy Cricket Platform · Demo credentials shown above
      </footer>
    </div>
  )
}

function Feature({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="size-8 rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 flex items-center justify-center mb-2">{icon}</div>
      <p className="text-sm font-semibold">{title}</p>
      <p className="text-xs text-muted-foreground">{desc}</p>
    </div>
  )
}
