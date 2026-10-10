import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldAlert, ArrowRight } from 'lucide-react'
import { login } from '../api/realApi'
import { setToken } from '../lib/auth'

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('doctor@retinex.com')
  const [password, setPassword] = useState('RetinEx@2026')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await login(email, password)
      setToken(res.token)
      navigate('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative grid min-h-screen place-items-center px-4 font-sans text-[#0F172A]">
      <div className="w-full max-w-md my-8">
        {/* Retinex Wordmark */}
        <div className="mb-8 text-center">
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-[#0F172A]">
            Retinex
          </h1>
          <p className="text-sm text-[#64748B] mt-1.5 font-sans">
            AI-assisted diabetic retinopathy screening tool
          </p>
        </div>

        {/* Structural Glass Centered Card */}
        <div className="glass-structural glass-hover p-7 sm:p-8">
          <div className="mb-6 pb-4 border-b border-[#0F172A]/[0.06]">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-lg font-semibold text-[#0F172A]">
                Sign In
              </h2>
            </div>
            <p className="text-xs text-[#64748B] mt-1.5">
              Enter your credentials to access the clinical screening review queue.
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-xs font-medium text-[#0F172A] mb-1.5">
                Staff Email Address
              </label>
              <input
                id="email"
                autoFocus
                type="email"
                className="clinical-input font-sans text-xs"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="doctor@retinex.com"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-medium text-[#0F172A] mb-1.5">
                Security Password
              </label>
              <input
                id="password"
                type="password"
                className="clinical-input font-sans text-xs"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
              />
            </div>

            {error && (
              <div className="rounded-[8px] border border-[#DC2626]/25 bg-[#DC2626]/[0.06] p-3 text-xs text-[#DC2626]">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 shrink-0 text-[#DC2626]" />
                  <span>Authentication failed: {error}</span>
                </div>
              </div>
            )}

            {/* Primary Solid Button */}
            <button
              type="submit"
              className="btn-primary w-full py-2.5 text-xs font-medium mt-2"
              disabled={busy}
            >
              {busy ? (
                <>
                  <span className="lens-spinner-invert" aria-hidden />
                  Verifying credentials…
                </>
              ) : (
                <>
                  Sign in to workstation
                  <ArrowRight className="h-4 w-4 ml-1" />
                </>
              )}
            </button>
          </form>

        </div>
      </div>
    </div>
  )
}
