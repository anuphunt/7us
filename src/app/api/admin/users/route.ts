import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { verifySessionToken } from '@/lib/auth'
import { hashPin } from '@/lib/authPin'
import { logAuthEvent } from '@/lib/authEvents'

type UserRole = 'admin' | 'employee'

type UserRow = {
  id: string
  role: UserRole
  active: boolean
}

async function getSessionFromRequest() {
  const jar = await cookies()
  const token = jar.get('session')?.value
  return verifySessionToken(token)
}

function getClientIp(req: Request) {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]?.trim() || 'unknown'
  return req.headers.get('x-real-ip') ?? 'unknown'
}

function getUserAgent(req: Request) {
  return req.headers.get('user-agent') ?? 'unknown'
}

export async function GET() {
  const session = await getSessionFromRequest()
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { data, error } = await supabaseServer
    .from('users')
    .select('id, user_id_short, role, active, name')
    .order('user_id_short', { ascending: true })

  if (error) return NextResponse.json({ error: 'server_error' }, { status: 500 })

  const users = data ?? []
  const userIds = users.map((u) => u.id)
  const now = new Date().toISOString()
  const rateByUserId = new Map<string, number>()

  if (userIds.length > 0) {
    const { data: rates } = await supabaseServer
      .from('hourly_rates')
      .select('user_id, rate_cents, effective_from, effective_to')
      .in('user_id', userIds)
      .lte('effective_from', now)
      .or(`effective_to.is.null,effective_to.gt.${now}`)
      .order('effective_from', { ascending: false })

    ;(rates ?? []).forEach((row) => {
      if (!rateByUserId.has(row.user_id)) {
        rateByUserId.set(row.user_id, row.rate_cents)
      }
    })
  }

  return NextResponse.json({
    users: users.map((u) => ({
      id: u.id,
      userId: u.user_id_short,
      role: u.role,
      active: u.active,
      name: u.name,
      rateCents: rateByUserId.get(u.id) ?? null,
    })),
  })
}

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req)
    const userAgent = getUserAgent(req)
    const body = await req.json().catch(() => ({} as Record<string, unknown>))

    const session = await getSessionFromRequest()
    if (!session || session.role !== 'admin') {
      await logAuthEvent({
        userIdShort: String((body as { userId?: string }).userId ?? '').trim() || null,
        userId: session?.sub ?? null,
        ip,
        userAgent,
        eventType: 'admin_create_user',
        success: false,
        reason: 'forbidden',
      })
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    const userIdShort = String((body as { userId?: string }).userId ?? '').trim()
    const pin = String((body as { pin?: string }).pin ?? '')
    const role = ((body as { role?: string }).role ?? 'employee') as UserRole
    const name = (body as { name?: string }).name ? String((body as { name?: string }).name) : null
    const hourlyRate = (body as { hourlyRate?: number | string | null }).hourlyRate ?? null

    if (userIdShort.length !== 2 || pin.length < 4) {
      await logAuthEvent({
        userIdShort,
        userId: session.sub,
        ip,
        userAgent,
        eventType: 'admin_create_user',
        success: false,
        reason: 'invalid_fields',
      })
      return NextResponse.json({ error: 'invalid_fields' }, { status: 400 })
    }

    if (role !== 'admin' && role !== 'employee') {
      await logAuthEvent({
        userIdShort,
        userId: session.sub,
        ip,
        userAgent,
        eventType: 'admin_create_user',
        success: false,
        reason: 'invalid_role',
      })
      return NextResponse.json({ error: 'invalid_role' }, { status: 400 })
    }

    const rateValue =
      hourlyRate === null || hourlyRate === undefined ? null : Number(hourlyRate)
    if (role === 'employee' && rateValue !== null) {
      if (!Number.isFinite(rateValue) || rateValue <= 0) {
        return NextResponse.json({ error: 'invalid_rate' }, { status: 400 })
      }
    }
    const { data: existing } = await supabaseServer
      .from('users')
      .select('id')
      .eq('user_id_short', userIdShort)
      .maybeSingle()

    if (existing) {
      await logAuthEvent({
        userIdShort,
        userId: session.sub,
        ip,
        userAgent,
        eventType: 'admin_create_user',
        success: false,
        reason: 'user_exists',
      })
      return NextResponse.json({ error: 'user_exists' }, { status: 409 })
    }

    const pinHash = await hashPin(pin)

    const { data, error } = await supabaseServer
      .from('users')
      .insert({
        user_id_short: userIdShort,
        pin_hash: pinHash,
        role,
        name,
        active: true,
      })
      .select('id, role, active')
      .maybeSingle()

    if (error || !data) {
      await logAuthEvent({
        userIdShort,
        userId: session.sub,
        ip,
        userAgent,
        eventType: 'admin_create_user',
        success: false,
        reason: 'server_error',
      })
      return NextResponse.json({ error: 'server_error' }, { status: 500 })
    }

    if (role === 'employee' && rateValue !== null) {
      const { error: rateError } = await supabaseServer.from('hourly_rates').insert({
        user_id: data.id,
        rate_cents: Math.round(rateValue * 100),
        effective_from: new Date().toISOString(),
      })

      if (rateError) {
        await supabaseServer.from('users').delete().eq('id', data.id)
        return NextResponse.json({ error: 'rate_insert_failed' }, { status: 500 })
      }
    }

    await logAuthEvent({
      userIdShort,
      userId: session.sub,
      ip,
      userAgent,
      eventType: 'admin_create_user',
      success: true,
      reason: null,
    })

    const user = data as UserRow
    return NextResponse.json({
      user: {
        id: user.id,
        role: user.role,
        active: user.active,
      },
    })
  } catch {
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
