import { useEffect, useMemo, useState, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Inbox,
  Search,
  CheckCircle2,
  FileImage,
  ArrowRight,
  Eye,
  AlertTriangle,
  Users,
  ShieldAlert,
} from 'lucide-react'
import AppShell from '../components/layout/AppShell'
import { Spinner, ErrorNote, EmptyState } from '../components/ui/States'
import SeverityBadge from '../components/ui/SeverityBadge'
import { useAsync } from '../lib/hooks'
import { formatDateTime } from '../lib/format'
import { getToken } from '../lib/auth'
import { createPatient, uploadVisit, listVisits, type RealVisitSummary } from '../api/realApi'
import type { SeverityScore } from '../types'

type SortKey = 'severity' | 'uploaded' | 'name' | 'age'
type Dir = 'asc' | 'desc'
type FilterTab = 'all' | 'referable' | 'normal' | 'finalized' | 'pending'

export default function Dashboard() {
  const navigate = useNavigate()
  const token = getToken()

  useEffect(() => {
    if (!token) navigate('/login')
  }, [token, navigate])

  const { data: visits, loading, error, reload } = useAsync(() => {
    if (!token) return Promise.resolve<RealVisitSummary[]>([])
    return listVisits(token)
  }, [token])

  // Compute KPI metrics
  const kpis = useMemo(() => {
    if (!visits || visits.length === 0) {
      return { total: 0, referable: 0, critical: 0, finalized: 0 }
    }
    const total = visits.length
    const referable = visits.filter((v) => (v.worst_grade ?? -1) >= 2).length
    const critical = visits.filter((v) => (v.worst_grade ?? -1) >= 3).length
    const finalized = visits.filter((v) => v.clinical_evaluation?.status === 'finalized').length
    return { total, referable, critical, finalized }
  }, [visits])

  return (
    <AppShell>
      {/* Page Title & Clinical Subtitle */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-1">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-[#0F172A]">
            Diagnostic Screening Workstation
          </h1>
          <p className="text-xs text-[#64748B] mt-0.5 font-sans">
            AI-assisted diabetic retinopathy assessment pipeline &amp; clinical review worklist
          </p>
        </div>
      </div>

      {/* KPI Metric Cards -- structural glass */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:gap-5">
        <div className="glass-structural glass-hover p-5">
          <div className="flex items-center justify-between text-xs text-[#64748B] font-medium mb-2">
            <span>Total Screened</span>
            <Users className="h-4 w-4 text-[#64748B]/70" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-3xl font-bold text-[#0F172A]">{kpis.total}</span>
            <span className="font-mono text-xs text-[#64748B]">cases</span>
          </div>
          <div className="mt-2 text-[11px] text-[#64748B]">Active patient cohort</div>
        </div>

        <div className="glass-structural glass-hover p-5">
          <div className="flex items-center justify-between text-xs text-[#D97706] font-medium mb-2">
            <span>Referable DR</span>
            <AlertTriangle className="h-4 w-4 text-[#D97706]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-3xl font-bold text-[#D97706]">{kpis.referable}</span>
            <span className="font-mono text-xs text-[#D97706]/80">Grade ≥ 2</span>
          </div>
          <div className="mt-2 text-[11px] text-[#D97706]/70">Specialist threshold met</div>
        </div>

        <div className="glass-structural glass-hover p-5">
          <div className="flex items-center justify-between text-xs text-[#DC2626] font-medium mb-2">
            <span>Critical Severity</span>
            <ShieldAlert className="h-4 w-4 text-[#DC2626]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-3xl font-bold text-[#DC2626]">{kpis.critical}</span>
            <span className="font-mono text-xs text-[#DC2626]/80">Grade 3–4</span>
          </div>
          <div className="mt-2 text-[11px] text-[#DC2626]/70">Immediate clinical referral</div>
        </div>

        <div className="glass-structural glass-hover p-5">
          <div className="flex items-center justify-between text-xs text-[#EA6C53] font-medium mb-2">
            <span>Physician Audited</span>
            <CheckCircle2 className="h-4 w-4 text-[#EA6C53]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-3xl font-bold text-[#EA6C53]">{kpis.finalized}</span>
            <span className="font-mono text-xs text-[#EA6C53]/80">finalized</span>
          </div>
          <div className="mt-2 text-[11px] text-[#EA6C53]/70">Signed diagnostic reports</div>
        </div>
      </div>

      {/* Section (a): New patient visit */}
      <div>
        <NewPatientVisitForm onUploadComplete={reload} />
      </div>

      {/* Section (b): Review Queue */}
      <div>
        <ReviewQueue visits={visits || []} loading={loading} error={error} />
      </div>
    </AppShell>
  )
}

const ACCEPTED_TYPES = ['image/jpeg', 'image/png']

function NewPatientVisitForm({ onUploadComplete }: { onUploadComplete?: () => void }) {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [ageInput, setAgeInput] = useState('')
  const [odFile, setOdFile] = useState<File | null>(null)
  const [osFile, setOsFile] = useState<File | null>(null)
  const [odPreview, setOdPreview] = useState<string | null>(null)
  const [osPreview, setOsPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progressStage, setProgressStage] = useState<string>('Initializing screening pipeline…')

  const odInputRef = useRef<HTMLInputElement>(null)
  const osInputRef = useRef<HTMLInputElement>(null)

  function handleFileSelect(file: File | undefined, eye: 'od' | 'os') {
    if (!file) return
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('Only JPEG or PNG fundus images are supported.')
      return
    }
    setError(null)
    const url = URL.createObjectURL(file)
    if (eye === 'od') {
      setOdFile(file)
      setOdPreview(url)
    } else {
      setOsFile(file)
      setOsPreview(url)
    }
  }

  function clearEye(eye: 'od' | 'os') {
    if (eye === 'od') {
      setOdFile(null)
      if (odPreview) URL.revokeObjectURL(odPreview)
      setOdPreview(null)
      if (odInputRef.current) odInputRef.current.value = ''
    } else {
      setOsFile(null)
      if (osPreview) URL.revokeObjectURL(osPreview)
      setOsPreview(null)
      if (osInputRef.current) osInputRef.current.value = ''
    }
  }

  const ageNumber = Number(ageInput)
  const ageValid = ageInput.trim() !== '' && Number.isFinite(ageNumber) && ageNumber >= 0
  const ready = name.trim().length > 0 && ageValid && (!!odFile || !!osFile)

  async function handleSubmit() {
    if (!ready) return
    setError(null)

    const token = getToken()
    if (!token) {
      navigate('/login')
      return
    }

    try {
      setBusy(true)
      setProgressStage('Registering patient encounter…')
      const patient = await createPatient(name.trim(), ageNumber, token)

      setProgressStage('Executing automated DR grading and lesion analysis…')
      const visit = await uploadVisit(
        odFile,
        osFile,
        token,
        patient.patient_id,
      )

      setName('')
      setAgeInput('')
      clearEye('od')
      clearEye('os')
      onUploadComplete?.()
      navigate(`/visits/${visit.visit_id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="glass-structural glass-hover p-6 sm:p-7">
      <div className="flex items-center justify-between pb-4 mb-5 border-b border-[#0F172A]/[0.05]">
        <div>
          <h2 className="font-heading text-[15px] font-semibold text-[#0F172A]">
            New patient visit
          </h2>
          <p className="text-xs text-[#64748B] mt-0.5">
            Register patient details and attach digital retinal fundus photographs. At least one eye required.
          </p>
        </div>
      </div>

      {busy ? (
        <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 py-8 text-center rounded-[12px] border border-dashed border-[#0F172A]/[0.12] bg-[#0F172A]/[0.02] p-6">
          <span className="lens-spinner" style={{ width: '1.75rem', height: '1.75rem' }} aria-hidden />
          <div>
            <p className="font-heading text-sm font-semibold text-[#0F172A]">{progressStage}</p>
            <p className="mt-1 font-sans text-xs text-[#64748B] max-w-md">
              Executing EfficientNet-B0 inference, optic disc/fovea localisation, and Grad-CAM generation.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {error && (
            <div className="rounded-[8px] border border-[#DC2626]/25 bg-[#DC2626]/[0.06] p-3.5 text-xs text-[#DC2626]">
              {error}
            </div>
          )}

          {/* Combined Patient Information Inputs */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="patient-name" className="block text-xs font-medium text-[#0F172A] mb-1.5">
                Patient Legal Name *
              </label>
              <input
                id="patient-name"
                className="clinical-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Ravi Shankar"
              />
            </div>
            <div>
              <label htmlFor="patient-age" className="block text-xs font-medium text-[#0F172A] mb-1.5">
                Patient Age (Years) *
              </label>
              <input
                id="patient-age"
                type="number"
                min={0}
                max={130}
                className="clinical-input font-mono"
                value={ageInput}
                onChange={(e) => setAgeInput(e.target.value)}
                placeholder="e.g. 64"
              />
            </div>
          </div>

          {/* Two File-Upload Dropzones */}
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Right eye (OD) */}
            <div className="rounded-[12px] border border-white/70 bg-white/40 p-4">
              <div className="flex items-center justify-between mb-2.5">
                <span className="font-heading text-xs font-semibold text-[#0F172A] flex items-center gap-1.5">
                  <Eye className="h-4 w-4 text-[#EA6C53]" /> Right eye (OD)
                </span>
                {odFile && (
                  <button
                    type="button"
                    onClick={() => clearEye('od')}
                    className="text-xs font-medium text-[#DC2626] hover:text-[#B91C1C] transition-colors"
                  >
                    Remove
                  </button>
                )}
              </div>

              {odPreview ? (
                <div className="rounded-[10px] border border-white/70 bg-white/70 p-3 flex items-center gap-3.5">
                  <img src={odPreview} alt="OD Preview" className="h-16 w-16 object-cover rounded-[8px] border border-[#0F172A]/[0.06]" />
                  <div className="min-w-0 flex-1 text-xs">
                    <p className="truncate font-semibold text-[#0F172A]">{odFile?.name}</p>
                    <p className="font-mono text-[#64748B] text-[11px] mt-0.5">{(odFile?.size ? odFile.size / 1024 : 0).toFixed(1)} KB</p>
                    <span className="inline-block mt-1 font-mono text-[10px] text-[#EA6C53] font-semibold bg-[#EA6C53]/10 px-2 py-0.5 rounded-[6px] border border-[#EA6C53]/25">
                      Attached for OD analysis
                    </span>
                  </div>
                </div>
              ) : (
                <label
                  htmlFor="upload-od"
                  className="flex flex-col items-center justify-center rounded-[10px] border-2 border-dashed border-[#0F172A]/[0.12] hover:border-[#EA6C53]/60 hover:bg-white/85 hover:shadow-[0_8px_20px_rgba(59,91,219,0.1)] bg-white/60 p-6 cursor-pointer transition-all duration-150 text-center"
                >
                  <div className="h-10 w-10 rounded-[8px] bg-[#EA6C53]/10 flex items-center justify-center mb-2">
                    <FileImage className="h-5 w-5 text-[#EA6C53]" />
                  </div>
                  <span className="text-xs font-semibold text-[#0F172A]">Upload Right eye (OD)</span>
                  <span className="text-[11px] text-[#64748B] mt-0.5">JPEG or PNG Color Fundus</span>
                  <input
                    id="upload-od"
                    ref={odInputRef}
                    type="file"
                    accept="image/jpeg,image/png"
                    className="sr-only"
                    onChange={(e) => handleFileSelect(e.target.files?.[0], 'od')}
                  />
                </label>
              )}
            </div>

            {/* Left eye (OS) */}
            <div className="rounded-[12px] border border-white/70 bg-white/40 p-4">
              <div className="flex items-center justify-between mb-2.5">
                <span className="font-heading text-xs font-semibold text-[#0F172A] flex items-center gap-1.5">
                  <Eye className="h-4 w-4 text-[#EA6C53]" /> Left eye (OS)
                </span>
                {osFile && (
                  <button
                    type="button"
                    onClick={() => clearEye('os')}
                    className="text-xs font-medium text-[#DC2626] hover:text-[#B91C1C] transition-colors"
                  >
                    Remove
                  </button>
                )}
              </div>

              {osPreview ? (
                <div className="rounded-[10px] border border-white/70 bg-white/70 p-3 flex items-center gap-3.5">
                  <img src={osPreview} alt="OS Preview" className="h-16 w-16 object-cover rounded-[8px] border border-[#0F172A]/[0.06]" />
                  <div className="min-w-0 flex-1 text-xs">
                    <p className="truncate font-semibold text-[#0F172A]">{osFile?.name}</p>
                    <p className="font-mono text-[#64748B] text-[11px] mt-0.5">{(osFile?.size ? osFile.size / 1024 : 0).toFixed(1)} KB</p>
                    <span className="inline-block mt-1 font-mono text-[10px] text-[#EA6C53] font-semibold bg-[#EA6C53]/10 px-2 py-0.5 rounded-[6px] border border-[#EA6C53]/25">
                      Attached for OS analysis
                    </span>
                  </div>
                </div>
              ) : (
                <label
                  htmlFor="upload-os"
                  className="flex flex-col items-center justify-center rounded-[10px] border-2 border-dashed border-[#0F172A]/[0.12] hover:border-[#EA6C53]/60 hover:bg-white/85 hover:shadow-[0_8px_20px_rgba(59,91,219,0.1)] bg-white/60 p-6 cursor-pointer transition-all duration-150 text-center"
                >
                  <div className="h-10 w-10 rounded-[8px] bg-[#EA6C53]/10 flex items-center justify-center mb-2">
                    <FileImage className="h-5 w-5 text-[#EA6C53]" />
                  </div>
                  <span className="text-xs font-semibold text-[#0F172A]">Upload Left eye (OS)</span>
                  <span className="text-[11px] text-[#64748B] mt-0.5">JPEG or PNG Color Fundus</span>
                  <input
                    id="upload-os"
                    ref={osInputRef}
                    type="file"
                    accept="image/jpeg,image/png"
                    className="sr-only"
                    onChange={(e) => handleFileSelect(e.target.files?.[0], 'os')}
                  />
                </label>
              )}
            </div>
          </div>

          {/* Action Row */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <p className="text-xs text-[#64748B]">
              {ready
                ? 'Encounter inputs complete. Ready for automated analysis.'
                : 'Enter patient name, age, and attach at least one fundus image.'}
            </p>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!ready || busy}
              className="btn-primary py-2.5 px-6 text-xs font-semibold"
            >
              Submit Patient Visit
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

function ReviewQueue({
  visits,
  loading,
  error,
}: {
  visits: RealVisitSummary[]
  loading: boolean
  error: string | null
}) {
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<FilterTab>('all')
  const [sort, setSort] = useState<SortKey>('uploaded')
  const [dir, setDir] = useState<Dir>('desc')

  const filtered = useMemo(() => {
    let list = visits

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (v) =>
          v.patient_name.toLowerCase().includes(q) ||
          v.visit_id.toLowerCase().includes(q),
      )
    }

    if (tab === 'referable') {
      list = list.filter((v) => (v.worst_grade ?? -1) >= 2)
    } else if (tab === 'normal') {
      list = list.filter((v) => (v.worst_grade ?? -1) >= 0 && (v.worst_grade ?? -1) <= 1)
    } else if (tab === 'finalized') {
      list = list.filter((v) => v.clinical_evaluation?.status === 'finalized')
    } else if (tab === 'pending') {
      list = list.filter((v) => !v.clinical_evaluation || v.clinical_evaluation.status === 'pending')
    }

    return [...list].sort((a, b) => {
      let d = 0
      if (sort === 'severity') d = (a.worst_grade ?? -1) - (b.worst_grade ?? -1)
      else if (sort === 'uploaded') d = +new Date(a.created_at) - +new Date(b.created_at)
      else if (sort === 'age') d = (a.patient_age ?? 0) - (b.patient_age ?? 0)
      else d = a.patient_name.localeCompare(b.patient_name)
      return dir === 'asc' ? d : -d
    })
  }, [visits, search, tab, sort, dir])

  const toggleSort = (key: SortKey) => {
    if (sort === key) setDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSort(key)
      setDir(key === 'name' ? 'asc' : 'desc')
    }
  }

  const SortIcon = ({ k }: { k: SortKey }) =>
    sort !== k ? (
      <ArrowUpDown className="h-3 w-3 opacity-35 inline ml-1" />
    ) : dir === 'asc' ? (
      <ArrowUp className="h-3 w-3 text-[#EA6C53] inline ml-1" />
    ) : (
      <ArrowDown className="h-3 w-3 text-[#EA6C53] inline ml-1" />
    )

  return (
    <section className="glass-dense overflow-hidden">
      {/* Table Header Bar */}
      <div className="border-b border-[#0F172A]/[0.05] p-6 sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-heading text-[15px] font-semibold text-[#0F172A]">
              Review Queue
            </h2>
            <p className="text-xs text-[#64748B] mt-0.5">
              Screening worklist of past patient visits for diagnostic review and sign-off.
            </p>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#64748B]/70" />
            <input
              type="text"
              className="clinical-input pl-9 py-2 text-xs"
              placeholder="Search patient name or ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Filter Controls */}
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#0F172A]/[0.05] pt-4 text-xs">
          {(
            [
              { id: 'all', label: 'All visits' },
              { id: 'referable', label: 'Referable (Grade ≥ 2)' },
              { id: 'normal', label: 'None / Mild (Grade 0–1)' },
              { id: 'pending', label: 'Unreviewed' },
              { id: 'finalized', label: 'Finalized' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-[8px] transition-colors duration-150 ${
                tab === t.id
                  ? 'bg-[#EA6C53] text-white'
                  : 'bg-[#0F172A]/[0.04] text-[#64748B] hover:bg-[#0F172A]/[0.06] hover:text-[#0F172A]'
              }`}
            >
              {t.label}
            </button>
          ))}
          <span className="ml-auto font-mono text-xs text-[#64748B]">
            {filtered.length} {filtered.length === 1 ? 'record' : 'records'}
          </span>
        </div>
      </div>

      {error && <div className="p-6"><ErrorNote message={error} /></div>}
      {loading && <div className="p-10"><Spinner label="Loading clinical worklist…" /></div>}

      {!loading && filtered.length === 0 && (
        <EmptyState
          icon={<Inbox className="h-8 w-8 text-[#64748B]/70" />}
          title="No patient visits found"
          hint="Create a new patient visit above."
        />
      )}

      {/* Clinical Worklist Data Table */}
      {filtered.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#0F172A]/[0.05] bg-[#0F172A]/[0.015] font-semibold text-[#64748B]">
                <th className="px-6 py-3.5 font-heading">
                  <button className="hover:text-[#0F172A]" onClick={() => toggleSort('name')}>
                    Patient Name <SortIcon k="name" />
                  </button>
                </th>
                <th className="px-4 py-3.5 font-heading">
                  <button className="hover:text-[#0F172A]" onClick={() => toggleSort('age')}>
                    Age <SortIcon k="age" />
                  </button>
                </th>
                <th className="px-4 py-3.5 font-heading">
                  <button className="hover:text-[#0F172A]" onClick={() => toggleSort('severity')}>
                    AI Severity Grade <SortIcon k="severity" />
                  </button>
                </th>
                <th className="px-4 py-3.5 font-heading">Right Eye (OD)</th>
                <th className="px-4 py-3.5 font-heading">Left Eye (OS)</th>
                <th className="px-5 py-3.5 font-heading">
                  <button className="hover:text-[#0F172A]" onClick={() => toggleSort('uploaded')}>
                    Upload Timestamp <SortIcon k="uploaded" />
                  </button>
                </th>
                <th className="px-4 py-3.5 font-heading">Review Status</th>
                <th className="px-6 py-3.5 text-right font-heading">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#0F172A]/[0.05]">
              {filtered.map((v) => (
                <tr
                  key={v.visit_id}
                  className="relative hover:bg-[#EA6C53]/[0.04] hover:shadow-[inset_2px_0_0_#EA6C53] transition-all duration-150 group"
                >
                  <td className="px-6 py-4">
                    <Link to={`/visits/${v.visit_id}`} className="font-semibold text-[#0F172A] hover:text-[#EA6C53] text-sm transition-colors">
                      {v.patient_name}
                    </Link>
                    <div className="font-mono text-[11px] text-[#64748B]/70 mt-0.5">{v.visit_id.slice(0, 14)}…</div>
                  </td>

                  <td className="px-4 py-4 font-mono text-[#0F172A] text-xs">
                    {v.patient_age != null ? `${v.patient_age}y` : '—'}
                  </td>

                  <td className="px-4 py-4">
                    <SeverityBadge score={v.worst_grade as SeverityScore | null} size="sm" />
                  </td>

                  <td className="px-4 py-4">{eyeCell(v.od)}</td>
                  <td className="px-4 py-4">{eyeCell(v.os)}</td>

                  <td className="px-5 py-4 font-mono text-[11px] text-[#64748B]">
                    {formatDateTime(v.created_at)}
                  </td>

                  <td className="px-4 py-4">
                    {v.clinical_evaluation?.status === 'finalized' ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-[8px] font-mono text-[11px] font-semibold border border-[#EA6C53]/25 bg-[#EA6C53]/10 text-[#EA6C53]">
                        <CheckCircle2 className="h-3.5 w-3.5 text-[#EA6C53]" />
                        Finalized
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-[8px] font-mono text-[11px] font-semibold border border-[#0F172A]/[0.06] bg-[#0F172A]/[0.02] text-[#64748B]">
                        Unreviewed
                      </span>
                    )}
                  </td>

                  <td className="px-6 py-4 text-right">
                    <Link
                      to={`/visits/${v.visit_id}`}
                      className="inline-flex items-center gap-1.5 rounded-[8px] border border-[#0F172A]/[0.06] bg-white/70 px-3 py-1.5 text-xs font-semibold text-[#0F172A] hover:bg-white hover:border-[#EA6C53]/25 hover:shadow-[0_4px_12px_rgba(59,91,219,0.15)] hover:-translate-y-0.5 transition-all"
                    >
                      Open Visit <ArrowRight className="h-3.5 w-3.5 text-[#EA6C53] transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function eyeCell(eye: RealVisitSummary['od']) {
  if (!eye) return <span className="font-mono text-[#64748B]/70">—</span>
  if (eye.quality === 'reject') {
    return <span className="rounded-[6px] border border-[#DC2626]/25 bg-[#DC2626]/[0.06] text-[#DC2626] font-mono text-[10px] font-semibold px-2 py-0.5">Reject</span>
  }
  return (
    <span className="inline-flex items-baseline gap-1 font-mono text-xs">
      {eye.grade != null && (
        <span className="font-semibold text-[#0F172A]">G{eye.grade}</span>
      )}
      <span className="text-[#64748B] text-[11px]">({eye.grade_name ?? eye.quality})</span>
    </span>
  )
}
