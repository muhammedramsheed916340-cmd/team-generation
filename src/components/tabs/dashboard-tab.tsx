'use client'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Users, Trophy, Send, Calendar, Activity, Zap, TrendingUp, RefreshCw, Sparkles, ArrowRight, Brain, Download } from 'lucide-react'
import { healthApi, matchesApi, testApi, seedApi } from '@/lib/api-client'
import { toast } from 'sonner'

export function DashboardTab({ onNavigate }: { onNavigate: (t: string) => void }) {
  const [metrics, setMetrics] = useState<any>(null)
  const [matches, setMatches] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const [m, matchesRes] = await Promise.all([healthApi.metrics(), matchesApi.list()])
      setMetrics(m)
      setMatches(matchesRes.matches)
    } catch (e: any) { toast.error(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [])

  const seed = async () => {
    try { await seedApi.seed(); toast.success('Database seeded'); load() }
    catch (e: any) { toast.error(e.message) }
  }

  const c = metrics?.counts || {}
  const transferStats = metrics?.transferStats || {}
  const queue = metrics?.queue || {}
  const cache = metrics?.cache || {}

  return (
    <div className="space-y-4">
      {/* Top stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={<Users className="size-4" />} label="Users" value={c.totalUsers ?? '—'} color="emerald" />
        <StatCard icon={<Calendar className="size-4" />} label="Matches" value={c.totalMatches ?? '—'} color="blue" />
        <StatCard icon={<Trophy className="size-4" />} label="Teams Generated" value={c.totalTeams ?? '—'} color="amber" />
        <StatCard icon={<Send className="size-4" />} label="Transfers" value={c.totalTransfers ?? '—'} color="purple" />
      </div>

      {/* Quick actions */}
      <div className="grid md:grid-cols-4 gap-3">
        <ActionCard
          icon={<Brain className="size-5" />}
          title="Match Predictions"
          desc="AI win probability & key players"
          color="emerald"
          onClick={() => onNavigate('predictions')}
        />
        <ActionCard
          icon={<Sparkles className="size-5" />}
          title="Generate AI Teams"
          desc="GL / SL / H2H with advanced logic"
          color="amber"
          onClick={() => onNavigate('generator')}
        />
        <ActionCard
          icon={<Send className="size-5" />}
          title="Fantasy Transfer"
          desc="Bulk transfer up to 500 teams"
          color="purple"
          onClick={() => onNavigate('transfer')}
        />
        <ActionCard
          icon={<RefreshCw className="size-5" />}
          title="Sync Live Matches"
          desc="Auto-update playing XI"
          color="blue"
          onClick={() => onNavigate('matches')}
        />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* System health */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Activity className="size-4" /> System Health</CardTitle>
            <Button variant="ghost" size="sm" onClick={load} disabled={loading}><RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} /></Button>
          </CardHeader>
          <CardContent className="space-y-3">
            <Row label="Cache hit rate" value={`${(cache.hitRate ?? 0).toFixed(1)}%`} />
            <Row label="Cache size" value={`${cache.size ?? 0} keys`} />
            <Row label="Queue depth" value={`${(queue.QUEUED || 0) + (queue.RETRYING || 0)} pending`} />
            <Row label="Running jobs" value={`${queue.RUNNING || 0}`} />
            <Row label="Linked fantasy accounts" value={c.totalAccounts ?? 0} />
            <Row label="Unresolved errors" value={<Badge variant={c.totalErrors ? 'destructive' : 'secondary'}>{c.totalErrors ?? 0}</Badge>} />
          </CardContent>
        </Card>

        {/* Transfer stats */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Send className="size-4" /> Transfer Statistics</CardTitle>
            <CardDescription>Status of all fantasy transfers</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.keys(transferStats).length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No transfers yet</p>
            ) : (
              Object.entries(transferStats).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between">
                  <Badge variant={status === 'VERIFIED' || status === 'SUCCESS' ? 'default' : status === 'FAILED' ? 'destructive' : 'secondary'}>
                    {status}
                  </Badge>
                  <span className="text-sm font-mono">{count as number}</span>
                </div>
              ))
            )}
            <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => onNavigate('transfer')}>
              Go to Transfer <ArrowRight className="size-3.5" />
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming matches */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base flex items-center gap-2"><Calendar className="size-4" /> Recent Matches</CardTitle>
          <Button variant="outline" size="sm" onClick={() => onNavigate('matches')}>View all</Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-12 bg-muted animate-pulse rounded" />)}</div>
          ) : (
            <div className="space-y-2">
              {matches.slice(0, 5).map((m) => (
                <div key={m.id} className="flex items-center justify-between p-2 rounded border">
                  <div>
                    <p className="text-sm font-medium">{m.shortName}</p>
                    <p className="text-xs text-muted-foreground">{new Date(m.startAt).toLocaleString()} · {m.venue}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {m.playingXINamed && <Badge variant="outline" className="text-emerald-600">XI Announced</Badge>}
                    <Badge variant={m.status === 'LIVE' ? 'destructive' : m.status === 'COMPLETED' ? 'secondary' : 'default'}>
                      {m.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Seed button (dev) */}
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={seed}><Zap className="size-3.5" /> Seed demo data</Button>
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: React.ReactNode; color: string }) {
  const colors: Record<string, string> = {
    emerald: 'from-emerald-500/10 to-emerald-500/5 text-emerald-700 dark:text-emerald-400',
    blue: 'from-blue-500/10 to-blue-500/5 text-blue-700 dark:text-blue-400',
    amber: 'from-amber-500/10 to-amber-500/5 text-amber-700 dark:text-amber-400',
    purple: 'from-purple-500/10 to-purple-500/5 text-purple-700 dark:text-purple-400',
  }
  const iconBg: Record<string, string> = {
    emerald: 'bg-emerald-500',
    blue: 'bg-blue-500',
    amber: 'bg-amber-500',
    purple: 'bg-purple-500',
  }
  return (
    <Card className={`bg-gradient-to-br ${colors[color]} border-0 shadow-sm`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground font-medium">{label}</p>
          <div className={`size-8 rounded-lg text-white flex items-center justify-center shadow-sm ${iconBg[color]}`}>{icon}</div>
        </div>
        <p className="text-3xl font-bold mt-2 tabular-nums">{value}</p>
      </CardContent>
    </Card>
  )
}

function ActionCard({ icon, title, desc, color, onClick }: { icon: React.ReactNode; title: string; desc: string; color: string; onClick: () => void }) {
  const colors: Record<string, string> = {
    emerald: 'hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/20',
    blue: 'hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/20',
    purple: 'hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-950/20',
    amber: 'hover:border-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/20',
  }
  const iconColors: Record<string, string> = {
    emerald: 'bg-emerald-600',
    blue: 'bg-blue-600',
    purple: 'bg-purple-600',
    amber: 'bg-amber-600',
  }
  return (
    <button onClick={onClick} className={`text-left p-4 rounded-lg border bg-card transition-colors ${colors[color]}`}>
      <div className={`size-10 rounded-lg text-white flex items-center justify-center mb-3 ${iconColors[color]}`}>{icon}</div>
      <p className="font-semibold">{title}</p>
      <p className="text-sm text-muted-foreground mt-0.5">{desc}</p>
    </button>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}
