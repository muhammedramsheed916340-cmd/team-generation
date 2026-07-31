import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { authenticate } from '@/lib/auth'
import { apiHandler, ok, fail, parseBody } from '@/lib/api'
import { audit } from '@/lib/audit'
import { cache, cacheKeys } from '@/lib/cache'

export const POST = apiHandler(async (req: NextRequest) => {
  const auth = await authenticate(req)
  if (!auth) return fail('Unauthorized', 401, 'AUTH_ERROR')
  const { planId, durationDays } = await parseBody<{ planId: string; durationDays?: number }>(req)
  const plan = await db.plan.findUnique({ where: { id: planId } })
  if (!plan) return fail('Plan not found', 404, 'NOT_FOUND')

  const days = durationDays || plan.durationDays
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000)

  const sub = await db.subscription.upsert({
    where: { userId: auth.user.id },
    update: { planId, status: 'ACTIVE', startsAt: new Date(), expiresAt },
    create: { userId: auth.user.id, planId, status: 'ACTIVE', expiresAt },
  })
  cache.delete(cacheKeys.subscription(auth.user.id))
  await audit({ userId: auth.user.id, action: 'SUBSCRIPTION_ACTIVATED', entity: 'Plan', entityId: planId, details: { days, expiresAt } })
  return ok({ subscription: sub })
})
