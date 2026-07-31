'use client'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { RefreshCw, Calendar, MapPin, Users, CheckCircle2, Dice5, Sparkles } from 'lucide-react'
import { matchesApi } from '@/lib/api-client'
import { toast } from 'sonner'

export function MatchesTab() {
  const [matches, setMatches] = useState<any[]>([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)
  const [players, setPlayers] = useState<any[]>([])
  const [xi, setXi] = useState<any[]>([])

  const load = async () => {
    setLoading(true)
    try {
      const res = await matchesApi.list(filter === 'all' ? undefined : filter)
      setMatches(res.matches)
      if (res.matches[0] && !selected) setSelected(res.matches[0].id)
    } catch (e: any) { toast.error(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [filter])

  useEffect(() => {
    if (!selected) return
    Promise.all([matchesApi.players(selected), matchesApi.playingXI(selected)])
      .then(([p, x]) => { setPlayers(p.players); setXi(x.playingXI) })
      .catch((e) => toast.error(e.message))
  }, [selected])

  const sync = async () => {
    try { await matchesApi.sync(); toast.success('Matches synced'); load() }
    catch (e: any) { toast.error(e.message) }
  }

  const announceXI = async (id: string) => {
    try { await matchesApi.announceXI(id); toast.success('Playing XI announced'); load(); if (selected === id) { const x = await matchesApi.playingXI(id); setXi(x.playingXI) } }
    catch (e: any) { toast.error(e.message) }
  }

  const toss = async (id: string) => {
    try { const r = await matchesApi.toss(id); toast.success(`Toss: ${r.winner} chose to ${r.decision}`); load() }
    catch (e: any) { toast.error(e.message) }
  }

  const sel = matches.find((m) => m.id === selected)
  const xiIds = new Set(xi.map((x) => x.playerId))

  return (
    <div className="grid md:grid-cols-2 gap-4">
      {/* Matches list */}
      <Card className="flex flex-col max-h-[calc(100vh-12rem)]">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Calendar className="size-4" /> Matches</CardTitle>
          <Button variant="outline" size="sm" onClick={sync} disabled={loading}><RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} /> Sync</Button>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden p-0">
          <div className="px-4 pb-2">
            <Tabs value={filter} onValueChange={setFilter}>
              <TabsList className="w-full">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="UPCOMING">Upcoming</TabsTrigger>
                <TabsTrigger value="LIVE">Live</TabsTrigger>
                <TabsTrigger value="COMPLETED">Done</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <ScrollArea className="h-[calc(100vh-18rem)] px-4">
            <div className="space-y-2 pb-4">
              {matches.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setSelected(m.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${selected === m.id ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20' : 'hover:bg-muted/50'}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-semibold text-sm">{m.shortName}</p>
                    <Badge variant={m.status === 'LIVE' ? 'destructive' : m.status === 'COMPLETED' ? 'secondary' : 'default'}>{m.status}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <MapPin className="size-3" /> {m.venue}, {m.city}
                  </p>
                  <p className="text-xs text-muted-foreground">{new Date(m.startAt).toLocaleString()}</p>
                  <div className="flex items-center gap-2 mt-2">
                    {m.playingXINamed && <Badge variant="outline" className="text-emerald-600 text-xs"><CheckCircle2 className="size-3 mr-1" /> XI</Badge>}
                    {m.tossWinner && <Badge variant="outline" className="text-amber-600 text-xs"><Dice5 className="size-3 mr-1" /> {m.tossWinner} {m.tossDecision}</Badge>}
                    <span className="text-xs text-muted-foreground ml-auto">{m._count?.players || 0} players</span>
                  </div>
                </button>
              ))}
              {!loading && matches.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">No matches found</p>}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Match detail */}
      <Card className="flex flex-col max-h-[calc(100vh-12rem)]">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{sel?.shortName || 'Select a match'}</CardTitle>
            {sel && (
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => announceXI(sel.id)} disabled={sel.playingXINamed}>
                  <Users className="size-3.5" /> Update XI
                </Button>
                <Button size="sm" variant="outline" onClick={() => toss(sel.id)} disabled={!!sel.tossWinner}>
                  <Dice5 className="size-3.5" /> Toss
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden">
          {sel ? (
            <ScrollArea className="h-[calc(100vh-16rem)]">
              <div className="space-y-3 pb-4">
                <div className="grid grid-cols-2 gap-2">
                  <TeamBox name={sel.team1Name} short={sel.team1Short} color={sel.team1Color} count={players.filter((p) => p.team === sel.team1Short).length} />
                  <TeamBox name={sel.team2Name} short={sel.team2Short} color={sel.team2Color} count={players.filter((p) => p.team === sel.team2Short).length} />
                </div>
                <div className="flex items-center justify-between text-sm p-2 rounded bg-muted/50">
                  <span className="text-muted-foreground">Series</span>
                  <span className="font-medium">{sel.series} · {sel.format}</span>
                </div>
                {sel.tossWinner && (
                  <div className="flex items-center justify-between text-sm p-2 rounded bg-amber-50 dark:bg-amber-950/30">
                    <span className="text-muted-foreground">Toss</span>
                    <span className="font-medium text-amber-700 dark:text-amber-400">{sel.tossWinner} won & chose to {sel.tossDecision}</span>
                  </div>
                )}
                <div>
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <Sparkles className="size-4" /> Squad ({players.length})
                    {sel.playingXINamed && <Badge variant="outline" className="text-emerald-600">XI Named</Badge>}
                  </h4>
                  <div className="space-y-1">
                    {players.map((p) => (
                      <div key={p.id} className={`flex items-center justify-between p-1.5 rounded text-sm ${xiIds.has(p.id) ? 'bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900' : ''}`}>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${p.team === sel.team1Short ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300' : 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'}`}>{p.team}</span>
                          <span className="font-medium">{p.name}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <Badge variant="outline">{p.role}</Badge>
                          <span className="text-muted-foreground">{p.credit} cr</span>
                          {xiIds.has(p.id) && <CheckCircle2 className="size-3.5 text-emerald-600" />}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </ScrollArea>
          ) : <p className="text-center text-sm text-muted-foreground py-8">Select a match to view details</p>}
        </CardContent>
      </Card>
    </div>
  )
}

function TeamBox({ name, short, color, count }: { name: string; short: string; color: string; count: number }) {
  return (
    <div className="rounded-lg border p-3" style={{ borderLeft: `4px solid ${color}` }}>
      <p className="text-xs text-muted-foreground">{name}</p>
      <div className="flex items-center justify-between mt-1">
        <span className="font-bold text-lg">{short}</span>
        <span className="text-xs text-muted-foreground">{count} players</span>
      </div>
    </div>
  )
}
