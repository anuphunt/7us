import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { verifySessionToken } from '@/lib/auth'

type Status = 'pending' | 'approved' | 'denied'

async function requireAdmin() {
  const jar = await cookies()
  const session = verifySessionToken(jar.get('session')?.value)
  if (!session || session.role !== 'admin') return null
  return session
}

export async function GET(req: Request) {
  try {
    const session = await requireAdmin()
    if (!session) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

    const url = new URL(req.url)
    const status = (url.searchParams.get('status') ?? 'pending') as Status
    const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit') ?? 50)))

    const q = supabaseServer
      .from('override_requests')
      .select(
        'id, user_id, requested_event_type, requested_at, distance_m, radius_m, status, reviewed_at, review_reason'
      )
      .order('requested_at', { ascending: false })
      .limit(limit)

    const { data, error } = status ? await q.eq('status', status) : await q

    if (error) return NextResponse.json({ error: 'server_error' }, { status: 500 })
    return NextResponse.json({ requests: data ?? [] })
  } catch {
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
