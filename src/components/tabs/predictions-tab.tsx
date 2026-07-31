'use client'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Brain, TrendingUp, Target, Users2, Sparkles, RefreshCw, Trophy, Zap, Activity } from 'lucide-react'
import { matchesApi } from '@/lib/api-client'
import { toast } from 'sonner'

export function PredictionsTab() {
  const [matches, setMatches] = useState<any[]>([])
  const [matchId, setMatchId] = useState('')
  const [prediction, setPrediction] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    matchesApi.list().then((r) => { setMatches(r.matches); if (r.matches[0]) setMatchId(r.matches[0].id) }).catch((e) => toast.error(e.message))
  }, [])

  useEffect(() => {
    if (!matchId) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const p = await matchesApi.predict(matchId)
        if (!cancelled) setPrediction(p)
      } catch (e: any) {
        if (!cancelled) { toast.error(e.message); setPrediction(null) }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [matchId])

  const selMatch = matches.find((m) => m.id === matchId)

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden border-0 bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 text-white">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="size-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
              <Brain className="size-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">AI Match Predictions</h2>
              <p className="text-emerald-100 text-sm">Win probability powered by player form, credits, toss & squad analysis</p>
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
            <Button variant="secondary" size="sm" onClick={() => setMatchId(matchId)} disabled={loading}>
              <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {prediction ? (
        <>
          {/* Win Probability Bar */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2"><Trophy className="size-4 text-amber-500" /> Win Probability</CardTitle>
                <Badge variant={prediction.confidence === 'HIGH' ? 'default' : prediction.confidence === 'MEDIUM' ? 'secondary' : 'outline'}>
                  Confidence: {prediction.confidence}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {/* Probability bar */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm font-medium">
                  <span className="flex items-center gap-2">
                    <span className="size-3 rounded-full bg-emerald-500" />
                    {prediction.team1.short}
                  </span>
                  <span className="text-lg font-bold text-emerald-600">{prediction.team1.winProbability}%</span>
                </div>
                <div className="flex h-6 rounded-full overflow-hidden bg-muted">
                  <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 flex items-center justify-center text-xs text-white font-medium transition-all" style={{ width: `${prediction.team1.winProbability}%` }}>
                    {prediction.team1.winProbability > 15 && prediction.team1.short}
                  </div>
                  <div className="bg-gradient-to-r from-purple-500 to-purple-600 flex items-center justify-center text-xs text-white font-medium transition-all" style={{ width: `${prediction.team2.winProbability}%` }}>
                    {prediction.team2.winProbability > 15 && prediction.team2.short}
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm font-medium">
                  <span className="text-lg font-bold text-purple-600">{prediction.team2.winProbability}%</span>
                  <span className="flex items-center gap-2">
                    {prediction.team2.short}
                    <span className="size-3 rounded-full bg-purple-500" />
                  </span>
                </div>
              </div>

              {prediction.tossAdvantage && (
                <div className="mt-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900">
                  <p className="text-sm flex items-center gap-2">
                    <Sparkles className="size-4 text-amber-600" />
                    <span className="text-muted-foreground">Toss Advantage:</span>
                    <span className="font-medium text-amber-700 dark:text-amber-400">{prediction.tossAdvantage}</span>
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Score Prediction + Strength */}
          <div className="grid md:grid-cols-3 gap-3">
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/40 dark:to-blue-900/20 border-blue-200 dark:border-blue-900">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-muted-foreground">Predicted Score</p>
                  <Target className="size-4 text-blue-600" />
                </div>
                <p className="text-3xl font-bold text-blue-700 dark:text-blue-400">{prediction.predictedTotalScore}</p>
                <p className="text-xs text-muted-foreground">~{prediction.predictedWickets} wickets</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-muted-foreground">{prediction.team1.short} Strength</p>
                  <Zap className="size-4 text-emerald-600" />
                </div>
                <p className="text-3xl font-bold">{prediction.team1.strength}</p>
                <Progress value={prediction.team1.strength} className="h-1.5 mt-1" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-muted-foreground">{prediction.team2.short} Strength</p>
                  <Zap className="size-4 text-purple-600" />
                </div>
                <p className="text-3xl font-bold">{prediction.team2.strength}</p>
                <Progress value={prediction.team2.strength} className="h-1.5 mt-1" />
              </CardContent>
            </Card>
          </div>

          {/* Key Players */}
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <span className="size-4 rounded bg-emerald-500" /> {prediction.team1.name} — Key Players
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {prediction.team1.keyPlayers.map((p: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded border bg-card">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">{i + 1}</Badge>
                      <span className="text-sm font-medium">{p.name}</span>
                      <Badge variant="secondary" className="text-xs">{p.role}</Badge>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Activity className="size-3 text-emerald-600" />
                      <span className="text-sm font-mono font-bold text-emerald-600">{p.impact}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <span className="size-4 rounded bg-purple-500" /> {prediction.team2.name} — Key Players
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {prediction.team2.keyPlayers.map((p: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded border bg-card">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">{i + 1}</Badge>
                      <span className="text-sm font-medium">{p.name}</span>
                      <Badge variant="secondary" className="text-xs">{p.role}</Badge>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Activity className="size-3 text-purple-600" />
                      <span className="text-sm font-mono font-bold text-purple-600">{p.impact}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Comparison Factors */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><TrendingUp className="size-4" /> Comparison Factors</CardTitle>
              <CardDescription>Head-to-head statistical breakdown</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="grid grid-cols-4 gap-2 text-xs font-semibold text-muted-foreground pb-2 border-b">
                  <div>Factor</div>
                  <div className="text-center">{prediction.team1.short}</div>
                  <div className="text-center">{prediction.team2.short}</div>
                  <div className="text-right">Edge</div>
                </div>
                {prediction.factors.map((f: any, i: number) => (
                  <div key={i} className="grid grid-cols-4 gap-2 text-sm py-1.5 items-center">
                    <div className="text-muted-foreground">{f.label}</div>
                    <div className={`text-center font-mono font-medium ${f.edge === prediction.team1.short ? 'text-emerald-600' : ''}`}>{f.team1Value}</div>
                    <div className={`text-center font-mono font-medium ${f.edge === prediction.team2.short ? 'text-purple-600' : ''}`}>{f.team2Value}</div>
                    <div className="text-right">
                      <Badge variant="outline" className="text-xs">{f.edge}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <Brain className="size-12 mx-auto mb-3 opacity-40" />
            <p>{loading ? 'Computing prediction...' : 'Select a match to view AI prediction'}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
