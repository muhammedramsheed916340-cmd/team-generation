'use client'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Play, Loader2, Trophy, Activity, TrendingUp, Target, Zap, RefreshCw } from 'lucide-react'
import { matchesApi } from '@/lib/api-client'
import { toast } from 'sonner'

export function SimulationTab() {
  const [matches, setMatches] = useState<any[]>([])
  const [matchId, setMatchId] = useState('')
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [visibleBalls, setVisibleBalls] = useState(0)

  useEffect(() => {
    matchesApi.list().then((r) => { setMatches(r.matches); if (r.matches[0]) setMatchId(r.matches[0].id) }).catch((e) => toast.error(e.message))
  }, [])

  const simulate = async () => {
    if (!matchId) { toast.error('Select a match'); return }
    setLoading(true)
    setResult(null)
    setVisibleBalls(0)
    try {
      const res = await matchesApi.simulate(matchId)
      setResult(res)
      // animate ball-by-ball reveal
      const totalBalls = res.firstInnings.timeline.length + res.secondInnings.timeline.length
      let i = 0
      const interval = setInterval(() => {
        i++
        setVisibleBalls(i)
        if (i >= totalBalls) clearInterval(interval)
      }, 30)
    } catch (e: any) { toast.error(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="space-y-4">
      {/* Hero */}
      <Card className="overflow-hidden border-0 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="size-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
              <Activity className="size-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Live Match Simulation</h2>
              <p className="text-blue-100 text-sm">Ball-by-ball AI simulation using player form & role data</p>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-4">
            <Select value={matchId} onValueChange={setMatchId}>
              <SelectTrigger className="bg-white/10 border-white/20 text-white">
                <SelectValue placeholder="Select match" />
              </SelectTrigger>
              <SelectContent>
                {matches.map((m) => <SelectItem key={m.id} value={m.id}>{m.shortName} · {new Date(m.startAt).toLocaleDateString()}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="secondary" onClick={simulate} disabled={loading}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
              Simulate
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && (
        <>
          {/* Result banner */}
          <Card className={`border-2 ${result.winner ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20' : 'border-amber-500 bg-amber-50 dark:bg-amber-950/20'}`}>
            <CardContent className="p-4 flex items-center gap-3">
              <Trophy className={`size-8 ${result.winner ? 'text-emerald-600' : 'text-amber-600'}`} />
              <div>
                <p className="text-xs text-muted-foreground">Result</p>
                <p className="text-lg font-bold">{result.result}</p>
              </div>
              <Badge variant="outline" className="ml-auto">{result.margin}</Badge>
            </CardContent>
          </Card>

          {/* Scorecards */}
          <div className="grid md:grid-cols-2 gap-4">
            <InningsCard innings={result.firstInnings} label="1st Innings" color="emerald" visibleBalls={visibleBalls} />
            <InningsCard innings={result.secondInnings} label="2nd Innings" color="purple" visibleBalls={visibleBalls} offset={result.firstInnings.timeline.length} target={result.firstInnings.totalRuns + 1} />
          </div>

          {/* Commentary */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><Zap className="size-4 text-amber-500" /> Ball-by-Ball Commentary</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-80">
                <div className="space-y-1 pb-4">
                  {[...result.firstInnings.timeline, ...result.secondInnings.timeline].slice(0, visibleBalls).map((ball: any, i: number) => (
                    <div key={i} className={`flex items-start gap-2 p-1.5 rounded text-sm ${ball.isWicket ? 'bg-red-50 dark:bg-red-950/20 border-l-2 border-red-500' : ball.runs === 4 ? 'bg-blue-50 dark:bg-blue-950/20 border-l-2 border-blue-500' : ball.runs === 6 ? 'bg-purple-50 dark:bg-purple-950/20 border-l-2 border-purple-500' : 'hover:bg-muted/50'}`}>
                      <Badge variant="outline" className="text-xs font-mono shrink-0">{ball.over}.{ball.ballInOver}</Badge>
                      <span className={`flex-1 ${ball.isWicket ? 'text-red-700 dark:text-red-400 font-medium' : ball.runs >= 4 ? 'font-medium' : 'text-muted-foreground'}`}>
                        {ball.commentary}
                      </span>
                      {ball.isWicket ? <span className="text-red-600 font-bold text-xs">W</span> : ball.runs === 4 ? <span className="text-blue-600 font-bold text-xs">4</span> : ball.runs === 6 ? <span className="text-purple-600 font-bold text-xs">6</span> : <span className="text-muted-foreground text-xs">{ball.runs}</span>}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </>
      )}

      {!result && !loading && (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <Activity className="size-12 mx-auto mb-3 opacity-40" />
            <p>Select a match and click Simulate to run a ball-by-ball simulation</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function InningsCard({ innings, label, color, visibleBalls, offset = 0, target }: any) {
  const visibleTimeline = innings.timeline.slice(0, Math.max(0, visibleBalls - offset))
  const progressRuns = visibleTimeline.length > 0 ? visibleTimeline[visibleTimeline.length - 1].scoreAfter.split('/')[0] : '0'
  const progressWickets = visibleTimeline.length > 0 ? visibleTimeline[visibleTimeline.length - 1].scoreAfter.split('/')[1] : '0'

  return (
    <Card className={`${color === 'emerald' ? 'border-emerald-200 dark:border-emerald-900' : 'border-purple-200 dark:border-purple-900'}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <span className={`size-3 rounded-full ${color === 'emerald' ? 'bg-emerald-500' : 'bg-purple-500'}`} />
              {innings.battingTeam}
              <span className="text-xs text-muted-foreground font-normal">{label}</span>
            </CardTitle>
            {target && <CardDescription className="text-xs">Target: {target}</CardDescription>}
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold tabular-nums">{progressRuns}/{progressWickets}</p>
            <p className="text-xs text-muted-foreground">{innings.oversBowled} ov · RR {innings.runRate}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Top scorer */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1"><TrendingUp className="size-3" /> Top Batsmen</p>
          <div className="space-y-1">
            {innings.topScorers.slice(0, 3).map((b: any, i: number) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="font-medium">{b.name}</span>
                <span className="font-mono text-xs">{b.runs} ({b.balls}) <span className="text-muted-foreground">SR {(b.balls > 0 ? (b.runs / b.balls * 100) : 0).toFixed(0)}</span></span>
              </div>
            ))}
          </div>
        </div>
        <Separator />
        {/* Top bowler */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1"><Target className="size-3" /> Top Bowlers</p>
          <div className="space-y-1">
            {innings.topBowlers.filter((b: any) => b.wickets > 0).slice(0, 3).map((b: any, i: number) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="font-medium">{b.name}</span>
                <span className="font-mono text-xs">{b.wickets}/{b.runsConceded}</span>
              </div>
            ))}
            {innings.topBowlers.filter((b: any) => b.wickets > 0).length === 0 && <p className="text-xs text-muted-foreground">No wickets taken</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
