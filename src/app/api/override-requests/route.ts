import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { verifySessionToken } from '@/lib/auth'

type StoreRow = {
  id: string
  radius_m: number | null
}

async function getStore(): Promise<StoreRow | null> {
  const storeId = process.env.STORE_ID
  const query = supabaseServer.from('stores').select('id, radius_m').limit(1)
  const { data, error } = storeId
    ? await query.eq('id', storeId).maybeSingle()
    : await query.maybeSingle()
  if (error) throw error
  return data as StoreRow | null
}

export async function POST(req: Request) {
  try {
    const jar = await cookies()
    const session = verifySessionToken(jar.get('session')?.value)
    if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const body = await req.json()
    const requestedEventType = String(body.requestedEventType ?? '')
    const lat = body.lat != null ? Number(body.lat) : null
    const lng = body.lng != null ? Number(body.lng) : null
    const accuracyM = body.accuracyM != null ? Number(body.accuracyM) : null
    const distanceM = body.distanceM != null ? Number(body.distanceM) : null
    const radiusM = body.radiusM != null ? Number(body.radiusM) : null

    const accuracyVal = accuracyM != null && !Number.isNaN(accuracyM) ? accuracyM : null
    const distanceVal = distanceM != null && !Number.isNaN(distanceM) ? Math.round(distanceM) : null
    const radiusVal = radiusM != null && !Number.isNaN(radiusM) ? Math.round(radiusM) : null

    if (requestedEventType !== 'in' && requestedEventType !== 'out') {
      return NextResponse.json({ error: 'invalid_fields' }, { status: 400 })
    }

    const store = await getStore()
    if (!store) {
      return NextResponse.json({ error: 'store_not_configured' }, { status: 400 })
    }

    // Avoid spam: only one pending request per user at a time.
    const { data: existing } = await supabaseServer
      .from('override_requests')
      .select('id')
      .eq('user_id', session.sub)
      .eq('status', 'pending')
      .limit(1)
      .maybeSingle()

    if (existing?.id) {
      return NextResponse.json({ ok: true, id: existing.id, status: 'pending' })
    }

    const { data, error } = await supabaseServer
      .from('override_requests')
      .insert({
        user_id: session.sub,
        store_id: store.id,
        requested_event_type: requestedEventType,
        lat,
        lng,
        accuracy_m: accuracyVal,
        distance_m: distanceVal,
        radius_m: radiusVal,
        status: 'pending',
      })
      .select('id, status')
      .maybeSingle()

    if (error || !data) {
      return NextResponse.json({ error: 'server_error' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, id: data.id, status: data.status })
  } catch {
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
