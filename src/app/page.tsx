import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen p-8">
      <h1 className="text-2xl font-semibold">7us</h1>
      <p className="mt-2 text-sm text-neutral-600">
        Employee time clock + schedules + tasks (PWA)
      </p>

      <div className="mt-6 flex gap-3">
        <Link className="rounded bg-black px-4 py-2 text-white" href="/login">
          Login
        </Link>
        <Link className="rounded border px-4 py-2" href="/admin">
          Admin
        </Link>
        <Link className="rounded border px-4 py-2" href="/app">
          Employee
        </Link>
      </div>
    </main>
  )
}
