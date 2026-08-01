'use client'
import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import { Send, Plus, Loader2, Smartphone, ShieldCheck, RefreshCw, CheckCircle2, XCircle, Clock, Zap, History, Play, RotateCcw, Link2, Unlink, Activity } from 'lucide-react'
import { fantasyApi, realApi } from '@/lib/api-client'
import { useJobsSocket } from '@/hooks/use-jobs-socket'
import { toast } from 'sonner'

export function TransferTab() {
  const { connected, events, transferProgress } = useJobsSocket()
  const [tab, setTab] = useState('dashboard')
  const [accounts, setAccounts] = useState<any[]>([])
  const [queues, setQueues] = useState<any[]>([])
  const [history, setHistory] = useState<any[]>({ transfers: [], total: 0, successCount: 0, failedCount: 0 } as any)

  const loadAll = useCallback(async () => {
    try {
      const [acc, q, h] = await Promise.all([fantasyApi.accounts(), fantasyApi.queueList(), fantasyApi.transferHistory()])
      setAccounts(acc.accounts)
      setQueues(q.queues)
      setHistory(h)
    } catch (e: any) { toast.error(e.message) }
  }, [])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadAll() }, [loadAll])
  useEffect(() => {
    // refresh when a transfer:queue:done event arrives
    const done = events.find((e) => e.type === 'transfer:queue:done')
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (done) { void loadAll() }
  }, [events, loadAll])

  const successCount = history.successCount || 0
  const failedCount = history.failedCount || 0
  const totalTransfers = history.total || 0
  const successRate = totalTransfers > 0 ? Math.round((successCount / totalTransfers) * 100) : 0

  return (
    <div className="space-y-4">
      {/* Top stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between"><p className="text-xs text-muted-foreground">Linked Accounts</p><Link2 className="size-4 text-emerald-600" /></div>
            <p className="text-2xl font-bold mt-1">{accounts.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between"><p className="text-xs text-muted-foreground">Total Transfers</p><Send className="size-4 text-purple-600" /></div>
            <p className="text-2xl font-bold mt-1">{totalTransfers}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between"><p className="text-xs text-muted-foreground">Success Rate</p><CheckCircle2 className="size-4 text-emerald-600" /></div>
            <p className="text-2xl font-bold mt-1 text-emerald-600">{successRate}%</p>
            <p className="text-xs text-muted-foreground">{successCount} verified</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between"><p className="text-xs text-muted-foreground">Failed</p><XCircle className="size-4 text-red-600" /></div>
            <p className="text-2xl font-bold mt-1 text-red-600">{failedCount}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="dashboard" className="gap-1.5"><Activity className="size-4" /> Dashboard</TabsTrigger>
          <TabsTrigger value="accounts" className="gap-1.5"><Link2 className="size-4" /> Accounts</TabsTrigger>
          <TabsTrigger value="transfer" className="gap-1.5"><Send className="size-4" /> New Transfer</TabsTrigger>
          <TabsTrigger value="queue" className="gap-1.5"><Clock className="size-4" /> Queue</TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5"><History className="size-4" /> History</TabsTrigger>
          <TabsTrigger value="logs" className="gap-1.5"><Zap className="size-4" /> Live Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-4">
          <TransferOverview accounts={accounts} queues={queues} history={history} transferProgress={transferProgress} connected={connected} />
        </TabsContent>
        <TabsContent value="accounts" className="mt-4">
          <AccountsPanel accounts={accounts} onChanged={loadAll} />
        </TabsContent>
        <TabsContent value="transfer" className="mt-4">
          <NewTransferPanel accounts={accounts} onDone={loadAll} />
        </TabsContent>
        <TabsContent value="queue" className="mt-4">
          <QueuePanel queues={queues} transferProgress={transferProgress} onChanged={loadAll} />
        </TabsContent>
        <TabsContent value="history" className="mt-4">
          <HistoryPanel history={history} />
        </TabsContent>
        <TabsContent value="logs" className="mt-4">
          <LiveLogsPanel events={events} connected={connected} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ============================================================
// OVERVIEW
// ============================================================
function TransferOverview({ accounts, queues, history, transferProgress, connected }: any) {
  const activeQueues = queues.filter((q: any) => q.status === 'PROCESSING' || q.status === 'QUEUED')
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Link2 className="size-4" /> Linked Accounts</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {accounts.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">No accounts linked yet</p> : accounts.map((a: any) => (
            <div key={a.id} className="flex items-center justify-between p-2 rounded border">
              <div className="flex items-center gap-2">
                <div className={`size-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${a.platform === 'DREAM11' ? 'bg-rose-600' : 'bg-blue-600'}`}>{a.platform.slice(0, 2)}</div>
                <div>
                  <p className="text-sm font-medium">{a.displayName}</p>
                  <p className="text-xs text-muted-foreground">{a.platform} · {a.mobile}</p>
                </div>
              </div>
              <Badge variant={a.sessionActive ? 'default' : 'secondary'} className={a.sessionActive ? 'text-emerald-600' : ''}>{a.sessionActive ? 'Active' : 'Expired'}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Activity className="size-4" /> Active Queues</CardTitle><CardDescription>{connected ? 'Live updates connected' : 'Live updates offline'}</CardDescription></CardHeader>
        <CardContent className="space-y-2">
          {activeQueues.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">No active transfers</p> : activeQueues.map((q: any) => {
            const prog = transferProgress[q.id] || {}
            const pct = q.totalTeams > 0 ? Math.round((q.completedCount / q.totalTeams) * 100) : 0
            return (
              <div key={q.id} className="p-2 rounded border space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{q.matchName}</span>
                  <Badge variant="secondary">{q.platform}</Badge>
                </div>
                <Progress value={pct} className="h-1.5" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{q.completedCount}/{q.totalTeams} · {q.successCount} ok · {q.failedCount} fail</span>
                  <span>{pct}%</span>
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================================
// ACCOUNTS (OTP Login)
// ============================================================
function AccountsPanel({ accounts, onChanged }: any) {
  const [showLogin, setShowLogin] = useState(false)
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div><CardTitle className="text-base">Fantasy Accounts</CardTitle><CardDescription>Link your Dream11 / My11Circle accounts via OTP</CardDescription></div>
        <Button size="sm" onClick={() => setShowLogin(true)}><Plus className="size-4" /> Link Account</Button>
      </CardHeader>
      <CardContent>
        {accounts.length === 0 ? (
          <div className="text-center py-12">
            <Smartphone className="size-12 mx-auto mb-3 text-muted-foreground opacity-50" />
            <p className="text-sm text-muted-foreground mb-3">No accounts linked. Link your first fantasy account to start transferring teams.</p>
            <Button onClick={() => setShowLogin(true)}><Plus className="size-4" /> Link Account</Button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-3">
            {accounts.map((a: any) => <AccountCard key={a.id} account={a} onChanged={onChanged} />)}
          </div>
        )}
      </CardContent>
      {showLogin && <OtpLoginDialog onClose={() => setShowLogin(false)} onSuccess={() => { setShowLogin(false); onChanged() }} />}
    </Card>
  )
}

function AccountCard({ account, onChanged }: any) {
  const [loading, setLoading] = useState(false)
  const [remaining, setRemaining] = useState<any>(null)

  const checkRemaining = async () => {
    try { setRemaining(await fantasyApi.remainingTransfer(account.id)) } catch (e: any) { toast.error(e.message) }
  }
  const logout = async () => {
    setLoading(true)
    try { await fantasyApi.logout(account.id); toast.success('Logged out'); onChanged() } catch (e: any) { toast.error(e.message) }
    finally { setLoading(false) }
  }
  useEffect(() => { checkRemaining() }, [])

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`size-10 rounded-full flex items-center justify-center text-white font-bold ${account.platform === 'DREAM11' ? 'bg-rose-600' : 'bg-blue-600'}`}>{account.platform.slice(0, 2)}</div>
          <div>
            <p className="font-semibold">{account.displayName}</p>
            <p className="text-xs text-muted-foreground">{account.platform} · +91 {account.mobile}</p>
          </div>
        </div>
        <Badge variant={account.sessionActive ? 'default' : 'secondary'} className={account.sessionActive ? 'text-emerald-600' : ''}>{account.status}</Badge>
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs mb-3">
        <div className="p-2 rounded bg-muted/50"><p className="text-muted-foreground">Transfers</p><p className="font-bold text-base">{account._count?.transfers || 0}</p></div>
        <div className="p-2 rounded bg-muted/50"><p className="text-muted-foreground">Queues</p><p className="font-bold text-base">{account._count?.queueItems || 0}</p></div>
        <div className="p-2 rounded bg-muted/50"><p className="text-muted-foreground">Remaining</p><p className="font-bold text-base text-emerald-600">{remaining?.remaining ?? '—'}</p></div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" className="flex-1" onClick={checkRemaining}><RefreshCw className="size-3.5" /> Refresh</Button>
        <Button size="sm" variant="outline" onClick={logout} disabled={loading}><Unlink className="size-3.5" /> Logout</Button>
      </div>
    </div>
  )
}

function OtpLoginDialog({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [step, setStep] = useState<'request' | 'verify'>('request')
  const [platform, setPlatform] = useState('DREAM11')
  const [mobile, setMobile] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [resendsLeft, setResendsLeft] = useState(5)

  const requestOtp = async () => {
    if (!/^\d{10}$/.test(mobile)) { toast.error('Enter a valid 10-digit mobile'); return }
    setLoading(true)
    try {
      const res = await fantasyApi.login(platform, mobile)
      setResendsLeft(res.resendsLeft || 5)
      setStep('verify')
      toast.success(`OTP sent to +91 ${mobile} via SMS`, { description: 'Check your phone for the OTP' })
    } catch (e: any) { toast.error(e.message) }
    finally { setLoading(false) }
  }

  const verify = async () => {
    if (otp.length !== 6) { toast.error('Enter 6-digit OTP'); return }
    setLoading(true)
    try {
      await fantasyApi.verify(platform, mobile, otp)
      toast.success('Account linked successfully!')
      onSuccess()
    } catch (e: any) { toast.error(e.message) }
    finally { setLoading(false) }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle className="flex items-center gap-2"><ShieldCheck className="size-5 text-emerald-600" /> Link Fantasy Account</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Platform</Label>
            <Select value={platform} onValueChange={setPlatform}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="DREAM11">Dream11</SelectItem>
                <SelectItem value="MY11CIRCLE">My11Circle</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Mobile Number</Label>
            <Input placeholder="10-digit mobile" value={mobile} onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))} maxLength={10} />
          </div>
          {step === 'verify' && (
            <div className="space-y-2">
              <Label>Enter OTP sent to +91 {mobile}</Label>
              <InputOTP value={otp} onChange={(v) => setOtp(v)} maxLength={6}>
                <InputOTPGroup>
                  <InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} />
                  <InputOTPSlot index={3} /><InputOTPSlot index={4} /><InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
              <p className="text-xs text-muted-foreground">Resends left: {resendsLeft}</p>
            </div>
          )}
        </div>
        <DialogFooter>
          {step === 'request' ? (
            <Button onClick={requestOtp} disabled={loading}>{loading ? <Loader2 className="size-4 animate-spin" /> : <Smartphone className="size-4" />} Send OTP</Button>
          ) : (
            <Button onClick={verify} disabled={loading}>{loading ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />} Verify & Link</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================
// NEW TRANSFER
// ============================================================
function NewTransferPanel({ accounts, onDone }: any) {
  const [matchId, setMatchId] = useState('')
  const [matches, setMatches] = useState<any[]>([])
  const [accountId, setAccountId] = useState('')
  const [mode, setMode] = useState('CREATE')
  const [totalTeams, setTotalTeams] = useState([5])
  const [concurrency, setConcurrency] = useState([5])
  const [maxRetries, setMaxRetries] = useState([3])
  const [replaceIds, setReplaceIds] = useState('')
  const [generatedTeams, setGeneratedTeams] = useState<any[]>([])
  const [selectedTeam, setSelectedTeam] = useState<any>(null)
  const [submitting, setSubmitting] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [remaining, setRemaining] = useState<any>(null)

  useEffect(() => {
    realApi.matches('cricket').then((r) => { setMatches(r.matches || []); if (r.matches?.[0]) setMatchId(r.matches[0].id) }).catch(() => {})
  }, [])
  useEffect(() => { if (accounts[0]) setAccountId(accounts[0].id) }, [accounts])
  useEffect(() => {
    if (accountId) fantasyApi.remainingTransfer(accountId).then(setRemaining).catch(() => {})
  }, [accountId])

  // Generate teams from real data when match changes
  const generateTeams = async () => {
    if (!matchId) return
    setGenerating(true)
    try {
      const res = await realApi.generate(matchId, 'GL', 5)
      setGeneratedTeams(res.teams || [])
      if (res.teams?.[0]) setSelectedTeam(res.teams[0])
    } catch (e: any) { toast.error(e.message) }
    finally { setGenerating(false) }
  }

  useEffect(() => { if (matchId) void generateTeams() }, [matchId])

  const submit = async () => {
    if (!accountId) { toast.error('Select an account'); return }
    if (!selectedTeam) { toast.error('Select a team to transfer'); return }
    if (mode === 'REPLACE_SPECIFIC' && !replaceIds) { toast.error('Enter team IDs to replace'); return }
    setSubmitting(true)
    try {
      const template = {
        players: selectedTeam.players.map((p: any) => ({ externalId: String(p.id), name: p.name, role: p.role })),
        captainExternalId: String(selectedTeam.captainId),
        viceCaptainExternalId: String(selectedTeam.viceCaptainId),
        captainName: selectedTeam.captainName,
        viceCaptainName: selectedTeam.viceCaptainName,
      }
      const selMatch = matches.find((m) => m.id === matchId)
      const res = await fantasyApi.bulkTransfer({
        accountId, matchId, matchName: selMatch ? `${selMatch.team1} vs ${selMatch.team2}` : 'Custom', mode,
        totalTeams: totalTeams[0], concurrency: concurrency[0], maxRetries: maxRetries[0],
        replaceTeamIds: mode === 'REPLACE_SPECIFIC' ? replaceIds.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
        template,
      })
      toast.success(`Transferred ${res.totalTeams} teams successfully!`)
      onDone()
    } catch (e: any) { toast.error(e.message) }
    finally { setSubmitting(false) }
  }

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Send className="size-4" /> Configure Transfer</CardTitle><CardDescription>Bulk transfer teams to your fantasy platform</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Account</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
              <SelectContent>{accounts.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.platform} · {a.mobile}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {remaining && (
            <div className="p-2 rounded bg-emerald-50 dark:bg-emerald-950/30 text-sm flex justify-between">
              <span className="text-muted-foreground">Remaining today</span>
              <span className="font-bold text-emerald-600">{remaining.remaining} / {remaining.dailyLimit}</span>
            </div>
          )}
          <div className="space-y-2">
            <Label>Match (optional)</Label>
            <Select value={matchId} onValueChange={setMatchId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{matches.map((m) => <SelectItem key={m.id} value={m.id}>{m.shortName}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Transfer Mode</Label>
            <Select value={mode} onValueChange={setMode}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="CREATE">Create New Team</SelectItem>
                <SelectItem value="REPLACE">Replace Existing Team</SelectItem>
                <SelectItem value="REPLACE_SPECIFIC">Replace Specific Team IDs</SelectItem>
                <SelectItem value="AUTO_REPLACE">Auto Replace Mode</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {mode === 'REPLACE_SPECIFIC' && (
            <div className="space-y-2">
              <Label>Team IDs to replace (comma-separated)</Label>
              <Input placeholder="tpl-123, tpl-456" value={replaceIds} onChange={(e) => setReplaceIds(e.target.value)} />
            </div>
          )}
          <div className="space-y-2">
            <div className="flex justify-between"><Label>Number of teams</Label><Badge variant="secondary" className="font-mono">{totalTeams[0]}</Badge></div>
            <Slider value={totalTeams} onValueChange={setTotalTeams} min={1} max={500} step={1} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <div className="flex justify-between"><Label className="text-xs">Concurrency</Label><Badge variant="secondary" className="font-mono text-xs">{concurrency[0]}</Badge></div>
              <Slider value={concurrency} onValueChange={setConcurrency} min={1} max={20} step={1} />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between"><Label className="text-xs">Max retries</Label><Badge variant="secondary" className="font-mono text-xs">{maxRetries[0]}</Badge></div>
              <Slider value={maxRetries} onValueChange={setMaxRetries} min={0} max={5} step={1} />
            </div>
          </div>
          <Button onClick={submit} disabled={submitting} className="w-full">
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            Start Bulk Transfer ({totalTeams[0]} teams)
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Select Team Template</CardTitle>
            <CardDescription>Generated from real teamgeneration.in data</CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={generateTeams} disabled={generating}>
            {generating ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />} Regen
          </Button>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[calc(100vh-20rem)]">
            <div className="space-y-2">
              {generating ? (
                <p className="text-sm text-muted-foreground text-center py-8">Generating teams from real data...</p>
              ) : generatedTeams.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No teams generated. Select a match.</p>
              ) : generatedTeams.map((t, i) => (
                <button key={i} onClick={() => setSelectedTeam(t)} className={`w-full text-left p-2 rounded border text-sm ${selectedTeam === t ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20' : 'hover:bg-muted/50'}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Team #{i + 1} · {t.combinationKey}</span>
                    <Badge variant="outline" className="text-xs">{t.totalCredit} cr</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t.players?.length || 11} players · C: {t.captainName} · VC: {t.viceCaptainName}
                  </p>
                </button>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================================
// QUEUE
// ============================================================
function QueuePanel({ queues, transferProgress, onChanged }: any) {
  const [selected, setSelected] = useState<string | null>(null)
  const [detail, setDetail] = useState<any>(null)

  const loadDetail = async (id: string) => {
    try { setDetail(await fantasyApi.transferStatus(id, false)) } catch (e: any) { toast.error(e.message) }
  }

  const selectQueue = (id: string) => { setSelected(id) }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (selected) void loadDetail(selected)
    const i = setInterval(() => { if (selected) void loadDetail(selected) }, 2000)
    return () => clearInterval(i)
  }, [selected])

  const retry = async (id: string) => { try { await fantasyApi.queueRetry(id); toast.success('Retrying failed transfers'); loadDetail(id); onChanged() } catch (e: any) { toast.error(e.message) } }
  const process = async (id: string) => { try { await fantasyApi.queueProcess(id); toast.success('Processing started'); loadDetail(id) } catch (e: any) { toast.error(e.message) } }

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Card className="flex flex-col max-h-[calc(100vh-12rem)]">
        <CardHeader className="pb-2"><CardTitle className="text-base">Transfer Queues</CardTitle></CardHeader>
        <CardContent className="flex-1 overflow-hidden">
          <ScrollArea className="h-[calc(100vh-16rem)]">
            <div className="space-y-2 pb-4">
              {queues.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No transfer queues yet</p> :
                queues.map((q: any) => {
                  const pct = q.totalTeams > 0 ? Math.round((q.completedCount / q.totalTeams) * 100) : 0
                  return (
                    <button key={q.id} onClick={() => selectQueue(q.id)} className={`w-full text-left p-3 rounded-lg border ${selected === q.id ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20' : ''}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">{q.matchName}</span>
                        <Badge variant={q.status === 'COMPLETED' ? 'default' : q.status === 'PROCESSING' ? 'secondary' : 'outline'}>{q.status}</Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                        <Badge variant="outline" className="text-xs">{q.platform}</Badge>
                        <span>{q.mode}</span>
                      </div>
                      <Progress value={pct} className="h-1.5" />
                      <div className="flex justify-between text-xs mt-1">
                        <span className="text-emerald-600">{q.successCount} ok</span>
                        <span className="text-red-600">{q.failedCount} fail</span>
                        <span>{q.completedCount}/{q.totalTeams}</span>
                      </div>
                    </button>
                  )
                })
              }
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card className="flex flex-col max-h-[calc(100vh-12rem)]">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base">Queue Details</CardTitle>
          {detail && (
            <div className="flex gap-1">
              <Button size="sm" variant="outline" onClick={() => process(detail.queue.id)}><Play className="size-3.5" /> Process</Button>
              <Button size="sm" variant="outline" onClick={() => retry(detail.queue.id)}><RotateCcw className="size-3.5" /> Retry Failed</Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden">
          {detail ? (
            <ScrollArea className="h-[calc(100vh-16rem)]">
              <div className="space-y-3 pb-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="p-2 rounded bg-muted/50"><p className="text-xs text-muted-foreground">Total</p><p className="font-bold text-lg">{detail.queue.totalTeams}</p></div>
                  <div className="p-2 rounded bg-muted/50"><p className="text-xs text-muted-foreground">Completed</p><p className="font-bold text-lg">{detail.queue.completedCount}</p></div>
                  <div className="p-2 rounded bg-emerald-50 dark:bg-emerald-950/30"><p className="text-xs text-muted-foreground">Success</p><p className="font-bold text-lg text-emerald-600">{detail.queue.successCount}</p></div>
                  <div className="p-2 rounded bg-red-50 dark:bg-red-950/30"><p className="text-xs text-muted-foreground">Failed</p><p className="font-bold text-lg text-red-600">{detail.queue.failedCount}</p></div>
                </div>
                <Progress value={detail.progress} className="h-2" />
                <Separator />
                <div>
                  <h4 className="text-sm font-semibold mb-2">Transfer Items</h4>
                  <div className="space-y-1">
                    {detail.recent.map((t: any) => (
                      <div key={t.id} className="flex items-center justify-between p-1.5 rounded border text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-mono">#{t.teamIndex + 1}</span>
                          {t.status === 'VERIFIED' && <CheckCircle2 className="size-3.5 text-emerald-600" />}
                          {t.status === 'FAILED' && <XCircle className="size-3.5 text-red-600" />}
                          {t.status === 'PROCESSING' && <Loader2 className="size-3.5 animate-spin text-amber-600" />}
                          {t.status === 'PENDING' && <Clock className="size-3.5 text-muted-foreground" />}
                          <span>{t.captainName}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          {t.platformTeamId && <Badge variant="outline" className="text-xs font-mono">{t.platformTeamId.slice(-8)}</Badge>}
                          {t.attempts > 0 && <span className="text-muted-foreground">×{t.attempts}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </ScrollArea>
          ) : <p className="text-center text-sm text-muted-foreground py-8">Select a queue to view details</p>}
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================================
// HISTORY
// ============================================================
function HistoryPanel({ history }: any) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Transfer History</CardTitle><CardDescription>{history.total} total · {history.successCount} verified · {history.failedCount} failed</CardDescription></CardHeader>
      <CardContent>
        <ScrollArea className="h-[calc(100vh-16rem)]">
          <div className="space-y-2 pb-4">
            {history.transfers?.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No transfers yet</p> :
              history.transfers?.map((t: any) => (
                <div key={t.id} className="flex items-center justify-between p-2 rounded border text-sm">
                  <div className="flex items-center gap-2">
                    {t.status === 'VERIFIED' && <CheckCircle2 className="size-4 text-emerald-600" />}
                    {t.status === 'FAILED' && <XCircle className="size-4 text-red-600" />}
                    {t.status === 'PROCESSING' && <Loader2 className="size-4 animate-spin text-amber-600" />}
                    {t.status === 'PENDING' && <Clock className="size-4 text-muted-foreground" />}
                    <div>
                      <p className="font-medium">{t.matchName} · #{t.teamIndex + 1}</p>
                      <p className="text-xs text-muted-foreground">{t.platform} · C: {t.captainName} · VC: {t.viceCaptainName}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant={t.status === 'VERIFIED' ? 'default' : t.status === 'FAILED' ? 'destructive' : 'secondary'} className="text-xs">{t.status}</Badge>
                    {t.errorCode && <p className="text-xs text-red-600 mt-0.5">{t.errorCode}</p>}
                    <p className="text-xs text-muted-foreground mt-0.5">{new Date(t.createdAt).toLocaleString()}</p>
                  </div>
                </div>
              ))
            }
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

// ============================================================
// LIVE LOGS
// ============================================================
function LiveLogsPanel({ events, connected }: any) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base flex items-center gap-2"><Zap className="size-4" /> Live Event Stream</CardTitle>
        <Badge variant={connected ? 'default' : 'secondary'} className={connected ? 'text-emerald-600' : ''}>{connected ? '● Connected' : '○ Disconnected'}</Badge>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[calc(100vh-16rem)]">
          <div className="space-y-1 font-mono text-xs pb-4">
            {events.length === 0 ? <p className="text-center text-muted-foreground py-8">Waiting for events...</p> :
              events.map((e: any, i: number) => (
                <div key={i} className="flex gap-2 p-1.5 rounded hover:bg-muted/50">
                  <span className="text-muted-foreground shrink-0">{new Date(e.at).toLocaleTimeString()}</span>
                  <Badge variant="outline" className="text-xs shrink-0">{e.type}</Badge>
                  <span className="truncate">{JSON.stringify(e.payload)}</span>
                </div>
              ))
            }
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
