import { NextResponse } from 'next/server'
import argon2 from 'argon2'
import { supabaseServer } from '@/lib/supabaseServer'
import { createSessionToken, getSessionCookieOptions } from '@/lib/auth'

type UserRow = {
  id: string
  user_id_short: string
  pin_hash: string
  role: 'admin' | 'employee'
  active: boolean
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const userIdShort = String(body.userId ?? '').trim()
    const pin = String(body.pin ?? '')

    if (userIdShort.length !== 2 || pin.length < 4) {
      return NextResponse.json({ error: 'invalid_credentials' }, { status: 400 })
    }

    const { data, error } = await supabaseServer
      .from('users')
      .select('id, user_id_short, pin_hash, role, active')
      .eq('user_id_short', userIdShort)
      .maybeSingle()

    if (error || !data) {
      return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 })
    }

    const user = data as UserRow

    if (!user.active) {
      return NextResponse.json({ error: 'inactive_user' }, { status: 403 })
    }

    const ok = await argon2.verify(user.pin_hash, pin)
    if (!ok) {
      return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 })
    }

    const token = createSessionToken({ sub: user.id, role: user.role })
    const res = NextResponse.json({ ok: true, role: user.role })
    res.cookies.set('session', token, getSessionCookieOptions())
    return res
  } catch {
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
