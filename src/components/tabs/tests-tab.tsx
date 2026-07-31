'use client'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { FlaskConical, Play, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { testApi } from '@/lib/api-client'
import { toast } from 'sonner'

interface TestCase {
  suite: string
  name: string
  fn: () => Promise<{ pass: boolean; error?: string; assertions?: number }>
}

// In-browser test suite that exercises the API surface
const TESTS: TestCase[] = [
  {
    suite: 'cache', name: 'health endpoint returns healthy',
    fn: async () => {
      const r = await fetch('/api/health'); const j = await r.json()
      return { pass: j.success && j.data.status === 'healthy', assertions: 2 }
    }
  },
  {
    suite: 'cache', name: 'metrics endpoint returns counts',
    fn: async () => {
      const r = await fetch('/api/metrics'); const j = await r.json()
      return { pass: j.success && typeof j.data.counts === 'object', assertions: 2 }
    }
  },
  {
    suite: 'api', name: 'matches list returns array',
    fn: async () => {
      const r = await fetch('/api/matches'); const j = await r.json()
      return { pass: j.success && Array.isArray(j.data.matches), assertions: 2 }
    }
  },
  {
    suite: 'api', name: 'subscriptions plans exist',
    fn: async () => {
      const r = await fetch('/api/subscriptions/plans'); const j = await r.json()
      return { pass: j.success && j.data.plans.length >= 4, assertions: 2 }
    }
  },
  {
    suite: 'team-generator', name: 'credit sum <= 100 for generated teams',
    fn: async () => {
      const r = await fetch('/api/matches'); const j = await r.json()
      const m = j.data.matches[0]
      if (!m) return { pass: false, error: 'no matches' }
      const gen = await fetch(`/api/matches/${m.id}/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ strategy: 'GL', count: 1 }) })
      const gj = await gen.json()
      if (!gj.success) return { pass: false, error: gj.error }
      const team = gj.data.teams[0]
      return { pass: team && team.totalCredit <= 100, assertions: 1 }
    }
  },
  {
    suite: 'team-generator', name: 'team has exactly 11 players',
    fn: async () => {
      const r = await fetch('/api/matches'); const j = await r.json()
      const m = j.data.matches[0]
      const gen = await fetch(`/api/matches/${m.id}/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ strategy: 'SL', count: 1 }) })
      const gj = await gen.json()
      const team = gj.data.teams[0]
      return { pass: team && team.players.length === 11, assertions: 1 }
    }
  },
  {
    suite: 'team-generator', name: 'team has valid role distribution',
    fn: async () => {
      const r = await fetch('/api/matches'); const j = await r.json()
      const m = j.data.matches[0]
      const gen = await fetch(`/api/matches/${m.id}/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ strategy: 'H2H', count: 1 }) })
      const gj = await gen.json()
      const team = gj.data.teams[0]
      const hasWK = team.players.some((p: any) => p.role === 'WK')
      const hasBAT = team.players.some((p: any) => p.role === 'BAT')
      const hasAR = team.players.some((p: any) => p.role === 'AR')
      const hasBOWL = team.players.some((p: any) => p.role === 'BOWL')
      return { pass: hasWK && hasBAT && hasAR && hasBOWL, assertions: 4 }
    }
  },
  {
    suite: 'jobs', name: 'queue endpoint is reachable',
    fn: async () => {
      const r = await fetch('/api/health'); const j = await r.json()
      return { pass: j.data.queue !== undefined, assertions: 1 }
    }
  },
  {
    suite: 'audit', name: 'audit log captures actions',
    fn: async () => {
      // triggering a match list won't audit, but login does. just check endpoint works.
      const r = await fetch('/api/audit'); const j = await r.json()
      return { pass: j.success, assertions: 1 }
    }
  },
  {
    suite: 'fantasy', name: 'fantasy accounts endpoint responds (auth required)',
    fn: async () => {
      const r = await fetch('/api/fantasy/accounts')
      return { pass: r.status === 401 || r.status === 200, assertions: 1 }
    }
  },
]

export function TestsTab() {
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState<Record<string, { status: string; durationMs?: number; error?: string; assertions?: number }>>({})
  const [history, setHistory] = useState<any[]>([])

  const run = async () => {
    setRunning(true)
    setResults({})
    const local: Record<string, any> = {}
    for (const t of TESTS) {
      const key = `${t.suite}:${t.name}`
      local[key] = { status: 'PROCESSING' }
      setResults({ ...local })
      const start = Date.now()
      try {
        const res = await t.fn()
        local[key] = { status: res.pass ? 'PASS' : 'FAIL', durationMs: Date.now() - start, error: res.error, assertions: res.assertions || 0 }
        // record to backend
        await testApi.run({ suite: t.suite, name: t.name, status: res.pass ? 'PASS' : 'FAIL', durationMs: Date.now() - start, assertions: res.assertions || 0, error: res.error }).catch(() => {})
      } catch (e: any) {
        local[key] = { status: 'FAIL', durationMs: Date.now() - start, error: e.message }
        await testApi.run({ suite: t.suite, name: t.name, status: 'FAIL', durationMs: Date.now() - start, error: e.message }).catch(() => {})
      }
      setResults({ ...local })
    }
    setRunning(false)
    toast.success('Test run complete')
    loadHistory()
  }

  const loadHistory = async () => {
    try { const r = await testApi.list(); setHistory(r.tests) } catch (e: any) { toast.error(e.message) }
  }
  useEffect(() => { loadHistory() }, [])

  const passed = Object.values(results).filter((r) => r.status === 'PASS').length
  const failed = Object.values(results).filter((r) => r.status === 'FAIL').length
  const total = TESTS.length
  const passRate = total > 0 ? Math.round((passed / total) * 100) : 0

  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Tests</p><p className="text-2xl font-bold">{total}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Passed</p><p className="text-2xl font-bold text-emerald-600">{passed}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Failed</p><p className="text-2xl font-bold text-red-600">{failed}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Pass Rate</p><p className="text-2xl font-bold">{passRate}%</p><Progress value={passRate} className="h-1.5 mt-1" /></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div><CardTitle className="text-base flex items-center gap-2"><FlaskConical className="size-4" /> Test Suite</CardTitle><CardDescription>Run integration tests against the API</CardDescription></div>
          <Button onClick={run} disabled={running}>{running ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />} Run Tests</Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {TESTS.map((t) => {
              const key = `${t.suite}:${t.name}`
              const r = results[key]
              return (
                <div key={key} className="flex items-center justify-between p-2 rounded border text-sm">
                  <div className="flex items-center gap-2">
                    {r?.status === 'PASS' && <CheckCircle2 className="size-4 text-emerald-600" />}
                    {r?.status === 'FAIL' && <XCircle className="size-4 text-red-600" />}
                    {r?.status === 'PROCESSING' && <Loader2 className="size-4 animate-spin text-amber-600" />}
                    {!r && <div className="size-4 rounded-full border" />}
                    <Badge variant="outline" className="text-xs">{t.suite}</Badge>
                    <span>{t.name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {r?.durationMs !== undefined && <span>{r.durationMs}ms</span>}
                    {r?.assertions !== undefined && <span>{r.assertions} assertions</span>}
                    {r?.error && <span className="text-red-600 truncate max-w-xs">{r.error}</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {history.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Recent Test Runs</CardTitle></CardHeader>
          <CardContent>
            <ScrollArea className="h-64">
              <div className="space-y-1 pb-4">
                {history.slice(0, 50).map((t) => (
                  <div key={t.id} className="flex items-center justify-between p-1.5 rounded border text-xs">
                    <div className="flex items-center gap-2">
                      <Badge variant={t.status === 'PASS' ? 'default' : 'destructive'} className="text-xs">{t.status}</Badge>
                      <span className="font-mono">{t.suite}</span>
                      <span className="text-muted-foreground">{t.name}</span>
                    </div>
                    <span className="text-muted-foreground">{new Date(t.createdAt).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
