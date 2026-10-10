import type { Eye } from '../types'

export const EYE_LABEL: Record<Eye, string> = { OD: 'Right eye (OD)', OS: 'Left eye (OS)' }
export const EYE_SHORT: Record<Eye, string> = { OD: 'OD', OS: 'OS' }

/** "Om Prakash", never "Prakash, Om" — first name leads everywhere in this app. */
export function fullName(p: { first_name: string; last_name: string }): string {
  return `${p.first_name} ${p.last_name}`
}

export function age(dob: string): number {
  const d = new Date(dob)
  const diff = Date.now() - d.getTime()
  return Math.floor(diff / (365.25 * 86_400_000))
}

export function yearsSince(dateStr: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / (365.25 * 86_400_000)))
}

export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  const secs = Math.round((Date.now() - then) / 1000)
  if (secs < 60) return 'just now'
  const mins = Math.round(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.round(hrs / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.round(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.round(months / 12)}y ago`
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export const pct = (n: number) => `${Math.round(n * 100)}%`
