import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { verifySessionToken } from '@/lib/auth'

async function getSession() {
  const jar = await cookies()
  const token = jar.get('session')?.value
  return verifySessionToken(token)
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { id } = await ctx.params

  const body = (await req.json().catch(() => ({}))) as {
    userId?: string
    startAt?: string
    endAt?: string
    notes?: string | null
  }

  const patch: Record<string, unknown> = {}

  if (body.userId != null) patch.user_id = String(body.userId).trim()
  if (body.notes !== undefined) patch.notes = body.notes == null ? null : String(body.notes)

  if (body.startAt != null) {
    const d = new Date(String(body.startAt))
    if (Number.isNaN(d.getTime())) return NextResponse.json({ error: 'invalid_start_at' }, { status: 400 })
    patch.start_at = d.toISOString()
  }

  if (body.endAt != null) {
    const d = new Date(String(body.endAt))
    if (Number.isNaN(d.getTime())) return NextResponse.json({ error: 'invalid_end_at' }, { status: 400 })
    patch.end_at = d.toISOString()
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'invalid_fields' }, { status: 400 })
  }

  // If both are being updated, validate range.
  if (patch.start_at && patch.end_at) {
    const start = new Date(String(patch.start_at))
    const end = new Date(String(patch.end_at))
    if (end <= start) return NextResponse.json({ error: 'invalid_time_range' }, { status: 400 })
  }

  const { error } = await supabaseServer.from('shifts').update(patch).eq('id', id)

  if (error) return NextResponse.json({ error: 'server_error' }, { status: 500 })

  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { id } = await ctx.params

  const { error } = await supabaseServer.from('shifts').delete().eq('id', id)

  if (error) return NextResponse.json({ error: 'server_error' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
