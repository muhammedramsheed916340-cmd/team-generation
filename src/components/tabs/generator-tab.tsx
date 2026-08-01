'use client'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Sparkles, Wand2, Loader2, Crown, Star, TrendingUp, Shield, Layers, RefreshCw, AlertCircle, Radio } from 'lucide-react'
import { realApi } from '@/lib/api-client'
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
  const [generating, setGenerating] = useState(false)
  const [teams, setTeams] = useState<any[]>([])
  const [matchInfo, setMatchInfo] = useState<any>(null)

  useEffect(() => {
    // Fetch REAL matches from teamgeneration.in ONLY — no fallback to mock data
    realApi.matches('cricket').then((r) => {
      setMatches(r.matches || [])
      if (r.matches?.[0]) setMatchId(r.matches[0].id)
    }).catch((e) => {
      toast.error('Failed to load real matches: ' + e.message)
    })
  }, [])

  const generate = async () => {
    if (!matchId) { toast.error('Select a match first'); return }
    setGenerating(true)
    setTeams([])
    try {
      // Use real generation API with real player data
      const res = await realApi.generate(matchId, strategy, count[0])
      setTeams(res.teams || [])
      setMatchInfo(res.match)
      toast.success(`Generated ${res.teams?.length || 0} ${strategy} teams from real data!`)
    } catch (e: any) {
      toast.error(e.message)
    } finally { setGenerating(false) }
  }

  const selMatch = matches.find((m) => m.id === matchId)

  return (
    <div className="grid md:grid-cols-2 gap-4">
      {/* Config */}
      <Card className="bg-[#202124] border-[#3c4043]">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Sparkles className="size-4 text-[#563d7c]" /> AI Team Generator</CardTitle>
          <CardDescription>Generate teams using real player data from teamgeneration.in</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Match selector */}
          <div className="space-y-2">
            <Label>Match (Real Data)</Label>
            <Select value={matchId} onValueChange={setMatchId}>
              <SelectTrigger className="bg-[#131314] border-[#3c4043] text-white"><SelectValue placeholder="Select match" /></SelectTrigger>
              <SelectContent>
                {matches.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.team1 || m.team1Short} vs {m.team2 || m.team2Short} · {(m.series || '').slice(0, 25)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selMatch && (
              <div className="flex items-center gap-2 mt-1">
                {selMatch.team1Image && <img src={selMatch.team1Image} alt="" className="size-5 rounded-full" />}
                <span className="text-xs text-[#9aa0a6]">vs</span>
                {selMatch.team2Image && <img src={selMatch.team2Image} alt="" className="size-5 rounded-full" />}
                <Badge variant="outline" className={`text-[10px] ml-auto ${selMatch.lineupOut ? 'text-[#1e8e3e] border-[#1e8e3e]/40' : 'text-[#f9ab00] border-[#f9ab00]/40'}`}>
                  {selMatch.lineupOut ? '✓ Lineup Out' : '⏳ Lineup Pending'}
                </Badge>
              </div>
            )}
          </div>

          {/* Strategy */}
          <div className="space-y-2">
            <Label>Strategy</Label>
            <div className="grid grid-cols-3 gap-2">
              {STRATEGIES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setStrategy(s.id)}
                  className={`p-3 rounded-lg border text-left transition-colors ${strategy === s.id ? 'border-[#563d7c] bg-[#563d7c]/10' : 'border-[#3c4043] hover:bg-[#28292c]'}`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    {s.icon}
                    <span className="text-xs font-bold">{s.id}</span>
                  </div>
                  <p className="text-xs text-[#9aa0a6] leading-tight">{s.name}</p>
                </button>
              ))}
            </div>
            <p className="text-xs text-[#9aa0a6]">{STRATEGIES.find((s) => s.id === strategy)?.desc}</p>
          </div>

          {/* Count */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Number of teams</Label>
              <Badge variant="secondary" className="font-mono">{count[0]}</Badge>
            </div>
            <Slider value={count} onValueChange={setCount} min={1} max={20} step={1} />
          </div>

          {/* Lineup info */}
          {selMatch && (
            <div className={`p-3 rounded-lg border text-xs flex items-start gap-2 ${selMatch.lineupOut ? 'border-[#1e8e3e]/30 bg-[#1e8e3e]/5 text-[#1e8e3e]' : 'border-[#f9ab00]/30 bg-[#f9ab00]/5 text-[#f9ab00]'}`}>
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <div>
                {selMatch.lineupOut ? (
                  <span><strong>Lineup Out:</strong> Only playing XI players will be used. Bench players excluded.</span>
                ) : (
                  <span><strong>Lineup Pending:</strong> Full squad used. Low-form/bench players penalized (0.3x weight).</span>
                )}
              </div>
            </div>
          )}

          <Button onClick={generate} disabled={generating} className="w-full bg-[#563d7c] hover:bg-[#6b4ba3] text-white">
            {generating ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
            Generate {count[0]} {strategy} {count[0] > 1 ? 'Teams' : 'Team'}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      <Card className="bg-[#202124] border-[#3c4043] flex flex-col max-h-[calc(100vh-12rem)]">
        <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="size-4" /> Generated Teams ({teams.length})
          </CardTitle>
          {matchInfo && (
            <Badge variant="outline" className="text-[10px] border-[#3c4043] text-[#9aa0a6]">
              {matchInfo.team1} vs {matchInfo.team2}
            </Badge>
          )}
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden">
          <ScrollArea className="h-[calc(100vh-16rem)]">
            <div className="space-y-3 pb-4">
              {teams.length === 0 ? (
                <div className="text-center py-12 text-[#9aa0a6]">
                  <Sparkles className="size-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No teams yet. Generate some!</p>
                  <p className="text-xs mt-1">Uses real player data from teamgeneration.in</p>
                </div>
              ) : (
                teams.map((t, i) => <TeamCard key={i} team={t} index={i} />)
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

  return (
    <div className="rounded-lg border border-[#3c4043] bg-[#28292c] p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-[#131314]">#{index + 1}</span>
          <Badge variant="outline" className="text-xs border-[#3c4043]">{team.combinationKey}</Badge>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge variant={team.riskLevel === 'LOW' ? 'default' : team.riskLevel === 'MEDIUM' ? 'secondary' : 'destructive'} className="text-xs">{team.riskLevel}</Badge>
          <span className="text-xs text-[#f9ab00] font-mono">{team.totalCredit} cr</span>
        </div>
      </div>
      {/* Players with images */}
      <div className="flex flex-wrap gap-1 mb-2">
        {team.players?.map((p: any) => (
          <div
            key={p.id}
            className={`text-[10px] px-1.5 py-0.5 rounded border flex items-center gap-1 ${
              p.isCaptain ? 'border-[#f9ab00] bg-[#f9ab00]/10' :
              p.isViceCaptain ? 'border-[#1a73e8] bg-[#1a73e8]/10' :
              'border-[#3c4043]'
            }`}
          >
            {p.isCaptain && <Crown className="size-2.5 text-[#f9ab00]" />}
            {p.isViceCaptain && <Star className="size-2.5 text-[#1a73e8]" />}
            {p.image && <img src={p.image} alt="" className="size-4 rounded-full" />}
            <span>{p.name.split(' ').slice(-1)[0]}</span>
          </div>
        ))}
      </div>
      <Separator className="my-2 bg-[#3c4043]" />
      <div className="flex items-center gap-3 text-xs">
        {captain && (
          <span className="flex items-center gap-1">
            <Crown className="size-3 text-[#f9ab00]" />
            <span className="text-[#9aa0a6]">C:</span>
            <span className="font-medium text-white">{captain.name}</span>
          </span>
        )}
        {vc && (
          <span className="flex items-center gap-1">
            <Star className="size-3 text-[#1a73e8]" />
            <span className="text-[#9aa0a6]">VC:</span>
            <span className="font-medium text-white">{vc.name}</span>
          </span>
        )}
        <span className="ml-auto text-[#9aa0a6]">{team.team1Count}-{team.team2Count}</span>
      </div>
    </div>
  )
}
