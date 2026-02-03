import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { haversineDistanceMeters } from '@/lib/geo'
import { supabaseServer } from '@/lib/supabaseServer'
import { verifySessionToken } from '@/lib/auth'

type ClockEventType = 'in' | 'out'

type StoreRow = {
  id: string
  lat: number
  lng: number
  radius_m: number | null
}

type ClockEventRow = {
  event_type: ClockEventType
  occurred_at: string
}

async function getStore() {
  const storeId = process.env.STORE_ID
  const query = supabaseServer
    .from('stores')
    .select('id, lat, lng, radius_m')
    .limit(1)

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
    if (!session) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const lat = Number(body.lat)
    const lng = Number(body.lng)
    const accuracyM = body.accuracyM ? Number(body.accuracyM) : null

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return NextResponse.json(
        { error: 'missing_fields' },
        { status: 400 }
      )
    }

    const store = await getStore()
    if (!store) {
      return NextResponse.json(
        { error: 'store_not_configured' },
        { status: 400 }
      )
    }

    const radius = store.radius_m ?? 200
    const distanceM = haversineDistanceMeters(
      { lat, lng },
      { lat: store.lat, lng: store.lng }
    )

    if (distanceM > radius) {
      return NextResponse.json(
        {
          error: 'outside_geofence',
          distanceM: Math.round(distanceM),
          radiusM: radius,
        },
        { status: 403 }
      )
    }

    const { data: lastEvent, error: lastError } = await supabaseServer
      .from('clock_events')
      .select('event_type, occurred_at')
      .eq('user_id', session.sub)
      .is('deleted_at', null)
      .order('occurred_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (lastError) throw lastError

    const nextType: ClockEventType = lastEvent?.event_type === 'in' ? 'out' : 'in'
    const occurredAt = new Date().toISOString()

    const { error: insertError } = await supabaseServer.from('clock_events').insert({
      user_id: session.sub,
      store_id: store.id,
      event_type: nextType,
      occurred_at: occurredAt,
      lat,
      lng,
      accuracy_m: accuracyM,
      is_override: false,
    })

    if (insertError) throw insertError

    return NextResponse.json({
      status: nextType,
      startedAt: nextType === 'in' ? occurredAt : null,
      distanceM: Math.round(distanceM),
      radiusM: radius,
    })
  } catch (error) {
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
