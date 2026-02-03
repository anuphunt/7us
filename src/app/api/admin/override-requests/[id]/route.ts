import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { verifySessionToken } from '@/lib/auth'

type ClockEventType = 'in' | 'out'

type OverrideRequestRow = {
  id: string
  user_id: string
  store_id: string | null
  requested_event_type: ClockEventType
  lat: number | null
  lng: number | null
  accuracy_m: number | null
  status: 'pending' | 'approved' | 'denied'
}

async function requireAdmin() {
  const jar = await cookies()
  const session = verifySessionToken(jar.get('session')?.value)
  if (!session || session.role !== 'admin') return null
  return session
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin()
    if (!session) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

    const { id } = await ctx.params
    const body = await req.json()
    const action = String(body.action ?? '')
    const reason = String(body.reason ?? '').trim()

    if (!reason) return NextResponse.json({ error: 'missing_reason' }, { status: 400 })

    const { data: reqRow, error: fetchErr } = await supabaseServer
      .from('override_requests')
      .select('id, user_id, store_id, requested_event_type, lat, lng, accuracy_m, status')
      .eq('id', id)
      .maybeSingle()

    if (fetchErr || !reqRow) return NextResponse.json({ error: 'not_found' }, { status: 404 })

    const row = reqRow as OverrideRequestRow
    if (row.status !== 'pending') {
      return NextResponse.json({ error: 'already_reviewed' }, { status: 409 })
    }

    if (action === 'deny') {
      const { error } = await supabaseServer
        .from('override_requests')
        .update({
          status: 'denied',
          reviewed_at: new Date().toISOString(),
          reviewed_by_user_id: session.sub,
          review_reason: reason,
        })
        .eq('id', id)

      if (error) return NextResponse.json({ error: 'server_error' }, { status: 500 })
      return NextResponse.json({ ok: true, status: 'denied' })
    }

    if (action !== 'approve') {
      return NextResponse.json({ error: 'invalid_action' }, { status: 400 })
    }

    // Create an override clock event.
    const occurredAt = new Date().toISOString()
    const { data: clockEvent, error: createErr } = await supabaseServer
      .from('clock_events')
      .insert({
        user_id: row.user_id,
        store_id: row.store_id,
        event_type: row.requested_event_type,
        occurred_at: occurredAt,
        lat: row.lat,
        lng: row.lng,
        accuracy_m: row.accuracy_m,
        is_override: true,
        reason,
        created_by_user_id: session.sub,
        created_at: occurredAt,
      })
      .select('id')
      .maybeSingle()

    if (createErr || !clockEvent) {
      return NextResponse.json({ error: 'server_error' }, { status: 500 })
    }

    // Link request to the created clock event.
    const { error: updateErr } = await supabaseServer
      .from('override_requests')
      .update({
        status: 'approved',
        reviewed_at: occurredAt,
        reviewed_by_user_id: session.sub,
        review_reason: reason,
        created_clock_event_id: clockEvent.id,
      })
      .eq('id', id)

    if (updateErr) return NextResponse.json({ error: 'server_error' }, { status: 500 })

    // Also write to clock_event_audits.
    await supabaseServer.from('clock_event_audits').insert({
      clock_event_id: clockEvent.id,
      action: 'create',
      actor_user_id: session.sub,
      reason: `override_request:${id} ${reason}`,
      before: null,
      after: {
        user_id: row.user_id,
        store_id: row.store_id,
        event_type: row.requested_event_type,
        occurred_at: occurredAt,
        is_override: true,
      },
    })

    return NextResponse.json({ ok: true, status: 'approved' })
  } catch {
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
