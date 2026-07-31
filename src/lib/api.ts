/** Small helpers for API route handlers */
import { NextResponse } from 'next/server'
import { AuthError } from '@/lib/auth'
import { trackError } from '@/lib/errors'
import { ZodError } from 'zod'

export function ok(data: unknown, status = 200) {
  return NextResponse.json({ success: true, data }, { status })
}

export function fail(message: string, status = 400, code?: string, details?: unknown) {
  return NextResponse.json({ success: false, error: message, code, details }, { status })
}

/** Wrap an async handler with uniform error handling + audit + error tracking */
export function apiHandler(fn: (req: Request, ctx?: { params: Record<string, string> }) => Promise<NextResponse>) {
  return async (req: Request, ctx?: { params: Promise<Record<string, string>> }) => {
    try {
      const params = ctx?.params ? await ctx.params : {}
      return await fn(req, { params })
    } catch (e) {
      if (e instanceof AuthError) {
        return fail(e.message, e.statusCode, 'AUTH_ERROR')
      }
      if (e instanceof ZodError) {
        return fail('Validation error', 422, 'VALIDATION_ERROR', e.errors)
      }
      const message = e instanceof Error ? e.message : 'Internal server error'
      const stack = e instanceof Error ? e.stack : undefined
      const url = new URL(req.url)
      await trackError({
        message,
        stack,
        path: url.pathname,
        method: req.method,
        source: 'api',
      })
      console.error(`[api:${url.pathname}]`, e)
      return fail(message, 500, 'INTERNAL_ERROR')
    }
  }
}

/** Parse JSON body safely */
export async function parseBody<T = unknown>(req: Request): Promise<T> {
  const text = await req.text()
  if (!text) return {} as T
  return JSON.parse(text) as T
}

/** Get client IP from request */
export function getClientIp(req: Request): string | null {
  const url = new URL(req.url)
  return req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for')?.split(',')[0] || null
}
