'use client'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Sparkles, Wand2, Loader2, Crown, Star, TrendingUp, Shield, Layers, RefreshCw } from 'lucide-react'
import { matchesApi } from '@/lib/api-client'
import { toast } from 'sonner'

const STRATEGIES = [
  { id: 'GL', name: 'Grand League', desc: 'High uniqueness, contrarian picks, risk spread', icon: <Layers className="size-4" />, color: 'purple' },
  { id: 'SL', name: 'Small League', desc: 'Safe core, high selection, low risk', icon: <Shield className="size-4" />, color: 'emerald' },
  { id: 'H2H', name: 'Head-to-Head', desc: 'Optimal 11, maximize projected points', icon: <TrendingUp className="size-4" />, color: 'blue' },
]

export function GeneratorTab() {
  const [matches, setMatches] = useState<any[]>([])
  const [matchId, setMatchId] = useState('')
  const [strategy, setStrategy] = useState('GL')
  const [count, setCount] = useState([5])
  const [regenOnToss, setRegenOnToss] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [teams, setTeams] = useState<any[]>([])

  useEffect(() => {
    matchesApi.list().then((r) => { setMatches(r.matches); if (r.matches[0]) setMatchId(r.matches[0].id) }).catch((e) => toast.error(e.message))
  }, [])

  const generate = async () => {
    if (!matchId) { toast.error('Select a match first'); return }
    setGenerating(true)
    try {
      const res = await matchesApi.generate(matchId, strategy, count[0], regenOnToss)
      setTeams(res.teams)
      toast.success(`Generated ${res.teams.length} ${strategy} teams`)
    } catch (e: any) { toast.error(e.message) }
    finally { setGenerating(false) }
  }

  const loadExisting = async () => {
    if (!matchId) return
    try {
      const res = await matchesApi.getTeams(matchId, strategy)
      setTeams(res.teams)
    } catch (e: any) { toast.error(e.message) }
  }

  useEffect(() => { if (matchId) loadExisting() }, [matchId, strategy])

  const selMatch = matches.find((m) => m.id === matchId)

  return (
    <div className="grid md:grid-cols-2 gap-4">
      {/* Config */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Sparkles className="size-4 text-emerald-600" /> AI Team Generator</CardTitle>
          <CardDescription>Generate optimized fantasy teams using advanced AI</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Match</Label>
            <Select value={matchId} onValueChange={setMatchId}>
              <SelectTrigger><SelectValue placeholder="Select match" /></SelectTrigger>
              <SelectContent>
                {matches.map((m) => <SelectItem key={m.id} value={m.id}>{m.shortName} · {new Date(m.startAt).toLocaleDateString()}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Strategy</Label>
            <div className="grid grid-cols-3 gap-2">
              {STRATEGIES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setStrategy(s.id)}
                  className={`p-3 rounded-lg border text-left transition-colors ${strategy === s.id ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20' : 'hover:bg-muted/50'}`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    {s.icon}
                    <span className="text-xs font-bold">{s.id}</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-tight">{s.name}</p>
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{STRATEGIES.find((s) => s.id === strategy)?.desc}</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Number of teams</Label>
              <Badge variant="secondary" className="font-mono">{count[0]}</Badge>
            </div>
            <Slider value={count} onValueChange={setCount} min={1} max={20} step={1} />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div>
              <Label className="flex items-center gap-2"><RefreshCw className="size-3.5" /> Toss regeneration</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Auto-regenerate when toss is decided</p>
            </div>
            <Switch checked={regenOnToss} onCheckedChange={setRegenOnToss} />
          </div>

          {selMatch && (
            <div className="p-3 rounded-lg bg-muted/50 text-sm space-y-1">
              <div className="flex justify-between"><span className="text-muted-foreground">Teams</span><span className="font-medium">{selMatch.team1Short} vs {selMatch.team2Short}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Playing XI</span><span className="font-medium">{selMatch.playingXINamed ? 'Announced' : 'Pending'}</span></div>
              {selMatch.tossWinner && <div className="flex justify-between"><span className="text-muted-foreground">Toss</span><span className="font-medium">{selMatch.tossWinner} ({selMatch.tossDecision})</span></div>}
            </div>
          )}

          <Button onClick={generate} disabled={generating} className="w-full">
            {generating ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
            Generate {count[0]} {strategy} {count[0] > 1 ? 'Teams' : 'Team'}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      <Card className="flex flex-col max-h-[calc(100vh-12rem)]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Layers className="size-4" /> Generated Teams ({teams.length})</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden">
          <ScrollArea className="h-[calc(100vh-16rem)]">
            <div className="space-y-3 pb-4">
              {teams.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Sparkles className="size-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No teams yet. Generate some!</p>
                </div>
              ) : (
                teams.map((t, i) => <TeamCard key={t.id || i} team={t} index={i} />)
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}

function TeamCard({ team, index }: { team: any; index: number }) {
  const captain = team.players?.find((p: any) => p.isCaptain)
  const vc = team.players?.find((p: any) => p.isViceCaptain)
  const byTeam: Record<string, any[]> = {}
  team.players?.forEach((p: any) => { (byTeam[p.team] ||= []).push(p) })

  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-muted">#{index + 1}</span>
          <Badge variant="outline">{team.strategy || team.combinationKey}</Badge>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge variant={team.riskLevel === 'LOW' ? 'default' : team.riskLevel === 'MEDIUM' ? 'secondary' : 'destructive'} className="text-xs">{team.riskLevel}</Badge>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs mb-2">
        <div className="flex justify-between"><span className="text-muted-foreground">Credits</span><span className="font-mono font-medium">{team.totalCredit}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Uniqueness</span><span className="font-mono font-medium">{team.uniquenessScore}%</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Projected</span><span className="font-mono font-medium">{team.projectedScore}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Combo</span><span className="font-mono font-medium text-[10px]">{team.combinationKey}</span></div>
      </div>
      <Separator className="my-2" />
      <div className="flex flex-wrap gap-1">
        {team.players?.map((p: any) => (
          <div key={p.id} className={`text-xs px-1.5 py-0.5 rounded border ${p.isCaptain ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/30' : p.isViceCaptain ? 'border-purple-400 bg-purple-50 dark:bg-purple-950/30' : 'bg-muted/50'}`}>
            {p.isCaptain && <Crown className="size-2.5 inline mr-0.5 text-amber-600" />}
            {p.isViceCaptain && <Star className="size-2.5 inline mr-0.5 text-purple-600" />}
            {p.shortName}
          </div>
        ))}
      </div>
      {(captain || vc) && (
        <div className="flex items-center gap-3 mt-2 text-xs">
          {captain && <span className="flex items-center gap-1"><Crown className="size-3 text-amber-600" /> C: <span className="font-medium">{captain.name}</span></span>}
          {vc && <span className="flex items-center gap-1"><Star className="size-3 text-purple-600" /> VC: <span className="font-medium">{vc.name}</span></span>}
        </div>
      )}
    </div>
  )
}
