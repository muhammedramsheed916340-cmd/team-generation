'use client'
import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Loader2, Flame, ExternalLink, RefreshCw, Radio } from 'lucide-react'
import { realApi } from '@/lib/api-client'
import { toast } from 'sonner'

export function LiveMatchesTab() {
  const [matches, setMatches] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [matchDetail, setMatchDetail] = useState<any>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await realApi.matches('cricket')
      setMatches(res.matches || [])
      if (res.matches[0]) selectMatch(res.matches[0].id)
    } catch (e: any) { toast.error(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [])

  const selectMatch = async (id: string) => {
    setSelectedId(id)
    setDetailLoading(true)
    setMatchDetail(null)
    try {
      const res = await realApi.match(id)
      setMatchDetail(res.match)
    } catch (e: any) { toast.error(e.message) }
    finally { setDetailLoading(false) }
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
          <ScrollArea className="h-[calc(100vh-20rem)]">
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
                    {m.lineupOut && <Badge className="bg-[#1e8e3e]/20 text-[#1e8e3e] text-[10px]">XI</Badge>}
                  </div>
                  <p className="text-[10px] text-[#9aa0a6] truncate">{m.series}</p>
                  <p className="text-[10px] text-[#9aa0a6]">{new Date(m.matchTime).toLocaleString()}</p>
                </button>
              ))}
            </div>
          </ScrollArea>
        </Card>

        {/* Match detail */}
        <Card className="bg-[#202124] border-[#3c4043]">
          <div className="p-3 border-b border-[#3c4043]">
            <h3 className="font-semibold text-sm">
              {matchDetail ? `${matchDetail.team1} vs ${matchDetail.team2}` : 'Select a match'}
            </h3>
          </div>
          <ScrollArea className="h-[calc(100vh-20rem)]">
            <div className="p-3">
              {detailLoading ? (
                <div className="text-center py-8"><Loader2 className="size-6 animate-spin text-[#563d7c] mx-auto" /></div>
              ) : matchDetail ? (
                <div className="space-y-3">
                  {/* Teams */}
                  <div className="flex items-center justify-around p-3 bg-[#28292c] rounded-lg">
                    <div className="text-center">
                      <img src={matchDetail.team1Image} alt={matchDetail.team1} className="size-12 mx-auto rounded-full mb-1" />
                      <p className="font-bold">{matchDetail.team1}</p>
                      <p className="text-xs text-[#9aa0a6]">{matchDetail.players?.team1?.length || 0} players</p>
                    </div>
                    <span className="text-[#9aa0a6] font-bold">VS</span>
                    <div className="text-center">
                      <img src={matchDetail.team2Image} alt={matchDetail.team2} className="size-12 mx-auto rounded-full mb-1" />
                      <p className="font-bold">{matchDetail.team2}</p>
                      <p className="text-xs text-[#9aa0a6]">{matchDetail.players?.team2?.length || 0} players</p>
                    </div>
                  </div>

                  {/* Players */}
                  {matchDetail.players?.team1 && (
                    <div>
                      <h4 className="text-xs font-semibold text-[#9aa0a6] mb-2 uppercase">{matchDetail.team1} Squad</h4>
                      <div className="space-y-1">
                        {matchDetail.players.team1.map((p: any) => (
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
                  {matchDetail.players?.team2 && (
                    <div>
                      <h4 className="text-xs font-semibold text-[#9aa0a6] mb-2 uppercase">{matchDetail.team2} Squad</h4>
                      <div className="space-y-1">
                        {matchDetail.players.team2.map((p: any) => (
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

      <div className="text-center">
        <a href="https://teamgeneration.in" target="_blank" rel="noopener noreferrer" className="text-xs text-[#9aa0a6] hover:text-[#563d7c] inline-flex items-center gap-1">
          Data source: teamgeneration.in <ExternalLink className="size-3" />
        </a>
      </div>
    </div>
  )
}
