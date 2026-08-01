'use client'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Activity, RefreshCw, Database, Server, HardDrive, Cpu } from 'lucide-react'
import { healthApi } from '@/lib/api-client'
import { toast } from 'sonner'

export function MonitoringTab() {
  const [health, setHealth] = useState<any>(null)
  const [metrics, setMetrics] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [h, m] = await Promise.all([healthApi.health(), healthApi.metrics()])
      setHealth(h); setMetrics(m)
    } catch (e: any) { toast.error(e.message) }
    finally { setLoading(false) }
  }
  useEffect(() => { load(); const i = setInterval(load, 10000); return () => clearInterval(i) }, [])

  const fmtBytes = (b: number) => `${(b / 1024 / 1024).toFixed(1)} MB`

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold flex items-center gap-2"><Activity className="size-5" /> System Monitoring</h3>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}><RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh</Button>
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Server className="size-4" /> Service Status</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Status" value={<Badge variant="default" className="text-emerald-600">{health?.status || '...'}</Badge>} />
            <Row label="Uptime" value={health ? `${Math.floor(health.uptime / 60)}m ${Math.floor(health.uptime % 60)}s` : '—'} />
            <Row label="Database" value={<Badge variant={health?.db?.connected ? 'default' : 'destructive'}>{health?.db?.connected ? 'Connected' : 'Down'}</Badge>} />
            <Row label="Timestamp" value={health ? new Date(health.timestamp).toLocaleTimeString() : '—'} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Database className="size-4" /> Cache (Redis-like)</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Hit rate" value={`${(metrics?.cache?.hitRate ?? 0).toFixed(1)}%`} />
            <Progress value={metrics?.cache?.hitRate ?? 0} className="h-1.5" />
            <Row label="Keys" value={metrics?.cache?.size ?? 0} />
            <Row label="Hits / Misses" value={`${metrics?.cache?.hits ?? 0} / ${metrics?.cache?.misses ?? 0}`} />
            <Row label="Evictions" value={metrics?.cache?.evictions ?? 0} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Cpu className="size-4" /> Job Queue</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Queued" value={metrics?.queue?.QUEUED ?? 0} />
            <Row label="Running" value={metrics?.queue?.RUNNING ?? 0} />
            <Row label="Success" value={<span className="text-emerald-600">{metrics?.queue?.SUCCESS ?? 0}</span>} />
            <Row label="Failed" value={<span className="text-red-600">{metrics?.queue?.FAILED ?? 0}</span>} />
            <Row label="Retrying" value={metrics?.queue?.RETRYING ?? 0} />
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><HardDrive className="size-4" /> Memory Usage</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {health?.memory ? (
              <>
                <Row label="RSS" value={fmtBytes(health.memory.rss)} />
                <Row label="Heap used" value={fmtBytes(health.memory.heapUsed)} />
                <Row label="Heap total" value={fmtBytes(health.memory.heapTotal)} />
                <Row label="External" value={fmtBytes(health.memory.external)} />
                <Progress value={(health.memory.heapUsed / health.memory.heapTotal) * 100} className="h-2" />
              </>
            ) : <p className="text-muted-foreground text-sm">Loading...</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Platform Counts</CardTitle><CardDescription>Database record counts</CardDescription></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {metrics?.counts && Object.entries(metrics.counts).map(([k, v]) => (
              <Row key={k} label={k.replace(/^total/, '')} value={v as number} />
            ))}
          </CardContent>
        </Card>
      </div>

      {metrics?.recentErrors?.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Recent Unresolved Errors</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {metrics.recentErrors.map((e: any) => (
              <div key={e.id} className="flex items-center justify-between p-2 rounded border text-sm">
                <div><p className="font-medium">{e.message}</p><p className="text-xs text-muted-foreground font-mono">{e.source} · {e.path}</p></div>
                <Badge variant={e.level === 'FATAL' ? 'destructive' : 'secondary'}>{e.level}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="flex items-center justify-between"><span className="text-muted-foreground">{label}</span><span className="font-medium">{value}</span></div>
}
