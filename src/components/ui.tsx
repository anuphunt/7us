import type { ReactNode } from 'react'

type PageShellProps = {
  children: ReactNode
}

type PageHeaderProps = {
  title: string
  subtitle?: string
  children?: ReactNode
}

type CardProps = {
  children: ReactNode
  className?: string
}

const baseCard =
  'rounded-2xl border border-neutral-200 bg-neutral-50'

export function PageShell({ children }: PageShellProps) {
  return (
    <main className="min-h-screen bg-white px-6 py-10">
      <div className="mx-auto flex max-w-sm flex-col gap-8">{children}</div>
    </main>
  )
}

export function PageHeader({ title, subtitle, children }: PageHeaderProps) {
  return (
    <header>
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-red-600">
        7us
      </p>
      <h1 className="mt-3 text-2xl font-semibold text-neutral-900">{title}</h1>
      {subtitle && <p className="mt-2 text-sm text-neutral-600">{subtitle}</p>}
      {children}
    </header>
  )
}

export function Card({ children, className }: CardProps) {
  return <section className={`${baseCard} ${className ?? ''}`}>{children}</section>
}
