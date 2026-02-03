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
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const url = new URL(req.url)
  const userId = url.searchParams.get('userId')
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')

  let query = supabaseServer
    .from('work_sessions')
    .select('id, user_id, started_at, ended_at, minutes, pay_cents, rate_cents, finalized')
    .order('started_at', { ascending: false })
    .limit(500)

  if (userId) query = query.eq('user_id', userId)
  if (from) query = query.gte('started_at', from)
  if (to) query = query.lte('started_at', to)

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }

  const sessions = ((data ?? []) as WorkSessionRow[]).map((s) => ({
    id: s.id,
    userId: s.user_id,
    startedAt: s.started_at,
    endedAt: s.ended_at,
    minutes: s.minutes,
    payCents: s.pay_cents,
    rateCents: s.rate_cents,
    finalized: s.finalized,
  }))

  return NextResponse.json({ sessions })
}
