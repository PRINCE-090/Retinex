import { useState } from 'react'
import { CheckCircle2, AlertCircle, User, KeyRound } from 'lucide-react'
import { useProfile, type Role } from '../../lib/profile'
import PatientSettings from '../patient/PatientSettings'
import { useWorkflow } from '../../context/WorkflowContext'
import { changePasswordApi } from '../../api/realApi'

const input =
  'w-full bg-black/20 border border-white/15 rounded-xl px-4 py-3 text-slate-100 text-sm placeholder:text-slate-500 focus:outline-none focus:border-white/40 transition-all'
const label = 'block text-xs font-semibold text-white/70 mb-1.5'
const card = 'backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-6 space-y-4'

type Msg = { ok: boolean; text: string } | null

function Banner({ msg }: { msg: Msg }) {
  if (!msg) return null
  const Icon = msg.ok ? CheckCircle2 : AlertCircle
  return (
    <div className={`flex items-center gap-2 text-xs rounded-xl px-3 py-2 border ${msg.ok ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30' : 'text-rose-300 bg-rose-500/10 border-rose-500/30'}`}>
      <Icon className="h-4 w-4 flex-shrink-0" /> {msg.text}
    </div>
  )
}

export default function SettingsPage({ role }: { role: Role }) {
  if (role === 'patient') return <PatientSettings />
  return <StaffSettings role={role} />
}

function StaffSettings({ role }: { role: Role }) {
  const { profile, save } = useProfile(role)
  const { token } = useWorkflow()
  const [name, setName] = useState(profile.name)
  const [email, setEmail] = useState(profile.email)
  const [profileMsg, setProfileMsg] = useState<Msg>(null)

  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [pwMsg, setPwMsg] = useState<Msg>(null)

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return setProfileMsg({ ok: false, text: 'Name cannot be empty.' })
    if (!/^\S+@\S+\.\S+$/.test(email)) return setProfileMsg({ ok: false, text: 'Enter a valid email address.' })
    try {
      await save({ name: name.trim(), email: email.trim().toLowerCase() })
      setProfileMsg({ ok: true, text: 'Profile updated.' })
    } catch (err) {
      setProfileMsg({ ok: false, text: err instanceof Error ? err.message : 'Could not save profile.' })
    }
  }

  const resetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (next.length < 8) return setPwMsg({ ok: false, text: 'New password must be at least 8 characters.' })
    if (next !== confirm) return setPwMsg({ ok: false, text: 'New passwords do not match.' })
    if (next === current) return setPwMsg({ ok: false, text: 'New password must differ from the current one.' })
    if (!token) return setPwMsg({ ok: false, text: 'You are signed out. Please sign in again.' })
    try {
      await changePasswordApi(current, next, token)
      setCurrent('')
      setNext('')
      setConfirm('')
      setPwMsg({ ok: true, text: 'Password updated.' })
    } catch (err) {
      setPwMsg({ ok: false, text: err instanceof Error ? err.message : 'Could not change password.' })
    }
  }

  return (
    <div className="p-6 md:p-10 max-w-3xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="pt-2">
        <h1 className="text-3xl font-bold text-white tracking-tight">Settings</h1>
        <p className="text-white/60 mt-1">Manage your account details and password</p>
      </div>

      <form onSubmit={saveProfile} className={card}>
        <h2 className="flex items-center gap-2 text-white font-bold"><User className="h-4 w-4" /> Profile</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={label}>Full name</label>
            <input className={input} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className={label}>Email</label>
            <input className={input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        </div>
        <Banner msg={profileMsg} />
        <button type="submit" className="px-5 py-2.5 rounded-full bg-white text-neutral-900 text-sm font-semibold hover:bg-white/90 transition-colors">
          Save changes
        </button>
      </form>

      <form onSubmit={resetPassword} className={card}>
        <h2 className="flex items-center gap-2 text-white font-bold"><KeyRound className="h-4 w-4" /> Reset password</h2>
        <div>
          <label className={label}>Current password</label>
          <input className={input} type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={label}>New password</label>
            <input className={input} type="password" autoComplete="new-password" required value={next} onChange={(e) => setNext(e.target.value)} />
          </div>
          <div>
            <label className={label}>Confirm new password</label>
            <input className={input} type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
        </div>
        <Banner msg={pwMsg} />
        <button type="submit" className="px-5 py-2.5 rounded-full bg-white text-neutral-900 text-sm font-semibold hover:bg-white/90 transition-colors">
          Update password
        </button>
      </form>
    </div>
  )
}
