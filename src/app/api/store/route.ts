import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { verifySessionToken } from '@/lib/auth'

type StoreRow = {
  id: string
  name: string | null
  lat: number
  lng: number
  radius_m: number | null
}

async function fetchStore() {
  const storeId = process.env.STORE_ID
  const query = supabaseServer
    .from('stores')
    .select('id, name, lat, lng, radius_m')
    .limit(1)

  const { data, error } = storeId
    ? await query.eq('id', storeId).maybeSingle()
    : await query.maybeSingle()

  if (error) throw error
  return data as StoreRow | null
}

export async function GET() {
  try {
    const store = await fetchStore()
    return NextResponse.json({ store })
  } catch {
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    const jar = await cookies()
    const session = verifySessionToken(jar.get('session')?.value)
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const lat = Number(body.lat)
    const lng = Number(body.lng)
    const radiusM = body.radiusM != null ? Number(body.radiusM) : null
    const name = body.name ? String(body.name) : null

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return NextResponse.json(
        { error: 'missing_fields' },
        { status: 400 }
      )
    }

    const storeId = process.env.STORE_ID
    const existing = await fetchStore()
    const targetId = storeId ?? existing?.id ?? null

    const payload = {
      name,
      lat,
      lng,
      radius_m: Number.isNaN(radiusM) ? null : radiusM,
    }

    const { error } = targetId
      ? await supabaseServer
          .from('stores')
          .upsert({ id: targetId, ...payload }, { onConflict: 'id' })
      : await supabaseServer.from('stores').insert(payload)

    if (error) throw error

    const store = await fetchStore()
    return NextResponse.json({ store })
  } catch {
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
