'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Card, PageHeader, PageShell } from '@/components/ui'

type WorkSession = {
  id: string
  userId: string
  startedAt: string
  endedAt: string | null
  minutes: number | null
  payCents: number | null
  rateCents: number | null
  finalized: boolean
}

function formatMoney(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

export default function AdminTimesheetsPage() {
  const [sessions, setSessions] = useState<WorkSession[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  const [userId, setUserId] = useState('')
  const [type, setType] = useState<'in' | 'out'>('in')
  const [occurredAt, setOccurredAt] = useState('')
  const [reason, setReason] = useState('')
  const [actionStatus, setActionStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  const load = async () => {
    setStatus('loading')
    try {
      const qs = userId ? `?userId=${encodeURIComponent(userId)}` : ''
      const res = await fetch(`/api/admin/work-sessions${qs}`)
      const data = await res.json()
      if (!res.ok) {
        setStatus('error')
        return
      }
      setSessions(Array.isArray(data.sessions) ? data.sessions : [])
      setStatus('ready')
    } catch {
      setStatus('error')
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onCreateClockEvent = async () => {
    setActionStatus('saving')
    try {
      const res = await fetch('/api/admin/clock-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          type,
          occurredAt,
          reason,
        }),
      })
      if (!res.ok) {
        setActionStatus('error')
        return
      }
      setActionStatus('saved')
      setReason('')
      await load()
    } catch {
      setActionStatus('error')
    }
  }

  return (
    <PageShell>
      <PageHeader title="Timesheets" subtitle="Admin-only: create/edit/delete clock events (audited).">
        <Link className="text-sm font-semibold text-red-700 underline" href="/admin">
          Back to Admin
        </Link>
      </PageHeader>

      <Card className="p-5">
        <div className="text-xs font-semibold uppercase tracking-wide text-neutral-600">
          Add clock event override
        </div>
        <div className="mt-4 grid gap-3">
          <label className="grid gap-1 text-sm">
            User ID (uuid)
            <input
              className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-base"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="user uuid"
            />
          </label>
          <label className="grid gap-1 text-sm">
            Type
            <select
              className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-base"
              value={type}
              onChange={(e) => setType(e.target.value as 'in' | 'out')}
            >
              <option value="in">in</option>
              <option value="out">out</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            Occurred at (ISO)
            <input
              className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-base"
              value={occurredAt}
              onChange={(e) => setOccurredAt(e.target.value)}
              placeholder={new Date().toISOString()}
            />
          </label>
          <label className="grid gap-1 text-sm">
            Reason (required)
            <input
              className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-base"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Forgot to clock out"
            />
          </label>

          <button
            className="mt-2 rounded-full bg-red-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-40"
            disabled={actionStatus === 'saving'}
            onClick={onCreateClockEvent}
          >
            {actionStatus === 'saving' ? 'Saving…' : 'Create override'}
          </button>
          {actionStatus === 'saved' && <div className="text-sm text-emerald-600">Saved.</div>}
          {actionStatus === 'error' && (
            <div className="text-sm text-red-600">Unable to save. Check fields.</div>
          )}
        </div>
      </Card>

      <Card className="mt-4 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-neutral-600">
              Work sessions
            </div>
            <div className="mt-1 text-xs text-neutral-500">Derived from clock events.</div>
          </div>
          <button
            className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold"
            onClick={load}
          >
            Refresh
          </button>
        </div>

        {status === 'loading' && <div className="mt-3 text-sm text-neutral-600">Loading…</div>}
        {status === 'error' && (
          <div className="mt-3 text-sm text-red-600">Unable to load sessions.</div>
        )}
        {status === 'ready' && sessions.length === 0 && (
          <div className="mt-3 text-sm text-neutral-600">No sessions found.</div>
        )}

        {status === 'ready' && sessions.length > 0 && (
          <div className="mt-3 divide-y divide-neutral-100">
            {sessions.slice(0, 100).map((s) => (
              <div key={s.id} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-neutral-900">
                    {new Date(s.startedAt).toLocaleString()}
                  </div>
                  <div className="text-xs text-neutral-500">user: {s.userId}</div>
                </div>
                <div className="mt-1 text-xs text-neutral-500">
                  {s.endedAt ? `→ ${new Date(s.endedAt).toLocaleString()}` : 'Missing clock-out'}
                </div>
                <div className="mt-1 text-xs text-neutral-500">
                  {s.minutes ?? '—'} min · {s.rateCents != null ? `${formatMoney(s.rateCents)}/hr` : 'no rate'} ·{' '}
                  {s.payCents != null ? formatMoney(s.payCents) : '—'}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </PageShell>
  )
}
