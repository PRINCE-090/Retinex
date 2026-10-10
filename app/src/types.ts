/**
 * Domain types — shaped to DATABASE_SCHEMA.md and API_ROUTES.md so a real
 * backend can be dropped in behind `src/api/client.ts` with no UI changes.
 */

export type Role = 'DOCTOR' | 'ADMIN' | 'TECHNICIAN'
export type Eye = 'OD' | 'OS' // OD = right eye, OS = left eye
export type ScanStatus = 'PENDING' | 'ANALYZING' | 'REVIEWED'

/** DR severity, ICDR 0–4 scale. */
export type SeverityScore = 0 | 1 | 2 | 3 | 4

export const SEVERITY_LABEL: Record<SeverityScore, string> = {
  0: 'No DR',
  1: 'Mild NPDR',
  2: 'Moderate NPDR',
  3: 'Severe NPDR',
  4: 'Proliferative DR',
}

export const SEVERITY_SHORT: Record<SeverityScore, string> = {
  0: 'None',
  1: 'Mild',
  2: 'Moderate',
  3: 'Severe',
  4: 'PDR',
}

/** Tailwind token name per severity, used for badges/rings. */
export const SEVERITY_TOKEN: Record<SeverityScore, string> = {
  0: 'healthy',
  1: 'mild',
  2: 'moderate',
  3: 'severe',
  4: 'proliferative',
}

export const SEVERITY_HEX: Record<SeverityScore, string> = {
  0: '#2C8C74',
  1: '#84B24C',
  2: '#E68A00',
  3: '#C92A2A',
  4: '#8A1414',
}

export interface User {
  id: string
  email: string
  name: string
  role: Role
  created_at: string
}

export interface Patient {
  id: string
  mrn: string
  first_name: string
  last_name: string
  date_of_birth: string
  diabetic_since: string
  sex: 'M' | 'F'
  phone?: string
  created_at: string
}

export type LesionType =
  | 'microaneurysm'
  | 'hemorrhage'
  | 'hard_exudate'
  | 'soft_exudate'
  | 'neovascularization'

export const LESION_META: Record<
  LesionType,
  { label: string; hex: string; blurb: string }
> = {
  microaneurysm: {
    label: 'Microaneurysm',
    hex: '#E11D48',
    blurb: 'Earliest visible lesion — outpouching of a retinal capillary wall.',
  },
  hemorrhage: {
    label: 'Retinal hemorrhage',
    hex: '#9F1239',
    blurb: 'Dot/blot bleed from ruptured capillaries in the deep retina.',
  },
  hard_exudate: {
    label: 'Hard exudate',
    hex: '#E68A00',
    blurb: 'Lipid deposit from leaking vessels — marks chronic edema.',
  },
  soft_exudate: {
    label: 'Cotton-wool spot',
    hex: '#F5D90A',
    blurb: 'Nerve-fibre-layer infarct from capillary occlusion.',
  },
  neovascularization: {
    label: 'Neovascularization',
    hex: '#7C3AED',
    blurb: 'New fragile vessels — defines proliferative disease.',
  },
}

/**
 * A single detected lesion. `x`/`y` are normalized fundus-image coordinates
 * in [-1, 1] with the fovea at the origin; the 3D eye maps them onto the
 * retinal cup and the fundus viewer maps them back to pixels.
 */
export interface Lesion {
  id: string
  eye: Eye
  type: LesionType
  x: number
  y: number
  /** relative lesion size, 0.3–1.4, used for pin + box scale */
  size: number
  confidence: number
}

export interface EyeResult {
  eye: Eye
  severity: SeverityScore
  confidence: number
  gradcam_url: string
  fundus_url: string
  lesions: Lesion[]
  /** short bullet notes the model surfaces */
  ai_findings: string[]
}

export interface AIResult {
  id: string
  scan_id: string
  ai_version: string
  processed_at: string
  eyes: Partial<Record<Eye, EyeResult>>
}

export interface ClinicalNote {
  id: string
  scan_id: string
  doctor_id: string
  doctor_name: string
  agrees_with_ai: boolean
  final_diagnosis: string
  notes: string
  timestamp: string
}

export interface Scan {
  id: string
  patient_id: string
  uploaded_by: string
  uploaded_by_name: string
  upload_timestamp: string
  status: ScanStatus
  eyes: Eye[]
  /** convenience: worst severity across analyzed eyes, for queue sorting */
  priority_severity: SeverityScore | null
}

export interface QueueItem {
  /** null when the patient has no scans on file yet */
  scan: Scan | null
  patient: Patient
  result: AIResult | null
  /** null until a doctor signs off — this, not the AI result, is what "screened" means */
  note: ClinicalNote | null
}

export interface DashboardStats {
  pending_reviews: number
  scans_today: number
  high_risk: number
  /** severity distribution across all reviewed scans this week */
  severity_distribution: Record<SeverityScore, number>
  /** last 8 weeks: index 0 = oldest */
  weekly_volume: { week: string; scans: number; high_risk: number }[]
}
