import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { createSessionToken, getSessionCookieOptions } from '@/lib/auth'
import {
  LOCK_WINDOW_MS,
  MAX_FAILED_ATTEMPTS,
  getFailureStateAfterFailure,
  isLocked,
  verifyPinWithLegacy,
  hashPin,
} from '@/lib/authPin'
import { countRecentFailedLoginsByIp, logAuthEvent } from '@/lib/authEvents'

type UserRow = {
  id: string
  user_id_short: string
  pin_hash: string
  role: 'admin' | 'employee'
  active: boolean
  failed_attempts: number | null
  locked_until: string | null
  last_failed_at: string | null
}

function getClientIp(req: Request) {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]?.trim() || 'unknown'
  return req.headers.get('x-real-ip') ?? 'unknown'
}

function getUserAgent(req: Request) {
  return req.headers.get('user-agent') ?? 'unknown'
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const userIdShort = String(body.userId ?? '').trim()
    const pin = String(body.pin ?? '')

    const ip = getClientIp(req)
    const userAgent = getUserAgent(req)
    const now = new Date()

    if (userIdShort.length !== 2 || pin.length < 4) {
      return NextResponse.json({ error: 'invalid_credentials' }, { status: 400 })
    }

    // IP-based throttle (prevents brute-force against many users).
    const ipWindowStart = new Date(now.getTime() - LOCK_WINDOW_MS)
    const ipFailures = await countRecentFailedLoginsByIp(ip, ipWindowStart)
    if (ipFailures >= MAX_FAILED_ATTEMPTS) {
      await logAuthEvent({
        userIdShort,
        userId: null,
        ip,
        userAgent,
        eventType: 'login',
        success: false,
        reason: 'ip_locked',
      })
      return NextResponse.json({ error: 'too_many_attempts' }, { status: 429 })
    }

    const { data, error } = await supabaseServer
      .from('users')
      .select(
        'id, user_id_short, pin_hash, role, active, failed_attempts, locked_until, last_failed_at'
      )
      .eq('user_id_short', userIdShort)
      .maybeSingle()

    if (error) {
      console.error('Supabase login query failed', error)
      return NextResponse.json({ error: 'server_error' }, { status: 500 })
    }

    if (!data) {
      // Equalize timing to reduce user enumeration.
      await verifyPinWithLegacy(pin, null)
      await logAuthEvent({
        userIdShort,
        userId: null,
        ip,
        userAgent,
        eventType: 'login',
        success: false,
        reason: 'invalid_credentials',
      })
      return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 })
    }

    const user = data as UserRow

    if (isLocked(user.locked_until, now)) {
      await logAuthEvent({
        userIdShort,
        userId: user.id,
        ip,
        userAgent,
        eventType: 'login',
        success: false,
        reason: 'user_locked',
      })
      // Generic failure to avoid existence/role/active leaks.
      return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 })
    }

    const pinCheck = await verifyPinWithLegacy(pin, user.pin_hash)

    if (!pinCheck.ok || !user.active) {
      const failureState = getFailureStateAfterFailure({
        failedAttempts: user.failed_attempts,
        lastFailedAt: user.last_failed_at,
        now,
      })

      await supabaseServer
        .from('users')
        .update({
          failed_attempts: failureState.failedAttempts,
          last_failed_at: failureState.lastFailedAt.toISOString(),
          locked_until: failureState.lockedUntil
            ? failureState.lockedUntil.toISOString()
            : null,
        })
        .eq('id', user.id)

      await logAuthEvent({
        userIdShort,
        userId: user.id,
        ip,
        userAgent,
        eventType: 'login',
        success: false,
        reason: user.active ? 'invalid_credentials' : 'inactive_user',
      })

      return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 })
    }

    // Success: if legacy plaintext matched, immediately upgrade to Argon2id.
    if (pinCheck.legacy) {
      const upgraded = await hashPin(pin)
      await supabaseServer.from('users').update({ pin_hash: upgraded }).eq('id', user.id)
    }

    // Success: reset lock state.
    await supabaseServer
      .from('users')
      .update({
        failed_attempts: 0,
        last_failed_at: null,
        locked_until: null,
      })
      .eq('id', user.id)

    const token = createSessionToken({ sub: user.id, role: user.role })
    const res = NextResponse.json({ ok: true, role: user.role })
    res.cookies.set('session', token, getSessionCookieOptions())

    await logAuthEvent({
      userIdShort,
      userId: user.id,
      ip,
      userAgent,
      eventType: 'login',
      success: true,
      reason: null,
    })

    return res
  } catch {
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
