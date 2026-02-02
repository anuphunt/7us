'use client'

import { useState } from 'react'

export default function LoginPage() {
  const [userId, setUserId] = useState('')
  const [pin, setPin] = useState('')

  return (
    <main className="min-h-screen p-6">
      <h1 className="text-xl font-semibold">Login</h1>
      <p className="mt-1 text-sm text-neutral-600">Use your 2-digit ID and 4-digit PIN.</p>

      <div className="mt-6 max-w-sm space-y-4">
        <label className="block">
          <div className="text-sm font-medium">User ID</div>
          <input
            className="mt-1 w-full rounded border px-3 py-2"
            inputMode="numeric"
            maxLength={2}
            value={userId}
            onChange={(e) => setUserId(e.target.value.replace(/\D/g, '').slice(0, 2))}
            placeholder="00"
          />
        </label>

        <label className="block">
          <div className="text-sm font-medium">PIN</div>
          <input
            className="mt-1 w-full rounded border px-3 py-2"
            inputMode="numeric"
            maxLength={4}
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="••••"
          />
        </label>

        <button
          className="w-full rounded bg-red-600 px-4 py-2 font-medium text-white disabled:opacity-50"
          disabled={userId.length !== 2 || pin.length !== 4}
          onClick={() => alert('Auth to be implemented (custom PIN login).')}
        >
          Sign in
        </button>
      </div>
    </main>
  )
}
