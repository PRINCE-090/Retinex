import { useCallback, useEffect, useState } from 'react'
import type { Language } from './i18n'

/**
 * Patient portal preferences, stored per patient in localStorage.
 *
 * BACKEND: no preferences/consent endpoint exists yet (only
 * POST /api/auth/login). When one is added, persist these server-side --
 * `modelConsent` and `deletionRequestedAt` in particular are records the
 * clinic must be able to see, not just browser state.
 */
export interface PatientPrefs {
  language: Language
  voiceLang: 'auto' | 'en-IN' | 'hi-IN'
  voiceRate: number
  largeText: boolean
  highContrast: boolean
  shareIncludePdf: boolean
  shareToFamily: boolean
  familyPhone: string
  modelConsent: boolean
  deletionRequestedAt: string | null
}

export const DEFAULT_PREFS: PatientPrefs = {
  language: 'English',
  voiceLang: 'auto',
  voiceRate: 1,
  largeText: false,
  highContrast: false,
  shareIncludePdf: true,
  shareToFamily: false,
  familyPhone: '',
  modelConsent: false,
  deletionRequestedAt: null,
}

const key = (id: string) => `retinex_patient_prefs_${id}`
const EVENT = 'retinex-patient-prefs-changed'

export function readPrefs(id: string | null): PatientPrefs {
  if (!id) return DEFAULT_PREFS
  try {
    const raw = localStorage.getItem(key(id))
    if (raw) return { ...DEFAULT_PREFS, ...JSON.parse(raw) }
  } catch {
    /* fall through */
  }
  return DEFAULT_PREFS
}

export function usePatientPrefs(id: string | null) {
  const [prefs, setPrefs] = useState<PatientPrefs>(() => readPrefs(id))

  useEffect(() => {
    setPrefs(readPrefs(id))
    const sync = () => setPrefs(readPrefs(id))
    window.addEventListener(EVENT, sync)
    return () => window.removeEventListener(EVENT, sync)
  }, [id])

  const update = useCallback(
    (patch: Partial<PatientPrefs>) => {
      if (!id) return
      const next = { ...readPrefs(id), ...patch }
      try {
        localStorage.setItem(key(id), JSON.stringify(next))
      } catch {
        /* ignore -- in-memory state below still updates */
      }
      setPrefs(next)
      window.dispatchEvent(new Event(EVENT))
    },
    [id],
  )

  return { prefs, update }
}

/** Digits for a wa.me link: 10-digit Indian numbers get +91; otherwise 11-15 digits incl. country code. '' if invalid. */
export function normalisePhone(input: string): string {
  const digits = input.replace(/\D/g, '')
  if (digits.length === 10) return `91${digits}`
  if (digits.length >= 11 && digits.length <= 15) return digits
  return ''
}

/** Single source for the speech language, so "Same as portal language" and an explicit "English" always pick the same voice. */
export function resolveVoiceLang(pref: PatientPrefs['voiceLang'], portalLanguage: string): 'en-IN' | 'hi-IN' {
  if (pref !== 'auto') return pref
  return portalLanguage === 'Hindi' ? 'hi-IN' : 'en-IN'
}
