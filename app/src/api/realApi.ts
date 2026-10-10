/**
 * Real backend API calls — separate from `client.ts`'s mock API, which
 * stays untouched and keeps powering the existing Landing/Dashboard/
 * DiagnosticViewer demo flow. This file talks to the actual
 * backend/index.js server documented in documents/FRONTEND_API_CONTRACT.md.
 */

const BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:3000'

export interface RealKnownPerformance {
  official_test_sensitivity: number
  official_test_specificity: number
  official_test_auc: number
  target_sensitivity: number
  target_specificity: number
  meets_target: boolean
}

export interface RealClassification {
  grade: number
  grade_name: string
  grade_probabilities_raw: number[]
  grade_probabilities_calibrated: number[]
  referable: {
    probability: number
    threshold: number
    threshold_source: string
    is_referable: boolean
    known_performance: RealKnownPerformance
  }
}

export interface RealLesionChannel {
  mask_path: string | null
  probability_map_path: string | null
  val_dice: number
  dice_unreliable: boolean
}

export interface RealResult {
  image_id: string
  classification: RealClassification | null
  image_quality: {
    status: string
    quality: 'adequate' | 'borderline' | 'reject'
    reject_reason: string | null
    enhanced_image_path: string | null
  }
  grad_cam: {
    heatmap_path: string
    overlay_path: string
    crop_region: {
      left: number
      top: number
      side: number
      original_width: number
      original_height: number
    }
  } | null
  lesion_segmentation: {
    channels: Record<
      'microaneurysms' | 'haemorrhages' | 'hard_exudates' | 'soft_exudates',
      RealLesionChannel
    >
  } | null
  vessel_segmentation: { mask_path: string } | null
  optic_disc: { status: string; location: { x: number; y: number; radius: number } } | null
  fovea: { status: string; location: { x: number; y: number; score: number } } | null
}

export interface RealUploadResponse {
  success: boolean
  message: string
  image_id: string
  original_filename: string
  uploaded_at: string
  result: RealResult
}

export interface RealClinicalEvaluation {
  status: 'pending' | 'finalized'
  decision: 'agree' | 'override' | null
  override_grade: number | null
  doctor_notes: string
  prescription?: string
  diet?: string
  finalized_at: string | null
  finalized_by: string | null
}

export interface RealVisit {
  visit_id: string
  assigned_doctor_id?: string | null
  patient_phone?: string
  patient_id?: string
  patient_name?: string
  patient_age?: number | null
  created_at?: string
  od: RealResult | null
  os: RealResult | null
  clinical_evaluation?: RealClinicalEvaluation | null
}

export interface RealVisitUploadResponse {
  success: boolean
  message: string
  visit_id: string
  patient_id: string
  /** The upload is accepted immediately and analysed in the background; poll GET /api/visits. */
  processing_status?: 'processing'
  od?: RealResult | null
  os?: RealResult | null
}

export interface RealPatient {
  patient_id: string
  name: string
  age: number
  phone?: string
  gender?: 'male' | 'female' | 'other' | ''
  diabetic_history?: boolean | null
  created_at?: string
}

export interface RealDoctor {
  id: string
  name: string
}

export interface RealEyeSummary {
  quality: string | null
  grade: number | null
  grade_name: string | null
  referable?: boolean | null
}

export interface RealVisitSummary {
  visit_id: string
  patient_id: string
  patient_name: string
  patient_age: number | null
  patient_phone?: string
  assigned_doctor_id?: string | null
  assigned_doctor_name?: string | null
  has_od?: boolean
  has_os?: boolean
  /** Server-side state of the AI run: processing -> complete | failed. */
  processing_status?: 'processing' | 'complete' | 'failed'
  processing_error?: string | null
  processing_started_at?: string | null
  created_at: string
  od: RealEyeSummary | null
  os: RealEyeSummary | null
  worst_grade: number | null
  clinical_evaluation?: RealClinicalEvaluation | null
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` }
}

export async function login(email: string, password: string) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const data = await res.json()
  if (!res.ok || !data.success) {
    throw new Error(data.message ?? `Login failed (${res.status})`)
  }
  return data as { success: true; message: string; token: string; user: { id: string; name: string; email: string; role: string } }
}

export async function uploadImage(file: File, token: string): Promise<RealUploadResponse> {
  const form = new FormData()
  form.append('image', file)

  const res = await fetch(`${BASE}/api/images`, {
    method: 'POST',
    headers: authHeaders(token),
    body: form,
  })
  const data = await res.json()
  if (!res.ok || !data.success) {
    throw new Error(data.details ?? data.error ?? `Upload failed (${res.status})`)
  }
  return data as RealUploadResponse
}

export async function getResult(imageId: string, token: string): Promise<RealResult> {
  const res = await fetch(`${BASE}/api/results/${imageId}`, {
    headers: authHeaders(token),
  })
  const data = await res.json()
  if (!res.ok || data.success === false) {
    throw new Error(data.error ?? `Fetching result failed (${res.status})`)
  }
  return data as RealResult
}

export async function uploadVisit(
  odFile: File | null,
  osFile: File | null,
  token: string,
  patientId: string,
  assignedDoctorId?: string | null,
): Promise<RealVisitUploadResponse> {
  const form = new FormData()
  if (odFile) form.append('image_od', odFile)
  if (osFile) form.append('image_os', osFile)
  form.append('patient_id', patientId)
  if (assignedDoctorId) form.append('assigned_doctor_id', assignedDoctorId)

  const res = await fetch(`${BASE}/api/visits`, {
    method: 'POST',
    headers: authHeaders(token),
    body: form,
  })
  const data = await res.json()
  if (!res.ok || !data.success) {
    // `details` is the raw pipeline traceback -- useful in the console, not
    // something to put in front of a technician.
    if (data.details) console.error('Visit processing failed:', data.details)
    throw new Error(
      data.details
        ? 'The AI analysis could not be completed for these images. Please try again, and contact support if it keeps failing.'
        : (data.error ?? `Visit upload failed (${res.status})`),
    )
  }
  return data as RealVisitUploadResponse
}

export async function createPatient(
  name: string,
  age: number,
  token: string,
  phone?: string,
  extra?: { gender?: string; diabetic_history?: boolean | null },
): Promise<RealPatient> {
  const res = await fetch(`${BASE}/api/patients`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify({ name, age, phone, ...extra }),
  })
  const data = await res.json()
  if (!res.ok || !data.success) {
    throw new Error(data.error ?? `Creating patient failed (${res.status})`)
  }
  return data.patient as RealPatient
}

export async function listVisits(token: string): Promise<RealVisitSummary[]> {
  const res = await fetch(`${BASE}/api/visits`, {
    headers: authHeaders(token),
  })
  const data = await res.json()
  if (!res.ok || !data.success) {
    throw new Error(data.error ?? `Fetching visits failed (${res.status})`)
  }
  return data.visits as RealVisitSummary[]
}

export async function getVisit(visitId: string, token: string): Promise<RealVisit> {
  const res = await fetch(`${BASE}/api/visits/${visitId}`, {
    headers: authHeaders(token),
  })
  const data = await res.json()
  if (!res.ok || data.success === false) {
    throw new Error(data.error ?? `Fetching visit failed (${res.status})`)
  }
  return data as RealVisit
}

/** Fetches a URL with the auth header and returns a local object URL, or null on failure. */
async function fetchBlobUrl(url: string, token: string): Promise<string | null> {
  const res = await fetch(url, { headers: authHeaders(token) })
  if (!res.ok) return null
  const blob = await res.blob()
  return URL.createObjectURL(blob)
}

/**
 * Fetches an asset image (Grad-CAM overlay, lesion mask, vessel mask) via
 * the authenticated single-image asset route and returns a local object
 * URL usable as an <img src>. The *_path fields in the result JSON are
 * server filesystem paths, not URLs, and cannot be loaded directly.
 */
export async function fetchAssetUrl(
  imageId: string,
  assetType: string,
  token: string,
): Promise<string | null> {
  return fetchBlobUrl(`${BASE}/api/results/${imageId}/assets/${assetType}`, token)
}

/** Same as fetchAssetUrl, but for one eye of a two-eye visit. */
export async function fetchVisitAssetUrl(
  visitId: string,
  eye: 'od' | 'os',
  assetType: string,
  token: string,
): Promise<string | null> {
  return fetchBlobUrl(`${BASE}/api/visits/${visitId}/assets/${eye}/${assetType}`, token)
}

const LESION_CHANNEL_KEYS = ['microaneurysms', 'haemorrhages', 'hard_exudates', 'soft_exudates'] as const

export interface RealAssetBundle {
  originalUrl: string | null
  overlayUrl: string | null
  vesselUrl: string | null
  lesionUrls: Partial<Record<(typeof LESION_CHANNEL_KEYS)[number], string | null>>
}

/**
 * Fetches every renderable asset for a non-rejected result in parallel,
 * given a function that knows how to fetch one assetType for it. Shared
 * internals for both the single-image and visit asset bundlers below, so
 * the asset-list/parallelization logic lives in exactly one place.
 */
async function bundleAssets(
  result: RealResult,
  fetchOne: (assetType: string) => Promise<string | null>,
): Promise<RealAssetBundle> {
  const [originalUrl, overlayUrl, vesselUrl] = await Promise.all([
    fetchOne('original'),
    fetchOne('gradcam_overlay'),
    fetchOne('vessels'),
  ])

  const lesionUrls: RealAssetBundle['lesionUrls'] = {}
  const channels = result.lesion_segmentation?.channels
  if (channels) {
    const entries = await Promise.all(
      LESION_CHANNEL_KEYS.map(async (key) => [key, await fetchOne(key)] as const),
    )
    for (const [key, url] of entries) lesionUrls[key] = url
  }

  return { originalUrl, overlayUrl, vesselUrl, lesionUrls }
}

/** Asset bundle for a single-image real result (POST /api/images path). */
export async function fetchAllRealAssets(result: RealResult, token: string): Promise<RealAssetBundle> {
  return bundleAssets(result, (assetType) => fetchAssetUrl(result.image_id, assetType, token))
}

/** Asset bundle for one eye of a real visit (POST /api/visits path). */
export async function fetchAllRealVisitAssets(
  eyeResult: RealResult,
  visitId: string,
  eye: 'od' | 'os',
  token: string,
): Promise<RealAssetBundle> {
  return bundleAssets(eyeResult, (assetType) => fetchVisitAssetUrl(visitId, eye, assetType, token))
}

export async function saveVisitEvaluation(
  visitId: string,
  evaluation: {
    decision: 'agree' | 'override'
    override_grade?: number | null
    doctor_notes?: string
    prescription?: string
    diet?: string
  },
  token: string,
): Promise<{ success: boolean; message: string; clinical_evaluation: RealClinicalEvaluation }> {
  const res = await fetch(`${BASE}/api/visits/${visitId}/evaluation`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify(evaluation),
  })
  const data = await res.json()
  if (!res.ok || !data.success) {
    throw new Error(data.error ?? `Saving evaluation failed (${res.status})`)
  }
  return data
}


// ---------------------------------------------------------------------
// Multi-role workflow additions
// ---------------------------------------------------------------------

async function jsonOrThrow<T>(res: Response, fallback: string): Promise<T> {
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.success === false) {
    throw new Error(data.message ?? data.error ?? `${fallback} (${res.status})`)
  }
  return data as T
}

/** Patient sign-in by phone. DEMO: the backend does not verify an OTP yet. */
export async function loginPatientApi(phone: string) {
  const res = await fetch(`${BASE}/api/auth/patient/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone }),
  })
  return jsonOrThrow<{ success: true; token: string; user: { id: string; name: string; role: 'patient' } }>(
    res,
    'Patient login failed',
  )
}

export async function listPatients(token: string): Promise<RealPatient[]> {
  const res = await fetch(`${BASE}/api/patients`, { headers: authHeaders(token) })
  const data = await jsonOrThrow<{ patients: RealPatient[] }>(res, 'Fetching patients failed')
  return data.patients
}

export async function getMyPatient(token: string): Promise<RealPatient> {
  const res = await fetch(`${BASE}/api/patients/me`, { headers: authHeaders(token) })
  const data = await jsonOrThrow<{ patient: RealPatient }>(res, 'Fetching your record failed')
  return data.patient
}

export async function listDoctors(token: string): Promise<RealDoctor[]> {
  const res = await fetch(`${BASE}/api/doctors`, { headers: authHeaders(token) })
  const data = await jsonOrThrow<{ doctors: RealDoctor[] }>(res, 'Fetching doctors failed')
  return data.doctors
}

export async function updateProfileApi(fields: { name?: string; email?: string }, token: string) {
  const res = await fetch(`${BASE}/api/auth/me`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify(fields),
  })
  return jsonOrThrow<{ user: { id: string; name: string; email: string; role: string } }>(res, 'Saving profile failed')
}

export async function changePasswordApi(currentPassword: string, newPassword: string, token: string) {
  const res = await fetch(`${BASE}/api/auth/change-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify({ currentPassword, newPassword }),
  })
  return jsonOrThrow<{ message: string }>(res, 'Changing password failed')
}
