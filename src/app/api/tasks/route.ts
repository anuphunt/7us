import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { verifySessionToken } from '@/lib/auth'

type TaskStatus = 'todo' | 'done'

type TaskRow = {
  id: string
  title: string
  details: string | null
  start_at: string | null
  due_at: string | null
  status: TaskStatus
  completed_at: string | null
  completed_by: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export async function GET() {
  try {
    const jar = await cookies()
    const session = verifySessionToken(jar.get('session')?.value)
    if (!session) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabaseServer
      .from('tasks')
      .select(
        'id, title, details, start_at, due_at, status, completed_at, completed_by, created_by, created_at, updated_at'
      )
      .order('status', { ascending: true }) // todo first
      .order('due_at', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ tasks: (data ?? []) as TaskRow[] })
  } catch {
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
