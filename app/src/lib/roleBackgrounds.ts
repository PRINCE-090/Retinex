import type { CSSProperties } from 'react'

/**
 * Background image + tinted overlay per role, shared by the dashboards
 * (layouts/*Layout.tsx via RoleShell) and the login pages so they match.
 * Images live in /public/backgrounds; the colour is what shows if the file
 * is missing. See .role-bg in index.css.
 */
export const BACKGROUNDS = {
  login: {
    bgImage: '/backgrounds/login.webp',
    overlay: 'linear-gradient(135deg, rgba(5, 11, 31, 0.78) 0%, rgba(10, 24, 60, 0.70) 45%, rgba(8, 14, 38, 0.80) 100%)',
    bgColor: '#050b1f',
  },
  patient: {
    bgImage: '/backgrounds/patient.webp',
    overlay: 'linear-gradient(135deg, rgba(10, 45, 110, 0.80) 0%, rgba(14, 60, 140, 0.74) 45%, rgba(30, 50, 130, 0.82) 100%)',
    bgColor: '#0c3a7a',
  },
  doctor: {
    bgImage: '/backgrounds/doctor.webp',
    overlay: 'linear-gradient(135deg, rgba(6, 30, 32, 0.78) 0%, rgba(8, 44, 44, 0.70) 45%, rgba(10, 28, 40, 0.80) 100%)',
    bgColor: '#062020',
  },
  technician: {
    bgImage: '/backgrounds/technician.webp',
    overlay: 'linear-gradient(135deg, rgba(15, 12, 45, 0.80) 0%, rgba(25, 20, 70, 0.72) 45%, rgba(12, 14, 38, 0.82) 100%)',
    bgColor: '#0f0c2d',
  },
} as const

export type BackgroundKey = keyof typeof BACKGROUNDS

/** Inline CSS variables consumed by the .role-bg class. */
export function backgroundStyle(key: BackgroundKey): CSSProperties {
  const b = BACKGROUNDS[key]
  return {
    '--role-image': `url('${b.bgImage}')`,
    '--role-overlay': b.overlay,
    '--role-color': b.bgColor,
  } as CSSProperties
}
