'use client'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { auditApi } from '@/lib/api-client'
import { toast } from 'sonner'

export function AuditTab() {
  const [logs, setLogs] = useState<any[]>([])
  const [action, setAction] = useState('all')
  const [severity, setSeverity] = useState('all')

  const load = async () => {
    try {
      const res = await auditApi.list(action === 'all' ? undefined : action, severity === 'all' ? undefined : severity)
      setLogs(res.logs)
    } catch (e: any) { toast.error(e.message) }
  }
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load() }, [action, severity])

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base">Audit Logs</CardTitle>
        <div className="flex gap-2">
          <Select value={action} onValueChange={setAction}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              <SelectItem value="LOGIN">LOGIN</SelectItem>
              <SelectItem value="TEAM_GENERATED">TEAM_GENERATED</SelectItem>
              <SelectItem value="FANTASY_LOGIN_SUCCESS">FANTASY_LOGIN</SelectItem>
              <SelectItem value="FANTASY_BULK_TRANSFER_QUEUED">BULK_TRANSFER</SelectItem>
              <SelectItem value="TOSS_UPDATED">TOSS_UPDATED</SelectItem>
              <SelectItem value="LICENSE_ACTIVATED">LICENSE_ACTIVATED</SelectItem>
            </SelectContent>
          </Select>
          <Select value={severity} onValueChange={setSeverity}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="INFO">INFO</SelectItem>
              <SelectItem value="WARN">WARN</SelectItem>
              <SelectItem value="ERROR">ERROR</SelectItem>
              <SelectItem value="CRITICAL">CRITICAL</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[calc(100vh-14rem)]">
          <div className="space-y-1 pb-4">
            {logs.map((l) => (
              <div key={l.id} className="flex items-start gap-2 p-2 rounded border text-sm">
                <Badge variant={l.severity === 'CRITICAL' ? 'destructive' : l.severity === 'ERROR' ? 'destructive' : l.severity === 'WARN' ? 'secondary' : 'outline'} className="text-xs shrink-0">{l.severity}</Badge>
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{l.action}</p>
                  {l.user && <p className="text-xs text-muted-foreground">{l.user.name} · {l.user.email}</p>}
                  <p className="text-xs text-muted-foreground font-mono truncate">{l.details}</p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">{new Date(l.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
