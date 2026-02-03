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
}

async function requireAdmin() {
  const jar = await cookies()
  const session = verifySessionToken(jar.get('session')?.value)
  if (!session || session.role !== 'admin') return null
  return session
}

export async function GET(req: Request) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const url = new URL(req.url)
  const userId = url.searchParams.get('userId')
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')

  let query = supabaseServer
    .from('clock_events')
    .select('id, user_id, store_id, event_type, occurred_at, is_override, reason, deleted_at')
    .order('occurred_at', { ascending: false })
    .limit(500)

  if (userId) query = query.eq('user_id', userId)
  if (from) query = query.gte('occurred_at', from)
  if (to) query = query.lte('occurred_at', to)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: 'server_error' }, { status: 500 })

  const events = ((data ?? []) as ClockEventRow[]).map((e) => ({
    id: e.id,
    userId: e.user_id,
    storeId: e.store_id,
    type: e.event_type,
    occurredAt: e.occurred_at,
    isOverride: e.is_override,
    reason: e.reason,
    deletedAt: e.deleted_at,
  }))

  return NextResponse.json({ events })
}

export async function POST(req: Request) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const body = (await req.json().catch(() => ({}))) as {
    userId?: string
    storeId?: string
    type?: ClockEventType
    occurredAt?: string
    reason?: string
  }

  const userId = String(body.userId ?? '').trim()
  const storeId = body.storeId ? String(body.storeId).trim() : null
  const type = body.type
  const occurredAt = body.occurredAt ? String(body.occurredAt) : null
  const reason = String(body.reason ?? '').trim()

  if (!userId || (type !== 'in' && type !== 'out') || !occurredAt || !reason) {
    return NextResponse.json({ error: 'invalid_fields' }, { status: 400 })
  }

  const { data, error } = await supabaseServer
    .from('clock_events')
    .insert({
      user_id: userId,
      store_id: storeId,
      event_type: type,
      occurred_at: occurredAt,
      is_override: true,
      reason,
      created_by_user_id: session.sub,
    })
    .select('id, user_id, store_id, event_type, occurred_at, is_override, reason, deleted_at')
    .maybeSingle()

  if (error || !data) {
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }

  await supabaseServer.from('clock_event_audits').insert({
    clock_event_id: data.id,
    action: 'create',
    actor_user_id: session.sub,
    reason,
    before: null,
    after: data,
  })

  return NextResponse.json({
    event: {
      id: data.id,
      userId: data.user_id,
      storeId: data.store_id,
      type: data.event_type,
      occurredAt: data.occurred_at,
      isOverride: data.is_override,
      reason: data.reason,
      deletedAt: data.deleted_at,
    },
  })
}
