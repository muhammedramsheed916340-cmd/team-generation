import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { authenticate } from '@/lib/auth'
import { apiHandler, ok, fail, parseBody } from '@/lib/api'
import { audit } from '@/lib/audit'

export const POST = apiHandler(async (req: NextRequest) => {
  const auth = await authenticate(req)
  if (!auth) return fail('Unauthorized', 401, 'AUTH_ERROR')
  const { key, machineId } = await parseBody<{ key: string; machineId?: string }>(req)
  const license = await db.license.findUnique({ where: { key } })
  if (!license) return fail('Invalid license key', 404, 'NOT_FOUND')
  if (license.status === 'ACTIVE' && license.userId && license.userId !== auth.user.id) {
    return fail('License already activated on another machine', 403, 'LICENSE_IN_USE')
  }
  if (license.status === 'EXPIRED' || (license.expiresAt && license.expiresAt < new Date())) {
    return fail('License expired', 403, 'LICENSE_EXPIRED')
  }
  const updated = await db.license.update({
    where: { key },
    data: { status: 'ACTIVE', userId: auth.user.id, machineId: machineId || null, activatedAt: new Date() },
  })
  // grant subscription if not present
  const existing = await db.subscription.findUnique({ where: { userId: auth.user.id } })
  if (!existing) {
    await db.subscription.create({
      data: {
        userId: auth.user.id,
        planId: license.planId,
        status: 'ACTIVE',
        expiresAt: license.expiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    })
  }
  await audit({ userId: auth.user.id, action: 'LICENSE_ACTIVATED', entity: 'License', entityId: license.id, details: { key } })
  return ok({ license: updated })
})
