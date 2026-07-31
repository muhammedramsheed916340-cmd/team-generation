'use client'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Users, Briefcase, AlertTriangle, CheckCircle2, Calendar } from 'lucide-react'
import { adminApi } from '@/lib/api-client'
import { toast } from 'sonner'

export function AdminTab() {
  const [stats, setStats] = useState<any>(null)
  const [users, setUsers] = useState<any[]>([])
  const [jobs, setJobs] = useState<any[]>([])
  const [errors, setErrors] = useState<any[]>([])
  const [tab, setTab] = useState('overview')

  const load = async () => {
    try {
      const [s, u, j, e] = await Promise.all([adminApi.stats(), adminApi.users(), adminApi.jobs(), adminApi.errors()])
      setStats(s); setUsers(u.users); setJobs(j.jobs); setErrors(e.errors)
    } catch (e: any) { toast.error(e.message) }
  }
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load() }, [])

  const resolveErr = async (id: string) => { try { await adminApi.resolveError(id); toast.success('Resolved'); load() } catch (e: any) { toast.error(e.message) } }

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="users">Users</TabsTrigger>
        <TabsTrigger value="jobs">Jobs</TabsTrigger>
        <TabsTrigger value="errors">Errors</TabsTrigger>
      </TabsList>
      <TabsContent value="overview" className="mt-4 space-y-4">
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat icon={<Users />} label="Users" value={stats.totalUsers} />
            <Stat icon={<Calendar />} label="Matches" value={stats.totalMatches} />
            <Stat icon={<Briefcase />} label="Teams" value={stats.totalGeneratedTeams} />
            <Stat icon={<AlertTriangle />} label="Errors" value={stats.unresolvedErrors} variant={stats.unresolvedErrors ? 'destructive' : 'default'} />
          </div>
        )}
      </TabsContent>
      <TabsContent value="users" className="mt-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Users ({users.length})</CardTitle></CardHeader>
          <CardContent>
            <ScrollArea className="h-[calc(100vh-16rem)]">
              <div className="space-y-2 pb-4">
                {users.map((u) => (
                  <div key={u.id} className="flex items-center justify-between p-2 rounded border">
                    <div>
                      <p className="text-sm font-medium">{u.name} <Badge variant="outline" className="ml-1 text-xs">{u.role}</Badge></p>
                      <p className="text-xs text-muted-foreground">{u.email} · {u.credits} credits</p>
                    </div>
                    <div className="text-right text-xs">
                      <p>{u._count?.generatedTeams || 0} teams</p>
                      <p>{u._count?.transfers || 0} transfers</p>
                      {u.subscription && <Badge variant="default" className="text-xs mt-1">{u.subscription.plan.name}</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="jobs" className="mt-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Background Jobs ({jobs.length})</CardTitle></CardHeader>
          <CardContent>
            <ScrollArea className="h-[calc(100vh-16rem)]">
              <div className="space-y-2 pb-4">
                {jobs.map((j) => (
                  <div key={j.id} className="flex items-center justify-between p-2 rounded border text-sm">
                    <div>
                      <p className="font-medium font-mono text-xs">{j.jobType}</p>
                      <p className="text-xs text-muted-foreground">{j.match?.shortName || j.matchId} · {new Date(j.createdAt).toLocaleString()}</p>
                    </div>
                    <Badge variant={j.status === 'SUCCESS' ? 'default' : j.status === 'FAILED' ? 'destructive' : 'secondary'}>{j.status}</Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="errors" className="mt-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0"><CardTitle className="text-base">Error Logs ({errors.length})</CardTitle><Button variant="outline" size="sm" onClick={load}>Refresh</Button></CardHeader>
          <CardContent>
            <ScrollArea className="h-[calc(100vh-16rem)]">
              <div className="space-y-2 pb-4">
                {errors.length === 0 ? <p className="text-center text-sm text-muted-foreground py-8">No errors 🎉</p> : errors.map((e) => (
                  <div key={e.id} className="p-2 rounded border">
                    <div className="flex items-center justify-between">
                      <Badge variant={e.level === 'FATAL' ? 'destructive' : 'secondary'} className="text-xs">{e.level}</Badge>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{e.source}</Badge>
                        <Button size="sm" variant="ghost" onClick={() => resolveErr(e.id)}><CheckCircle2 className="size-3.5" /></Button>
                      </div>
                    </div>
                    <p className="text-sm font-medium mt-1">{e.message}</p>
                    {e.path && <p className="text-xs text-muted-foreground font-mono">{e.method} {e.path}</p>}
                    <p className="text-xs text-muted-foreground">{new Date(e.createdAt).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
}

function Stat({ icon, label, value, variant }: { icon: React.ReactNode; label: string; value: React.ReactNode; variant?: 'default' | 'destructive' }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between"><p className="text-xs text-muted-foreground">{label}</p><div className="size-7 rounded-md bg-muted flex items-center justify-center">{icon}</div></div>
        <p className={`text-2xl font-bold mt-1 ${variant === 'destructive' ? 'text-red-600' : ''}`}>{value}</p>
      </CardContent>
    </Card>
  )
}
