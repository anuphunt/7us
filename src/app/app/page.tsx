'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

type Status = 'out' | 'in'
type TabKey = 'schedule' | 'tasks'
type AuthUser = {
  id: string
  userId: string
  role: 'admin' | 'employee'
  name?: string | null
}

function formatHMS(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s
    .toString()
    .padStart(2, '0')}`
}

export default function EmployeeHome() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isAuthLoading, setIsAuthLoading] = useState(true)
  const [status, setStatus] = useState<Status>('out')
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [now, setNow] = useState<number>(() => Date.now())
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [distanceM, setDistanceM] = useState<number | null>(null)
  const [radiusM, setRadiusM] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<TabKey>('schedule')

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/auth/me')
        const data = await res.json()
        setUser(data?.user ?? null)
      } catch {
        setUser(null)
      } finally {
        setIsAuthLoading(false)
      }
    }
    load()
  }, [])

  useEffect(() => {
    if (status !== 'in') return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [status])

  const elapsed = useMemo(() => {
    if (status !== 'in' || !startedAt) return null
    const seconds = Math.max(0, Math.floor((now - startedAt) / 1000))
    return formatHMS(seconds)
  }, [status, startedAt, now])

  const onToggle = async () => {
    setError(null)

    if (!user) {
      setError('Please sign in to clock in/out.')
      return
    }

    if (!navigator.geolocation) {
      setError('Geolocation not supported on this device.')
      return
    }

    setIsSubmitting(true)

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
        })
      })

      const res = await fetch('/api/clock/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracyM: position.coords.accuracy,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (data?.error === 'unauthorized') {
          setError('Please sign in to clock in/out.')
        } else if (data?.error === 'outside_geofence') {
          setError(
            `Outside store radius (${data.distanceM}m away; limit ${data.radiusM}m).`
          )
        } else if (data?.error === 'store_not_configured') {
          setError('Store location not configured.')
        } else {
          setError('Unable to clock. Please try again.')
        }
        return
      }

      setDistanceM(data.distanceM ?? null)
      setRadiusM(data.radiusM ?? null)
      setStatus(data.status)
      if (data.status === 'in' && data.startedAt) {
        const ts = Date.parse(data.startedAt)
        setStartedAt(Number.isNaN(ts) ? Date.now() : ts)
        setNow(Date.now())
      } else {
        setStartedAt(null)
      }
    } catch (err) {
      setError('Unable to fetch location. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-white px-6 py-8">
      <header className="mx-auto flex max-w-md flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-red-600">
          7us
        </p>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-neutral-900">Clock</h1>
          <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700">
            {status === 'in' ? 'On shift' : 'Off shift'}
          </span>
        </div>
        {!isAuthLoading && !user && (
          <p className="text-sm text-red-600">
            Please <Link className="underline" href="/login">sign in</Link> to clock in/out.
          </p>
        )}
      </header>

      <section className="mx-auto mt-10 flex max-w-md flex-col items-center gap-5">
        <div className="text-sm text-neutral-600">
          {status === 'in' && (
            <>
              Timer: <span className="font-mono">{elapsed ?? '00:00:00'}</span>
            </>
          )}
          {status !== 'in' && 'Ready to start your shift.'}
        </div>

        <button
          className={`flex h-48 w-48 items-center justify-center rounded-full text-xl font-semibold text-white shadow-lg transition ${
            status === 'in' ? 'bg-black' : 'bg-red-600'
          }`}
          onClick={onToggle}
          disabled={isSubmitting || !user}
        >
          {isSubmitting ? 'Checking…' : status === 'in' ? 'Clock Out' : 'Clock In'}
        </button>

        {error && <div className="text-sm text-red-600">{error}</div>}
        {distanceM != null && radiusM != null && (
          <div className="text-xs text-neutral-500">
            Distance from store: {distanceM}m (limit {radiusM}m)
          </div>
        )}
        <div className="text-xs text-neutral-500">Earnings finalize on clock-out.</div>
      </section>

      <section className="mx-auto mt-10 max-w-md">
        <div className="flex rounded-full border border-neutral-200 bg-neutral-100 p-1">
          <button
            className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold ${
              activeTab === 'schedule' ? 'bg-white text-neutral-900' : 'text-neutral-600'
            }`}
            onClick={() => setActiveTab('schedule')}
          >
            Schedule
          </button>
          <button
            className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold ${
              activeTab === 'tasks' ? 'bg-white text-neutral-900' : 'text-neutral-600'
            }`}
            onClick={() => setActiveTab('tasks')}
          >
            Tasks
          </button>
        </div>

        <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-4">
          {activeTab === 'schedule' ? (
            <div className="space-y-3 text-sm text-neutral-600">
              <div className="rounded-xl border border-dashed border-neutral-200 p-3">
                No shifts scheduled yet.
              </div>
              <div className="text-xs text-neutral-400">Your next shift will appear here.</div>
            </div>
          ) : (
            <div className="space-y-3 text-sm text-neutral-600">
              <div className="rounded-xl border border-dashed border-neutral-200 p-3">
                No tasks assigned yet.
              </div>
              <div className="text-xs text-neutral-400">Tasks will be listed by due date.</div>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
