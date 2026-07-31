'use client'
import { useState } from 'react'
import { useAuth } from './auth-provider'
import { useJobsSocket } from '@/hooks/use-jobs-socket'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Trophy, Wifi, WifiOff, LayoutDashboard, Calendar, Sparkles, Send, Crown, ScrollText, Activity, FlaskConical, Zap, Brain, Play, Menu, X } from 'lucide-react'
import { DashboardTab } from '@/components/tabs/dashboard-tab'
import { MatchesTab } from '@/components/tabs/matches-tab'
import { GeneratorTab } from '@/components/tabs/generator-tab'
import { TransferTab } from '@/components/tabs/transfer-tab'
import { SubscriptionsTab } from '@/components/tabs/subscriptions-tab'
import { AdminTab } from '@/components/tabs/admin-tab'
import { AuditTab } from '@/components/tabs/audit-tab'
import { MonitoringTab } from '@/components/tabs/monitoring-tab'
import { TestsTab } from '@/components/tabs/tests-tab'
import { PredictionsTab } from '@/components/tabs/predictions-tab'
import { SimulationTab } from '@/components/tabs/simulation-tab'
import { AnimatedTabContent } from '@/components/app/animations'

export function Dashboard() {
  const { user } = useAuth()
  const { connected } = useJobsSocket()
  const [tab, setTab] = useState('dashboard')
  const [mobileMenu, setMobileMenu] = useState(false)
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN'

  return (
    <div className="min-h-screen flex flex-col bg-[#131314] text-[#e8eaed]">
      {/* Top Info Bar - like original site nav links */}
      <div className="bg-[#0a0a0b] border-b border-[#3c4043] text-xs">
        <div className="container mx-auto px-4 flex items-center justify-between h-8">
          <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide">
            <span className="text-[#9aa0a6] hover:text-white cursor-pointer whitespace-nowrap">How to generate?</span>
            <span className="text-[#3c4043]">|</span>
            <span className="text-[#9aa0a6] hover:text-white cursor-pointer whitespace-nowrap">Best tips</span>
            <span className="text-[#3c4043]">|</span>
            <span className="text-[#9aa0a6] hover:text-white cursor-pointer whitespace-nowrap">Privacy Policy</span>
            <span className="text-[#3c4043]">|</span>
            <span className="text-[#9aa0a6] hover:text-white cursor-pointer whitespace-nowrap">Terms</span>
            <span className="text-[#3c4043]">|</span>
            <span className="text-[#9aa0a6] hover:text-white cursor-pointer whitespace-nowrap">Disclaimer</span>
            <span className="text-[#3c4043]">|</span>
            <span className="text-[#9aa0a6] hover:text-white cursor-pointer whitespace-nowrap">Contact us</span>
          </div>
          <div className="hidden md:flex items-center gap-2">
            <a href="#" className="text-[#d93025] hover:underline">YouTube</a>
            <span className="text-[#3c4043]">|</span>
            <span className="text-[#9aa0a6]">About us</span>
          </div>
        </div>
      </div>

      {/* Main Header - dark with logo */}
      <header className="sticky top-0 z-50 bg-[#202124] border-b border-[#3c4043] shadow-lg">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <button className="md:hidden" onClick={() => setMobileMenu(!mobileMenu)}>
              {mobileMenu ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
            <div className="flex items-center gap-2.5">
              <div className="size-9 rounded-lg bg-gradient-to-br from-[#563d7c] to-[#7c5bb5] flex items-center justify-center font-bold text-white text-lg shadow-md">
                TG
              </div>
              <div className="hidden sm:block">
                <span className="font-bold text-lg leading-tight block text-white">Team Generation</span>
                <span className="text-[10px] text-[#9aa0a6] leading-tight block">Dream11 Team Generator</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${connected ? 'border-[#1e8e3e]/40 bg-[#1e8e3e]/10' : 'border-[#3c4043]'}`}>
              <span className={`size-2 rounded-full ${connected ? 'bg-[#1e8e3e] animate-pulse' : 'bg-[#9aa0a6]'}`} />
              {connected ? <Wifi className="size-3 text-[#1e8e3e]" /> : <WifiOff className="size-3 text-[#9aa0a6]" />}
              <span className={connected ? 'text-[#1e8e3e] font-medium' : 'text-[#9aa0a6]'}>{connected ? 'Live' : 'Offline'}</span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border bg-[#f9ab00]/10 border-[#f9ab00]/30">
              <Zap className="size-3 text-[#f9ab00]" />
              <span className="font-semibold text-[#f9ab00]">{user?.credits ?? 0}</span>
              <span className="text-[#f9ab00]/70 text-[10px]">cr</span>
            </div>
            <div className="hidden md:block">
              <p className="font-medium leading-tight text-white text-sm">{user?.name || 'User'}</p>
              <p className="text-[#9aa0a6] leading-tight text-xs">{user?.credits ?? 0} credits available</p>
            </div>
          </div>
        </div>
      </header>

      {/* Sports Tabs Bar - like original Cricket/Football/Basketball/Kabaddi */}
      <div className="bg-[#1a1a1c] border-b border-[#3c4043]">
        <div className="container mx-auto px-4">
          <Tabs value={tab} onValueChange={setTab} className="w-full">
            <div className="overflow-x-auto pb-0">
              <TabsList className="inline-flex w-max h-auto bg-transparent gap-0 p-0">
                <TabsTrigger value="dashboard" className="gap-1.5 data-[state=active]:bg-[#563d7c] data-[state=active]:text-white text-[#9aa0a6] rounded-none border-b-2 border-transparent data-[state=active]:border-[#563d7c] px-4 py-2.5 text-sm"><LayoutDashboard className="size-4" /> Dashboard</TabsTrigger>
                <TabsTrigger value="matches" className="gap-1.5 data-[state=active]:bg-[#563d7c] data-[state=active]:text-white text-[#9aa0a6] rounded-none border-b-2 border-transparent data-[state=active]:border-[#563d7c] px-4 py-2.5 text-sm"><Calendar className="size-4" /> Matches</TabsTrigger>
                <TabsTrigger value="predictions" className="gap-1.5 data-[state=active]:bg-[#563d7c] data-[state=active]:text-white text-[#9aa0a6] rounded-none border-b-2 border-transparent data-[state=active]:border-[#563d7c] px-4 py-2.5 text-sm"><Brain className="size-4" /> Predictions</TabsTrigger>
                <TabsTrigger value="simulation" className="gap-1.5 data-[state=active]:bg-[#563d7c] data-[state=active]:text-white text-[#9aa0a6] rounded-none border-b-2 border-transparent data-[state=active]:border-[#563d7c] px-4 py-2.5 text-sm"><Play className="size-4" /> Simulation</TabsTrigger>
                <TabsTrigger value="generator" className="gap-1.5 data-[state=active]:bg-[#563d7c] data-[state=active]:text-white text-[#9aa0a6] rounded-none border-b-2 border-transparent data-[state=active]:border-[#563d7c] px-4 py-2.5 text-sm"><Sparkles className="size-4" /> AI Generator</TabsTrigger>
                <TabsTrigger value="transfer" className="gap-1.5 data-[state=active]:bg-[#563d7c] data-[state=active]:text-white text-[#9aa0a6] rounded-none border-b-2 border-transparent data-[state=active]:border-[#563d7c] px-4 py-2.5 text-sm"><Send className="size-4" /> Transfer</TabsTrigger>
                <TabsTrigger value="subscriptions" className="gap-1.5 data-[state=active]:bg-[#563d7c] data-[state=active]:text-white text-[#9aa0a6] rounded-none border-b-2 border-transparent data-[state=active]:border-[#563d7c] px-4 py-2.5 text-sm"><Crown className="size-4" /> Plans</TabsTrigger>
                {isAdmin && <TabsTrigger value="admin" className="gap-1.5 data-[state=active]:bg-[#563d7c] data-[state=active]:text-white text-[#9aa0a6] rounded-none border-b-2 border-transparent data-[state=active]:border-[#563d7c] px-4 py-2.5 text-sm"><Shield className="size-4" /> Admin</TabsTrigger>}
                <TabsTrigger value="monitoring" className="gap-1.5 data-[state=active]:bg-[#563d7c] data-[state=active]:text-white text-[#9aa0a6] rounded-none border-b-2 border-transparent data-[state=active]:border-[#563d7c] px-4 py-2.5 text-sm"><Activity className="size-4" /> Monitor</TabsTrigger>
                <TabsTrigger value="audit" className="gap-1.5 data-[state=active]:bg-[#563d7c] data-[state=active]:text-white text-[#9aa0a6] rounded-none border-b-2 border-transparent data-[state=active]:border-[#563d7c] px-4 py-2.5 text-sm"><ScrollText className="size-4" /> Audit</TabsTrigger>
                <TabsTrigger value="tests" className="gap-1.5 data-[state=active]:bg-[#563d7c] data-[state=active]:text-white text-[#9aa0a6] rounded-none border-b-2 border-transparent data-[state=active]:border-[#563d7c] px-4 py-2.5 text-sm"><FlaskConical className="size-4" /> Tests</TabsTrigger>
              </TabsList>
            </div>

            <div className="py-4">
              <TabsContent value="dashboard" className="mt-0"><AnimatedTabContent tabKey="dashboard"><DashboardTab onNavigate={setTab} /></AnimatedTabContent></TabsContent>
              <TabsContent value="matches" className="mt-0"><AnimatedTabContent tabKey="matches"><MatchesTab /></AnimatedTabContent></TabsContent>
              <TabsContent value="predictions" className="mt-0"><AnimatedTabContent tabKey="predictions"><PredictionsTab /></AnimatedTabContent></TabsContent>
              <TabsContent value="simulation" className="mt-0"><AnimatedTabContent tabKey="simulation"><SimulationTab /></AnimatedTabContent></TabsContent>
              <TabsContent value="generator" className="mt-0"><AnimatedTabContent tabKey="generator"><GeneratorTab /></AnimatedTabContent></TabsContent>
              <TabsContent value="transfer" className="mt-0"><AnimatedTabContent tabKey="transfer"><TransferTab /></AnimatedTabContent></TabsContent>
              <TabsContent value="subscriptions" className="mt-0"><AnimatedTabContent tabKey="subscriptions"><SubscriptionsTab /></AnimatedTabContent></TabsContent>
              {isAdmin && <TabsContent value="admin" className="mt-0"><AnimatedTabContent tabKey="admin"><AdminTab /></AnimatedTabContent></TabsContent>}
              <TabsContent value="monitoring" className="mt-0"><AnimatedTabContent tabKey="monitoring"><MonitoringTab /></AnimatedTabContent></TabsContent>
              <TabsContent value="audit" className="mt-0"><AnimatedTabContent tabKey="audit"><AuditTab /></AnimatedTabContent></TabsContent>
              <TabsContent value="tests" className="mt-0"><AnimatedTabContent tabKey="tests"><TestsTab /></AnimatedTabContent></TabsContent>
            </div>
          </Tabs>
        </div>
      </div>

      {/* Footer - like original "developed by Believer01 CEO Bobby" */}
      <footer className="mt-auto bg-[#0a0a0b] border-t border-[#3c4043] py-4">
        <div className="container mx-auto px-4 text-center">
          <p className="text-xs text-[#9aa0a6]">
            Developed by <span className="text-[#563d7c] font-semibold">Believer01</span> · CEO Bobby
          </p>
          <p className="text-[10px] text-[#5f6368] mt-1">
            All Rights Reserved ©2021 · Team Generation · Dream11 Team Generator Software
          </p>
        </div>
      </footer>
    </div>
  )
}

function Shield({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>
}
