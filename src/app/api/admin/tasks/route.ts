import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { verifySessionToken } from '@/lib/auth'

function asIsoOrNull(value: unknown) {
  if (value === null || value === undefined) return null
  const s = String(value).trim()
  if (!s) return null
  const ts = Date.parse(s)
  if (Number.isNaN(ts)) return null
  return new Date(ts).toISOString()
}

export async function GET() {
  try {
    const jar = await cookies()
    const session = verifySessionToken(jar.get('session')?.value)
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    const { data, error } = await supabaseServer
      .from('tasks')
      .select(
        'id, title, details, start_at, due_at, status, completed_at, completed_by, created_by, created_at, updated_at'
      )
      .order('status', { ascending: true })
      .order('due_at', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ tasks: data ?? [] })
  } catch {
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const jar = await cookies()
    const session = verifySessionToken(jar.get('session')?.value)
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>

    const title = String(body.title ?? '').trim()
    const details = body.details != null && String(body.details).trim() ? String(body.details) : null
    const startAt = asIsoOrNull(body.startAt)
    const dueAt = asIsoOrNull(body.dueAt)

    if (!title) return NextResponse.json({ error: 'missing_title' }, { status: 400 })

    const now = new Date().toISOString()

    const { data, error } = await supabaseServer
      .from('tasks')
      .insert({
        title,
        details,
        start_at: startAt,
        due_at: dueAt,
        status: 'todo',
        created_by: session.sub,
        updated_at: now,
      })
      .select(
        'id, title, details, start_at, due_at, status, completed_at, completed_by, created_by, created_at, updated_at'
      )
      .maybeSingle()

    if (error) throw error
    if (!data) return NextResponse.json({ error: 'server_error' }, { status: 500 })

    return NextResponse.json({ task: data })
  } catch {
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
