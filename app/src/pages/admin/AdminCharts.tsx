import { useState } from 'react'
import type { SeverityBucket, WeeklyVolume } from './adminMockData'

/**
 * Small hand-rolled charts for the admin panel, consistent with the rest
 * of the app (no charting library dependency). Bars are thin, rounded at
 * the data-end, anchored to a shared baseline, with a per-bar hover
 * tooltip -- see the dataviz skill's mark-spec guidance.
 */

export function WeeklyVolumeChart({ data }: { data: WeeklyVolume[] }) {
  const [hovered, setHovered] = useState<number | null>(null)
  const max = Math.max(...data.map((d) => d.scans))

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-2.5 h-40">
        {data.map((d, i) => {
          const heightPct = Math.max((d.scans / max) * 100, 4)
          const isHovered = hovered === i
          return (
            <div
              key={d.week}
              className="relative flex-1 flex flex-col items-center justify-end h-full group"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              {isHovered && (
                <div className="absolute -top-9 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-lg bg-slate-800 border border-white/10 text-white text-xs font-bold whitespace-nowrap shadow-xl z-10">
                  {d.scans} scans
                </div>
              )}
              <div
                className={`w-full rounded-t-md transition-all duration-200 ${isHovered ? 'bg-blue-400' : 'bg-blue-500/70'}`}
                style={{ height: `${heightPct}%` }}
              />
            </div>
          )
        })}
      </div>
      <div className="flex gap-2.5">
        {data.map((d) => (
          <p key={d.week} className="flex-1 text-center text-[10px] font-medium text-slate-500">
            {d.week}
          </p>
        ))}
      </div>
    </div>
  )
}

export function SeverityDistributionChart({ data }: { data: SeverityBucket[] }) {
  const [hovered, setHovered] = useState<number | null>(null)
  const max = Math.max(...data.map((d) => d.count))

  return (
    <div className="space-y-3.5">
      {data.map((bucket) => {
        const widthPct = Math.max((bucket.count / max) * 100, 3)
        const isHovered = hovered === bucket.grade
        return (
          <div
            key={bucket.grade}
            className="group"
            onMouseEnter={() => setHovered(bucket.grade)}
            onMouseLeave={() => setHovered(null)}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-slate-300">{bucket.label}</span>
              <span className={`text-xs font-bold tabular-nums transition-colors ${isHovered ? 'text-white' : 'text-slate-400'}`}>
                {bucket.count}
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-white/5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-200 ${bucket.colorClass} ${isHovered ? 'opacity-100' : 'opacity-80'}`}
                style={{ width: `${widthPct}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
