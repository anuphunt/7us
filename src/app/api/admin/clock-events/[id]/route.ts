import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { verifySessionToken } from '@/lib/auth'

type ClockEventType = 'in' | 'out'

type ClockEventRow = {
  id: string
  user_id: string
  store_id: string | null
  event_type: ClockEventType
  occurred_at: string
  is_override: boolean
  reason: string | null
  deleted_at: string | null
  deleted_by_user_id: string | null
  updated_at: string | null
  updated_by_user_id: string | null
}

async function requireAdmin() {
  const jar = await cookies()
  const session = verifySessionToken(jar.get('session')?.value)
  if (!session || session.role !== 'admin') return null
  return session
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { id } = await ctx.params

  const body = (await req.json().catch(() => ({}))) as {
    type?: ClockEventType
    occurredAt?: string
    reason?: string
    storeId?: string | null
  }

  const reason = String(body.reason ?? '').trim()
  if (!reason) return NextResponse.json({ error: 'reason_required' }, { status: 400 })

  const { data: before, error: beforeErr } = await supabaseServer
    .from('clock_events')
    .select('id, user_id, store_id, event_type, occurred_at, is_override, reason, deleted_at, deleted_by_user_id, updated_at, updated_by_user_id')
    .eq('id', id)
    .maybeSingle()

  if (beforeErr || !before) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    updated_by_user_id: session.sub,
    is_override: true,
    reason,
  }

  if (body.type) {
    if (body.type !== 'in' && body.type !== 'out') {
      return NextResponse.json({ error: 'invalid_type' }, { status: 400 })
    }
    patch.event_type = body.type
  }
  if (body.occurredAt) {
    patch.occurred_at = String(body.occurredAt)
  }
  if (body.storeId !== undefined) {
    patch.store_id = body.storeId === null ? null : String(body.storeId)
  }

  const { data: after, error } = await supabaseServer
    .from('clock_events')
    .update(patch)
    .eq('id', id)
    .select('id, user_id, store_id, event_type, occurred_at, is_override, reason, deleted_at, deleted_by_user_id, updated_at, updated_by_user_id')
    .maybeSingle()

  if (error || !after) return NextResponse.json({ error: 'server_error' }, { status: 500 })

  await supabaseServer.from('clock_event_audits').insert({
    clock_event_id: id,
    action: 'update',
    actor_user_id: session.sub,
    reason,
    before,
    after,
  })

  return NextResponse.json({ event: after })
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { id } = await ctx.params

  const body = (await req.json().catch(() => ({}))) as { reason?: string }
  const reason = String(body.reason ?? '').trim()
  if (!reason) return NextResponse.json({ error: 'reason_required' }, { status: 400 })

  const { data: before, error: beforeErr } = await supabaseServer
    .from('clock_events')
    .select('id, user_id, store_id, event_type, occurred_at, is_override, reason, deleted_at, deleted_by_user_id, updated_at, updated_by_user_id')
    .eq('id', id)
    .maybeSingle()

  if (beforeErr || !before) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const { data: after, error } = await supabaseServer
    .from('clock_events')
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by_user_id: session.sub,
      is_override: true,
      reason,
    })
    .eq('id', id)
    .select('id, user_id, store_id, event_type, occurred_at, is_override, reason, deleted_at, deleted_by_user_id, updated_at, updated_by_user_id')
    .maybeSingle()

  if (error || !after) return NextResponse.json({ error: 'server_error' }, { status: 500 })

  await supabaseServer.from('clock_event_audits').insert({
    clock_event_id: id,
    action: 'delete',
    actor_user_id: session.sub,
    reason,
    before,
    after,
  })

  return NextResponse.json({ event: after })
}
