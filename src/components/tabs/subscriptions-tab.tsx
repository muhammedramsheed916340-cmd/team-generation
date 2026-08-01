'use client'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Crown, Check, Loader2, KeyRound, Shield } from 'lucide-react'
import { subsApi, licenseApi } from '@/lib/api-client'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'

export function SubscriptionsTab() {
  const [plans, setPlans] = useState<any[]>([])
  const [licenses, setLicenses] = useState<any[]>([])
  const [licenseKey, setLicenseKey] = useState('')
  const [loading, setLoading] = useState(false)

  const load = async () => {
    try {
      const [p, l] = await Promise.all([subsApi.plans(), licenseApi.list()])
      setPlans(p.plans)
      setLicenses(l.licenses)
    } catch (e: any) { toast.error(e.message) }
  }
  useEffect(() => { void load() }, [])

  const activate = async (planId: string) => {
    setLoading(true)
    try { await subsApi.activate(planId); toast.success('Plan activated!'); load() } catch (e: any) { toast.error(e.message) }
    finally { setLoading(false) }
  }
  const activateLicense = async () => {
    if (!licenseKey) return
    setLoading(true)
    try { await licenseApi.activate(licenseKey); toast.success('License activated!'); setLicenseKey(''); load() } catch (e: any) { toast.error(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><KeyRound className="size-4" /> Activate License Key</CardTitle><CardDescription>Enter your license key to unlock a plan</CardDescription></CardHeader>
          <CardContent><Input placeholder="TG-PRO-XXXXXX" value={licenseKey} onChange={(e) => setLicenseKey(e.target.value)} /></CardContent>
          <CardFooter><Button onClick={activateLicense} disabled={loading || !licenseKey}>{loading ? <Loader2 className="size-4 animate-spin" /> : <Shield className="size-4" />} Activate</Button></CardFooter>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Your Licenses</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {licenses.length === 0 ? <p className="text-sm text-muted-foreground">No licenses</p> : licenses.map((l) => (
              <div key={l.id} className="flex items-center justify-between p-2 rounded border text-sm">
                <div><p className="font-mono font-medium">{l.key}</p><p className="text-xs text-muted-foreground">{l.plan?.name}</p></div>
                <Badge variant={l.status === 'ACTIVE' ? 'default' : 'secondary'}>{l.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2"><Crown className="size-5 text-amber-600" /> Subscription Plans</h3>
        <div className="grid md:grid-cols-4 gap-3">
          {plans.map((p) => (
            <Card key={p.id} className={p.name === 'ELITE' ? 'border-amber-500' : ''}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{p.displayName}</CardTitle>
                  {p.name === 'ELITE' && <Badge className="bg-amber-500">Popular</Badge>}
                </div>
                <CardDescription>{p.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-3xl font-bold">₹{p.priceInr}<span className="text-sm font-normal text-muted-foreground">/{p.durationDays}d</span></div>
                <ul className="space-y-1 text-sm">
                  {p.features.map((f: string, i: number) => <li key={i} className="flex items-center gap-2"><Check className="size-3.5 text-emerald-600 shrink-0" /> {f}</li>)}
                </ul>
                <div className="pt-2 text-xs text-muted-foreground space-y-1">
                  <p>{p.creditsPerDay} credits/day</p>
                  <p>Max {p.maxTeamsPerMatch} teams/match</p>
                </div>
              </CardContent>
              <CardFooter><Button className="w-full" variant={p.name === 'FREE' ? 'outline' : 'default'} onClick={() => activate(p.id)} disabled={loading}>Choose {p.name}</Button></CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
