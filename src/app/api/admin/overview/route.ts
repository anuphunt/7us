import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { verifySessionToken } from '@/lib/auth'

async function requireAdmin() {
  const jar = await cookies()
  const session = verifySessionToken(jar.get('session')?.value)
  if (!session || session.role !== 'admin') return null
  return session
}

export async function GET() {
  try {
    const session = await requireAdmin()
    if (!session) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

    const now = new Date()
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000)

    const [clockedInRes, tasksRes, shiftsRes, exceptionsRes] = await Promise.all([
      // Who is clocked in: users whose last non-deleted event is 'in'
      supabaseServer
        .from('users')
        .select('id, user_id_short, name')
        .eq('active', true),

      // Tasks due soon (next 24h) and still todo
      supabaseServer
        .from('tasks')
        .select('id, title, due_at, status')
        .eq('status', 'todo')
        .gte('due_at', now.toISOString())
        .lte('due_at', in24h.toISOString())
        .order('due_at', { ascending: true })
        .limit(20),

      // Shifts upcoming (next 24h)
      supabaseServer
        .from('shifts')
        .select('id, user_id, start_at, end_at')
        .gte('start_at', now.toISOString())
        .lte('start_at', in24h.toISOString())
        .order('start_at', { ascending: true })
        .limit(50),

      // Exceptions: missing clock-out sessions
      supabaseServer
        .from('work_sessions')
        .select('id, user_id, started_at, ended_at, finalized')
        .eq('finalized', false)
        .order('started_at', { ascending: false })
        .limit(50),
    ])

    if (clockedInRes.error || tasksRes.error || shiftsRes.error || exceptionsRes.error) {
      return NextResponse.json({ error: 'server_error' }, { status: 500 })
    }

    // Determine clocked-in users by checking latest clock event per user.
    // (We do a second query to clock_events because PostgREST can't easily do DISTINCT ON.)
    const users = clockedInRes.data ?? []
    const userIds = users.map((u) => u.id)
    let clockedIn: Array<{ id: string; userIdShort: string; name: string | null }> = []

    if (userIds.length) {
      const { data: events, error } = await supabaseServer
        .from('clock_events')
        .select('user_id, event_type, occurred_at')
        .in('user_id', userIds)
        .is('deleted_at', null)
        .order('occurred_at', { ascending: false })

      if (!error && events) {
        const latestByUser = new Map<string, { event_type: string }>()
        for (const ev of events) {
          if (!latestByUser.has(ev.user_id)) latestByUser.set(ev.user_id, ev)
        }
        clockedIn = users
          .filter((u) => latestByUser.get(u.id)?.event_type === 'in')
          .map((u) => ({ id: u.id, userIdShort: u.user_id_short, name: u.name }))
      }
    }

    return NextResponse.json({
      clockedIn,
      dueSoonTasks: tasksRes.data ?? [],
      upcomingShifts: shiftsRes.data ?? [],
      missingClockOut: exceptionsRes.data ?? [],
    })
  } catch {
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
