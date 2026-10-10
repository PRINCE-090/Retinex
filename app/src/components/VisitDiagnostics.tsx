import { useState } from 'react'
import { AlertTriangle, ShieldCheck } from 'lucide-react'
import RealFundus from './RealFundus'
import type { RealAssetBundle, RealVisit } from '../api/realApi'

export type EyeKey = 'od' | 'os'

export const EYE_TITLE: Record<EyeKey, string> = { od: 'Right Eye (OD)', os: 'Left Eye (OS)' }

const LESION_METADATA: Record<string, { name: string; desc: string }> = {
  hard_exudates: { name: 'Hard Exudates', desc: 'Lipid/lipoprotein deposits (validated channel)' },
  microaneurysms: { name: 'Microaneurysms', desc: 'Focal capillary outpouchings' },
  haemorrhages: { name: 'Haemorrhages', desc: 'Intraretinal blot / flame bleeding' },
  soft_exudates: { name: 'Soft Exudates / CWS', desc: 'Nerve fiber layer infarcts' },
}

// The backend may send sensitivity/specificity as a fraction or a percentage.
const pct = (v: number) => (v <= 1 ? v * 100 : v).toFixed(0)

const GRADE_LABELS = ['No DR', 'Mild NPDR', 'Moderate NPDR', 'Severe NPDR', 'Proliferative DR']

interface Props {
  visit: RealVisit
  assets: Partial<Record<EyeKey, RealAssetBundle>>
  eye: EyeKey
  onEyeChange: (eye: EyeKey) => void
}

/**
 * The real pipeline output for one visit, shown in the staff dark theme.
 * Row 1: the fundus viewer (Grad-CAM heatmap, raw fundus, vessel map, lesion
 * masks, optic disc / fovea markers -- RealFundus) beside the grade card, the
 * two stretched to the same height. Row 2: the lesion channels as an even grid.
 */
export default function VisitDiagnostics({ visit, assets, eye, onEyeChange }: Props) {
  const [selectedLesionKey, setSelectedLesionKey] = useState<string | null>(null)

  const eyes = (['od', 'os'] as EyeKey[]).filter((k) => visit[k])
  const result = visit[eye]
  const eyeAssets = assets[eye]
  const cls = result?.classification ?? null
  const grade = cls?.grade ?? null
  const referable = cls?.referable
  const rejected = result?.image_quality?.quality === 'reject'
  const probs = cls?.grade_probabilities_calibrated ?? null

  // Eye switcher lives inside the viewer card so the card, and the panel
  // beside it, start on the same line.
  const eyeSwitcher =
    eyes.length > 1 ? (
      <div className="mb-3 inline-flex self-start gap-1 rounded-full bg-white/5 p-1 ring-1 ring-white/10">
        {eyes.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => {
              setSelectedLesionKey(null)
              onEyeChange(k)
            }}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              eye === k ? 'bg-white text-neutral-900' : 'text-white/70 hover:text-white'
            }`}
          >
            {EYE_TITLE[k]}
          </button>
        ))}
      </div>
    ) : (
      <p className="mb-3 text-sm font-semibold text-white/80">{EYE_TITLE[eye]}</p>
    )

  return (
    <div className="space-y-5">
      {!result ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-slate-400 text-sm">
          No scan was uploaded for this eye.
        </div>
      ) : (
        <>
          {/* Row 1: viewer + grade card, same height */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 items-stretch">
            <div className="lg:col-span-3 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl flex flex-col">
              {eyeSwitcher}
              {rejected ? (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-6 text-amber-100">
                  <div className="flex items-center gap-2 font-bold">
                    <AlertTriangle className="h-5 w-5 text-amber-400" /> Image rejected at the quality gate
                  </div>
                  <p className="mt-2 text-sm text-amber-100/80">
                    Reason: {result.image_quality.reject_reason ?? 'Severe blur or insufficient illumination.'} No AI grading was
                    produced for this eye — please re-capture the scan.
                  </p>
                  {eyeAssets?.originalUrl && (
                    <img src={eyeAssets.originalUrl} alt="Rejected scan" className="mt-4 max-h-64 rounded-xl border border-white/10" />
                  )}
                </div>
              ) : (
                <RealFundus
                  tone="dark"
                  result={result}
                  originalUrl={eyeAssets?.originalUrl}
                  overlayUrl={eyeAssets?.overlayUrl}
                  vesselUrl={eyeAssets?.vesselUrl}
                  lesionUrls={eyeAssets?.lesionUrls}
                  selectedLesionKey={selectedLesionKey}
                />
              )}
              {result.image_quality?.quality === 'borderline' && (
                <p className="mt-3 text-xs text-amber-300 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" /> Borderline image quality — interpret the AI output with caution.
                </p>
              )}
            </div>

            <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl flex flex-col justify-between gap-5">
              {cls ? (
                <>
                  <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">AI severity grade</p>
                  <div className="mt-2 flex items-baseline gap-3">
                    <span className="font-mono text-6xl font-medium text-white leading-none">{grade}</span>
                    <span className="text-xl font-bold text-white">{cls.grade_name}</span>
                  </div>
                  </div>

                  <div className="border-t border-white/10 pt-5">
                  <div
                    className={`flex items-center justify-between rounded-xl border px-3 py-2.5 ${
                      referable?.is_referable ? 'border-rose-500/30 bg-rose-500/10' : 'border-emerald-500/30 bg-emerald-500/10'
                    }`}
                  >
                    <span className="text-xs font-semibold text-slate-200">Referable DR</span>
                    <span className={`text-xs font-bold ${referable?.is_referable ? 'text-rose-300' : 'text-emerald-300'}`}>
                      {referable?.is_referable ? 'Referral recommended' : 'Non-referable'}
                    </span>
                  </div>
                  {referable && (
                    <p className="mt-2 font-mono text-xs text-slate-400">
                      Referable probability: <span className="font-bold text-white">{(referable.probability * 100).toFixed(1)}%</span>
                      <span className="text-slate-500"> (threshold {(referable.threshold * 100).toFixed(0)}%)</span>
                    </p>
                  )}
                  </div>

                  {probs && (
                    <div className="border-t border-white/10 pt-5 space-y-2.5">
                      <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">Calibrated class probabilities</p>
                      {probs.map((p, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <span className="w-28 text-slate-400 truncate">{GRADE_LABELS[i] ?? `Grade ${i}`}</span>
                          <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                            <div className={`h-full rounded-full ${i === grade ? 'bg-emerald-400' : 'bg-white/30'}`} style={{ width: `${Math.max(1, p * 100)}%` }} />
                          </div>
                          <span className="w-10 text-right font-mono text-slate-300">{(p * 100).toFixed(0)}%</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="border-t border-white/10 pt-5 grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">Image quality</p>
                      <p className="mt-1 text-sm font-semibold capitalize text-white">{result.image_quality?.quality ?? '—'}</p>
                    </div>
                    {referable?.known_performance && (
                      <div>
                        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">Model (test set)</p>
                        <p className="mt-1 font-mono text-xs text-slate-300 leading-relaxed">
                          Sens {pct(referable.known_performance.official_test_sensitivity)}%
                          <br />
                          Spec {pct(referable.known_performance.official_test_specificity)}%
                          <br />
                          AUC {referable.known_performance.official_test_auc.toFixed(2)}
                        </p>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-sm text-slate-400 text-center">
                  {rejected ? 'No AI grade — the image was rejected.' : 'No diagnostic findings for this eye.'}
                </div>
              )}
            </div>
          </div>

          {/* Row 2: lesion channels as an even grid */}
          {result.lesion_segmentation?.channels && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Lesion segmentation</p>
                <span className="text-[10px] font-mono text-slate-500">Click a channel to isolate its mask</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                {Object.entries(result.lesion_segmentation.channels).map(([key, ch]) => {
                  const meta = LESION_METADATA[key] ?? { name: key.replace(/_/g, ' '), desc: 'Retinal lesion' }
                  const selected = selectedLesionKey === key
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSelectedLesionKey(selected ? null : key)}
                      className={`h-full flex flex-col text-left rounded-xl border p-3 transition-colors ${
                        selected ? 'border-emerald-400/60 bg-emerald-400/10' : 'border-white/10 bg-white/5 hover:bg-white/10'
                      }`}
                    >
                      <span className="text-sm font-semibold text-white">{meta.name}</span>
                      <span className="mt-0.5 text-[11px] text-slate-500 flex-1">{meta.desc}</span>
                      <span className="mt-3 flex items-center justify-between gap-2">
                        <span className="font-mono text-xs text-slate-400">Dice {typeof ch.val_dice === 'number' ? ch.val_dice.toFixed(2) : '—'}</span>
                        {ch.dice_unreliable ? (
                          <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300" title="Low validation Dice — interpret with caution">
                            Low confidence
                          </span>
                        ) : (
                          <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300 flex items-center gap-1">
                            <ShieldCheck className="h-3 w-3" /> Reliable
                          </span>
                        )}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
