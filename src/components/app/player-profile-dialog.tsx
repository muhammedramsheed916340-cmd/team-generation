'use client'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Trophy, TrendingUp, Users, Activity, Zap, Target, Shield, Star } from 'lucide-react'

export interface PlayerProfile {
  id: string
  name: string
  shortName: string
  team: string
  role: string
  battingStyle?: string | null
  bowlingStyle?: string | null
  credit: number
  selectedBy: number
  formScore: number
  isPlaying: boolean
}

const ROLE_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  WK: { label: 'Wicket Keeper', icon: <Shield className="size-4" />, color: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400' },
  BAT: { label: 'Batter', icon: <TrendingUp className="size-4" />, color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' },
  AR: { label: 'All Rounder', icon: <Zap className="size-4" />, color: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400' },
  BOWL: { label: 'Bowler', icon: <Target className="size-4" />, color: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400' },
}

export function PlayerProfileDialog({ player, onClose }: { player: PlayerProfile | null; onClose: () => void }) {
  if (!player) return null
  const meta = ROLE_META[player.role] || ROLE_META.BAT

  // derived stats for visual flair
  const battingRating = player.role === 'BOWL' ? Math.max(10, player.formScore - 30) : player.formScore
  const bowlingRating = player.role === 'BAT' ? Math.max(10, player.formScore - 30) : player.formScore
  const consistency = Math.round(40 + Math.random() * 50) // simulated
  const recentForm = [Math.random() * 100, Math.random() * 100, Math.random() * 100, Math.random() * 100, Math.random() * 100].map((v) => Math.round(v))

  return (
    <Dialog open={!!player} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className={`size-14 rounded-xl flex items-center justify-center text-2xl font-bold ${meta.color}`}>
              {player.shortName.split(' ').map((w) => w[0]).join('').slice(0, 2)}
            </div>
            <div className="flex-1">
              <DialogTitle className="text-xl">{player.name}</DialogTitle>
              <DialogDescription className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className={meta.color}>{meta.icon} {player.role}</Badge>
                <span className="text-sm">{player.team}</span>
                {player.isPlaying && <Badge variant="default" className="text-emerald-600 text-xs">Playing</Badge>}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Credit + Selection */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border p-3 text-center">
              <div className="flex items-center justify-center mb-1"><Trophy className="size-4 text-amber-500" /></div>
              <p className="text-2xl font-bold">{player.credit}</p>
              <p className="text-xs text-muted-foreground">Credits</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <div className="flex items-center justify-center mb-1"><Users className="size-4 text-blue-500" /></div>
              <p className="text-2xl font-bold">{player.selectedBy}%</p>
              <p className="text-xs text-muted-foreground">Selected By</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <div className="flex items-center justify-center mb-1"><Activity className="size-4 text-emerald-500" /></div>
              <p className="text-2xl font-bold">{player.formScore}</p>
              <p className="text-xs text-muted-foreground">Form Score</p>
            </div>
          </div>

          {/* Style info */}
          {(player.battingStyle || player.bowlingStyle) && (
            <div className="space-y-1.5">
              {player.battingStyle && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1.5"><TrendingUp className="size-3.5" /> Batting Style</span>
                  <span className="font-medium">{player.battingStyle}</span>
                </div>
              )}
              {player.bowlingStyle && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1.5"><Target className="size-3.5" /> Bowling Style</span>
                  <span className="font-medium">{player.bowlingStyle}</span>
                </div>
              )}
            </div>
          )}

          <Separator />

          {/* Ratings */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold flex items-center gap-1.5"><Star className="size-4 text-amber-500" /> Player Ratings</h4>
            <RatingBar label="Batting" value={battingRating} color="emerald" />
            <RatingBar label="Bowling" value={bowlingRating} color="blue" />
            <RatingBar label="Consistency" value={consistency} color="purple" />
            <RatingBar label="Current Form" value={player.formScore} color="amber" />
          </div>

          <Separator />

          {/* Recent form sparkline */}
          <div>
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5"><Activity className="size-4 text-emerald-500" /> Recent Form (last 5)</h4>
            <div className="flex items-end justify-between gap-1.5 h-16">
              {recentForm.map((v, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className={`w-full rounded-t transition-all ${v > 60 ? 'bg-emerald-500' : v > 30 ? 'bg-amber-500' : 'bg-red-400'}`}
                    style={{ height: `${v}%`, minHeight: '4px' }}
                  />
                  <span className="text-xs text-muted-foreground">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function RatingBar({ label, value, color }: { label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    emerald: 'bg-emerald-500',
    blue: 'bg-blue-500',
    purple: 'bg-purple-500',
    amber: 'bg-amber-500',
  }
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono font-medium">{value}/100</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className={`h-full ${colors[color]} transition-all`} style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}
