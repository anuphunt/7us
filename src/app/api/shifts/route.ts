import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { verifySessionToken } from '@/lib/auth'

type Scope = 'my' | 'team'

type ShiftRow = {
  id: string
  user_id: string
  start_at: string
  end_at: string
  notes: string | null
  users?: {
    id: string
    user_id_short: string
    name: string | null
  }[] | null
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
  const jar = await cookies()
  const token = jar.get('session')?.value
  const session = verifySessionToken(token)
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const scope = (url.searchParams.get('scope') ?? 'my') as Scope
  const { from, to } = parseRange(url)

  if (scope !== 'my' && scope !== 'team') {
    return NextResponse.json({ error: 'invalid_scope' }, { status: 400 })
  }

  const base = supabaseServer
    .from('shifts')
    .select('id, user_id, start_at, end_at, notes, users(id, user_id_short, name)')
    .order('start_at', { ascending: true })

  const query = scope === 'my' ? base.eq('user_id', session.sub) : base

  const withFrom = from ? query.gte('start_at', from) : query
  const withTo = to ? withFrom.lte('start_at', to) : withFrom

  const { data, error } = await withTo

  if (error) return NextResponse.json({ error: 'server_error' }, { status: 500 })

  const shifts = (data ?? []) as ShiftRow[]

  return NextResponse.json({
    shifts: shifts.map((s) => ({
      id: s.id,
      userId: s.user_id,
      startAt: s.start_at,
      endAt: s.end_at,
      notes: s.notes,
      user: s.users && s.users.length > 0
        ? {
            id: s.users[0].id,
            userId: s.users[0].user_id_short,
            name: s.users[0].name,
          }
        : null,
    })),
  })
}
