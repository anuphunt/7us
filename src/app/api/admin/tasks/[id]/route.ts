import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { verifySessionToken } from '@/lib/auth'

type TaskStatus = 'todo' | 'done'

function asIsoOrNull(value: unknown) {
  if (value === null || value === undefined) return null
  const s = String(value).trim()
  if (!s) return null
  const ts = Date.parse(s)
  if (Number.isNaN(ts)) return null
  return new Date(ts).toISOString()
}

function statusOrNull(value: unknown): TaskStatus | null {
  const s = String(value ?? '').trim()
  if (s === 'todo' || s === 'done') return s
  return null
}

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const jar = await cookies()
    const session = verifySessionToken(jar.get('session')?.value)
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    const { id } = await ctx.params
    if (!id) return NextResponse.json({ error: 'missing_id' }, { status: 400 })

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>

    const title = body.title != null ? String(body.title).trim() : null
    const details = body.details != null ? String(body.details) : null
    const startAt = body.startAt !== undefined ? asIsoOrNull(body.startAt) : undefined
    const dueAt = body.dueAt !== undefined ? asIsoOrNull(body.dueAt) : undefined
    const status = body.status !== undefined ? statusOrNull(body.status) : undefined

    const now = new Date().toISOString()

    const patch: Record<string, unknown> = { updated_at: now }
    if (title !== null) patch.title = title
    if (details !== null) patch.details = String(details).trim() ? details : null
    if (startAt !== undefined) patch.start_at = startAt
    if (dueAt !== undefined) patch.due_at = dueAt

    if (status !== undefined) {
      if (!status) return NextResponse.json({ error: 'invalid_status' }, { status: 400 })
      patch.status = status
      if (status === 'todo') {
        patch.completed_at = null
        patch.completed_by = null
      } else {
        patch.completed_at = now
        patch.completed_by = session.sub
      }
    }

    if (patch.title !== undefined && !String(patch.title).trim()) {
      return NextResponse.json({ error: 'missing_title' }, { status: 400 })
    }

    const { data, error } = await supabaseServer
      .from('tasks')
      .update(patch)
      .eq('id', id)
      .select(
        'id, title, details, start_at, due_at, status, completed_at, completed_by, created_by, created_at, updated_at'
      )
      .maybeSingle()

    if (error) throw error
    if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 })

    return NextResponse.json({ task: data })
  } catch {
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const jar = await cookies()
    const session = verifySessionToken(jar.get('session')?.value)
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    const { id } = await ctx.params
    if (!id) return NextResponse.json({ error: 'missing_id' }, { status: 400 })

    const { error } = await supabaseServer.from('tasks').delete().eq('id', id)
    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
