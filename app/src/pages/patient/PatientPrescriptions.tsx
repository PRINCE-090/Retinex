import { Download, Volume2, Pill, Utensils, AlertCircle, MessageCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useWorkflow } from '../../context/WorkflowContext';
import { Navigate } from 'react-router-dom';
import { buildReportSummaryText, getReportPdfFile } from '../../lib/generateReport';
import { speak, stopSpeaking } from '../../lib/speech';
import { usePatientPrefs, normalisePhone, resolveVoiceLang } from '../../lib/patientPrefs';
import LanguageSelect from './LanguageSelect';
import { UI, translateClinicalText, type Language } from '../../lib/i18n';

export default function PatientPrescriptions() {
  const { currentPatient: patient, currentPatientId, language, token } = useWorkflow();
  const { prefs } = usePatientPrefs(currentPatientId);
  const [speaking, setSpeaking] = useState(false);
  const [pdfError, setPdfError] = useState('');

  // Build the PDF (with the fundus photos + Grad-CAM heatmaps) as soon as
  // the report is ready, so Share/Download don't have to wait -- sharing
  // needs to happen right inside the click for browsers to allow it.
  const reportFileRef = useRef<File | null>(null);
  useEffect(() => {
    reportFileRef.current = null;
    if (!patient || patient.status !== 'report_ready') return;
    let alive = true;
    getReportPdfFile(patient, token)
      .then((f) => { if (alive) reportFileRef.current = f; })
      .catch(() => undefined);
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patient?.visitId, patient?.status, token]);

  if (!currentPatientId) {
    return <Navigate to="/login/patient" replace />;
  }
  if (!patient) return <div className="p-10 text-sky-200/70">Loading your records…</div>;

  const hasFinalReport = patient.status === 'report_ready' && patient.doctorReview;
  const t = UI[language as Language].prescriptions;

  // Only the known, fixed canned templates (seed patient + Auto-fill
  // Demo) have real Hindi translations -- see lib/i18n.ts. Freely-typed
  // doctor notes fall through unchanged, in whichever language they were
  // written in.
  const doctorNotes = patient.doctorReview?.notes
    ? translateClinicalText(patient.doctorReview.notes, language as Language)
    : t.noNotesAvailable;
  const prescriptionText = translateClinicalText(patient.doctorReview?.prescription, language as Language);
  const dietText = translateClinicalText(patient.doctorReview?.diet, language as Language);

  const handleSpeak = () => {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    const lang = resolveVoiceLang(prefs.voiceLang, language);
    setSpeaking(true);
    speak(doctorNotes, lang, prefs.voiceRate, () => setSpeaking(false)).then(ok => { if (!ok) setSpeaking(false) });
  };

  // wa.me links can only pre-fill text; a file can't be attached via URL.
  // With "attach PDF" on (Settings): where the browser supports sharing
  // files (mobile, some desktop) use the native share sheet with the PDF +
  // text; otherwise download the PDF and open WhatsApp with the text so the
  // user can attach it. With it off, only the text summary is sent. If a
  // family number is saved and enabled, the chat opens straight to it (the
  // native share sheet can't pre-pick a recipient, so it is skipped then).
  const getFile = async () => reportFileRef.current ?? (reportFileRef.current = await getReportPdfFile(patient, token));

  const saveFile = (file: File) => {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleWhatsApp = async () => {
    setPdfError('');
    const shareText = buildReportSummaryText(patient);
    const target = prefs.shareToFamily ? normalisePhone(prefs.familyPhone) : '';
    const waUrl = `https://wa.me/${target}?text=${encodeURIComponent(shareText)}`;

    if (!prefs.shareIncludePdf) {
      window.open(waUrl, '_blank');
      return;
    }

    try {
      const file = await getFile();

      if (!target) {
        const shareData: ShareData = { files: [file], text: shareText, title: 'Retinex Eye Report' };
        if (navigator.canShare?.(shareData)) {
          try {
            await navigator.share(shareData);
            return;
          } catch (err) {
            if (err instanceof DOMException && err.name === 'AbortError') return; // user cancelled
            // any other failure: fall through to the download + wa.me fallback
          }
        }
      }

      saveFile(file);
      window.open(waUrl, '_blank');
    } catch {
      setPdfError('Could not prepare the PDF. Please try again.');
    }
  };

  const handleDownloadPdf = async () => {
    setPdfError('');
    try {
      saveFile(await getFile());
    } catch {
      setPdfError('Could not prepare the PDF. Please try again.');
    }
  };

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-2">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">{t.title}</h1>
          <p className="text-sky-200/80 mt-1">{t.subtitle}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <LanguageSelect />
          <button onClick={handleWhatsApp} disabled={!hasFinalReport}
            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-200 font-bold text-sm hover:bg-emerald-500/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
            <MessageCircle className="h-4 w-4" /> {t.shareWhatsApp}
          </button>
          <button onClick={handleDownloadPdf} disabled={!hasFinalReport}
            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-white/20 border border-white/25 text-white font-bold text-sm hover:bg-white/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
            <Download className="h-4 w-4" /> {t.downloadPdf}
          </button>
        </div>
      </div>

      {pdfError && <p className="text-sm text-rose-300">{pdfError}</p>}

      {!hasFinalReport ? (
        <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-12 flex flex-col items-center text-center">
          <div className="h-16 w-16 bg-white/10 border border-white/20 rounded-full flex items-center justify-center mb-4">
            <AlertCircle className="h-8 w-8 text-sky-200/60" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">{t.noReportTitle}</h2>
          <p className="text-sky-200/70 max-w-md text-sm">{t.noReportBody}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Doctor Notes */}
          <div className="lg:col-span-2 backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold text-sky-200/70 uppercase tracking-widest">{t.clinicalNotes}</h2>
              <button onClick={handleSpeak}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-all ${speaking ? 'bg-rose-500/20 border-rose-500/40 text-rose-200' : 'bg-white/10 border-white/20 text-white hover:bg-white/15'}`}>
                <Volume2 className="h-4 w-4" />
                {speaking ? t.stop : t.readAloud}
              </button>
            </div>

            <div className="p-5 bg-white/5 border border-white/10 rounded-xl">
              <p className="text-sky-100 text-base leading-relaxed">"{doctorNotes}"</p>
              <div className="mt-5 pt-5 border-t border-white/10 flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-white/20 border border-white/30 flex items-center justify-center text-white font-bold">{(patient.doctorReview?.finalizedBy ?? 'D').replace(/^Dr\.?\s*/i, '').charAt(0)}</div>
                <div>
                  <p className="text-white text-sm font-bold">{patient.doctorReview?.finalizedBy ?? 'Your doctor'}</p>
                  <p className="text-sky-200/70 text-xs">{t.retinalSpecialist}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {/* Medications */}
            <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-6 shadow-2xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 rounded-xl bg-purple-500/20 border border-purple-500/30">
                  <Pill className="h-5 w-5 text-purple-300" />
                </div>
                <h2 className="text-lg font-bold text-white">{t.medications}</h2>
              </div>
              <div className="space-y-3">
                <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                  <p className="text-white font-semibold text-sm">{prescriptionText}</p>
                </div>
              </div>
            </div>

            {/* Diet & Lifestyle */}
            <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-6 shadow-2xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 rounded-xl bg-amber-500/20 border border-amber-500/30">
                  <Utensils className="h-5 w-5 text-amber-300" />
                </div>
                <h2 className="text-lg font-bold text-white">{t.dietLifestyle}</h2>
              </div>
              <ul className="space-y-2">
                <li className="flex items-start gap-2 text-sm text-sky-100">
                  <span className="text-amber-400 mt-1">&bull;</span>
                  {dietText}
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}