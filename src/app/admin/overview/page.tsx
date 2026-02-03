'use client'

import { useEffect, useState } from 'react'
import { Card, PageHeader, PageShell } from '@/components/ui'

type Overview = {
  clockedIn: Array<{ id: string; userIdShort: string; name: string | null }>
  dueSoonTasks: Array<{ id: string; title: string; due_at: string | null; status: string }>
  upcomingShifts: Array<{ id: string; user_id: string; start_at: string; end_at: string }>
  missingClockOut: Array<{ id: string; user_id: string; started_at: string; ended_at: string | null }>
}

function fmt(ts: string | null | undefined) {
  if (!ts) return '—'
  const d = new Date(ts)
  return Number.isNaN(d.getTime()) ? String(ts) : d.toLocaleString()
}

export default function AdminOverviewPage() {
  const [data, setData] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/admin/overview')
        const json = await res.json()
        setData(json)
      } catch {
        setData(null)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <PageShell>
      <PageHeader title="Admin Overview" subtitle="Quick status across shifts, tasks, and clock exceptions." />

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Clocked In</h2>
          <div className="mt-3 text-sm text-neutral-700">
            {loading ? (
              'Loading…'
            ) : (data?.clockedIn?.length ?? 0) === 0 ? (
              <div className="text-neutral-500">Nobody is clocked in.</div>
            ) : (
              <ul className="space-y-2">
                {data!.clockedIn.map((u) => (
                  <li key={u.id} className="rounded-xl border border-neutral-200 p-3">
                    <div className="font-semibold">{u.name ?? `User ${u.userIdShort}`}</div>
                    <div className="text-xs text-neutral-500">ID {u.userIdShort}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Tasks Due Soon</h2>
          <div className="mt-3 text-sm text-neutral-700">
            {loading ? (
              'Loading…'
            ) : (data?.dueSoonTasks?.length ?? 0) === 0 ? (
              <div className="text-neutral-500">No upcoming due tasks.</div>
            ) : (
              <ul className="space-y-2">
                {data!.dueSoonTasks.map((t) => (
                  <li key={t.id} className="rounded-xl border border-neutral-200 p-3">
                    <div className="font-semibold">{t.title}</div>
                    <div className="text-xs text-neutral-500">Due: {fmt(t.due_at)}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Upcoming Shifts</h2>
          <div className="mt-3 text-sm text-neutral-700">
            {loading ? (
              'Loading…'
            ) : (data?.upcomingShifts?.length ?? 0) === 0 ? (
              <div className="text-neutral-500">No shifts starting in the next 24h.</div>
            ) : (
              <ul className="space-y-2">
                {data!.upcomingShifts.map((s) => (
                  <li key={s.id} className="rounded-xl border border-neutral-200 p-3">
                    <div className="text-xs text-neutral-500">User: {s.user_id}</div>
                    <div className="font-semibold">{fmt(s.start_at)} → {fmt(s.end_at)}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Missing Clock-Out</h2>
          <div className="mt-3 text-sm text-neutral-700">
            {loading ? (
              'Loading…'
            ) : (data?.missingClockOut?.length ?? 0) === 0 ? (
              <div className="text-neutral-500">No missing clock-outs.</div>
            ) : (
              <ul className="space-y-2">
                {data!.missingClockOut.map((s) => (
                  <li key={s.id} className="rounded-xl border border-neutral-200 p-3">
                    <div className="text-xs text-neutral-500">User: {s.user_id}</div>
                    <div className="font-semibold">Started: {fmt(s.started_at)}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>
    </PageShell>
  )
}
