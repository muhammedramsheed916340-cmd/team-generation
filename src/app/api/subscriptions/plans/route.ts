import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { apiHandler, ok } from '@/lib/api'

export const GET = apiHandler(async () => {
  const plans = await db.plan.findMany({ where: { isActive: true }, orderBy: { priceInr: 'asc' } })
  return ok({ plans: plans.map((p) => ({ ...p, features: JSON.parse(p.features) })) })
})
