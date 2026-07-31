/**
 * Database seeder. Creates plans, an admin user, a demo user, and a few matches.
 * Idempotent — safe to run multiple times.
 */
import { db } from '@/lib/db'
import { seedMatch, simulateToss } from '@/lib/mock-cricket'
import { initDemoCredentials } from '@/lib/auth'

const PLANS = [
  {
    name: 'FREE',
    displayName: 'Free Plan',
    description: 'Basic team generation with limited credits.',
    priceInr: 0,
    durationDays: 365,
    creditsPerDay: 5,
    maxTeamsPerMatch: 5,
    features: ['5 teams/match', 'GL strategy', 'Basic AI'],
  },
  {
    name: 'PRO',
    displayName: 'Pro Plan',
    description: 'Advanced AI generation with GL + SL strategies.',
    priceInr: 499,
    durationDays: 30,
    creditsPerDay: 25,
    maxTeamsPerMatch: 20,
    features: ['20 teams/match', 'GL + SL strategies', 'Toss regeneration', 'Priority queue'],
  },
  {
    name: 'ELITE',
    displayName: 'Elite Plan',
    description: 'Full access including H2H logic and bulk generation.',
    priceInr: 999,
    durationDays: 30,
    creditsPerDay: 50,
    maxTeamsPerMatch: 50,
    features: ['50 teams/match', 'GL + SL + H2H', 'Toss regeneration', 'Bulk transfer', 'Priority support'],
  },
  {
    name: 'MASTERY',
    displayName: 'Mastery Plan',
    description: 'Unlimited generation + fantasy direct transfer system.',
    priceInr: 1999,
    durationDays: 90,
    creditsPerDay: 200,
    maxTeamsPerMatch: 500,
    features: ['500 teams/match', 'All strategies', 'Fantasy transfer (Dream11 + My11Circle)', 'Bulk 500 teams', 'Dedicated support'],
  },
]

export async function seedAll() {
  await initDemoCredentials()
  // Plans
  for (const plan of PLANS) {
    await db.plan.upsert({
      where: { name: plan.name },
      update: {},
      create: { ...plan, features: JSON.stringify(plan.features) },
    })
  }

  // Admin user
  const admin = await db.user.upsert({
    where: { email: 'admin@teamgen.in' },
    update: {},
    create: { email: 'admin@teamgen.in', name: 'Admin', role: 'SUPER_ADMIN', credits: 9999 },
  })

  // Demo user
  const demo = await db.user.upsert({
    where: { email: 'demo@teamgen.in' },
    update: {},
    create: { email: 'demo@teamgen.in', name: 'Demo User', role: 'USER', credits: 200 },
  })

  // Give demo a PRO subscription
  const proPlan = await db.plan.findUnique({ where: { name: 'PRO' } })
  if (proPlan && !(await db.subscription.findUnique({ where: { userId: demo.id } }))) {
    await db.subscription.create({
      data: {
        userId: demo.id,
        planId: proPlan.id,
        status: 'ACTIVE',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    })
  }

  // Generate a few licenses
  for (let i = 0; i < 3; i++) {
    const key = `TG-${proPlan?.name || 'PRO'}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`
    await db.license.upsert({
      where: { key },
      update: {},
      create: { key, planId: proPlan!.id, status: 'UNUSED', expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) },
    })
  }

  // Matches: 1 live (XI announced), 1 today (upcoming), 1 tomorrow
  const matches = await db.match.count()
  if (matches === 0) {
    const liveId = await seedMatch({ daysFromNow: 0, live: true, announceXI: true })
    await simulateToss(liveId)
    await seedMatch({ daysFromNow: 0, announceXI: false })
    await seedMatch({ daysFromNow: 1, announceXI: false })
    await seedMatch({ daysFromNow: 2, announceXI: false })
  }

  console.log('[seed] completed: plans, users, subscriptions, licenses, matches')
}

// Allow running directly: `bun run src/lib/seed.ts`
if (require.main === module) {
  seedAll()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e)
      process.exit(1)
    })
}
