'use client'
// ============================================================
// TEMP BYPASS — Dream11 & My11Circle are now free, so Team
// Generation is also free temporarily. This tab now shows a
// "All Features Free" banner instead of paid plans.
// Revert this file to the original version (with paid plan cards)
// when fantasy platforms stop being free.
// ============================================================
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Crown, Check, Sparkles, Gift, Heart } from 'lucide-react'
import { subsApi, licenseApi } from '@/lib/api-client'
import { toast } from 'sonner'

export function SubscriptionsTab() {
  const [plans, setPlans] = useState<any[]>([])
  const [licenses, setLicenses] = useState<any[]>([])

  const load = async () => {
    try {
      const [p, l] = await Promise.all([subsApi.plans(), licenseApi.list()])
      setPlans(p.plans)
      setLicenses(l.licenses)
    } catch (e: any) { toast.error(e.message) }
  }
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load() }, [])

  return (
    <div className="space-y-6">
      {/* Free announcement banner */}
      <Card className="border-emerald-500/40 bg-gradient-to-br from-emerald-500/10 to-amber-500/10">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-3">
            <div className="size-10 rounded-full bg-gradient-to-br from-emerald-500 to-amber-500 flex items-center justify-center">
              <Gift className="size-6 text-white" />
            </div>
            All Features Are Now <span className="text-emerald-500">FREE</span>
          </CardTitle>
          <CardDescription className="text-base">
            Since Dream11 and My11Circle are now free, Team Generation is also 100% free.
            No subscriptions, no license keys, no payments — generate unlimited teams.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { icon: Sparkles, label: 'Unlimited team generation' },
              { icon: Check, label: 'All strategies (GL, SL, H2H)' },
              { icon: Check, label: 'Fantasy transfer to Dream11 / My11Circle' },
              { icon: Check, label: 'AI predictions & simulations' },
            ].map(({ icon: Icon, label }, i) => (
              <div key={i} className="flex items-start gap-2 p-3 rounded-lg bg-background/50">
                <Icon className="size-4 text-emerald-500 shrink-0 mt-0.5" />
                <span className="text-sm">{label}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
            <Heart className="size-3.5 text-rose-500" />
            <span>Enjoy — and good luck with your Grand League teams!</span>
          </div>
        </CardContent>
      </Card>

      {/* Existing licenses (if user previously purchased any — still shown for transparency) */}
      {licenses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Crown className="size-4 text-amber-600" /> Your Previously Activated Licenses
            </CardTitle>
            <CardDescription>These are kept for your records. No active license is required — all features are free.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {licenses.map((l) => (
              <div key={l.id} className="flex items-center justify-between p-2 rounded border text-sm">
                <div>
                  <p className="font-mono font-medium">{l.key}</p>
                  <p className="text-xs text-muted-foreground">{l.plan?.name}</p>
                </div>
                <Badge variant={l.status === 'ACTIVE' ? 'default' : 'secondary'}>{l.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Plans list — all free now */}
      <div>
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Crown className="size-5 text-amber-600" /> Available Plans
        </h3>
        <div className="grid md:grid-cols-4 gap-3">
          {plans.map((p) => (
            <Card key={p.id} className={p.name === 'MASTERY' ? 'border-amber-500' : ''}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{p.displayName}</CardTitle>
                  {p.name === 'MASTERY' && <Badge className="bg-amber-500">Best</Badge>}
                </div>
                <CardDescription>{p.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-3xl font-bold text-emerald-500">
                  FREE
                  <span className="text-sm font-normal text-muted-foreground"> / {p.durationDays}d</span>
                </div>
                <ul className="space-y-1 text-sm">
                  {p.features.map((f: string, i: number) => (
                    <li key={i} className="flex items-center gap-2">
                      <Check className="size-3.5 text-emerald-600 shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
                <div className="pt-2 text-xs text-muted-foreground space-y-1">
                  <p>Unlimited credits/day</p>
                  <p>Max {p.maxTeamsPerMatch} teams/match</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
