import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { verifySessionToken } from '@/lib/auth'

type UserRow = {
  id: string
  user_id_short: string
  role: 'admin' | 'employee'
  active: boolean
  name: string | null
}

export async function GET() {
  const jar = await cookies()
  const token = jar.get('session')?.value
  const session = verifySessionToken(token)
  if (!session) {
    return NextResponse.json({ user: null })
  }

  const { data, error } = await supabaseServer
    .from('users')
    .select('id, user_id_short, role, active, name')
    .eq('id', session.sub)
    .maybeSingle()

  if (error || !data || !data.active) {
    return NextResponse.json({ user: null })
  }

  const user = data as UserRow

  return NextResponse.json({
    user: {
      id: user.id,
      userId: user.user_id_short,
      role: user.role,
      name: user.name,
    },
  })
}
