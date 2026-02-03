'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { Card, PageHeader, PageShell } from '@/components/ui'

type Session = {
  id: string
  startedAt: string
  endedAt: string | null
  minutes: number | null
  payCents: number | null
  rateCents: number | null
}

function formatMoney(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

export default function EarningsPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [totalPayCents, setTotalPayCents] = useState(0)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    const load = async () => {
      setStatus('loading')
      try {
        const res = await fetch('/api/earnings')
        const data = await res.json()
        if (!res.ok) {
          setStatus('error')
          return
        }
        setSessions(Array.isArray(data.sessions) ? data.sessions : [])
        setTotalPayCents(Number(data.totalPayCents ?? 0))
        setStatus('ready')
      } catch {
        setStatus('error')
      }
    }
    load()
  }, [])

  const rows = useMemo(() => {
    return sessions.map((s) => {
      const started = new Date(s.startedAt)
      const ended = s.endedAt ? new Date(s.endedAt) : null
      return {
        ...s,
        dateLabel: started.toLocaleDateString(),
        timeLabel: `${started.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – ${ended ? ended.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '…'}`,
      }
    })
  }, [sessions])

  return (
    <PageShell>
      <PageHeader title="Earnings" subtitle="Finalized sessions only (clock-out required).">
        <Link className="text-sm font-semibold text-red-700 underline" href="/app">
          Back to Clock
        </Link>
      </PageHeader>

      <Card className="p-5">
        <div className="text-xs font-semibold uppercase tracking-wide text-neutral-600">
          Total
        </div>
        <div className="mt-2 text-3xl font-semibold">
          {formatMoney(totalPayCents)}
        </div>
        <div className="mt-1 text-xs text-neutral-500">Last 200 finalized sessions.</div>
      </Card>

      <Card className="mt-4 p-4">
        {status === 'loading' && <div className="text-sm text-neutral-600">Loading…</div>}
        {status === 'error' && (
          <div className="text-sm text-red-600">Unable to load earnings.</div>
        )}
        {status === 'ready' && rows.length === 0 && (
          <div className="text-sm text-neutral-600">No finalized sessions yet.</div>
        )}
        {status === 'ready' && rows.length > 0 && (
          <div className="divide-y divide-neutral-100">
            {rows.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-4 py-3">
                <div>
                  <div className="text-sm font-semibold text-neutral-900">{s.dateLabel}</div>
                  <div className="text-xs text-neutral-500">{s.timeLabel}</div>
                  <div className="text-xs text-neutral-500">
                    {s.minutes ?? 0} min @ {s.rateCents != null ? formatMoney(s.rateCents) : '—'}/hr
                  </div>
                </div>
                <div className="text-sm font-semibold">{formatMoney(s.payCents ?? 0)}</div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </PageShell>
  )
}
