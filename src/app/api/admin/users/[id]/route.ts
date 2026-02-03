import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { verifySessionToken } from '@/lib/auth'
import { hashPin } from '@/lib/authPin'

type UpdateBody = {
  name?: string | null
  userIdShort?: string
  pin?: string
  hourlyRateCents?: number | null
  clearHourlyRate?: boolean
}

async function getSession() {
  const jar = await cookies()
  const token = jar.get('session')?.value
  return verifySessionToken(token)
}

function isTwoDigitId(value: string) {
  return /^\d{2}$/.test(value)
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    const { id } = await params
    const body = (await req.json().catch(() => ({}))) as UpdateBody

    const updates: Record<string, unknown> = {}

    if (body.name !== undefined) {
      const nextName = typeof body.name === 'string' ? body.name.trim() : ''
      updates.name = nextName.length > 0 ? nextName : null
    }

    if (body.userIdShort !== undefined) {
      const nextUserId = String(body.userIdShort).trim()
      if (!isTwoDigitId(nextUserId)) {
        return NextResponse.json({ error: 'invalid_user_id' }, { status: 400 })
      }
      const { data: existing } = await supabaseServer
        .from('users')
        .select('id')
        .eq('user_id_short', nextUserId)
        .neq('id', id)
        .maybeSingle()
      if (existing) {
        return NextResponse.json({ error: 'user_exists' }, { status: 409 })
      }
      updates.user_id_short = nextUserId
    }

    if (body.pin !== undefined) {
      const nextPin = String(body.pin)
      if (nextPin.length < 4) {
        return NextResponse.json({ error: 'invalid_pin' }, { status: 400 })
      }
      updates.pin_hash = await hashPin(nextPin)
    }

    if (Object.keys(updates).length > 0) {
      const { data, error } = await supabaseServer
        .from('users')
        .update(updates)
        .eq('id', id)
        .select('id')
        .maybeSingle()

      if (error) {
        return NextResponse.json({ error: 'server_error' }, { status: 500 })
      }
      if (!data) {
        return NextResponse.json({ error: 'not_found' }, { status: 404 })
      }
    }

    if (body.clearHourlyRate || body.hourlyRateCents !== undefined) {
      const now = new Date().toISOString()

      const { error: closeError } = await supabaseServer
        .from('hourly_rates')
        .update({ effective_to: now })
        .eq('user_id', id)
        .is('effective_to', null)

      if (closeError) {
        return NextResponse.json({ error: 'server_error' }, { status: 500 })
      }

      if (!body.clearHourlyRate && body.hourlyRateCents !== undefined) {
        const nextRate = Number(body.hourlyRateCents)
        if (!Number.isFinite(nextRate) || nextRate < 0) {
          return NextResponse.json({ error: 'invalid_rate' }, { status: 400 })
        }

        const { error: insertError } = await supabaseServer.from('hourly_rates').insert({
          user_id: id,
          rate_cents: Math.round(nextRate),
          effective_from: now,
          created_by_user_id: session.sub,
          note: 'Admin update',
        })

        if (insertError) {
          return NextResponse.json({ error: 'server_error' }, { status: 500 })
        }
      }
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    const { id } = await params
    const { data, error } = await supabaseServer
      .from('users')
      .delete()
      .eq('id', id)
      .select('id')
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: 'server_error' }, { status: 500 })
    }
    if (!data) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
