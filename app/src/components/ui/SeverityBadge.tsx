import type { SeverityScore } from '../../types'
import { SEVERITY_LABEL, SEVERITY_SHORT } from '../../types'

interface Props {
  score: SeverityScore | null
  variant?: 'short' | 'long'
  size?: 'sm' | 'md'
  className?: string
  alert?: boolean
}

const CLINICAL_STYLES: Record<
  number,
  { bg: string; text: string; border: string; dot: string }
> = {
  // Grade 0: None (Low severity)
  0: {
    bg: 'bg-[#059669]/10',
    text: 'text-[#059669]',
    border: 'border-[#059669]/25',
    dot: 'bg-[#059669]',
  },
  // Grade 1: Mild (Low severity)
  1: {
    bg: 'bg-[#059669]/10',
    text: 'text-[#059669]',
    border: 'border-[#059669]/25',
    dot: 'bg-[#059669]',
  },
  // Grade 2: Moderate
  2: {
    bg: 'bg-[#D97706]/10',
    text: 'text-[#D97706]',
    border: 'border-[#D97706]/25',
    dot: 'bg-[#D97706]',
  },
  // Grade 3: Severe (High/referable)
  3: {
    bg: 'bg-[#DC2626]/10',
    text: 'text-[#DC2626]',
    border: 'border-[#DC2626]/25',
    dot: 'bg-[#DC2626]',
  },
  // Grade 4: Proliferative (High/referable)
  4: {
    bg: 'bg-[#DC2626]/10',
    text: 'text-[#DC2626]',
    border: 'border-[#DC2626]/25',
    dot: 'bg-[#DC2626]',
  },
}

export default function SeverityBadge({
  score,
  variant = 'short',
  size = 'md',
  className = '',
}: Props) {
  if (score === null || score === undefined) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-[8px] border border-[#64748B]/20 bg-[#64748B]/[0.06] font-mono font-medium text-[#64748B] ${
          size === 'sm' ? 'px-2.5 py-0.5 text-[11px]' : 'px-3 py-1 text-xs'
        } ${className}`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-[#64748B]/60" />
        <span>Pending</span>
      </span>
    )
  }

  const label = variant === 'long' ? SEVERITY_LABEL[score] : SEVERITY_SHORT[score]
  const style = CLINICAL_STYLES[score] ?? CLINICAL_STYLES[0]

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-[8px] border font-medium ${style.bg} ${style.border} ${style.text} ${
        size === 'sm' ? 'px-2.5 py-0.5 text-[11px]' : 'px-3.5 py-1 text-xs'
      } ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
      <span className="font-mono font-semibold">Grade {score}</span>
      <span className="opacity-40">·</span>
      <span className="font-sans text-[11px] font-medium">{label}</span>
    </span>
  )
}
