import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import { Bell, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react'

export type NotificationKind = 'success' | 'urgent' | 'info'

export interface NotificationItem {
  kind: NotificationKind
  title: string
  body: string
  time: string
}

// Only the icon carries the colour; the cards themselves stay neutral.
const ICONS = {
  success: { Icon: CheckCircle2, cls: 'text-emerald-400 bg-emerald-500/15' },
  urgent: { Icon: AlertTriangle, cls: 'text-rose-400 bg-rose-500/15' },
  info: { Icon: ShieldCheck, cls: 'text-slate-400 bg-slate-500/10' },
}

/**
 * Bell + dropdown. The panel is portalled to <body> and positioned from the
 * navbar's bounding box: the navbar has backdrop-filter, which would
 * otherwise make a fixed/absolute child position relative to the navbar and
 * overlap it.
 *
 * BACKEND: items are supplied by the layouts as hardcoded demo content --
 * no notifications endpoint or persisted store exists yet. See
 * API_ROUTES.md's "Notifications" gap.
 */
export default function NotificationBell({ items, tone = 'dark' }: { items: NotificationItem[]; tone?: 'light' | 'dark' }) {
  const light = tone === 'light'
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(items.length > 0)
  const [pos, setPos] = useState({ top: 0, right: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const path = useLocation().pathname

  const measure = () => {
    const nav = btnRef.current?.closest('nav')
    if (!nav) return
    const r = nav.getBoundingClientRect()
    setPos({ top: r.bottom + 10, right: Math.max(8, window.innerWidth - r.right) })
  }

  useLayoutEffect(() => {
    if (open) measure()
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (panelRef.current?.contains(t) || btnRef.current?.contains(t)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', measure)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', measure)
    }
  }, [open])

  useEffect(() => setOpen(false), [path])

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setOpen((o) => !o)}
        title="Notifications"
        aria-label="Notifications"
        className={`relative p-2 rounded-full border transition-colors ${light ? 'bg-white/60 hover:bg-white/90 border-white/80' : 'bg-white/10 hover:bg-white/20 border-white/20'}`}
      >
        <Bell className={`h-4 w-4 ${light ? 'text-slate-700' : 'text-white/80'}`} />
        {unread && <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-rose-500" />}
      </button>

      {open &&
        createPortal(
          <div
            ref={panelRef}
            style={{ top: pos.top, right: pos.right }}
            className={`fixed z-[100] w-[min(20rem,calc(100vw-1rem))] backdrop-blur-2xl rounded-2xl p-4 animate-in fade-in slide-in-from-top-2 ${light ? 'bg-white/90 border border-white shadow-[0_12px_40px_rgba(45,80,155,0.18)]' : 'bg-slate-900/90 border border-white/15 shadow-[0_10px_40px_rgba(0,0,0,0.5)]'}`}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className={`font-bold text-sm ${light ? 'text-slate-900' : 'text-white'}`}>Notifications</h3>
              <button onClick={() => setUnread(false)} className={`text-xs transition-colors ${light ? 'text-slate-500 hover:text-slate-900' : 'text-white/60 hover:text-white'}`}>
                Mark all read
              </button>
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {items.map((n, i) => {
                const { Icon, cls } = ICONS[n.kind]
                return (
                  <div key={i} className={`p-3 rounded-xl border transition-colors ${light ? 'bg-slate-50/80 border-slate-200/80 hover:bg-slate-100' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}>
                    <div className="flex items-start gap-3">
                      <div className={`p-1.5 rounded-lg mt-0.5 ${cls}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className={`font-semibold text-sm mb-0.5 ${light ? 'text-slate-900' : 'text-white'}`}>{n.title}</p>
                        <p className={`text-xs leading-relaxed ${light ? 'text-slate-600' : 'text-slate-300'}`}>{n.body}</p>
                        <p className="text-slate-500 text-[10px] mt-2 font-medium">{n.time}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
