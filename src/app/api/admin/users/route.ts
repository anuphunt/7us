import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { verifySessionToken } from '@/lib/auth'

type UserRole = 'admin' | 'employee'

type UserRow = {
  id: string
  role: UserRole
  active: boolean
}

async function getSessionFromRequest() {
  const jar = await cookies()
  const token = jar.get('session')?.value
  return verifySessionToken(token)
}

export async function POST(req: Request) {
  try {
    const session = await getSessionFromRequest()
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const userIdShort = String(body.userId ?? '').trim()
    const pin = String(body.pin ?? '')
    const role = (body.role ?? 'employee') as UserRole
    const name = body.name ? String(body.name) : null

    if (userIdShort.length !== 2 || pin.length < 4) {
      return NextResponse.json({ error: 'invalid_fields' }, { status: 400 })
    }

    if (role !== 'admin' && role !== 'employee') {
      return NextResponse.json({ error: 'invalid_role' }, { status: 400 })
    }

    const pinHash = pin

    const { data: existing } = await supabaseServer
      .from('users')
      .select('id, role, active')
      .eq('user_id_short', userIdShort)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: 'user_exists' }, { status: 409 })
    }

    const { data, error } = await supabaseServer
      .from('users')
      .insert({
        user_id_short: userIdShort,
        pin_hash: pinHash,
        role,
        name,
        active: true,
      })
      .select('id, role, active')
      .maybeSingle()

    if (error || !data) {
      return NextResponse.json({ error: 'server_error' }, { status: 500 })
    }

    const user = data as UserRow
    return NextResponse.json({
      user: {
        id: user.id,
        role: user.role,
        active: user.active,
      },
    })
  } catch {
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
