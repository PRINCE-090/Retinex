import type { ReactNode } from 'react'

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2.5 py-16 text-sm text-[#64748B]">
      <span className="lens-spinner" aria-hidden />
      {label}
    </div>
  )
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <div className="glass-dense m-4 border-[#DC2626]/25 bg-[#DC2626]/[0.06] p-4 text-sm text-[#DC2626]">
      {message}
    </div>
  )
}

export function EmptyState({
  title,
  hint,
  icon,
  action,
}: {
  title: string
  hint?: string
  icon?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="grid place-items-center px-6 py-16 text-center">
      {icon && <div className="mb-3 text-[#64748B]">{icon}</div>}
      <p className="font-medium text-[#0F172A]">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-sm text-[#64748B]">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
