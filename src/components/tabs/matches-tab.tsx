'use client'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RefreshCw, Calendar, Users, CheckCircle2, Sparkles, Search, Radio, Loader2 } from 'lucide-react'
import { realApi } from '@/lib/api-client'
import { toast } from 'sonner'
import { PlayerProfileDialog, PlayerProfile } from '@/components/app/player-profile-dialog'

export function MatchesTab() {
  const [matches, setMatches] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)
  const [matchDetail, setMatchDetail] = useState<any>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [profile, setProfile] = useState<PlayerProfile | null>(null)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('ALL')

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
    setSelected(id)
    setDetailLoading(true)
    setMatchDetail(null)
    setSearch('')
    try {
      const res = await realApi.match(id)
      setMatchDetail(res.match)
    } catch (e: any) { toast.error(e.message) }
    finally { setDetailLoading(false) }
  }

  useEffect(() => { void load() }, [])

  // Flatten players from match detail
  const allPlayers = matchDetail ? [
    ...(matchDetail.players?.team1 || []).map((p: any) => ({ ...p, team: matchDetail.team1 })),
    ...(matchDetail.players?.team2 || []).map((p: any) => ({ ...p, team: matchDetail.team2 })),
  ] : []

  const filteredPlayers = allPlayers.filter((p) => {
    const matchesSearch = !search || p.name.toLowerCase().includes(search.toLowerCase())
    const matchesRole = roleFilter === 'ALL' || p.role === roleFilter
    return matchesSearch && matchesRole
  })

  const sel = matches.find((m) => m.id === selected)

  return (
    <div className="grid md:grid-cols-2 gap-4">
      {/* Matches list */}
      <Card className="bg-[#202124] border-[#3c4043] flex flex-col max-h-[calc(100vh-12rem)]">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Radio className="size-4 text-[#d93025]" /> Real Matches</CardTitle>
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="border-[#3c4043] text-[#e8eaed] hover:bg-[#28292c]">
            <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} /> Sync
          </Button>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden p-0">
          <ScrollArea className="h-[calc(100vh-18rem)] px-4">
            <div className="space-y-2 pb-4">
              {loading ? (
                [...Array(4)].map((_, i) => <div key={i} className="h-24 bg-[#28292c] animate-pulse rounded-lg" />)
              ) : matches.map((m) => (
                <button
                  key={m.id}
                  onClick={() => selectMatch(m.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${selected === m.id ? 'border-[#563d7c] bg-[#563d7c]/10' : 'border-[#3c4043] hover:bg-[#28292c]'}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {m.team1Image && <img src={m.team1Image} alt={m.team1} className="size-8 rounded-full" />}
                      <span className="font-bold text-sm">{m.team1}</span>
                      <span className="text-[#9aa0a6] text-xs">vs</span>
                      {m.team2Image && <img src={m.team2Image} alt={m.team2} className="size-8 rounded-full" />}
                      <span className="font-bold text-sm">{m.team2}</span>
                    </div>
                    {m.lineupOut && <Badge className="bg-[#1e8e3e]/20 text-[#1e8e3e] text-[10px]">XI Out</Badge>}
                  </div>
                  <p className="text-xs text-[#9aa0a6] truncate">{m.series}</p>
                  <p className="text-xs text-[#9aa0a6]">{new Date(m.matchTime).toLocaleString()}</p>
                </button>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Match detail */}
      <Card className="bg-[#202124] border-[#3c4043] flex flex-col max-h-[calc(100vh-12rem)]">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              {matchDetail ? `${matchDetail.team1} vs ${matchDetail.team2}` : 'Select a match'}
            </CardTitle>
            {matchDetail && (
              <Badge variant="outline" className={`text-[10px] ${matchDetail.lineupOut ? 'text-[#1e8e3e] border-[#1e8e3e]/40' : 'text-[#f9ab00] border-[#f9ab00]/40'}`}>
                {matchDetail.lineupOut ? '✓ XI Out' : '⏳ XI Pending'}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden">
          {detailLoading ? (
            <div className="text-center py-12"><Loader2 className="size-8 animate-spin text-[#563d7c] mx-auto" /></div>
          ) : matchDetail ? (
            <ScrollArea className="h-[calc(100vh-16rem)]">
              <div className="space-y-3 pb-4">
                {/* Teams */}
                <div className="grid grid-cols-2 gap-2">
                  <TeamBox name={matchDetail.team1} image={matchDetail.team1Image} count={matchDetail.players?.team1?.length || 0} />
                  <TeamBox name={matchDetail.team2} image={matchDetail.team2Image} count={matchDetail.players?.team2?.length || 0} />
                </div>

                {/* Search + filter */}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9aa0a6]" />
                    <Input placeholder="Search player..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 pl-8 text-sm bg-[#131314] border-[#3c4043] text-white" />
                  </div>
                  <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger className="w-24 h-8 text-xs bg-[#131314] border-[#3c4043] text-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All</SelectItem>
                      <SelectItem value="WK">WK</SelectItem>
                      <SelectItem value="BAT">BAT</SelectItem>
                      <SelectItem value="AR">AR</SelectItem>
                      <SelectItem value="BOWL">BOWL</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Squad */}
                <div>
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <Sparkles className="size-4 text-[#563d7c]" /> Squad ({filteredPlayers.length})
                  </h4>
                  <div className="space-y-1">
                    {filteredPlayers.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setProfile({
                          id: String(p.id), name: p.name, shortName: p.name.split(' ').map((w: string) => w[0]).join(''),
                          team: p.team, role: p.role, credit: p.credits, selectedBy: p.selectedBy,
                          formScore: p.points, isPlaying: p.playing, battingStyle: null, bowlingStyle: p.playerType,
                        })}
                        className={`w-full flex items-center justify-between p-1.5 rounded text-sm transition-colors hover:bg-[#28292c] ${p.playing ? 'bg-[#1e8e3e]/10 border border-[#1e8e3e]/30' : 'border border-transparent'}`}
                      >
                        <div className="flex items-center gap-2">
                          {p.image && <img src={p.image} alt={p.name} className="size-6 rounded-full" />}
                          <span className="font-medium">{p.name}</span>
                          {p.playing && <CheckCircle2 className="size-3 text-[#1e8e3e]" />}
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <Badge variant="outline" className="text-[10px] border-[#3c4043]">{p.role}</Badge>
                          <span className="text-[#f9ab00] font-mono">{p.credits}cr</span>
                          <span className="text-[#9aa0a6]">{p.selectedBy}%</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </ScrollArea>
          ) : (
            <p className="text-center text-sm text-[#9aa0a6] py-8">Select a match to view details</p>
          )}
        </CardContent>
      </Card>
      <PlayerProfileDialog player={profile} onClose={() => setProfile(null)} />
    </div>
  )
}

function TeamBox({ name, image, count }: { name: string; image: string; count: number }) {
  return (
    <div className="rounded-lg border border-[#3c4043] p-3 bg-[#28292c]">
      <div className="flex items-center gap-2 mb-1">
        {image && <img src={image} alt={name} className="size-8 rounded-full" />}
        <span className="font-bold text-lg">{name}</span>
      </div>
      <p className="text-xs text-[#9aa0a6]">{count} players</p>
    </div>
  )
}
