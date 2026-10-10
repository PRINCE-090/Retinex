import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  createPatient,
  getMyPatient,
  listDoctors,
  listPatients,
  listVisits,
  login as loginStaffApi,
  loginPatientApi,
  saveVisitEvaluation,
  uploadVisit,
  type RealDoctor,
  type RealPatient,
  type RealVisitSummary,
} from '../api/realApi'
import { clearSession, loadSession, saveSession, updateStoredUser, type SessionRole, type SessionUser } from '../lib/session'

/**
 * Clinic workflow state (technician -> doctor -> patient), backed by the
 * real backend: patients and visits come from GET /api/patients and
 * GET /api/visits, uploads go through POST /api/visits (which runs the
 * MATLAB + AI pipeline), and the doctor's review is PATCH
 * /api/visits/:id/evaluation. Nothing clinical is kept only in the browser.
 *
 * The shape pages consume (`patients` with a derived `status`) is kept from
 * the earlier demo so the UI code stayed close to what it was.
 */

export type PatientStatus = 'waiting' | 'processing' | 'doctor_review' | 'report_ready'

export interface DoctorReview {
  notes: string
  prescription: string
  diet: string
  finalGrade: string
  finalizedBy: string | null
  finalizedAt: string | null
  decision: 'agree' | 'override' | null
}

export interface WorkflowPatient {
  /** patient_id (uuid) -- used in URLs and API calls. */
  id: string
  /** Short display id derived from the uuid, e.g. PT-3F9A. */
  code: string
  name: string
  age: number
  phone: string
  gender: '' | 'male' | 'female' | 'other'
  diabeticHistory: boolean | null
  status: PatientStatus
  /** Latest visit, if any. */
  visitId: string | null
  visitCreatedAt: string | null
  /** Worst-eye AI grade name of the latest visit (patients only see it once finalized). */
  aiGrade: string | null
  gradeNumber: number | null
  referable: boolean
  assignedDoctorName: string | null
  /** When the current AI run started (status === 'processing'). */
  processingStartedAt: string | null
  /** Why the latest AI run failed (status is 'waiting' again, ready to retry). */
  processingError: string | null
  doctorReview: DoctorReview | null
  visit: RealVisitSummary | null
}

interface NewPatientInput {
  name: string
  age: number
  phone: string
  gender?: '' | 'male' | 'female' | 'other'
  diabeticHistory?: boolean | null
}

export interface ReviewInput {
  decision: 'agree' | 'override'
  overrideGrade?: number | null
  notes: string
  prescription: string
  diet: string
}

interface WorkflowContextValue {
  /** null when signed out. */
  user: SessionUser | null
  token: string | null
  /** true once the first load after sign-in has finished (or failed). */
  ready: boolean
  loading: boolean
  error: string | null
  patients: WorkflowPatient[]
  visits: RealVisitSummary[]
  doctors: RealDoctor[]
  /** Patient portal: the signed-in patient's id / record. */
  currentPatientId: string | null
  currentPatient: WorkflowPatient | null
  /** Patient ids currently being run through the AI pipeline. */
  processingIds: string[]
  /** Last upload failure per patient id (cleared on the next attempt). */
  uploadErrors: Record<string, string>
  language: string
  setLanguage: (language: string) => void
  refresh: () => Promise<void>
  loginStaff: (email: string, password: string, expected: SessionRole) => Promise<void>
  loginPatient: (phone: string) => Promise<void>
  logout: () => void
  renameUser: (name: string, email?: string) => void
  addPatient: (patient: NewPatientInput) => Promise<void>
  /** Uploads the scans; resolves once the server has accepted them (analysis continues server-side). */
  startVisit: (patientId: string, odFile: File | null, osFile: File | null, doctorId: string | null) => Promise<void>
  submitDoctorReview: (visitId: string, review: ReviewInput) => Promise<void>
}

const GRADE_NAMES = ['No DR', 'Mild NPDR', 'Moderate NPDR', 'Severe NPDR', 'Proliferative DR']

const REFRESH_MS = 20000
const PROCESSING_REFRESH_MS = 4000

const codeFor = (id: string) => `PT-${id.replace(/-/g, '').slice(0, 4).toUpperCase()}`

function worstEye(v: RealVisitSummary) {
  const eyes = [v.od, v.os].filter(Boolean) as NonNullable<RealVisitSummary['od']>[]
  const graded = eyes.filter((e) => e.grade !== null && e.grade !== undefined)
  if (graded.length) {
    const worst = graded.reduce((a, b) => ((b.grade as number) > (a.grade as number) ? b : a))
    return { grade: worst.grade as number, name: worst.grade_name ?? GRADE_NAMES[worst.grade as number] ?? 'Unknown' }
  }
  // Both eyes rejected at the quality gate: nothing to grade.
  if (eyes.length && eyes.every((e) => e.quality === 'reject')) return { grade: null, name: 'Ungradable image' }
  return { grade: null, name: null }
}

function buildPatient(
  p: Pick<WorkflowPatient, 'id' | 'name' | 'age' | 'phone' | 'gender' | 'diabeticHistory'>,
  visit: RealVisitSummary | null,
  uploading: boolean,
): WorkflowPatient {
  const finalized = visit?.clinical_evaluation?.status === 'finalized'
  const runState = visit?.processing_status ?? 'complete'
  const worst = visit && runState === 'complete' ? worstEye(visit) : { grade: null, name: null }

  // Server truth wins: the run is tracked on the visit, so this survives a
  // refresh and shows on any device. `uploading` only covers the moment
  // between clicking Upload and the server confirming it.
  let status: PatientStatus = 'waiting'
  if (uploading || runState === 'processing') status = 'processing'
  else if (visit && runState === 'complete') status = finalized ? 'report_ready' : 'doctor_review'
  // a failed run leaves the patient 'waiting' so the technician can retry

  let review: DoctorReview | null = null
  if (visit && finalized && visit.clinical_evaluation) {
    const ev = visit.clinical_evaluation
    review = {
      notes: ev.doctor_notes ?? '',
      prescription: ev.prescription ?? '',
      diet: ev.diet ?? '',
      finalGrade:
        ev.decision === 'override' && ev.override_grade != null
          ? (GRADE_NAMES[ev.override_grade] ?? `Grade ${ev.override_grade}`)
          : (worst.name ?? 'Unknown'),
      finalizedBy: ev.finalized_by ?? null,
      finalizedAt: ev.finalized_at ?? null,
      decision: ev.decision ?? null,
    }
  }

  return {
    id: p.id,
    code: codeFor(p.id),
    name: p.name,
    age: p.age,
    phone: p.phone,
    gender: p.gender,
    diabeticHistory: p.diabeticHistory,
    status,
    visitId: visit?.visit_id ?? null,
    visitCreatedAt: visit?.created_at ?? null,
    aiGrade: worst.name,
    gradeNumber: worst.grade,
    referable: !!(visit && ([visit.od, visit.os].some((e) => e?.referable) || (worst.grade ?? 0) >= 2)),
    assignedDoctorName: visit?.assigned_doctor_name ?? null,
    processingStartedAt: runState === 'processing' ? (visit?.processing_started_at ?? visit?.created_at ?? null) : null,
    processingError: runState === 'failed' ? (visit?.processing_error ?? 'The AI analysis failed.') : null,
    doctorReview: review,
    visit,
  }
}

const WorkflowContext = createContext<WorkflowContextValue | null>(null)

export function WorkflowProvider({ children }: { children: ReactNode }) {
  const initial = useMemo(() => loadSession(), [])
  const [session, setSession] = useState<{ token: string; user: SessionUser } | null>(initial)
  const [rawPatients, setRawPatients] = useState<RealPatient[]>([])
  const [visits, setVisits] = useState<RealVisitSummary[]>([])
  const [doctors, setDoctors] = useState<RealDoctor[]>([])
  const [ready, setReady] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [processingIds, setProcessingIds] = useState<string[]>([])
  const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({})
  const [language, setLanguage] = useState('English')
  const tokenRef = useRef<string | null>(initial?.token ?? null)

  const user = session?.user ?? null
  const token = session?.token ?? null
  tokenRef.current = token

  const dropSession = useCallback(() => {
    clearSession()
    setSession(null)
    setRawPatients([])
    setVisits([])
    setDoctors([])
    setReady(false)
  }, [])

  const refresh = useCallback(async () => {
    const tok = tokenRef.current
    const u = session?.user
    if (!tok || !u) return
    setLoading(true)
    try {
      if (u.role === 'patient') {
        const [me, v] = await Promise.all([getMyPatient(tok), listVisits(tok)])
        setRawPatients([me])
        setVisits(v)
      } else {
        const [p, v, d] = await Promise.all([
          listPatients(tok),
          listVisits(tok),
          u.role === 'admin' ? Promise.resolve([] as RealDoctor[]) : listDoctors(tok),
        ])
        setRawPatients(p)
        setVisits(v)
        setDoctors(d)
      }
      setError(null)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      // An expired/invalid token means the session is over.
      if (/invalid or expired token|authentication required/i.test(msg)) dropSession()
      else setError(msg)
    } finally {
      setLoading(false)
      setReady(true)
    }
  }, [session, dropSession])

  // Poll faster while a visit is being analysed so it moves along promptly.
  const anyProcessing = visits.some((v) => v.processing_status === 'processing')

  // Load on sign-in / reload, then keep queues fresh.
  useEffect(() => {
    if (!session) return
    refresh()
    const id = window.setInterval(() => {
      if (!document.hidden) refresh()
    }, anyProcessing ? PROCESSING_REFRESH_MS : REFRESH_MS)
    return () => window.clearInterval(id)
  }, [session, refresh, anyProcessing])

  const patients = useMemo<WorkflowPatient[]>(() => {
    const latest = new Map<string, RealVisitSummary>()
    // visits arrive newest-first
    for (const v of visits) if (!latest.has(v.patient_id)) latest.set(v.patient_id, v)
    return rawPatients.map((p) =>
      buildPatient(
        {
          id: p.patient_id,
          name: p.name,
          age: p.age,
          phone: p.phone ?? '',
          gender: p.gender ?? '',
          diabeticHistory: p.diabetic_history ?? null,
        },
        latest.get(p.patient_id) ?? null,
        processingIds.includes(p.patient_id),
      ),
    )
  }, [rawPatients, visits, processingIds])

  const currentPatientId = user?.role === 'patient' ? user.id : null
  const currentPatient = useMemo(
    () => (currentPatientId ? (patients.find((p) => p.id === currentPatientId) ?? null) : null),
    [patients, currentPatientId],
  )

  const loginStaff = useCallback(async (email: string, password: string, expected: SessionRole) => {
    const res = await loginStaffApi(email, password)
    const role = res.user.role === 'reviewer' ? 'doctor' : res.user.role
    if (role !== expected) {
      throw new Error(`This account is a ${res.user.role} account. Please use the ${res.user.role} login.`)
    }
    const u: SessionUser = { id: res.user.id, name: res.user.name, email: res.user.email, role: expected }
    saveSession(res.token, u)
    setReady(false)
    setSession({ token: res.token, user: u })
  }, [])

  const loginPatient = useCallback(async (phone: string) => {
    const res = await loginPatientApi(phone)
    const u: SessionUser = { id: res.user.id, name: res.user.name, role: 'patient' }
    saveSession(res.token, u)
    setReady(false)
    setSession({ token: res.token, user: u })
  }, [])

  const logout = useCallback(() => dropSession(), [dropSession])

  const renameUser = useCallback((name: string, email?: string) => {
    setSession((s) => {
      if (!s) return s
      const u = { ...s.user, name, ...(email ? { email } : {}) }
      updateStoredUser(u)
      return { ...s, user: u }
    })
  }, [])

  const addPatient = useCallback(
    async (input: NewPatientInput) => {
      const tok = tokenRef.current
      if (!tok) throw new Error('Not signed in')
      await createPatient(input.name, input.age, tok, input.phone, {
        gender: input.gender || undefined,
        diabetic_history: input.diabeticHistory ?? null,
      })
      await refresh()
    },
    [refresh],
  )

  const startVisit = useCallback(
    async (patientId: string, odFile: File | null, osFile: File | null, doctorId: string | null) => {
      const tok = tokenRef.current
      if (!tok) throw new Error('Not signed in')
      setUploadErrors((e) => {
        const { [patientId]: _drop, ...rest } = e
        return rest
      })
      setProcessingIds((ids) => [...ids, patientId])
      try {
        // Returns once the server has accepted the images; the AI run then
        // continues on the server and is tracked on the visit.
        await uploadVisit(odFile, osFile, tok, patientId, doctorId)
        await refresh()
      } catch (e) {
        setUploadErrors((errs) => ({ ...errs, [patientId]: e instanceof Error ? e.message : String(e) }))
      } finally {
        setProcessingIds((ids) => ids.filter((x) => x !== patientId))
      }
    },
    [refresh],
  )

  const submitDoctorReview = useCallback(
    async (visitId: string, review: ReviewInput) => {
      const tok = tokenRef.current
      if (!tok) throw new Error('Not signed in')
      await saveVisitEvaluation(
        visitId,
        {
          decision: review.decision,
          override_grade: review.decision === 'override' ? review.overrideGrade : null,
          doctor_notes: review.notes,
          prescription: review.prescription,
          diet: review.diet,
        },
        tok,
      )
      await refresh()
    },
    [refresh],
  )

  const value: WorkflowContextValue = {
    user,
    token,
    ready,
    loading,
    error,
    patients,
    visits,
    doctors,
    currentPatientId,
    currentPatient,
    processingIds,
    uploadErrors,
    language,
    setLanguage,
    refresh,
    loginStaff,
    loginPatient,
    logout,
    renameUser,
    addPatient,
    startVisit,
    submitDoctorReview,
  }

  return <WorkflowContext.Provider value={value}>{children}</WorkflowContext.Provider>
}

export function useWorkflow() {
  const ctx = useContext(WorkflowContext)
  if (!ctx) throw new Error('useWorkflow must be used within a WorkflowProvider')
  return ctx
}
