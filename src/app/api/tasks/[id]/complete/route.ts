import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { verifySessionToken } from '@/lib/auth'

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const jar = await cookies()
    const session = verifySessionToken(jar.get('session')?.value)
    if (!session) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const { id } = await ctx.params
    if (!id) {
      return NextResponse.json({ error: 'missing_id' }, { status: 400 })
    }

    const now = new Date().toISOString()

    const { data, error } = await supabaseServer
      .from('tasks')
      .update({
        status: 'done',
        completed_at: now,
        completed_by: session.sub,
        updated_at: now,
      })
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
