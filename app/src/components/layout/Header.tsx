import { Link, useNavigate } from 'react-router-dom'
import { LogOut, User } from 'lucide-react'
import { clearToken, getToken } from '../../lib/auth'

export default function Header() {
  const navigate = useNavigate()
  const token = getToken()

  const handleSignOut = () => {
    clearToken()
    navigate('/login')
  }

  return (
    <header className="glass-structural flex h-[72px] shrink-0 items-center justify-between rounded-none border-x-0 border-t-0 px-5 lg:px-8 z-30">
      {/* Left: App Wordmark */}
      <div className="flex items-center gap-3">
        <Link to="/dashboard" className="flex items-center gap-2.5 group">
          <span className="font-heading text-2xl font-semibold tracking-tight text-[#0F172A]">
            Retinex
          </span>
        </Link>
      </div>

      {/* Right: Practitioner Session & Sign out */}
      <div className="flex items-center gap-3">
        {token ? (
          <>
            <div className="hidden sm:flex items-center gap-2.5 rounded-[8px] border border-white/70 bg-white/40 px-3 py-1 text-sm">
              <div className="flex h-6 w-6 items-center justify-center rounded-[6px] bg-[#EA6C53]/15 text-[#EA6C53]">
                <User className="h-3.5 w-3.5" />
              </div>
              <div className="text-sm leading-tight">
                <span className="font-medium text-[#0F172A]">Dr. Bhotika Thakur, MD</span>
                <span className="text-[#64748B] text-xs ml-1.5 font-sans"></span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSignOut}
              className="btn text-sm"
              title="Sign out of Workstation"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </>
        ) : (
          <Link
            to="/login"
            className="btn-primary py-2 px-5 text-sm"
          >
            Sign In
          </Link>
        )}
      </div>
    </header>
  )
}
