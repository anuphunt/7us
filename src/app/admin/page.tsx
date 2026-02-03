'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, PageHeader, PageShell } from '@/components/ui'

type AdminUser = {
  id: string
  userId: string
  role: 'admin' | 'employee'
  active: boolean
  name: string | null
  rateCents: number | null
  rateInput: string
  pinInput: string
  status: 'idle' | 'saving' | 'saved' | 'error'
  statusMessage?: string
}

export default function AdminPage() {
  const [authRole, setAuthRole] = useState<'admin' | 'employee' | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const [radiusM, setRadiusM] = useState('200')
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [newUserId, setNewUserId] = useState('')
  const [newUserPin, setNewUserPin] = useState('')
  const [newUserRole, setNewUserRole] = useState<'employee' | 'admin'>('employee')
  const [newUserRate, setNewUserRate] = useState('')
  const [userStatus, setUserStatus] = useState<'idle' | 'saved' | 'error'>('idle')
  const [users, setUsers] = useState<AdminUser[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [usersError, setUsersError] = useState<string | null>(null)

  const loadUsers = async () => {
    setUsersLoading(true)
    setUsersError(null)
    try {
      const res = await fetch('/api/admin/users')
      const data = await res.json()
      if (!res.ok) {
        setUsersError('Unable to load employees.')
        return
      }
      const list = Array.isArray(data?.users) ? data.users : []
      setUsers(
        list.map((u: { id: string; userId: string; role: 'admin' | 'employee'; active: boolean; name: string | null; rateCents: number | null }) => ({
          id: u.id,
          userId: u.userId,
          role: u.role,
          active: u.active,
          name: u.name,
          rateCents: u.rateCents ?? null,
          rateInput: u.rateCents != null ? (u.rateCents / 100).toFixed(2) : '',
          pinInput: '',
          status: 'idle',
        }))
      )
    } catch {
      setUsersError('Unable to load employees.')
    } finally {
      setUsersLoading(false)
    }
  }

  useEffect(() => {
    const load = async () => {
      try {
        const authRes = await fetch('/api/auth/me')
        const authData = await authRes.json()
        setAuthRole(authData?.user?.role ?? null)

        const res = await fetch('/api/store')
        const data = await res.json()
        if (data?.store) {
          setLat(String(data.store.lat ?? ''))
          setLng(String(data.store.lng ?? ''))
          setRadiusM(String(data.store.radius_m ?? 200))
        }

        if (authData?.user?.role === 'admin') {
          await loadUsers()
        }
      } catch {
        setStatus('error')
      } finally {
        setAuthLoading(false)
      }
    }
    load()
  }, [])

  const onSave = async () => {
    setStatus('saving')
    try {
      const res = await fetch('/api/store', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: Number(lat),
          lng: Number(lng),
          radiusM: Number(radiusM),
        }),
      })

      setStatus(res.ok ? 'saved' : 'error')
    } catch {
    setStatus('error')
  }
}

  const onSaveUser = async (user: AdminUser) => {
    if (authRole !== 'admin') return

    const rateInput = user.rateInput.trim()
    let ratePayload: { hourlyRateCents?: number | null; clearHourlyRate?: boolean } = {}

    if (rateInput === '' && user.rateCents != null) {
      ratePayload = { hourlyRateCents: null, clearHourlyRate: true }
    } else if (rateInput !== '') {
      const rateValue = Number(rateInput)
      if (!Number.isFinite(rateValue) || rateValue < 0) {
        setUsers((prev) =>
          prev.map((u) =>
            u.id === user.id
              ? { ...u, status: 'error', statusMessage: 'Hourly rate must be a valid number.' }
              : u
          )
        )
        return
      }
      const nextCents = Math.round(rateValue * 100)
      if (user.rateCents == null || nextCents !== user.rateCents) {
        ratePayload = { hourlyRateCents: nextCents }
      }
    }

    setUsers((prev) =>
      prev.map((u) =>
        u.id === user.id ? { ...u, status: 'saving', statusMessage: undefined } : u
      )
    )

    try {
      const body: Record<string, unknown> = {
        name: user.name ?? '',
        userIdShort: user.userId,
        ...ratePayload,
      }
      if (user.pinInput.trim().length > 0) {
        body.pin = user.pinInput.trim()
      }

      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        setUsers((prev) =>
          prev.map((u) =>
            u.id === user.id
              ? { ...u, status: 'error', statusMessage: 'Unable to save employee.' }
              : u
          )
        )
        return
      }

      await loadUsers()
      setUsers((prev) =>
        prev.map((u) =>
          u.id === user.id
            ? { ...u, status: 'saved', statusMessage: 'Saved.', pinInput: '' }
            : u
        )
      )
    } catch {
      setUsers((prev) =>
        prev.map((u) =>
          u.id === user.id
            ? { ...u, status: 'error', statusMessage: 'Unable to save employee.' }
            : u
        )
      )
    }
  }

  const onDeleteUser = async (user: AdminUser) => {
    if (authRole !== 'admin') return
    if (!window.confirm(`Delete ${user.name ?? `User ${user.userId}`}? This cannot be undone.`)) {
      return
    }
    setUsers((prev) =>
      prev.map((u) =>
        u.id === user.id ? { ...u, status: 'saving', statusMessage: undefined } : u
      )
    )
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, { method: 'DELETE' })
      if (!res.ok) {
        setUsers((prev) =>
          prev.map((u) =>
            u.id === user.id
              ? { ...u, status: 'error', statusMessage: 'Unable to delete employee.' }
              : u
          )
        )
        return
      }
      await loadUsers()
    } catch {
      setUsers((prev) =>
        prev.map((u) =>
          u.id === user.id
            ? { ...u, status: 'error', statusMessage: 'Unable to delete employee.' }
            : u
        )
      )
    }
  }

  return (
    <PageShell>
      <PageHeader
        title="Admin"
        subtitle="Dashboard (overview, overrides, timesheets, schedules, tasks)."
      >
        <div className="mt-3 text-sm">
          <Link className="font-semibold text-red-700 underline" href="/admin/timesheets">
            Timesheets
          </Link>
        </div>
        {!authLoading && authRole !== 'admin' && (
          <div className="mt-3 text-sm text-red-600">
            Admin access required. Please sign in with an admin account.
          </div>
        )}
      </PageHeader>

      <Card className="p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-600">
          Schedules
        </h2>
        <div className="mt-4">
          <Link
            className="inline-flex rounded-full bg-black px-4 py-2 text-sm font-semibold text-white"
            href="/admin/schedule"
          >
            Manage shifts
          </Link>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-600">
          Admin tools
        </h2>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-white"
            href="/admin/schedule"
          >
            Schedule
          </Link>
          <Link
            className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-white"
            href="/admin/tasks"
          >
            Tasks
          </Link>
          <Link
            className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-white"
            href="/admin/timesheets"
          >
            Timesheets
          </Link>
          <Link
            className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-white"
            href="/admin/overview"
          >
            Overview
          </Link>
          <Link
            className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-white"
            href="/admin/override-requests"
          >
            Override Requests
          </Link>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-600">
          Store Geofence
        </h2>
        <div className="mt-4 grid gap-3">
            <label className="grid gap-1 text-sm">
              Latitude
              <input
                className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-base"
                inputMode="decimal"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                placeholder="37.0000"
              />
            </label>
            <label className="grid gap-1 text-sm">
              Longitude
              <input
                className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-base"
                inputMode="decimal"
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                placeholder="-122.0000"
              />
            </label>
            <label className="grid gap-1 text-sm">
              Radius (meters)
              <input
                className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-base"
                inputMode="numeric"
                value={radiusM}
                onChange={(e) => setRadiusM(e.target.value)}
                placeholder="200"
              />
            </label>
            <button
              className="mt-2 rounded-full bg-red-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-40"
              onClick={onSave}
              disabled={status === 'saving' || authRole !== 'admin'}
            >
              {status === 'saving' ? 'Saving...' : 'Save location'}
            </button>
            {status === 'saved' && (
              <div className="text-sm text-emerald-600">Saved.</div>
            )}
            {status === 'error' && (
              <div className="text-sm text-red-600">Unable to save location.</div>
            )}
          </div>
      </Card>

      <Card className="p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-600">
          Add User
        </h2>
        <div className="mt-4 grid gap-3">
            <label className="grid gap-1 text-sm">
              User ID (2 digits)
              <input
                className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-base"
                inputMode="numeric"
                maxLength={2}
                value={newUserId}
                onChange={(e) =>
                  setNewUserId(e.target.value.replace(/\\D/g, '').slice(0, 2))
                }
                placeholder="00"
              />
            </label>
            <label className="grid gap-1 text-sm">
              Password (4 digits)
              <input
                className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-base"
                inputMode="numeric"
                maxLength={4}
                value={newUserPin}
                onChange={(e) =>
                  setNewUserPin(e.target.value.replace(/\\D/g, '').slice(0, 4))
                }
                placeholder="1234"
                type="password"
              />
            </label>
            <label className="grid gap-1 text-sm">
              Role
              <select
                className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-base"
                value={newUserRole}
                onChange={(e) => setNewUserRole(e.target.value as 'employee' | 'admin')}
              >
                <option value="employee">Employee</option>
                <option value="admin">Admin</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              Hourly rate (USD)
              <input
                className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-base"
                inputMode="decimal"
                value={newUserRate}
                onChange={(e) =>
                  setNewUserRate(e.target.value.replace(/[^0-9.]/g, ''))
                }
                placeholder="15.00"
              />
            </label>
            <button
              className="mt-2 rounded-full bg-red-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-40"
              disabled={authRole !== 'admin'}
              onClick={async () => {
                const rateValue = Number(newUserRate)
                const needsRate = newUserRole === 'employee'
                if (
                  newUserId.length !== 2 ||
                  newUserPin.length !== 4 ||
                  (needsRate && (!Number.isFinite(rateValue) || rateValue <= 0))
                ) {
                  setUserStatus('error')
                  return
                }
                try {
                  const res = await fetch('/api/admin/users', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      userId: newUserId,
                      pin: newUserPin,
                      role: newUserRole,
                      hourlyRate: needsRate ? rateValue : null,
                    }),
                  })
                  setUserStatus(res.ok ? 'saved' : 'error')
                } catch {
                  setUserStatus('error')
                }
              }}
            >
              Create user
            </button>
            {userStatus === 'saved' && (
              <div className="text-sm text-emerald-600">User created.</div>
            )}
            {userStatus === 'error' && (
              <div className="text-sm text-red-600">
                Enter a 2-digit ID, 4-digit password, and hourly rate.
              </div>
            )}
          </div>
      </Card>

      <Card className="p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-600">
          Manage Employees
        </h2>
        <div className="mt-2 text-xs text-neutral-500">
          Edit name, ID, password, or hourly rate. Leave password empty to keep it unchanged.
        </div>

        {usersLoading && (
          <div className="mt-4 text-sm text-neutral-600">Loading employees…</div>
        )}
        {usersError && (
          <div className="mt-4 text-sm text-red-600">{usersError}</div>
        )}

        {!usersLoading && !usersError && users.filter((u) => u.role === 'employee').length === 0 && (
          <div className="mt-4 text-sm text-neutral-600">No employees found.</div>
        )}

        {!usersLoading && !usersError && users.filter((u) => u.role === 'employee').length > 0 && (
          <div className="mt-4 space-y-4">
            {users
              .filter((u) => u.role === 'employee')
              .map((u) => (
                <div key={u.id} className="rounded-2xl border border-neutral-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-neutral-900">
                      {u.name ?? `User ${u.userId}`}
                    </div>
                    <div className="text-xs text-neutral-500">ID {u.userId}</div>
                  </div>

                  <div className="mt-3 grid gap-3">
                    <label className="grid gap-1 text-sm">
                      Name
                      <input
                        className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-base"
                        value={u.name ?? ''}
                        onChange={(e) =>
                          setUsers((prev) =>
                            prev.map((user) =>
                              user.id === u.id ? { ...user, name: e.target.value } : user
                            )
                          )
                        }
                        placeholder="Employee name"
                      />
                    </label>
                    <label className="grid gap-1 text-sm">
                      User ID (2 digits)
                      <input
                        className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-base"
                        inputMode="numeric"
                        maxLength={2}
                        value={u.userId}
                        onChange={(e) =>
                          setUsers((prev) =>
                            prev.map((user) =>
                              user.id === u.id
                                ? {
                                    ...user,
                                    userId: e.target.value.replace(/\\D/g, '').slice(0, 2),
                                  }
                                : user
                            )
                          )
                        }
                        placeholder="00"
                      />
                    </label>
                    <label className="grid gap-1 text-sm">
                      New password (4 digits)
                      <input
                        className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-base"
                        inputMode="numeric"
                        maxLength={4}
                        value={u.pinInput}
                        onChange={(e) =>
                          setUsers((prev) =>
                            prev.map((user) =>
                              user.id === u.id
                                ? {
                                    ...user,
                                    pinInput: e.target.value.replace(/\\D/g, '').slice(0, 4),
                                  }
                                : user
                            )
                          )
                        }
                        placeholder="1234"
                        type="password"
                      />
                    </label>
                    <label className="grid gap-1 text-sm">
                      Hourly rate ($/hr)
                      <input
                        className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-base"
                        inputMode="decimal"
                        value={u.rateInput}
                        onChange={(e) =>
                          setUsers((prev) =>
                            prev.map((user) =>
                              user.id === u.id ? { ...user, rateInput: e.target.value } : user
                            )
                          )
                        }
                        placeholder="15.00"
                      />
                    </label>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                      disabled={u.status === 'saving' || authRole !== 'admin'}
                      onClick={() => onSaveUser(u)}
                    >
                      {u.status === 'saving' ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 disabled:opacity-40"
                      disabled={u.status === 'saving' || authRole !== 'admin'}
                      onClick={() => onDeleteUser(u)}
                    >
                      Delete
                    </button>
                  </div>

                  {u.status === 'saved' && (
                    <div className="mt-2 text-sm text-emerald-600">Saved.</div>
                  )}
                  {u.status === 'error' && (
                    <div className="mt-2 text-sm text-red-600">
                      {u.statusMessage ?? 'Unable to save employee.'}
                    </div>
                  )}
                </div>
              ))}
          </div>
        )}
      </Card>
    </PageShell>
  )
}
