'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Card, PageHeader, PageShell } from '@/components/ui'

type AuthUser = {
  id: string
  role: 'admin' | 'employee'
}

type UserRow = {
  id: string
  user_id_short: string
  role: 'admin' | 'employee'
  active: boolean
  name: string | null
}

type ShiftRow = {
  id: string
  user_id: string
  start_at: string
  end_at: string
  notes: string | null
  users?: {
    id: string
    user_id_short: string
    name: string | null
  } | null
}

function toDateTimeLocalValue(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`
}

export default function AdminSchedulePage() {
  const [authRole, setAuthRole] = useState<AuthUser['role'] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [users, setUsers] = useState<UserRow[]>([])
  const [shifts, setShifts] = useState<ShiftRow[]>([])

  const [userId, setUserId] = useState('')
  const [startAt, setStartAt] = useState('')
  const [endAt, setEndAt] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editUserId, setEditUserId] = useState('')
  const [editStartAt, setEditStartAt] = useState('')
  const [editEndAt, setEditEndAt] = useState('')
  const [editNotes, setEditNotes] = useState('')

  const range = useMemo(() => {
    const from = new Date()
    from.setHours(0, 0, 0, 0)
    const to = new Date(from)
    to.setDate(to.getDate() + 14)
    return { from, to }
  }, [])

  const load = async () => {
    setError(null)
    try {
      const authRes = await fetch('/api/auth/me')
      const authData = await authRes.json()
      setAuthRole(authData?.user?.role ?? null)

      const [usersRes, shiftsRes] = await Promise.all([
        fetch('/api/admin/users'),
        fetch(
          `/api/admin/shifts?from=${encodeURIComponent(range.from.toISOString())}&to=${encodeURIComponent(
            range.to.toISOString()
          )}`
        ),
      ])

      const usersJson = await usersRes.json()
      const shiftsJson = await shiftsRes.json()

      if (!usersRes.ok) {
        setError(usersJson?.error === 'forbidden' ? 'Admin access required.' : 'Unable to load users.')
        return
      }

      if (!shiftsRes.ok) {
        setError(shiftsJson?.error === 'forbidden' ? 'Admin access required.' : 'Unable to load shifts.')
        return
      }

      setUsers((usersJson?.users ?? []) as UserRow[])
      setShifts((shiftsJson?.shifts ?? []) as ShiftRow[])

      if (!userId && (usersJson?.users?.length ?? 0) > 0) {
        setUserId(String(usersJson.users[0].id))
      }
    } catch {
      setError('Unable to load schedule.')
    }
  }

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      await load()
      setLoading(false)
    }
    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onCreate = async () => {
    setError(null)

    if (!userId || !startAt || !endAt) {
      setError('Pick a user, start time, and end time.')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/admin/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          startAt: new Date(startAt).toISOString(),
          endAt: new Date(endAt).toISOString(),
          notes: notes.trim() ? notes.trim() : null,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data?.error === 'invalid_time_range' ? 'End time must be after start time.' : 'Unable to create shift.')
        return
      }

      setNotes('')
      await load()
    } catch {
      setError('Unable to create shift.')
    } finally {
      setSaving(false)
    }
  }

  const startEditing = (s: ShiftRow) => {
    setEditingId(s.id)
    setEditUserId(s.user_id)
    setEditStartAt(toDateTimeLocalValue(s.start_at))
    setEditEndAt(toDateTimeLocalValue(s.end_at))
    setEditNotes(s.notes ?? '')
  }

  const cancelEditing = () => {
    setEditingId(null)
    setEditUserId('')
    setEditStartAt('')
    setEditEndAt('')
    setEditNotes('')
  }

  const onSaveEdit = async () => {
    if (!editingId) return
    setError(null)
    try {
      const res = await fetch(`/api/admin/shifts/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: editUserId,
          startAt: editStartAt ? new Date(editStartAt).toISOString() : undefined,
          endAt: editEndAt ? new Date(editEndAt).toISOString() : undefined,
          notes: editNotes.trim() ? editNotes.trim() : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data?.error === 'invalid_time_range' ? 'End time must be after start time.' : 'Unable to save shift.')
        return
      }
      cancelEditing()
      await load()
    } catch {
      setError('Unable to save shift.')
    }
  }

  const onDelete = async (id: string) => {
    if (!confirm('Delete this shift?')) return
    setError(null)
    try {
      const res = await fetch(`/api/admin/shifts/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data?.error === 'forbidden' ? 'Admin access required.' : 'Unable to delete shift.')
        return
      }
      await load()
    } catch {
      setError('Unable to delete shift.')
    }
  }

  const formatter = useMemo(() => {
    const day = new Intl.DateTimeFormat(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
    const time = new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    })
    return { day, time }
  }, [])

  const formatShift = (s: ShiftRow) => {
    const start = new Date(s.start_at)
    const end = new Date(s.end_at)
    const label = `${formatter.day.format(start)} · ${formatter.time.format(start)}–${formatter.time.format(end)}`
    const who = s.users?.name || `User ${s.users?.user_id_short ?? ''}`
    return { label, who }
  }

  return (
    <PageShell>
      <PageHeader title="Schedule" subtitle="Create and manage shifts (next 14 days).">
        <div className="mt-3 text-sm">
          <Link className="underline" href="/admin">
            ← Back to Admin
          </Link>
        </div>
      </PageHeader>

      {!loading && authRole !== 'admin' && (
        <Card className="p-5">
          <div className="text-sm text-red-600">Admin access required.</div>
        </Card>
      )}

      {authRole === 'admin' && (
        <>
          <Card className="p-5">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-600">
              Create shift
            </h2>
            <div className="mt-4 grid gap-3">
              <label className="grid gap-1 text-sm">
                Employee
                <select
                  className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-base"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                >
                  {users
                    .filter((u) => u.active)
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {(u.name ? `${u.name} ` : '') + `(${u.user_id_short})`}
                      </option>
                    ))}
                </select>
              </label>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-1 text-sm">
                  Start
                  <input
                    className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-base"
                    type="datetime-local"
                    value={startAt}
                    onChange={(e) => setStartAt(e.target.value)}
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  End
                  <input
                    className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-base"
                    type="datetime-local"
                    value={endAt}
                    onChange={(e) => setEndAt(e.target.value)}
                  />
                </label>
              </div>

              <label className="grid gap-1 text-sm">
                Notes
                <input
                  className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-base"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional"
                />
              </label>

              <button
                className="mt-2 rounded-full bg-red-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-40"
                disabled={saving}
                onClick={onCreate}
              >
                {saving ? 'Creating…' : 'Create shift'}
              </button>

              {error && <div className="text-sm text-red-600">{error}</div>}
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-600">
              Upcoming shifts
            </h2>

            <div className="mt-4 space-y-3">
              {shifts.length === 0 && (
                <div className="rounded-xl border border-dashed border-neutral-200 p-3 text-sm text-neutral-600">
                  No shifts yet.
                </div>
              )}

              {shifts.map((s) => {
                const { label, who } = formatShift(s)
                const isEditing = editingId === s.id
                return (
                  <div key={s.id} className="rounded-xl border border-neutral-200 bg-white p-3">
                    {!isEditing ? (
                      <>
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="text-sm font-semibold text-neutral-900">{label}</div>
                            <div className="mt-1 text-xs text-neutral-500">{who}</div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-800"
                              onClick={() => startEditing(s)}
                            >
                              Edit
                            </button>
                            <button
                              className="rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white"
                              onClick={() => onDelete(s.id)}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                        {s.notes && (
                          <div className="mt-2 text-sm text-neutral-600">{s.notes}</div>
                        )}
                      </>
                    ) : (
                      <div className="space-y-3">
                        <div className="grid gap-3 md:grid-cols-2">
                          <label className="grid gap-1 text-sm">
                            Employee
                            <select
                              className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-base"
                              value={editUserId}
                              onChange={(e) => setEditUserId(e.target.value)}
                            >
                              {users
                                .filter((u) => u.active)
                                .map((u) => (
                                  <option key={u.id} value={u.id}>
                                    {(u.name ? `${u.name} ` : '') + `(${u.user_id_short})`}
                                  </option>
                                ))}
                            </select>
                          </label>
                          <div />
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                          <label className="grid gap-1 text-sm">
                            Start
                            <input
                              className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-base"
                              type="datetime-local"
                              value={editStartAt}
                              onChange={(e) => setEditStartAt(e.target.value)}
                            />
                          </label>
                          <label className="grid gap-1 text-sm">
                            End
                            <input
                              className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-base"
                              type="datetime-local"
                              value={editEndAt}
                              onChange={(e) => setEditEndAt(e.target.value)}
                            />
                          </label>
                        </div>

                        <label className="grid gap-1 text-sm">
                          Notes
                          <input
                            className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-base"
                            value={editNotes}
                            onChange={(e) => setEditNotes(e.target.value)}
                          />
                        </label>

                        <div className="flex gap-2">
                          <button
                            className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white"
                            onClick={onSaveEdit}
                          >
                            Save
                          </button>
                          <button
                            className="rounded-full bg-neutral-100 px-4 py-2 text-sm font-semibold text-neutral-800"
                            onClick={cancelEditing}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </Card>
        </>
      )}
    </PageShell>
  )
}
