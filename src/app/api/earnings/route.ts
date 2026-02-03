import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { verifySessionToken } from '@/lib/auth'

type WorkSessionRow = {
  id: string
  user_id: string
  started_at: string
  ended_at: string | null
  minutes: number | null
  pay_cents: number | null
  rate_cents: number | null
  finalized: boolean
}

export async function GET(req: Request) {
  const jar = await cookies()
  const session = verifySessionToken(jar.get('session')?.value)
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')

  let query = supabaseServer
    .from('work_sessions')
    .select('id, user_id, started_at, ended_at, minutes, pay_cents, rate_cents, finalized')
    .eq('user_id', session.sub)
    .eq('finalized', true)
    .order('started_at', { ascending: false })
    .limit(200)

  if (from) query = query.gte('started_at', from)
  if (to) query = query.lte('started_at', to)

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }

  const sessions = ((data ?? []) as WorkSessionRow[]).map((s) => ({
    id: s.id,
    startedAt: s.started_at,
    endedAt: s.ended_at,
    minutes: s.minutes,
    payCents: s.pay_cents,
    rateCents: s.rate_cents,
  }))

  const totalPayCents = sessions.reduce((sum, s) => sum + (s.payCents ?? 0), 0)

  return NextResponse.json({ sessions, totalPayCents })
}
