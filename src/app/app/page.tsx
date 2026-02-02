'use client'

import { useEffect, useMemo, useState } from 'react'

type Status = 'out' | 'in'

function formatHMS(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s
    .toString()
    .padStart(2, '0')}`
}

export default function EmployeeHome() {
  const [status, setStatus] = useState<Status>('out')
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [now, setNow] = useState<number>(() => Date.now())

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
    // placeholder: will call /api/clock/toggle with geo verification
    if (status === 'out') {
      setStatus('in')
      const ts = Date.now()
      setStartedAt(ts)
      setNow(ts)
    } else {
      setStatus('out')
      setStartedAt(null)
    }
  }

  return (
    <main className="min-h-screen p-6">
      <header>
        <h1 className="text-xl font-semibold">Employee</h1>
        <p className="mt-1 text-sm text-neutral-600">Status: {status === 'in' ? 'Clocked in' : 'Clocked out'}</p>
      </header>

      <section className="mt-8">
        {status === 'in' && (
          <div className="mb-4 text-sm text-neutral-700">
            Timer: <span className="font-mono">{elapsed ?? '00:00:00'}</span>
          </div>
        )}

        <button
          className={`w-full max-w-sm rounded-2xl px-6 py-6 text-xl font-semibold text-white shadow-sm ${
            status === 'in' ? 'bg-black' : 'bg-red-600'
          }`}
          onClick={onToggle}
        >
          {status === 'in' ? 'Clock Out' : 'Clock In'}
        </button>

        <div className="mt-6 text-sm text-neutral-600">Earnings finalize on clock-out.</div>
      </section>
    </main>
  )
}
