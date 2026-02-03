'use client'

import { useEffect, useState } from 'react'
import { Card, PageHeader, PageShell } from '@/components/ui'

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
  const [userStatus, setUserStatus] = useState<'idle' | 'saved' | 'error'>('idle')

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

  return (
    <PageShell>
      <PageHeader
        title="Admin"
        subtitle="Dashboard scaffolding (override requests, timesheets, schedules, tasks)."
      >
        {!authLoading && authRole !== 'admin' && (
          <div className="mt-3 text-sm text-red-600">
            Admin access required. Please sign in with an admin account.
          </div>
        )}
      </PageHeader>

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
            <button
              className="mt-2 rounded-full bg-red-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-40"
              disabled={authRole !== 'admin'}
              onClick={async () => {
                if (newUserId.length !== 2 || newUserPin.length !== 4) {
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
                Enter a 2-digit ID and 4-digit password.
              </div>
            )}
          </div>
      </Card>
    </PageShell>
  )
}
