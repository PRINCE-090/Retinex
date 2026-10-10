import { ZoomIn, Eye, Activity, HelpCircle, Loader2, AlertCircle } from 'lucide-react';
import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import LanguageSelect from './LanguageSelect';
import { useWorkflow } from '../../context/WorkflowContext';
import { useVisitData } from '../../lib/useVisitData';
import { UI, translateGrade, type Language } from '../../lib/i18n';
import type { RealResult } from '../../api/realApi';
import type { EyeKey } from '../../components/VisitDiagnostics';

const icons = { healthy: '👁️', retinopathy: '⚠️' } as const;

/**
 * The patient's own scans and AI results, from the finalized visit
 * (GET /api/visits/:id and its assets -- the backend only releases these to
 * the patient once the doctor has signed the report off).
 */
export default function PatientScans() {
  const [edu, setEdu] = useState<string | null>(null);
  const [zoomUrl, setZoomUrl] = useState<string | null>(null);
  const { currentPatient: patient, currentPatientId, token, language } = useWorkflow();
  const t = UI[language as Language].scans;
  const tp = UI[language as Language].prescriptions;
  const educationData = t.education;

  const finalized = patient?.status === 'report_ready';
  const { visit, assets, loading, error } = useVisitData(finalized ? patient?.visitId : null, token);

  if (!currentPatientId) return <Navigate to="/login/patient" replace />;
  if (!patient) return <div className="p-10 text-sky-200/70">Loading your records…</div>;

  const eyeCard = (key: EyeKey, title: string) => {
    const result: RealResult | null = visit?.[key] ?? null;
    if (!result) return null;

    const cls = result.classification;
    const rejected = result.image_quality?.quality === 'reject';
    const referable = !!cls?.referable?.is_referable;
    const healthy = !referable && (cls?.grade ?? 0) === 0;
    const bundle = assets[key];
    const eduKey = healthy ? 'healthy' : 'retinopathy';
    const tiles: { label: string; url: string | null | undefined }[] = [
      { label: t.originalScan, url: bundle?.originalUrl },
      { label: t.aiHeatmap, url: bundle?.overlayUrl },
    ];

    return (
      <div key={key} className={`backdrop-blur-xl bg-white/10 border rounded-2xl p-6 shadow-2xl space-y-4 ${referable ? 'border-amber-400/30' : 'border-white/20'}`}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-sky-100 uppercase tracking-widest flex items-center gap-2">
            <Eye className="h-4 w-4" /> {title}
          </h2>
          {!rejected && cls && (
            referable ? (
              <span className="px-3 py-1 rounded-lg bg-amber-400/20 text-amber-200 border border-amber-400/30 text-xs font-bold flex items-center gap-1">
                <Activity className="h-3 w-3" /> {t.referableBadge}
              </span>
            ) : (
              <span className="px-3 py-1 rounded-lg bg-emerald-400/20 text-emerald-200 border border-emerald-400/30 text-xs font-bold">
                {(cls.grade ?? 0) === 0 ? t.noDrBadge : translateGrade(cls.grade_name, language as Language)}
              </span>
            )
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          {tiles.map(({ label, url }) => (
            <div key={label} className="space-y-2">
              <p className="text-xs text-sky-300/70 font-medium">{label}</p>
              <button
                type="button"
                disabled={!url}
                onClick={() => url && setZoomUrl(url)}
                className="w-full rounded-xl aspect-square bg-white/5 border border-white/10 flex items-center justify-center group relative overflow-hidden cursor-zoom-in hover:border-white/30 transition-all disabled:cursor-default"
              >
                {url ? (
                  <>
                    <img src={url} alt={label} className="absolute inset-0 h-full w-full object-cover" />
                    <ZoomIn className="relative h-6 w-6 text-white/0 group-hover:text-white/80 transition-colors drop-shadow" />
                  </>
                ) : (
                  <ZoomIn className="h-6 w-6 text-white/30" />
                )}
              </button>
            </div>
          ))}
        </div>

        {rejected ? (
          <div className="p-3 rounded-xl bg-amber-400/15 border border-amber-400/25 text-amber-100 text-xs leading-relaxed">
            {result.image_quality.reject_reason ?? 'This image was too blurry or dark to analyse.'}
          </div>
        ) : cls ? (
          <div className={`p-3 rounded-xl border ${referable ? 'bg-amber-400/15 border-amber-400/25' : 'bg-white/10 border-white/15'}`}>
            <p className={`${referable ? 'text-amber-100' : 'text-sky-100'} text-xs leading-relaxed`}>
              <span className="font-bold">{t.classification}:</span> {t.grade} {cls.grade} ({translateGrade(cls.grade_name, language as Language)}).{' '}
              {t.probability}: {Math.round((cls.grade_probabilities_calibrated?.[cls.grade] ?? cls.referable?.probability ?? 0) * 100)}%.
            </p>
          </div>
        ) : null}

        {!rejected && cls && (
          <>
            <button
              onClick={() => setEdu(edu === key ? null : key)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/10 border border-white/15 text-sky-200 text-sm font-medium hover:bg-white/20 transition-all"
            >
              <HelpCircle className="h-4 w-4" /> {t.whatDoesThisMean}
            </button>
            {edu === key && (
              <div className="p-4 rounded-xl bg-white/10 border border-white/15 text-center space-y-2">
                <span className="text-2xl">{icons[eduKey]}</span>
                <p className="text-white font-semibold text-sm">{educationData[eduKey].title}</p>
                <p className="text-sky-200/80 text-xs leading-relaxed">{educationData[eduKey].desc}</p>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-2">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">{t.title}</h1>
          <p className="text-sky-200/80 mt-1">{t.subtitle}</p>
        </div>
        <LanguageSelect />
      </div>

      {!finalized ? (
        <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-12 flex flex-col items-center text-center">
          <div className="h-16 w-16 bg-white/10 border border-white/20 rounded-full flex items-center justify-center mb-4">
            <AlertCircle className="h-8 w-8 text-sky-200/60" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">{tp.noReportTitle}</h2>
          <p className="text-sky-200/70 max-w-md text-sm">{tp.noReportBody}</p>
        </div>
      ) : loading ? (
        <div className="flex items-center gap-3 text-sky-200/80"><Loader2 className="h-5 w-5 animate-spin" /> Loading your scans…</div>
      ) : error || !visit ? (
        <p className="text-rose-300 flex items-center gap-2"><AlertCircle className="h-5 w-5" /> {error ?? 'Could not load your scans.'}</p>
      ) : (
        <>
          {patient.doctorReview?.decision === 'override' && (
            <div className="p-4 rounded-xl bg-white/10 border border-white/20 text-sky-100 text-sm">
              <span className="font-bold">{patient.doctorReview.finalizedBy}</span>: {translateGrade(patient.doctorReview.finalGrade, language as Language)}
            </div>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {eyeCard('os', t.leftEye)}
            {eyeCard('od', t.rightEye)}
          </div>
        </>
      )}

      {zoomUrl && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 cursor-zoom-out" onClick={() => setZoomUrl(null)}>
          <img src={zoomUrl} alt="Enlarged scan" className="max-h-full max-w-full rounded-2xl shadow-2xl" />
        </div>
      )}
    </div>
  );
}
