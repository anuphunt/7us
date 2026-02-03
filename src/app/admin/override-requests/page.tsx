'use client'

import { useEffect, useState } from 'react'
import { Card, PageHeader, PageShell } from '@/components/ui'

type ReqRow = {
  id: string
  user_id: string
  requested_event_type: 'in' | 'out'
  requested_at: string
  distance_m: number | null
  radius_m: number | null
  status: 'pending' | 'approved' | 'denied'
}

function fmt(ts: string) {
  const d = new Date(ts)
  return Number.isNaN(d.getTime()) ? ts : d.toLocaleString()
}

export default function OverrideRequestsPage() {
  const [rows, setRows] = useState<ReqRow[]>([])
  const [loading, setLoading] = useState(true)
  const [reasonById, setReasonById] = useState<Record<string, string>>({})

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/override-requests?status=pending&limit=100')
      const json = await res.json()
      setRows(json.requests ?? [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <PageShell>
      <PageHeader title="Override Requests" subtitle="Approve or deny employee geofence override requests." />

      <Card className="p-5">
        {loading ? (
          <div className="text-sm text-neutral-600">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-neutral-600">No pending requests.</div>
        ) : (
          <div className="space-y-3">
            {rows.map((r) => (
              <div key={r.id} className="rounded-xl border border-neutral-200 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold">Request: Clock {r.requested_event_type.toUpperCase()}</div>
                    <div className="text-xs text-neutral-500">{fmt(r.requested_at)}</div>
                    <div className="mt-2 text-xs text-neutral-500">
                      User: {r.user_id}
                      {r.distance_m != null && r.radius_m != null
                        ? ` • ${r.distance_m}m away (limit ${r.radius_m}m)`
                        : ''}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <input
                      className="w-64 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm"
                      placeholder="Reason (required)"
                      value={reasonById[r.id] ?? ''}
                      onChange={(e) =>
                        setReasonById((prev) => ({ ...prev, [r.id]: e.target.value }))
                      }
                    />
                    <div className="flex gap-2">
                      <button
                        className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                        disabled={!reasonById[r.id]?.trim()}
                        onClick={async () => {
                          const reason = (reasonById[r.id] ?? '').trim()
                          if (!reason) return
                          await fetch(`/api/admin/override-requests/${r.id}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ action: 'approve', reason }),
                          })
                          await load()
                        }}
                      >
                        Approve
                      </button>
                      <button
                        className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                        disabled={!reasonById[r.id]?.trim()}
                        onClick={async () => {
                          const reason = (reasonById[r.id] ?? '').trim()
                          if (!reason) return
                          await fetch(`/api/admin/override-requests/${r.id}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ action: 'deny', reason }),
                          })
                          await load()
                        }}
                      >
                        Deny
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </PageShell>
  )
}
