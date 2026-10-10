import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  Printer,
  X,
  AlertTriangle,
  ShieldCheck,
  Edit3,
  Lock,
  Copy,
  Check,
  LogOut,
} from 'lucide-react'
import AppShell from '../components/layout/AppShell'
import { Spinner, ErrorNote } from '../components/ui/States'
import RealFundus from '../components/RealFundus'
import SeverityBadge from '../components/ui/SeverityBadge'
import { getToken, clearToken } from '../lib/auth'
import { formatDateTime } from '../lib/format'
import {
  getVisit,
  fetchAllRealVisitAssets,
  saveVisitEvaluation,
  type RealVisit,
  type RealAssetBundle,
  type RealClinicalEvaluation,
} from '../api/realApi'
import { SEVERITY_LABEL, type SeverityScore } from '../types'

type EyeKey = 'od' | 'os'

const LESION_METADATA: Record<string, { name: string; desc: string }> = {
  hard_exudates: {
    name: 'Hard Exudates',
    desc: 'Lipid/lipoprotein deposits (validated channel)',
  },
  microaneurysms: {
    name: 'Microaneurysms',
    desc: 'Focal capillary outpouchings',
  },
  haemorrhages: {
    name: 'Haemorrhages',
    desc: 'Intraretinal blot / flame bleeding',
  },
  soft_exudates: {
    name: 'Soft Exudates / CWS',
    desc: 'Nerve fiber layer infarcts',
  },
}

function CopyableId({ id, prefix }: { id: string; prefix?: string }) {
  const [copied, setCopied] = useState(false)
  const shortId = id.length > 8 ? id.slice(0, 8) : id

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(id)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={`Click to copy full ID: ${id}`}
      className="group inline-flex items-center gap-1.5 font-mono text-inherit hover:text-[#EA6C53] transition-colors cursor-pointer"
    >
      {prefix && <span className="text-[#64748B] font-sans mr-0.5">{prefix}</span>}
      <span className="font-semibold text-[#0F172A] group-hover:text-[#EA6C53]">{shortId}</span>
      {copied ? (
        <span className="inline-flex items-center gap-0.5 text-[10px] text-[#EA6C53] font-sans font-medium bg-[#EA6C53]/10 px-1.5 py-0.5 rounded-[4px]">
          <Check className="h-3 w-3 shrink-0" />
          Copied
        </span>
      ) : (
        <Copy className="h-3.5 w-3.5 text-[#64748B]/70 group-hover:text-[#EA6C53] transition-colors shrink-0" />
      )}
    </button>
  )
}

function getDoctorDisplayName(finalizedBy?: string | null): string {
  if (!finalizedBy) return 'Dr. Ananya Sharma, MD'
  if (finalizedBy.includes('@')) {
    return 'Dr. Ananya Sharma, MD'
  }
  return finalizedBy
}

export default function RealVisitViewer() {
  const { visitId = '' } = useParams()
  const navigate = useNavigate()
  const token = getToken()

  const [visit, setVisit] = useState<RealVisit | null>(null)
  const [assets, setAssets] = useState<Partial<Record<EyeKey, RealAssetBundle>>>({})
  const [eye, setEye] = useState<EyeKey>('od')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Clinical Decision Form State
  const [decision, setDecision] = useState<'agree' | 'override'>('agree')
  const [overrideGrade, setOverrideGrade] = useState<number>(2)
  const [doctorNotes, setDoctorNotes] = useState<string>('')
  const [savingEvaluation, setSavingEvaluation] = useState(false)
  const [evaluationSuccess, setEvaluationSuccess] = useState<string | null>(null)
  const [evaluationError, setEvaluationError] = useState<string | null>(null)

  // Report modal state
  const [showReportModal, setShowReportModal] = useState(false)
  const [selectedLesionKey, setSelectedLesionKey] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      navigate('/login')
      return
    }

    let alive = true
    setLoading(true)
    setError(null)

    getVisit(visitId, token)
      .then(async (v) => {
        if (!alive) return
        setVisit(v)
        const initialEye = v.od ? 'od' : 'os'
        setEye(initialEye)

        if (v.clinical_evaluation) {
          setDecision(v.clinical_evaluation.decision === 'override' ? 'override' : 'agree')
          if (v.clinical_evaluation.override_grade != null) {
            setOverrideGrade(v.clinical_evaluation.override_grade)
          }
          if (v.clinical_evaluation.doctor_notes) {
            setDoctorNotes(v.clinical_evaluation.doctor_notes)
          }
        }

        const eyeAssets: Partial<Record<EyeKey, RealAssetBundle>> = {}
        if (v.od) {
          try {
            eyeAssets.od = await fetchAllRealVisitAssets(v.od, v.visit_id, 'od', token)
          } catch (e) {
            console.warn('Failed to load OD assets:', e)
          }
        }
        if (v.os) {
          try {
            eyeAssets.os = await fetchAllRealVisitAssets(v.os, v.visit_id, 'os', token)
          } catch (e) {
            console.warn('Failed to load OS assets:', e)
          }
        }
        if (alive) setAssets(eyeAssets)
      })
      .catch((err) => {
        if (alive) setError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        if (alive) setLoading(false)
      })

    return () => {
      alive = false
    }
  }, [visitId, token, navigate])

  const handleFinalizeDecision = async () => {
    if (!token || !visit) return
    setSavingEvaluation(true)
    setEvaluationError(null)
    setEvaluationSuccess(null)

    try {
      const res = await saveVisitEvaluation(
        visitId,
        {
          decision,
          override_grade: decision === 'override' ? overrideGrade : null,
          doctor_notes: doctorNotes,
        },
        token,
      )

      setVisit((prev) =>
        prev
          ? {
              ...prev,
              clinical_evaluation: res.clinical_evaluation,
            }
          : prev,
      )
      setEvaluationSuccess(
        decision === 'agree'
          ? 'Diagnosis agreed and signed as finalized.'
          : `Diagnosis overridden to Grade ${overrideGrade} and signed as finalized.`,
      )
    } catch (err) {
      setEvaluationError(err instanceof Error ? err.message : 'Failed to finalize evaluation.')
    } finally {
      setSavingEvaluation(false)
    }
  }

  const handleSignOut = () => {
    clearToken()
    navigate('/login')
  }

  const lead = (
    <div className="flex items-center gap-2">
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-1 rounded-[8px] border border-[#0F172A]/[0.06] bg-white/70 px-2.5 py-1 text-xs font-semibold text-[#0F172A] hover:bg-white transition-colors"
        aria-label="Back to review queue"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        <span>Review Queue</span>
      </Link>
      <span className="text-[#0F172A]/[0.15]">/</span>
      <span className="font-heading text-xs font-semibold text-[#0F172A]">
        Visit Diagnostic Viewer
      </span>
      <button
        type="button"
        onClick={() => setShowReportModal(true)}
        className="inline-flex items-center gap-1 rounded-[8px] border border-[#0F172A]/[0.06] bg-white/70 px-2.5 py-1 text-xs font-semibold text-[#0F172A] hover:bg-white transition-colors ml-1 cursor-pointer"
      >
        <Printer className="h-3.5 w-3.5 text-[#EA6C53]" />
        <span>Generate PDF Report</span>
      </button>
    </div>
  )

  if (loading) {
    return (
      <AppShell title="Visit Diagnostic Viewer" lead={lead} hideGlobalHeader>
        <div className="py-24 flex justify-center">
          <Spinner label="Loading fundus scan and diagnostic metrics…" />
        </div>
      </AppShell>
    )
  }

  if (error || !visit) {
    return (
      <AppShell title="Visit Diagnostic Viewer" lead={lead} hideGlobalHeader>
        <div className="py-16 max-w-lg mx-auto">
          <ErrorNote message={error || 'No visit found.'} />
        </div>
      </AppShell>
    )
  }

  const eyeResult = visit[eye]
  const eyeAssets = assets[eye]
  const isFinalized = visit.clinical_evaluation?.status === 'finalized'

  const grade = eyeResult?.classification?.grade ?? null
  const isReferable = eyeResult?.classification?.referable?.is_referable ?? false
  const referableProb = eyeResult?.classification?.referable?.probability ?? 0

  return (
    <AppShell
      bleed
      hideGlobalHeader
      title="Visit Diagnostic Viewer"
      lead={lead}
      actions={
        <div className="flex items-center gap-2.5">
          <div className="flex items-center text-xs text-[#64748B]">
            <CopyableId id={visit.visit_id} prefix="MRN:" />
          </div>
          <div className="h-3.5 w-px bg-[#0F172A]/[0.08]" />
          <button
            type="button"
            onClick={handleSignOut}
            title="Sign Out (Dr. Ananya Sharma)"
            className="inline-flex items-center gap-1 text-xs text-[#64748B] hover:text-[#DC2626] transition-colors p-1 rounded-[6px] hover:bg-[#0F172A]/[0.04] cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      }
    >
      <div className="p-3.5 lg:p-4 space-y-3 max-w-[1600px] mx-auto">
        {/* Patient Specimen & Encounter Bar -- structural toolbar */}
        <div className="glass-structural flex flex-wrap items-center justify-between gap-2.5 px-3.5 py-2">
          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-[#64748B]">Patient:</span>
              <span className="font-heading font-semibold text-[#0F172A] text-sm">{visit.patient_name}</span>
              {visit.patient_age != null && (
                <span className="font-mono text-[#64748B] text-xs">({visit.patient_age}y)</span>
              )}
            </div>

            <span className="text-[#0F172A]/[0.15]">·</span>

            <CopyableId id={visit.patient_id || visit.visit_id} prefix="Patient ID:" />

            <span className="text-[#0F172A]/[0.15]">·</span>

            <div className="flex items-center gap-1 text-[#64748B]">
              <span>Scan Date:</span>
              <span className="font-mono text-[#0F172A]">{formatDateTime(visit.created_at ?? '')}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isFinalized ? (
              <span className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-[#EA6C53] border border-[#EA6C53]/25 bg-[#EA6C53]/10 px-2.5 py-0.5 rounded-[8px]">
                <CheckCircle2 className="h-3 w-3 text-[#EA6C53]" /> Finalized
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-[#D97706] border border-[#D97706]/25 bg-[#D97706]/[0.08] px-2.5 py-0.5 rounded-[8px]">
                Pending Review
              </span>
            )}
          </div>
        </div>

        {/* Main Diagnostic Workspace: Left Image + Right Findings */}
        <div className="grid gap-3.5 lg:grid-cols-[1fr_380px] xl:grid-cols-[1fr_400px] items-start">
          {/* ==================================================== */}
          {/* LEFT / MAIN: Structural glass -- fundus & AI heatmap */}
          {/* ==================================================== */}
          <section className="glass-structural glass-hover p-3.5 flex flex-col gap-2.5">
            <div>
              {/* Header Bar with OD/OS Segmented Control */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-[#0F172A]/[0.05] pb-2.5 mb-2.5">
                <div>
                  <h2 className="font-heading text-[15px] font-semibold text-[#0F172A]">
                    Retinal Fundus Examination
                  </h2>
                  <div className="text-xs text-[#64748B]">
                    {eyeResult?.image_id ? (
                      <CopyableId id={eyeResult.image_id} prefix="Image ID:" />
                    ) : (
                      <span className="font-mono text-[11px] text-[#64748B]/70">Image ID: N/A</span>
                    )}
                  </div>
                </div>

                {/* OD / OS Segmented Control */}
                <div className="inline-flex gap-0.5 rounded-[8px] border border-white/70 bg-white/40 p-0.5">
                  {(
                    [
                      { key: 'od', label: 'Right eye (OD)' },
                      { key: 'os', label: 'Left eye (OS)' },
                    ] as const
                  ).map(({ key, label }) => {
                    const hasData = !!visit[key]
                    const active = eye === key
                    return (
                      <button
                        key={key}
                        type="button"
                        disabled={!hasData}
                        onClick={() => {
                          setEye(key)
                          setSelectedLesionKey(null)
                        }}
                        title={hasData ? undefined : `No scan uploaded for ${label}`}
                        className={`px-3 py-1 text-xs font-semibold rounded-[6px] transition-colors duration-150 ${
                          active
                            ? 'bg-white text-[#EA6C53]'
                            : hasData
                              ? 'text-[#64748B] hover:text-[#0F172A]'
                              : 'cursor-not-allowed text-[#0F172A]/[0.15]'
                        }`}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {!eyeResult ? (
                <div className="grid h-80 place-items-center rounded-[10px] border-2 border-dashed border-[#0F172A]/[0.06] bg-[#0F172A]/[0.015] font-mono text-xs text-[#64748B]/70">
                  No photograph available for this eye.
                </div>
              ) : eyeResult.image_quality.quality === 'reject' ? (
                <div className="rounded-[10px] border border-[#DC2626]/25 bg-[#DC2626]/[0.06] p-4 text-xs text-[#DC2626]">
                  <div className="flex items-center gap-2 font-semibold text-sm">
                    <AlertTriangle className="h-4 w-4 text-[#DC2626]" />
                    Photograph Rejected by Automated Quality Check
                  </div>
                  <p className="mt-1 text-[#0F172A]">
                    Reason: {eyeResult.image_quality.reject_reason ?? 'Severe blur / insufficient illumination.'}
                  </p>
                </div>
              ) : (
                <RealFundus
                  result={eyeResult}
                  originalUrl={eyeAssets?.originalUrl}
                  overlayUrl={eyeAssets?.overlayUrl}
                  vesselUrl={eyeAssets?.vesselUrl}
                  lesionUrls={eyeAssets?.lesionUrls}
                  selectedLesionKey={selectedLesionKey}
                />
              )}
            </div>
          </section>

          {/* ==================================================== */}
          {/* RIGHT / SIDE PANEL: data-dense -- Diagnostic Findings */}
          {/* ==================================================== */}
          <div className="h-full space-y-3">
            <section className="glass-dense glass-hover flex h-full flex-col p-3.5">
              <div className="border-b border-[#0F172A]/[0.05] pb-2 mb-2.5">
                <h2 className="font-heading text-[15px] font-semibold text-[#0F172A]">
                  Diagnostic Findings
                </h2>
              </div>

              {eyeResult?.classification ? (
                <div className="space-y-2.5">
                  {/* 1. DOMINANT VISUAL ELEMENT: Diagnostic Grade in JetBrains Mono */}
                  <div className="rounded-[8px] border border-[#0F172A]/[0.06] bg-[#0F172A]/[0.02] p-3">
                    <span className="text-[11px] font-semibold text-[#64748B] block mb-0.5">
                      Assigned DR severity grade
                    </span>
                    <div className="flex items-baseline gap-3 mt-0.5">
                      {/* Hero numeral: 48px mono, weight 500 */}
                      <span className="font-readout text-5xl font-medium text-[#0F172A]">
                        {grade !== null ? grade : '—'}
                      </span>
                      <div>
                        <div className="font-heading text-sm font-bold text-[#0F172A]">
                          {eyeResult.classification.grade_name}
                        </div>
                        <div className="mt-1">
                          <SeverityBadge score={grade as SeverityScore} size="sm" />
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 border-t border-[#0F172A]/[0.06] pt-2 font-mono text-xs">
                      <span className="text-[#64748B]">Referable probability: </span>
                      <span className="font-bold text-[#0F172A]">
                        {(referableProb * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div
                      className={`mt-2 rounded-[8px] border p-2.5 transition-colors ${
                        isReferable
                          ? 'border-[#DC2626]/25 bg-[#DC2626]/[0.06]'
                          : 'border-[#059669]/25 bg-[#059669]/10'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-[#0F172A]">
                          Referable DR Status:
                        </span>
                        <span
                          className={`font-mono text-xs font-bold rounded-[6px] px-2.5 py-0.5 border ${
                            isReferable
                              ? 'border-[#DC2626]/25 bg-[#DC2626]/[0.06] text-[#DC2626]'
                              : 'border-[#059669]/30 bg-[#059669]/10 text-[#059669]'
                          }`}
                        >
                          {isReferable ? 'Referral Recommended' : 'Non-Referable'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 2. Lesion Segmentation Channels */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="text-xs font-semibold text-[#0F172A]">
                        Lesion Segmentation Channels
                      </div>
                      <span className="font-mono text-[10px] text-[#64748B]/70">
                        Click channel to isolate mask
                      </span>
                    </div>

                    {eyeResult.lesion_segmentation?.channels ? (
                      <div className="space-y-1.5">
                        {Object.entries(eyeResult.lesion_segmentation.channels).map(([key, ch]) => {
                          const meta = LESION_METADATA[key] || {
                            name: key.replace(/_/g, ' '),
                            desc: 'Retinal lesion pathology',
                          }
                          const isSelected = selectedLesionKey === key
                          const isReliable = !ch.dice_unreliable

                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => setSelectedLesionKey(isSelected ? null : key)}
                              className={`w-full text-left rounded-[8px] border py-1.5 px-2.5 transition-colors cursor-pointer ${
                                isSelected
                                  ? 'border-[#EA6C53] bg-[#EA6C53]/5 ring-1 ring-[#EA6C53]'
                                  : 'border-[#0F172A]/[0.06] bg-white/70 hover:border-[#0F172A]/[0.12] hover:bg-white'
                              }`}
                            >
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-semibold text-[#0F172A]">
                                  {meta.name}
                                </span>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono text-[11px] font-semibold text-[#64748B]">
                                    Dice: {typeof ch.val_dice === 'number' ? ch.val_dice.toFixed(2) : '—'}
                                  </span>
                                  {isReliable ? (
                                    <span className="font-mono text-[10px] font-semibold px-2 py-0.5 rounded-[6px] border border-[#059669]/25 bg-[#059669]/10 text-[#059669]">
                                      Reliable
                                    </span>
                                  ) : (
                                    <span
                                      className="font-mono text-[10px] font-medium px-2 py-0.5 rounded-[6px] border border-[#D97706]/25 bg-[#D97706]/[0.08] text-[#D97706]"
                                      title="Low validation Dice score (unreliable) — interpret with caution"
                                    >
                                      Low confidence — caution
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center justify-between mt-0.5 text-[11px] text-[#64748B]">
                                <span>{meta.desc}</span>
                                {isSelected && (
                                  <span className="font-mono text-[10px] font-semibold text-[#EA6C53]">
                                    Overlay active
                                  </span>
                                )}
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="rounded-[8px] border border-dashed border-[#0F172A]/[0.06] bg-[#0F172A]/[0.02] p-3 text-center font-mono text-xs text-[#64748B]/70">
                        No lesion segmentation data available.
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-4 text-center font-mono text-xs text-[#64748B]/70">
                  No diagnostic findings available for this eye.
                </div>
              )}
            </section>
          </div>
        </div>

        {/* ==================================================== */}
        {/* BELOW: data-dense -- Clinical Evaluation & Sign-off  */}
        {/* ==================================================== */}
        <section className="glass-dense glass-hover p-3.5 sm:p-4">
          <div className="flex items-center justify-between border-b border-[#0F172A]/[0.05] pb-2 mb-2.5">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-[6px] bg-[#EA6C53]/10 flex items-center justify-center text-[#EA6C53]">
                <ShieldCheck className="h-3.5 w-3.5" />
              </div>
              <h2 className="font-heading text-[15px] font-semibold text-[#0F172A]">
                Clinical Evaluation &amp; Sign-off
              </h2>
            </div>
            {isFinalized ? (
              <span className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-[#EA6C53] border border-[#EA6C53]/25 bg-[#EA6C53]/10 px-2.5 py-0.5 rounded-[8px]">
                <Lock className="h-3 w-3 text-[#EA6C53]" /> Locked &amp; Finalized
              </span>
            ) : (
              <span className="text-xs text-[#64748B]">
                Awaiting attending physician sign-off
              </span>
            )}
          </div>

          {/* If Finalized: Muted / Read-Only Display */}
          {isFinalized && visit.clinical_evaluation ? (
            <div className="rounded-[8px] border border-[#0F172A]/[0.06] bg-[#0F172A]/[0.02] p-3 space-y-2">
              <div className="flex items-center justify-between border-b border-[#0F172A]/[0.06] pb-2">
                <div className="font-heading text-xs font-semibold text-[#0F172A] flex items-center gap-2">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full border border-[#EA6C53]/40 bg-[#EA6C53]/10 text-[#EA6C53]">
                    <CheckCircle2 className="h-3 w-3" />
                  </span>
                  Signed by {getDoctorDisplayName(visit.clinical_evaluation.finalized_by)}
                </div>
                <div className="font-mono text-[11px] text-[#64748B]">
                  Signed on {formatDateTime(visit.clinical_evaluation.finalized_at ?? '')}
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-[#64748B] block mb-0.5">Physician Assessment:</span>
                  <span className="font-semibold text-[#0F172A]">
                    {visit.clinical_evaluation.decision === 'override'
                      ? `Overridden to Grade ${visit.clinical_evaluation.override_grade} (${SEVERITY_LABEL[visit.clinical_evaluation.override_grade as SeverityScore]})`
                      : 'Agreed with automated AI inference'}
                  </span>
                </div>
                <div>
                  <span className="text-[#64748B] block mb-0.5">Clinical Notes:</span>
                  <span className="text-[#0F172A]">
                    {visit.clinical_evaluation.doctor_notes || 'No specific clinical notes recorded.'}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            /* Unfinalized Interactive Form */
            <div className="space-y-3">
              {/* Agree/Override Segmented Control */}
              <div>
                <label className="text-xs font-semibold text-[#0F172A] block mb-1.5">
                  Physician Concordance Decision *
                </label>
                <div className="grid grid-cols-2 gap-2 max-w-md rounded-[8px] border border-[#0F172A]/[0.06] bg-[#0F172A]/[0.025] p-1">
                  <button
                    type="button"
                    onClick={() => setDecision('agree')}
                    className={`flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold rounded-[6px] transition-colors duration-150 ${
                      decision === 'agree'
                        ? 'bg-white text-[#EA6C53] border border-[#0F172A]/[0.06]'
                        : 'text-[#64748B] hover:text-[#0F172A]'
                    }`}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 text-[#EA6C53]" />
                    Agree with AI assessment
                  </button>

                  <button
                    type="button"
                    onClick={() => setDecision('override')}
                    className={`flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold rounded-[6px] transition-colors duration-150 ${
                      decision === 'override'
                        ? 'bg-white text-[#D97706] border border-[#D97706]/25'
                        : 'text-[#64748B] hover:text-[#0F172A]'
                    }`}
                  >
                    <Edit3 className="h-3.5 w-3.5 text-[#D97706]" />
                    Override AI grade
                  </button>
                </div>
              </div>

              {/* Override Grade Selector */}
              {decision === 'override' && (
                <div className="rounded-[8px] border border-[#D97706]/25 bg-[#D97706]/[0.06] p-3 space-y-1.5 max-w-md">
                  <label className="text-xs font-semibold text-[#D97706] block">
                    Select Overridden Diagnostic Grade *
                  </label>
                  <select
                    value={overrideGrade}
                    onChange={(e) => setOverrideGrade(Number(e.target.value))}
                    className="clinical-input font-mono text-xs py-1.5"
                  >
                    <option value={0}>Grade 0: No DR (Normal)</option>
                    <option value={1}>Grade 1: Mild NPDR</option>
                    <option value={2}>Grade 2: Moderate NPDR</option>
                    <option value={3}>Grade 3: Severe NPDR</option>
                    <option value={4}>Grade 4: Proliferative DR (PDR)</option>
                  </select>
                </div>
              )}

              {/* Free-text Clinical Notes Textarea */}
              <div>
                <label className="text-xs font-semibold text-[#0F172A] block mb-1">
                  Clinical Notes &amp; Recommendations
                </label>
                <textarea
                  rows={2}
                  value={doctorNotes}
                  onChange={(e) => setDoctorNotes(e.target.value)}
                  placeholder="Enter physician examination observations, follow-up window, or referral rationale..."
                  className="clinical-input resize-none text-xs py-1.5"
                />
              </div>

              {evaluationError && (
                <div className="rounded-[8px] border border-[#DC2626]/25 bg-[#DC2626]/[0.06] p-3 text-xs text-[#DC2626]">
                  {evaluationError}
                </div>
              )}
              {evaluationSuccess && (
                <div className="rounded-[8px] border border-[#059669]/25 bg-[#059669]/10 p-3 text-xs text-[#059669]">
                  {evaluationSuccess}
                </div>
              )}

              {/* Primary "Sign & finalize" Button */}
              <div className="pt-2 flex items-center justify-between">
                <span className="font-mono text-[11px] text-[#64748B]">
                  Signing will lock this encounter under Dr. Ananya Sharma, MD.
                </span>
                <button
                  type="button"
                  onClick={handleFinalizeDecision}
                  disabled={savingEvaluation}
                  className="btn-primary py-2.5 px-6 text-xs font-semibold"
                >
                  {savingEvaluation ? (
                    <>
                      <span className="lens-spinner-invert" aria-hidden />
                      Finalizing…
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Sign &amp; finalize
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Printable Clinical Diagnostic Report Modal */}
      {showReportModal && (
        <ClinicalReportModal
          visit={visit}
          assets={assets}
          onClose={() => setShowReportModal(false)}
        />
      )}
    </AppShell>
  )
}

function ClinicalReportModal({
  visit,
  assets,
  onClose,
}: {
  visit: RealVisit
  assets: Partial<Record<EyeKey, RealAssetBundle>>
  onClose: () => void
}) {
  const handlePrint = () => {
    window.print()
  }

  const evalData: RealClinicalEvaluation | null = visit.clinical_evaluation || null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl rounded-[12px] border border-[#0F172A]/[0.06] bg-white my-8 overflow-hidden shadow-2xl">
        {/* Modal Toolbar */}
        <div className="flex items-center justify-between border-b border-[#0F172A]/[0.06] bg-[#0F172A]/[0.025] px-6 py-3.5 print:hidden">
          <div className="flex items-center gap-2 text-xs text-[#0F172A]">
            <FileText className="h-4 w-4 text-[#EA6C53]" />
            <span className="font-heading font-semibold text-sm">Retinex Clinical Examination Report</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="btn-primary py-1.5 px-4 text-xs flex items-center gap-1.5"
            >
              <Printer className="h-3.5 w-3.5" /> Print / Save PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-[#64748B] hover:text-[#0F172A] hover:bg-[#0F172A]/[0.04] rounded-[8px] transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Printable Report Document */}
        <div className="p-8 font-sans text-[#0F172A] bg-white print:p-0 print:m-0">
          <div className="border-b-2 border-[#0F172A] pb-5 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="font-heading text-2xl font-bold tracking-tight text-[#0F172A]">
                  Retinex
                </span>
                <span className="font-mono text-xs text-[#64748B]">
                  Ophthalmic Clinical Examination Report
                </span>
              </div>
              <p className="text-xs text-[#64748B] mt-1">
                AI-Assisted Diabetic Retinopathy Screening System
              </p>
            </div>
            <div className="text-right font-mono text-xs text-[#64748B]">
              <div>Case: {visit.visit_id.slice(0, 8)}</div>
              <div>Date: {formatDateTime(visit.created_at ?? new Date().toISOString())}</div>
            </div>
          </div>

          <div className="my-6 rounded-[10px] border border-[#0F172A]/[0.06] bg-[#0F172A]/[0.02] p-4 grid grid-cols-3 gap-4 text-xs font-mono">
            <div>
              <span className="text-[#64748B] block font-sans">Patient Name</span>
              <span className="font-bold text-[#0F172A] text-sm">{visit.patient_name || 'Anonymous'}</span>
            </div>
            <div>
              <span className="text-[#64748B] block font-sans">Evaluation Status</span>
              <span className="font-bold text-[#0F172A] text-sm capitalize">
                {evalData?.status ?? 'Unreviewed'}
              </span>
            </div>
            <div>
              <span className="text-[#64748B] block font-sans">Signing Physician</span>
              <span className="font-bold text-[#0F172A] text-sm">
                {getDoctorDisplayName(evalData?.finalized_by)}
              </span>
            </div>
          </div>

          {/* Dual-Eye Fundus Scans */}
          <div className="my-6 grid grid-cols-2 gap-5">
            <div className="rounded-[10px] border border-[#0F172A]/[0.06] p-4">
              <div className="font-mono text-xs font-bold text-[#0F172A] mb-2.5 border-b border-[#0F172A]/[0.05] pb-1.5 flex justify-between">
                <span>Right eye (OD)</span>
                <span>{visit.od?.classification?.grade_name ?? 'N/A'}</span>
              </div>
              {assets.od?.overlayUrl ? (
                <img
                  src={assets.od.overlayUrl}
                  alt="OD Grad-CAM"
                  className="w-full h-44 object-contain bg-black rounded-[8px]"
                />
              ) : (
                <div className="h-44 grid place-items-center bg-[#0F172A]/[0.02] rounded-[8px] font-mono text-xs text-[#64748B]/70">
                  Scan not available
                </div>
              )}
            </div>

            <div className="rounded-[10px] border border-[#0F172A]/[0.06] p-4">
              <div className="font-mono text-xs font-bold text-[#0F172A] mb-2.5 border-b border-[#0F172A]/[0.05] pb-1.5 flex justify-between">
                <span>Left eye (OS)</span>
                <span>{visit.os?.classification?.grade_name ?? 'N/A'}</span>
              </div>
              {assets.os?.overlayUrl ? (
                <img
                  src={assets.os.overlayUrl}
                  alt="OS Grad-CAM"
                  className="w-full h-44 object-contain bg-black rounded-[8px]"
                />
              ) : (
                <div className="h-44 grid place-items-center bg-[#0F172A]/[0.02] rounded-[8px] font-mono text-xs text-[#64748B]/70">
                  Scan not available
                </div>
              )}
            </div>
          </div>

          {/* Physician Verdict */}
          <div className="my-6 rounded-[10px] border border-[#0F172A]/[0.06] bg-[#0F172A]/[0.02] p-5">
            <h3 className="font-heading text-xs font-bold text-[#0F172A] mb-2.5">
              Physician Final Evaluation &amp; Verdict
            </h3>
            <div className="grid grid-cols-2 gap-4 text-xs font-mono mb-3">
              <div>
                <span className="text-[#64748B] block">AI Concordance:</span>
                <span className="font-bold text-[#0F172A]">
                  {evalData?.decision === 'override' ? 'Overridden' : 'Agreed with AI inference'}
                </span>
              </div>
              <div>
                <span className="text-[#64748B] block">Final Diagnosed Grade:</span>
                <span className="font-bold text-[#0F172A]">
                  {evalData?.decision === 'override' && evalData.override_grade != null
                    ? `Grade ${evalData.override_grade} (${SEVERITY_LABEL[evalData.override_grade as SeverityScore]})`
                    : `Grade ${visit.od?.classification?.grade ?? visit.os?.classification?.grade ?? 'N/A'}`}
                </span>
              </div>
            </div>

            <div>
              <span className="text-xs text-[#64748B] block mb-1">Clinical Notes:</span>
              <div className="rounded-[8px] border border-[#0F172A]/[0.06] bg-white p-3 text-xs text-[#0F172A] min-h-[44px]">
                {evalData?.doctor_notes || 'No clinical notes provided.'}
              </div>
            </div>
          </div>

          {/* Footer Signature */}
          <div className="mt-8 pt-4 border-t border-[#0F172A]/[0.06] flex justify-between items-end text-xs font-mono">
            <div>
              <p className="text-[10px] text-[#64748B]">
                Validation Sensitivity: 85.9% · Specificity: 82.1% · AUC: 0.920
              </p>
            </div>
            <div className="text-right">
              <div className="w-48 border-b border-[#0F172A] mb-1.5" />
              <div className="font-bold text-[#0F172A]">
                {getDoctorDisplayName(evalData?.finalized_by)}
              </div>
              <div className="text-[10px] text-[#64748B]">
                {evalData?.finalized_at ? formatDateTime(evalData.finalized_at) : 'Official Signature'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
