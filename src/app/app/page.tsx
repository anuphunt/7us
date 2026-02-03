'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card, PageHeader, PageShell } from '@/components/ui'

type Status = 'out' | 'in'
type TabKey = 'schedule' | 'tasks'
type AuthUser = {
  id: string
  userId: string
  role: 'admin' | 'employee'
  name?: string | null
}

type Shift = {
  id: string
  userId: string
  startAt: string
  endAt: string
  notes: string | null
  user?: {
    id: string
    userId: string
    name: string | null
  } | null
}

type TaskStatus = 'todo' | 'done'

type Task = {
  id: string
  title: string
  details: string | null
  start_at: string | null
  due_at: string | null
  status: TaskStatus
  completed_at: string | null
}

function formatHMS(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s
    .toString()
    .padStart(2, '0')}`
}

function formatShiftTimeRange(startAt: string, endAt: string) {
  const start = new Date(startAt)
  const end = new Date(endAt)
  const day = new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(start)
  const time = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })
  return `${day} · ${time.format(start)}–${time.format(end)}`
}

export default function EmployeeHome() {
  const router = useRouter()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isAuthLoading, setIsAuthLoading] = useState(true)
  const [status, setStatus] = useState<Status>('out')
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [now, setNow] = useState<number>(() => Date.now())
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [distanceM, setDistanceM] = useState<number | null>(null)
  const [radiusM, setRadiusM] = useState<number | null>(null)
  const [lastGeo, setLastGeo] = useState<{ lat: number; lng: number; accuracyM: number | null } | null>(null)
  const [overrideRequestStatus, setOverrideRequestStatus] = useState<'idle' | 'submitting' | 'sent' | 'error'>('idle')
  const [activeTab, setActiveTab] = useState<TabKey>('schedule')

  const [myShifts, setMyShifts] = useState<Shift[]>([])
  const [teamShifts, setTeamShifts] = useState<Shift[]>([])
  const [scheduleLoading, setScheduleLoading] = useState(false)
  const [scheduleError, setScheduleError] = useState<string | null>(null)

  const [tasks, setTasks] = useState<Task[]>([])
  const [tasksLoading, setTasksLoading] = useState(false)
  const [tasksError, setTasksError] = useState<string | null>(null)
  const [taskSubmittingId, setTaskSubmittingId] = useState<string | null>(null)

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
    const loadSchedule = async () => {
      if (activeTab !== 'schedule' || !user) return
      setScheduleError(null)
      setScheduleLoading(true)
      try {
        const start = new Date()
        start.setHours(0, 0, 0, 0)
        const end = new Date(start)
        end.setDate(end.getDate() + 14)

        const [myRes, teamRes] = await Promise.all([
          fetch(`/api/shifts?scope=my&from=${encodeURIComponent(start.toISOString())}&to=${encodeURIComponent(end.toISOString())}`),
          fetch(
            `/api/shifts?scope=team&from=${encodeURIComponent(start.toISOString())}&to=${encodeURIComponent(end.toISOString())}`
          ),
        ])

        const myData = await myRes.json()
        const teamData = await teamRes.json()

        if (!myRes.ok || !teamRes.ok) {
          setScheduleError('Unable to load schedule.')
          return
        }

        setMyShifts((myData?.shifts ?? []) as Shift[])
        setTeamShifts((teamData?.shifts ?? []) as Shift[])
      } catch {
        setScheduleError('Unable to load schedule.')
      } finally {
        setScheduleLoading(false)
      }
    }

    loadSchedule()
  }, [activeTab, user])

  useEffect(() => {
    if (status !== 'in') return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [status])

  useEffect(() => {
    if (activeTab !== 'tasks') return
    if (!user) return

    const loadTasks = async () => {
      setTasksError(null)
      setTasksLoading(true)
      try {
        const res = await fetch('/api/tasks')
        const data = await res.json()
        if (!res.ok) {
          setTasksError('Unable to load tasks.')
          return
        }
        setTasks(Array.isArray(data?.tasks) ? (data.tasks as Task[]) : [])
      } catch {
        setTasksError('Unable to load tasks.')
      } finally {
        setTasksLoading(false)
      }
    }

    loadTasks()
  }, [activeTab, user])

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

      setLastGeo({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracyM: position.coords.accuracy,
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
          setDistanceM(data.distanceM ?? null)
          setRadiusM(data.radiusM ?? null)
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
    } catch {
      setError('Unable to fetch location. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const onLogout = async () => {
    if (isLoggingOut) return
    setError(null)
    setIsLoggingOut(true)
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' })
      if (!res.ok) {
        setError('Unable to log out. Please try again.')
        return
      }
      setUser(null)
      router.replace('/login')
    } catch {
      setError('Unable to log out. Please try again.')
    } finally {
      setIsLoggingOut(false)
    }
  }

  return (
    <PageShell>
      <div className="flex items-start justify-between gap-3">
        <PageHeader title="Clock">
          <div className="mt-2 text-sm text-neutral-600">
            {user?.name ? `Welcome, ${user.name}.` : 'Ready for your shift?'}
          </div>
          <div className="mt-2 flex gap-3 text-sm">
            <Link className="font-semibold text-red-700 underline" href="/app/earnings">
              Earnings
            </Link>
            {user?.role === 'admin' && (
              <Link className="font-semibold text-red-700 underline" href="/admin/timesheets">
                Admin timesheets
              </Link>
            )}
          </div>
        </PageHeader>
        <div className="mt-4 flex items-center gap-3">
          <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700">
            {status === 'in' ? 'On shift' : 'Off shift'}
          </span>
          {user && (
            <button
              className="rounded-full border border-neutral-200 px-3 py-1 text-xs font-semibold text-neutral-700 transition hover:border-neutral-300 hover:text-neutral-900"
              onClick={onLogout}
              disabled={isLoggingOut}
            >
              {isLoggingOut ? 'Logging out…' : 'Log out'}
            </button>
          )}
        </div>
      </div>
      {!isAuthLoading && !user && (
        <p className="text-sm text-red-600">
          Please{' '}
          <Link className="underline" href="/login">
            sign in
          </Link>{' '}
          to clock in/out.
        </p>
      )}

      <Card className="flex flex-col items-center gap-5 p-5">
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

          {error?.includes('Outside store radius') && (
            <button
              className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-900 disabled:opacity-40"
              disabled={overrideRequestStatus === 'submitting' || !lastGeo}
              onClick={async () => {
                if (!lastGeo) return
                setOverrideRequestStatus('submitting')
                try {
                  const res = await fetch('/api/override-requests', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      requestedEventType: status === 'in' ? 'out' : 'in',
                      lat: lastGeo.lat,
                      lng: lastGeo.lng,
                      accuracyM: lastGeo.accuracyM,
                      distanceM,
                      radiusM,
                    }),
                  })
                  if (!res.ok) throw new Error('request_failed')
                  setOverrideRequestStatus('sent')
                } catch {
                  setOverrideRequestStatus('error')
                }
              }}
            >
              {overrideRequestStatus === 'submitting'
                ? 'Requesting…'
                : overrideRequestStatus === 'sent'
                  ? 'Override requested'
                  : 'Request admin override'}
            </button>
          )}

          <div className="text-xs text-neutral-500">Earnings finalize on clock-out.</div>
      </Card>

      <section>
        <div className="flex rounded-full border border-neutral-200 bg-neutral-50 p-1">
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

        <Card className="mt-4 p-4">
            {activeTab === 'schedule' ? (
              <div className="space-y-6">
                {!user && (
                  <div className="text-sm text-red-600">
                    Please sign in to view your schedule.
                  </div>
                )}

                {user && scheduleLoading && (
                  <div className="text-sm text-neutral-600">Loading schedule…</div>
                )}

                {user && scheduleError && (
                  <div className="text-sm text-red-600">{scheduleError}</div>
                )}

                {user && !scheduleLoading && !scheduleError && (
                  <>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-neutral-600">
                        My shifts (next 14 days)
                      </div>
                      <div className="mt-3 space-y-2">
                        {myShifts.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-neutral-200 p-3 text-sm text-neutral-600">
                            No shifts scheduled yet.
                          </div>
                        ) : (
                          myShifts.map((s) => (
                            <div key={s.id} className="rounded-xl border border-neutral-200 bg-white p-3">
                              <div className="text-sm font-semibold text-neutral-900">
                                {formatShiftTimeRange(s.startAt, s.endAt)}
                              </div>
                              {s.notes && (
                                <div className="mt-1 text-sm text-neutral-600">{s.notes}</div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-neutral-600">
                        Team schedule (next 14 days)
                      </div>
                      <div className="mt-3 space-y-2">
                        {teamShifts.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-neutral-200 p-3 text-sm text-neutral-600">
                            No team shifts found.
                          </div>
                        ) : (
                          teamShifts.map((s) => (
                            <div key={s.id} className="rounded-xl border border-neutral-200 bg-white p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="text-sm font-semibold text-neutral-900">
                                    {formatShiftTimeRange(s.startAt, s.endAt)}
                                  </div>
                                  <div className="mt-1 text-xs text-neutral-500">
                                    {(s.user?.name || `User ${s.user?.userId || ''}`).trim()}
                                  </div>
                                </div>
                                {s.user?.userId && (
                                  <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700">
                                    {s.user.userId}
                                  </span>
                                )}
                              </div>
                              {s.notes && (
                                <div className="mt-2 text-sm text-neutral-600">{s.notes}</div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {tasksLoading && (
                  <div className="text-sm text-neutral-600">Loading tasks…</div>
                )}
                {tasksError && (
                  <div className="text-sm text-red-600">{tasksError}</div>
                )}

                {!tasksLoading && !tasksError && tasks.length === 0 && (
                  <div className="space-y-2 text-sm text-neutral-600">
                    <div className="rounded-xl border border-dashed border-neutral-200 p-3">
                      No tasks yet.
                    </div>
                    <div className="text-xs text-neutral-400">
                      Tasks will be listed by due date.
                    </div>
                  </div>
                )}

                {!tasksLoading && !tasksError && tasks.length > 0 && (
                  <div className="space-y-3">
                    {tasks.map((task) => {
                      const dueLabel = task.due_at
                        ? new Date(task.due_at).toLocaleString()
                        : null
                      const startLabel = task.start_at
                        ? new Date(task.start_at).toLocaleString()
                        : null
                      const completedLabel = task.completed_at
                        ? new Date(task.completed_at).toLocaleString()
                        : null

                      return (
                        <div
                          key={task.id}
                          className="rounded-xl border border-neutral-200 bg-white p-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-neutral-900">
                                {task.title}
                              </div>
                              {task.details && (
                                <div className="mt-1 text-sm text-neutral-600">
                                  {task.details}
                                </div>
                              )}
                              <div className="mt-2 space-y-1 text-xs text-neutral-500">
                                {startLabel && <div>Starts: {startLabel}</div>}
                                {dueLabel && <div>Due: {dueLabel}</div>}
                                {task.status === 'done' && completedLabel && (
                                  <div>Completed: {completedLabel}</div>
                                )}
                              </div>
                            </div>

                            <div className="flex flex-col items-end gap-2">
                              <span
                                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                  task.status === 'done'
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'bg-neutral-100 text-neutral-700'
                                }`}
                              >
                                {task.status === 'done' ? 'Done' : 'To do'}
                              </span>

                              {task.status !== 'done' && (
                                <button
                                  className="rounded-full bg-black px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
                                  disabled={taskSubmittingId === task.id}
                                  onClick={async () => {
                                    setTasksError(null)
                                    setTaskSubmittingId(task.id)
                                    try {
                                      const res = await fetch(
                                        `/api/tasks/${task.id}/complete`,
                                        { method: 'POST' }
                                      )
                                      const data = await res.json()
                                      if (!res.ok) {
                                        setTasksError('Unable to mark task complete.')
                                        return
                                      }
                                      const updated = data?.task as Task
                                      setTasks((prev) =>
                                        prev.map((t) => (t.id === updated.id ? updated : t))
                                      )
                                    } catch {
                                      setTasksError('Unable to mark task complete.')
                                    } finally {
                                      setTaskSubmittingId(null)
                                    }
                                  }}
                                >
                                  {taskSubmittingId === task.id ? 'Saving…' : 'Mark done'}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
        </Card>
      </section>
    </PageShell>
  )
}
