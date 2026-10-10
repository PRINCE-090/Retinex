/**
 * Who is signed in. Persisted in localStorage so a page reload keeps the
 * session (the JWT itself lives under lib/auth.ts's key, shared with the
 * older real-API pages).
 */
import { getToken, setToken, clearToken } from './auth'

export type SessionRole = 'patient' | 'doctor' | 'technician' | 'admin'

export interface SessionUser {
  /** Mongo user id for staff; patient_id (uuid) for patients. */
  id: string
  name: string
  email?: string
  role: SessionRole
}

const USER_KEY = 'retinex_session_user'

export function loadSession(): { token: string; user: SessionUser } | null {
  try {
    const token = getToken()
    const raw = localStorage.getItem(USER_KEY)
    if (!token || !raw) return null
    const user = JSON.parse(raw) as SessionUser
    return user?.id && user?.role ? { token, user } : null
  } catch {
    return null
  }
}

export function saveSession(token: string, user: SessionUser) {
  setToken(token)
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(user))
  } catch {
    /* ignore */
  }
}

export function updateStoredUser(user: SessionUser) {
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(user))
  } catch {
    /* ignore */
  }
}

export function clearSession() {
  clearToken()
  try {
    localStorage.removeItem(USER_KEY)
  } catch {
    /* ignore */
  }
}

/** Where each role signs in. */
export const LOGIN_PATH: Record<SessionRole, string> = {
  patient: '/login/patient',
  doctor: '/login/doctor',
  technician: '/login/technician',
  admin: '/login/admin',
}
