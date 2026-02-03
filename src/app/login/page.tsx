'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function LoginPage() {
  const [userId, setUserId] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()

  return (
    <main className="min-h-screen bg-white px-6 py-10">
      <div className="mx-auto flex max-w-sm flex-col gap-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-red-600">
            7us
          </p>
          <h1 className="mt-3 text-3xl font-semibold text-neutral-900">Welcome back</h1>
          <p className="mt-2 text-sm text-neutral-600">
            Sign in to clock in, view schedules, and finish tasks.
          </p>
        </div>

        <div className="space-y-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
          <label className="block">
            <div className="text-xs font-semibold uppercase tracking-wide text-neutral-600">
              User ID
            </div>
            <input
              className="mt-2 w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-lg"
              inputMode="numeric"
              maxLength={2}
              value={userId}
              onChange={(e) => setUserId(e.target.value.replace(/\D/g, '').slice(0, 2))}
              placeholder="00"
            />
          </label>

          <label className="block">
            <div className="text-xs font-semibold uppercase tracking-wide text-neutral-600">
              Password
            </div>
            <input
              className="mt-2 w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-lg"
              maxLength={4}
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="••••"
            />
          </label>

          <button
            className="mt-2 w-full rounded-full bg-red-600 px-4 py-3 text-base font-semibold text-white disabled:opacity-40"
            disabled={userId.length !== 2 || pin.length < 4 || isSubmitting}
            onClick={async () => {
              setError(null)
              setIsSubmitting(true)
              try {
                const res = await fetch('/api/auth/login', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ userId, pin }),
                })
                const data = await res.json()
                if (!res.ok) {
                  setError('Invalid user ID or password.')
                  return
                }
                if (data?.role === 'admin') {
                  router.push('/admin')
                } else {
                  router.push('/app')
                }
              } catch {
                setError('Unable to sign in. Please try again.')
              } finally {
                setIsSubmitting(false)
              }
            }}
          >
            {isSubmitting ? 'Signing in...' : 'Sign in'}
          </button>
          {error && <div className="text-sm text-red-600">{error}</div>}
        </div>

        <p className="text-xs text-neutral-500">
          Need access? Ask your manager to create your account.
        </p>
      </div>
    </main>
  )
}
