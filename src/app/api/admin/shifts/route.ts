import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { verifySessionToken } from '@/lib/auth'

async function getSession() {
  const jar = await cookies()
  const token = jar.get('session')?.value
  return verifySessionToken(token)
}

function parseRange(url: URL) {
  const fromRaw = url.searchParams.get('from')
  const toRaw = url.searchParams.get('to')

  const from = fromRaw ? new Date(fromRaw) : null
  const to = toRaw ? new Date(toRaw) : null

  return {
    from: from && !Number.isNaN(from.getTime()) ? from.toISOString() : null,
    to: to && !Number.isNaN(to.getTime()) ? to.toISOString() : null,
  }
}

export async function GET(req: Request) {
  const session = await getSession()
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const url = new URL(req.url)
  const { from, to } = parseRange(url)

  const base = supabaseServer
    .from('shifts')
    .select('id, user_id, start_at, end_at, notes, created_by, created_at, updated_at, users(id, user_id_short, name)')
    .order('start_at', { ascending: true })

  const withFrom = from ? base.gte('start_at', from) : base
  const withTo = to ? withFrom.lte('start_at', to) : withFrom

  const { data, error } = await withTo

  if (error) return NextResponse.json({ error: 'server_error' }, { status: 500 })

  return NextResponse.json({ shifts: data ?? [] })
}

export async function POST(req: Request) {
  const session = await getSession()
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const body = (await req.json().catch(() => ({}))) as {
    userId?: string
    startAt?: string
    endAt?: string
    notes?: string | null
  }

  const userId = String(body.userId ?? '').trim()
  const startAt = String(body.startAt ?? '').trim()
  const endAt = String(body.endAt ?? '').trim()
  const notes = body.notes == null ? null : String(body.notes)

  if (!userId || !startAt || !endAt) {
    return NextResponse.json({ error: 'invalid_fields' }, { status: 400 })
  }

  const start = new Date(startAt)
  const end = new Date(endAt)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return NextResponse.json({ error: 'invalid_time_range' }, { status: 400 })
  }

  const { data, error } = await supabaseServer
    .from('shifts')
    .insert({
      user_id: userId,
      start_at: start.toISOString(),
      end_at: end.toISOString(),
      notes,
      created_by: session.sub,
    })
    .select('id')
    .maybeSingle()

  if (error || !data) {
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }

  return NextResponse.json({ id: data.id })
}
