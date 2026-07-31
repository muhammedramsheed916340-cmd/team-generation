'use client'
import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Loader2, Flame, RefreshCw, Radio, Sparkles, Crown, Star, Shield, TrendingUp, Layers, AlertCircle } from 'lucide-react'
import { realApi } from '@/lib/api-client'
import { toast } from 'sonner'

const STRATEGIES = [
  { id: 'GL', name: 'Grand League', desc: 'Contrarian, high uniqueness', icon: <Layers className="size-4" />, color: 'bg-[#563d7c]' },
  { id: 'SL', name: 'Small League', desc: 'Safe, high selection core', icon: <Shield className="size-4" />, color: 'bg-[#1e8e3e]' },
  { id: 'H2H', name: 'Head-to-Head', desc: 'Optimal, max points', icon: <TrendingUp className="size-4" />, color: 'bg-[#1a73e8]' },
]

export function LiveMatchesTab() {
  const [matches, setMatches] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [matchDetail, setMatchDetail] = useState<any>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // Generation state
  const [strategy, setStrategy] = useState('GL')
  const [count, setCount] = useState([5])
  const [generating, setGenerating] = useState(false)
  const [generatedTeams, setGeneratedTeams] = useState<any[]>([])

  const load = async () => {
    setLoading(true)
    try {
      const res = await realApi.matches('cricket')
      setMatches(res.matches || [])
      if (res.matches[0]) selectMatch(res.matches[0].id)
    } catch (e: any) { toast.error(e.message) }
    finally { setLoading(false) }
  }

  const selectMatch = async (id: string) => {
    setSelectedId(id)
    setDetailLoading(true)
    setMatchDetail(null)
    setGeneratedTeams([])
    try {
      const res = await realApi.match(id)
      setMatchDetail(res.match)
    } catch (e: any) { toast.error(e.message) }
    finally { setDetailLoading(false) }
  }

  useEffect(() => { void load() }, [])

  const generate = async () => {
    if (!selectedId) { toast.error('Select a match first'); return }
    setGenerating(true)
    setGeneratedTeams([])
    try {
      const res = await realApi.generate(selectedId, strategy, count[0])
      setGeneratedTeams(res.teams || [])
      toast.success(`Generated ${res.teams?.length || 0} ${strategy} teams from real data!`)
    } catch (e: any) { toast.error(e.message) }
    finally { setGenerating(false) }
  }

  return (
    <div className="space-y-4">
      {/* Hero */}
      <Card className="overflow-hidden border-0 bg-gradient-to-r from-[#d93025] via-[#e94235] to-[#d93025] p-5 text-white">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
            <Radio className="size-6 animate-pulse" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold">Live Matches from teamgeneration.in</h2>
            <p className="text-white/80 text-xs">Real-time data fetched & decrypted from the original backend</p>
          </div>
          <Button size="sm" variant="secondary" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
          </Button>
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Match list */}
        <Card className="bg-[#202124] border-[#3c4043]">
          <div className="p-3 border-b border-[#3c4043] flex items-center gap-2">
            <Flame className="size-4 text-[#d93025]" />
            <h3 className="font-semibold text-sm">Matches ({matches.length})</h3>
          </div>
          <ScrollArea className="h-[calc(100vh-22rem)]">
            <div className="p-2 space-y-2">
              {loading ? (
                [...Array(4)].map((_, i) => <div key={i} className="h-20 bg-[#28292c] animate-pulse rounded-lg" />)
              ) : matches.length === 0 ? (
                <p className="text-center text-sm text-[#9aa0a6] py-8">No live matches</p>
              ) : matches.map((m) => (
                <button
                  key={m.id}
                  onClick={() => selectMatch(m.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${selectedId === m.id ? 'border-[#563d7c] bg-[#563d7c]/10' : 'border-[#3c4043] hover:bg-[#28292c]'}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {m.team1Image && <img src={m.team1Image} alt={m.team1} className="size-6 rounded-full" />}
                      <span className="font-bold text-sm">{m.team1}</span>
                      <span className="text-[#9aa0a6] text-xs">vs</span>
                      {m.team2Image && <img src={m.team2Image} alt={m.team2} className="size-6 rounded-full" />}
                      <span className="font-bold text-sm">{m.team2}</span>
                    </div>
                    {m.lineupOut && <Badge className="bg-[#1e8e3e]/20 text-[#1e8e3e] text-[10px]">XI Out</Badge>}
                  </div>
                  <p className="text-[10px] text-[#9aa0a6] truncate">{m.series}</p>
                  <p className="text-[10px] text-[#9aa0a6]">{new Date(m.matchTime).toLocaleString()}</p>
                </button>
              ))}
            </div>
          </ScrollArea>
        </Card>

        {/* Match detail + Generation */}
        <Card className="bg-[#202124] border-[#3c4043]">
          <div className="p-3 border-b border-[#3c4043]">
            <h3 className="font-semibold text-sm">
              {matchDetail ? `${matchDetail.team1} vs ${matchDetail.team2}` : 'Select a match'}
            </h3>
            {matchDetail && (
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className={`text-[10px] ${matchDetail.lineupOut ? 'text-[#1e8e3e] border-[#1e8e3e]/40' : 'text-[#f9ab00] border-[#f9ab00]/40'}`}>
                  {matchDetail.lineupOut ? '✓ Lineup Out' : '⏳ Lineup Pending'}
                </Badge>
                <span className="text-[10px] text-[#9aa0a6]">
                  {matchDetail.players?.team1?.length || 0} + {matchDetail.players?.team2?.length || 0} players
                </span>
              </div>
            )}
          </div>

          <ScrollArea className="h-[calc(100vh-26rem)]">
            <div className="p-3">
              {detailLoading ? (
                <div className="text-center py-8"><Loader2 className="size-6 animate-spin text-[#563d7c] mx-auto" /></div>
              ) : matchDetail ? (
                <div className="space-y-3">
                  {/* Generation controls */}
                  <div className="space-y-2">
                    <div className="grid grid-cols-3 gap-1.5">
                      {STRATEGIES.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => setStrategy(s.id)}
                          className={`p-2 rounded-lg border text-center transition-colors ${strategy === s.id ? 'border-[#563d7c] bg-[#563d7c]/10' : 'border-[#3c4043] hover:bg-[#28292c]'}`}
                        >
                          <div className="flex items-center justify-center gap-1 mb-0.5">{s.icon}<span className="text-[10px] font-bold">{s.id}</span></div>
                          <p className="text-[9px] text-[#9aa0a6] leading-tight">{s.name}</p>
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[#9aa0a6]">Teams:</span>
                      <Slider value={count} onValueChange={setCount} min={1} max={20} step={1} className="flex-1" />
                      <Badge variant="secondary" className="font-mono text-xs">{count[0]}</Badge>
                    </div>
                    <Button onClick={generate} disabled={generating} className="w-full bg-[#563d7c] hover:bg-[#6b4ba3] text-white">
                      {generating ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                      Generate {count[0]} {strategy} Teams
                    </Button>
                    {!matchDetail.lineupOut && (
                      <p className="text-[10px] text-[#f9ab00] flex items-center gap-1">
                        <AlertCircle className="size-3" /> Lineup pending — generating from full squad (bench players penalized)
                      </p>
                    )}
                    {matchDetail.lineupOut && (
                      <p className="text-[10px] text-[#1e8e3e] flex items-center gap-1">
                        <AlertCircle className="size-3" /> Lineup out — only playing XI used (bench excluded)
                      </p>
                    )}
                  </div>

                  {/* Generated teams */}
                  {generatedTeams.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-[#9aa0a6] uppercase">Generated Teams ({generatedTeams.length})</h4>
                      {generatedTeams.map((t, i) => (
                        <div key={i} className="p-2 rounded-lg border border-[#3c4043] bg-[#28292c]">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-mono">#{i + 1}</span>
                            <div className="flex items-center gap-1">
                              <Badge variant="outline" className="text-[10px] border-[#3c4043]">{t.combinationKey}</Badge>
                              <Badge className={`text-[10px] ${t.riskLevel === 'LOW' ? 'bg-[#1e8e3e]/20 text-[#1e8e3e]' : t.riskLevel === 'MEDIUM' ? 'bg-[#f9ab00]/20 text-[#f9ab00]' : 'bg-[#d93025]/20 text-[#d93025]'}`}>{t.riskLevel}</Badge>
                              <span className="text-[10px] text-[#f9ab00] font-mono">{t.totalCredit}cr</span>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {t.players.map((p: any) => (
                              <div key={p.id} className={`text-[10px] px-1.5 py-0.5 rounded border ${p.isCaptain ? 'border-[#f9ab00] bg-[#f9ab00]/10' : p.isViceCaptain ? 'border-[#1a73e8] bg-[#1a73e8]/10' : 'border-[#3c4043]'}`}>
                                {p.isCaptain && <Crown className="size-2 inline mr-0.5 text-[#f9ab00]" />}
                                {p.isViceCaptain && <Star className="size-2 inline mr-0.5 text-[#1a73e8]" />}
                                {p.name.split(' ').slice(-1)[0]}
                              </div>
                            ))}
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-[10px] text-[#9aa0a6]">
                            <span>C: <span className="text-[#f9ab00]">{t.captainName}</span></span>
                            <span>VC: <span className="text-[#1a73e8]">{t.viceCaptainName}</span></span>
                            <span className="ml-auto">{t.team1Count}-{t.team2Count}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Players preview */}
                  {matchDetail.players?.team1 && generatedTeams.length === 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-[#9aa0a6] mb-2 uppercase">{matchDetail.team1} Squad</h4>
                      <div className="space-y-1">
                        {matchDetail.players.team1.slice(0, 8).map((p: any) => (
                          <div key={p.id} className="flex items-center justify-between p-1.5 rounded bg-[#28292c] text-sm">
                            <div className="flex items-center gap-2">
                              {p.image && <img src={p.image} alt={p.name} className="size-6 rounded-full" />}
                              <span className="font-medium">{p.name}</span>
                              {p.playing && <span className="size-1.5 rounded-full bg-[#1e8e3e]" />}
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                              <Badge variant="outline" className="text-[10px] border-[#3c4043]">{p.role}</Badge>
                              <span className="text-[#f9ab00] font-mono">{p.credits}cr</span>
                              <span className="text-[#9aa0a6]">{p.selectedBy}%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-center text-sm text-[#9aa0a6] py-8">Select a match to view details</p>
              )}
            </div>
          </ScrollArea>
        </Card>
      </div>
    </div>
  )
}
