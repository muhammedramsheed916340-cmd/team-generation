'use client'
import { useState } from 'react'
import { useAuth } from './auth-provider'
import { useJobsSocket } from '@/hooks/use-jobs-socket'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Trophy, LogOut, Wifi, WifiOff, LayoutDashboard, Calendar, Sparkles, Send, Crown, ScrollText, Activity, FlaskConical, Zap } from 'lucide-react'
import { DashboardTab } from '@/components/tabs/dashboard-tab'
import { MatchesTab } from '@/components/tabs/matches-tab'
import { GeneratorTab } from '@/components/tabs/generator-tab'
import { TransferTab } from '@/components/tabs/transfer-tab'
import { SubscriptionsTab } from '@/components/tabs/subscriptions-tab'
import { AdminTab } from '@/components/tabs/admin-tab'
import { AuditTab } from '@/components/tabs/audit-tab'
import { MonitoringTab } from '@/components/tabs/monitoring-tab'
import { TestsTab } from '@/components/tabs/tests-tab'

export function Dashboard() {
  const { user, logout } = useAuth()
  const { connected } = useJobsSocket()
  const [tab, setTab] = useState('dashboard')
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN'

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
              <Trophy className="size-5" />
            </div>
            <span className="font-bold hidden sm:inline">TeamGen Pro</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border">
              {connected ? <Wifi className="size-3 text-emerald-600" /> : <WifiOff className="size-3 text-muted-foreground" />}
              <span className={connected ? 'text-emerald-600 font-medium' : 'text-muted-foreground'}>
                {connected ? 'Live' : 'Offline'}
              </span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border bg-amber-50 dark:bg-amber-950/30">
              <Zap className="size-3 text-amber-600" />
              <span className="font-medium">{user?.credits ?? 0} credits</span>
            </div>
            <div className="text-xs text-right hidden md:block">
              <p className="font-medium leading-tight">{user?.name}</p>
              <p className="text-muted-foreground leading-tight">{user?.email}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={logout} title="Logout">
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 container mx-auto px-4 py-4 w-full">
        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <div className="overflow-x-auto pb-1">
            <TabsList className="inline-flex w-max">
              <TabsTrigger value="dashboard" className="gap-1.5"><LayoutDashboard className="size-4" /> Dashboard</TabsTrigger>
              <TabsTrigger value="matches" className="gap-1.5"><Calendar className="size-4" /> Matches</TabsTrigger>
              <TabsTrigger value="generator" className="gap-1.5"><Sparkles className="size-4" /> AI Generator</TabsTrigger>
              <TabsTrigger value="transfer" className="gap-1.5"><Send className="size-4" /> Fantasy Transfer</TabsTrigger>
              <TabsTrigger value="subscriptions" className="gap-1.5"><Crown className="size-4" /> Plans</TabsTrigger>
              {isAdmin && <TabsTrigger value="admin" className="gap-1.5"><Shield className="size-4" /> Admin</TabsTrigger>}
              <TabsTrigger value="monitoring" className="gap-1.5"><Activity className="size-4" /> Monitoring</TabsTrigger>
              <TabsTrigger value="audit" className="gap-1.5"><ScrollText className="size-4" /> Audit</TabsTrigger>
              <TabsTrigger value="tests" className="gap-1.5"><FlaskConical className="size-4" /> Tests</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="dashboard" className="mt-4"><DashboardTab onNavigate={setTab} /></TabsContent>
          <TabsContent value="matches" className="mt-4"><MatchesTab /></TabsContent>
          <TabsContent value="generator" className="mt-4"><GeneratorTab /></TabsContent>
          <TabsContent value="transfer" className="mt-4"><TransferTab /></TabsContent>
          <TabsContent value="subscriptions" className="mt-4"><SubscriptionsTab /></TabsContent>
          {isAdmin && <TabsContent value="admin" className="mt-4"><AdminTab /></TabsContent>}
          <TabsContent value="monitoring" className="mt-4"><MonitoringTab /></TabsContent>
          <TabsContent value="audit" className="mt-4"><AuditTab /></TabsContent>
          <TabsContent value="tests" className="mt-4"><TestsTab /></TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="border-t mt-auto py-4">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          TeamGen Pro · AI Fantasy Cricket Platform · {new Date().getFullYear()} · Built with Next.js + Prisma + Socket.io
        </div>
      </footer>
    </div>
  )
}

function Shield({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>
}
