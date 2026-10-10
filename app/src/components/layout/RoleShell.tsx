import { useEffect, useLayoutEffect, useRef } from 'react'
import type { CSSProperties, ElementType, ReactNode } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { LogOut, Settings } from 'lucide-react'
import NotificationBell, { type NotificationItem } from './NotificationBell'
import { useProfile, type Role } from '../../lib/profile'
import { useWorkflow } from '../../context/WorkflowContext'
import { gsap, prefersReducedMotion } from '../../lib/scroll'

/**
 * Shared floating-navbar shell for all four roles. Structure and styling
 * are lifted from Aura-Voice-Agent (PatientNav + .patient-page-bg): a
 * centered frosted-glass pill nav over a full-bleed background image that
 * is blended with a tinted gradient overlay (see .role-bg in index.css).
 */

export type NavLink = { href: string; label: string; icon: ElementType; exact?: boolean }

type Accent = 'sky' | 'emerald' | 'violet' | 'slate'

// Literal class strings so Tailwind can see them.
const ACCENTS: Record<Accent, { sub: string; avatar: string }> = {
  sky: { sub: 'text-sky-200', avatar: 'bg-sky-400/20 border-sky-300/40 text-sky-100' },
  emerald: { sub: 'text-emerald-300', avatar: 'bg-emerald-500/20 border-emerald-400/40 text-emerald-200' },
  violet: { sub: 'text-violet-300', avatar: 'bg-violet-500/20 border-violet-400/40 text-violet-200' },
  slate: { sub: 'text-violet-300', avatar: 'bg-violet-500/20 border-violet-400/40 text-violet-200' },
}

/** 'light' = Aura's pale glass over a light image (dark text); 'dark' = the original dark glass. */
export type Tone = 'light' | 'dark'

// Literal class strings so Tailwind can see them.
const TONES: Record<Tone, {
  nav: string; brand: string; sub: string; track: string; pill: string
  linkActive: string; linkIdle: string; iconBtn: string; iconBtnActive: string
  chip: string; chipName: string; avatar: string; logout: string
}> = {
  dark: {
    nav: 'aura-nav',
    brand: 'text-white',
    sub: '',
    track: 'bg-white/5 ring-white/10',
    pill: 'bg-white',
    linkActive: 'text-neutral-900',
    linkIdle: 'text-white/70 hover:text-white',
    iconBtn: 'bg-white/10 hover:bg-white/20 border-white/20 text-white/80',
    iconBtnActive: 'bg-white text-neutral-900 border-white',
    chip: 'bg-white/10 border-white/20',
    chipName: 'text-white/90',
    avatar: '',
    logout: 'text-white/70 hover:text-rose-300 hover:bg-rose-500/10',
  },
  light: {
    nav: 'aura-nav-light',
    brand: 'text-slate-900',
    sub: 'text-blue-700',
    track: 'bg-white/50 ring-slate-300/50',
    pill: 'bg-slate-900',
    linkActive: 'text-white',
    linkIdle: 'text-slate-600 hover:text-slate-900',
    iconBtn: 'bg-white/60 hover:bg-white/90 border-white/80 text-slate-700',
    iconBtnActive: 'bg-slate-900 text-white border-slate-900',
    chip: 'bg-white/70 border-white/80',
    chipName: 'text-slate-800',
    avatar: 'bg-gradient-to-tr from-blue-600 to-indigo-600 border-transparent text-white',
    logout: 'text-slate-500 hover:text-red-600 hover:bg-red-50',
  },
}

export interface RoleShellProps {
  title: string
  subtitle?: string
  links: NavLink[]
  accent: Accent
  /** Public path of the background image (under /public). */
  bgImage: string
  /** CSS gradient laid over the image; controls how much it blends in. */
  overlay: string
  /** Solid colour shown behind the image while it loads / if it is missing. */
  bgColor: string
  logoutTo: string
  logoutLabel?: string
  /** Drives the Settings link and the user chip (name comes from Settings). */
  role: Role
  showUserChip?: boolean
  /** Overrides the name on the chip (patients: name comes from their record, not Settings). */
  userName?: string
  /** Extra classes on the root (e.g. the patient high-contrast mode). */
  className?: string
  /** Visual tone of navbar + page; defaults to 'dark'. */
  tone?: Tone
  notifications?: NotificationItem[]
  rightSlot?: ReactNode
}

export default function RoleShell(props: RoleShellProps) {
  const { title, subtitle, links, accent, bgImage, overlay, bgColor, logoutTo, logoutLabel = 'Logout', role, showUserChip = true, userName, className = '', tone = 'dark', notifications, rightSlot } = props
  const navigate = useNavigate()
  const { logout } = useWorkflow()
  const path = useLocation().pathname
  const a = ACCENTS[accent]
  const t = TONES[tone]
  const { profile } = useProfile(role)
  const chipName = userName ?? profile.name

  // Same sliding pill as the landing page's TeamRoles tabs: one pill that
  // glides to the active link (power3.out, 0.45s), nothing fancier.
  const activeIdx = links.findIndex((l) => (l.exact ? path === l.href : path.startsWith(l.href)))
  const tabRefs = useRef<(HTMLAnchorElement | null)[]>([])
  const wrapRef = useRef<HTMLDivElement>(null)
  const pillRef = useRef<HTMLDivElement>(null)
  const placed = useRef(false)

  const place = (animate: boolean) => {
    const pill = pillRef.current
    const tab = tabRefs.current[activeIdx]
    if (!pill) return
    if (!tab) {
      gsap.set(pill, { opacity: 0 })
      return
    }
    const props = { x: tab.offsetLeft, width: tab.offsetWidth, opacity: 1 }
    if (animate && placed.current && !prefersReducedMotion()) {
      gsap.to(pill, { ...props, duration: 0.45, ease: 'power3.out' })
    } else {
      gsap.set(pill, props)
    }
    placed.current = true
  }

  useLayoutEffect(() => {
    place(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIdx])

  // Re-measure on real resizes only. A ResizeObserver fires once as soon as
  // it starts observing; if that ran place(false) right after a route
  // change it would snap the pill and cancel the slide mid-flight.
  const placeRef = useRef(place)
  placeRef.current = place
  useEffect(() => {
    const el = wrapRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    let first = true
    const ro = new ResizeObserver(() => {
      if (first) {
        first = false
        return
      }
      placeRef.current(false)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const bgStyle = {
    '--role-image': `url('${bgImage}')`,
    '--role-overlay': overlay,
    '--role-color': bgColor,
  } as CSSProperties

  return (
    <div className={`role-bg h-screen flex flex-col ${tone === 'light' ? 'light-mode' : ''} ${className}`} style={bgStyle}>
      <header className="relative z-30 w-full flex justify-center pt-3 px-4 select-none flex-shrink-0">
        <nav className={`${t.nav} px-3 sm:px-4 py-1.5 flex items-center justify-between gap-3 rounded-full w-full max-w-6xl`}>
          {/* Brand -- wordmark only, matching the landing page */}
          <div className="flex items-baseline gap-2 flex-shrink-0 pl-2">
            <span className={`font-instrument-serif text-2xl leading-none ${t.brand}`}>{title}</span>
            {subtitle && <span className={`hidden sm:block text-[10px] font-semibold uppercase tracking-wider ${tone === 'light' ? t.sub : a.sub}`}>{subtitle}</span>}
          </div>

          {/* Links */}
          <div className="min-w-0 overflow-x-auto no-scrollbar">
            <div ref={wrapRef} className={`relative inline-flex items-center gap-1 rounded-full p-1 ring-1 ${t.track}`}>
              <div ref={pillRef} className={`pointer-events-none absolute inset-y-1 left-0 rounded-full opacity-0 ${t.pill}`} />
              {links.map((link, i) => {
                const Icon = link.icon
                return (
                  <Link
                    key={link.href}
                    to={link.href}
                    ref={(el) => {
                      tabRefs.current[i] = el
                    }}
                    className={`relative z-10 flex items-center gap-1.5 rounded-full px-4 py-2 font-sans text-sm font-medium whitespace-nowrap transition-colors ${
                      i === activeIdx ? t.linkActive : t.linkIdle
                    }`}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    <span className="hidden lg:inline">{link.label}</span>
                  </Link>
                )
              })}
            </div>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {rightSlot}
            {notifications && <NotificationBell items={notifications} tone={tone} />}
            <Link
              to={`/${role}/settings`}
              title="Settings"
              aria-label="Settings"
              className={`p-2 rounded-full border transition-colors ${
                path.startsWith(`/${role}/settings`) ? t.iconBtnActive : t.iconBtn
              }`}
            >
              <Settings className="h-4 w-4" />
            </Link>
            {showUserChip && (
              <div className={`flex items-center gap-1.5 pl-1.5 py-1 pr-2.5 border rounded-full ${t.chip}`}>
                <div className={`w-6 h-6 rounded-full border flex items-center justify-center text-[10px] font-bold uppercase ${tone === 'light' ? t.avatar : a.avatar}`}>
                  {chipName.charAt(0)}
                </div>
                <span className={`text-xs font-semibold max-w-[100px] truncate hidden xl:inline ${t.chipName}`}>{chipName}</span>
              </div>
            )}
            <button
              onClick={() => {
                logout()
                navigate(logoutTo)
              }}
              title={logoutLabel}
              className={`flex items-center gap-1.5 p-1.5 sm:px-3 text-xs font-medium rounded-xl transition-colors ${t.logout}`}
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{logoutLabel}</span>
            </button>
          </div>
        </nav>
      </header>

      <main className="relative z-10 flex-1 min-h-0 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
