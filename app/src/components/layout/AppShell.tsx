import type { ReactNode } from 'react'
import Header from './Header'

interface Props {
  title?: string
  actions?: ReactNode
  lead?: ReactNode
  children: ReactNode
  bleed?: boolean
  hideGlobalHeader?: boolean
}

export default function AppShell({
  title,
  actions,
  lead,
  children,
  bleed = false,
  hideGlobalHeader = false,
}: Props) {
  return (
    <div className="relative flex h-screen flex-col overflow-hidden font-sans text-[#0F172A] antialiased">
      {/* Top Clinical Header (omitted when hideGlobalHeader is true) */}
      {!hideGlobalHeader && <Header />}

      {title && (
        <header
          className={`glass-structural flex shrink-0 items-center justify-between rounded-none border-x-0 border-t-0 ${
            hideGlobalHeader ? 'h-[72px] px-5 lg:px-8' : 'h-13 px-6 lg:px-8'
          }`}
        >
          <div className="flex min-w-0 items-center gap-2.5">
            {lead}
            {!lead && (
              <h1 className="truncate font-heading text-sm font-semibold text-[#0F172A]">
                {title}
              </h1>
            )}
          </div>
          <div className="flex items-center gap-3">{actions}</div>
        </header>
      )}

      {/* Main Content Area */}
      <main className="min-h-0 flex-1 overflow-auto">
        {bleed ? (
          children
        ) : (
          <div className="mx-auto max-w-[1440px] px-5 py-7 lg:px-8 space-y-7">
            {children}
          </div>
        )}
      </main>
    </div>
  )
}
