import { NextRequest } from 'next/server'
import { seedAll } from '@/lib/seed'
import { apiHandler, ok } from '@/lib/api'

export const POST = apiHandler(async () => {
  await seedAll()
  return ok({ seeded: true })
})
