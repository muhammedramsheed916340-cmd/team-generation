'use client'
import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Users, Trophy, Send, Calendar, Activity, Zap, RefreshCw, Sparkles, Brain, Play, TrendingUp, Flame, Target } from 'lucide-react'
import { healthApi, matchesApi } from '@/lib/api-client'
import { toast } from 'sonner'

export function DashboardTab({ onNavigate }: { onNavigate: (t: string) => void }) {
  const [metrics, setMetrics] = useState<any>(null)
  const [matches, setMatches] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = async (retries = 2) => {
    setLoading(true)
    for (let i = 0; i <= retries; i++) {
      try {
        const [m, matchesRes] = await Promise.all([healthApi.metrics(), matchesApi.list()])
        setMetrics(m)
        setMatches(matchesRes.matches)
        setLoading(false)
        return
      } catch (e: any) {
        if (i < retries) {
          await new Promise(r => setTimeout(r, 800 * (i + 1)))
        } else {
          toast.error('Failed to load data: ' + e.message)
          setLoading(false)
        }
      }
    }
  }

  useEffect(() => { void load() }, [])

  const c = metrics?.counts || {}

  return (
    <div className="space-y-4">
      {/* Hero banner - like original Dream11 banner */}
      <div className="rounded-xl overflow-hidden bg-gradient-to-r from-[#563d7c] via-[#7c5bb5] to-[#563d7c] p-6 text-white relative">
        <div className="relative z-10">
          <h1 className="text-2xl md:text-3xl font-bold mb-1">India's Best Dream11 Team Generator</h1>
          <p className="text-white/80 text-sm">Create Grand League winning teams with AI · GL · SL · H2H strategies</p>
          <div className="flex gap-2 mt-4 flex-wrap">
            <Button size="sm" variant="secondary" onClick={() => onNavigate('generator')}><Sparkles className="size-3.5" /> Generate Teams</Button>
            <Button size="sm" variant="secondary" onClick={() => onNavigate('transfer')}><Send className="size-3.5" /> Direct Transfer</Button>
            <Button size="sm" variant="secondary" onClick={() => onNavigate('predictions')}><Brain className="size-3.5" /> Predictions</Button>
          </div>
        </div>
        <div className="absolute right-4 top-4 opacity-20">
          <Trophy className="size-24" />
        </div>
      </div>

      {/* Stats - dark cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <DarkStat icon={<Users className="size-4" />} label="Users" value={c.totalUsers ?? '—'} color="#1a73e8" />
        <DarkStat icon={<Calendar className="size-4" />} label="Matches" value={c.totalMatches ?? '—'} color="#1e8e3e" />
        <DarkStat icon={<Trophy className="size-4" />} label="Teams Generated" value={c.totalTeams ?? '—'} color="#f9ab00" />
        <DarkStat icon={<Send className="size-4" />} label="Transfers" value={c.totalTransfers ?? '—'} color="#563d7c" />
      </div>

      {/* Upcoming Matches - like original match cards */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold flex items-center gap-2"><Flame className="size-5 text-[#d93025]" /> Upcoming Matches</h2>
          <Button variant="ghost" size="sm" onClick={() => onNavigate('matches')} className="text-[#9aa0a6]">View All →</Button>
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          {loading ? (
            [...Array(4)].map((_, i) => <div key={i} className="h-32 bg-[#202124] animate-pulse rounded-xl" />)
          ) : matches.length === 0 ? (
            <div className="col-span-2 text-center py-8 bg-[#202124] rounded-xl border border-[#3c4043]">
              <Calendar className="size-8 mx-auto mb-2 text-[#9aa0a6]" />
              <p className="text-sm text-[#9aa0a6] mb-3">No matches available</p>
              <Button size="sm" variant="outline" onClick={() => load()} className="border-[#3c4043] text-[#e8eaed] hover:bg-[#28292c]">
                <RefreshCw className="size-3.5" /> Refresh
              </Button>
            </div>
          ) : matches.slice(0, 6).map((m) => (
            <MatchCard key={m.id} match={m} onNavigate={onNavigate} />
          ))}
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid md:grid-cols-4 gap-3">
        <QuickAction icon={<Brain className="size-5" />} title="Predictions" desc="AI win probability" onClick={() => onNavigate('predictions')} />
        <QuickAction icon={<Play className="size-5" />} title="Simulation" desc="Ball-by-ball sim" onClick={() => onNavigate('simulation')} />
        <QuickAction icon={<Sparkles className="size-5" />} title="AI Generator" desc="GL/SL/H2H teams" onClick={() => onNavigate('generator')} />
        <QuickAction icon={<Send className="size-5" />} title="Transfer" desc="Direct to Dream11" onClick={() => onNavigate('transfer')} />
      </div>
    </div>
  )
}

function MatchCard({ match, onNavigate }: { match: any; onNavigate: (t: string) => void }) {
  const startDate = new Date(match.startAt)
  const isLive = match.status === 'LIVE'
  return (
    <Card className="bg-[#202124] border-[#3c4043] overflow-hidden hover:border-[#563d7c] transition-colors cursor-pointer" onClick={() => onNavigate('matches')}>
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <Badge variant="outline" className="text-[10px] text-[#9aa0a6] border-[#3c4043]">{match.series}</Badge>
          {isLive ? (
            <Badge className="bg-[#d93025] text-white text-[10px] animate-pulse">● LIVE</Badge>
          ) : match.playingXINamed ? (
            <Badge className="bg-[#1e8e3e]/20 text-[#1e8e3e] text-[10px]">XI Announced</Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] text-[#9aa0a6] border-[#3c4043]">{startDate.toLocaleDateString()}</Badge>
          )}
        </div>
        {/* Teams */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 flex-1">
            <div className="size-10 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: match.team1Color }}>
              {match.team1Short.slice(0, 2)}
            </div>
            <span className="font-semibold text-sm">{match.team1Short}</span>
          </div>
          <span className="text-[#9aa0a6] text-xs font-bold">VS</span>
          <div className="flex items-center gap-2 flex-1 justify-end">
            <span className="font-semibold text-sm">{match.team2Short}</span>
            <div className="size-10 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: match.team2Color }}>
              {match.team2Short.slice(0, 2)}
            </div>
          </div>
        </div>
        {/* GL/SL/H2H buttons - like original */}
        <div className="flex gap-1.5">
          <Button size="sm" className="flex-1 bg-[#563d7c] hover:bg-[#6b4ba3] text-white text-xs h-7" onClick={(e) => { e.stopPropagation(); onNavigate('generator') }}>Mega</Button>
          <Button size="sm" variant="outline" className="flex-1 border-[#3c4043] text-[#e8eaed] hover:bg-[#28292c] text-xs h-7" onClick={(e) => { e.stopPropagation(); onNavigate('generator') }}>GL</Button>
          <Button size="sm" variant="outline" className="flex-1 border-[#3c4043] text-[#e8eaed] hover:bg-[#28292c] text-xs h-7" onClick={(e) => { e.stopPropagation(); onNavigate('generator') }}>SL</Button>
          <Button size="sm" variant="outline" className="flex-1 border-[#3c4043] text-[#e8eaed] hover:bg-[#28292c] text-xs h-7" onClick={(e) => { e.stopPropagation(); onNavigate('generator') }}>H2H</Button>
        </div>
        {match.tossWinner && (
          <p className="text-[10px] text-[#f9ab00] mt-2 text-center">Toss: {match.tossWinner} chose to {match.tossDecision}</p>
        )}
      </div>
    </Card>
  )
}

function DarkStat({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: React.ReactNode; color: string }) {
  return (
    <Card className="bg-[#202124] border-[#3c4043] p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-[#9aa0a6]">{label}</p>
        <div className="size-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}20`, color }}>{icon}</div>
      </div>
      <p className="text-2xl font-bold mt-2 tabular-nums text-white">{value}</p>
    </Card>
  )
}

function QuickAction({ icon, title, desc, onClick }: { icon: React.ReactNode; title: string; desc: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="text-left p-4 rounded-xl bg-[#202124] border border-[#3c4043] hover:border-[#563d7c] transition-colors">
      <div className="size-10 rounded-lg bg-[#563d7c] text-white flex items-center justify-center mb-3">{icon}</div>
      <p className="font-semibold text-white">{title}</p>
      <p className="text-sm text-[#9aa0a6] mt-0.5">{desc}</p>
    </button>
  )
}
