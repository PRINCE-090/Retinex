import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Zap, Mic, Stethoscope, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { useWorkflow } from '../../context/WorkflowContext';
import { useVisitData } from '../../lib/useVisitData';
import VisitDiagnostics, { type EyeKey } from '../../components/VisitDiagnostics';

const GRADES = ['0 — No DR', '1 — Mild NPDR', '2 — Moderate NPDR', '3 — Severe NPDR', '4 — Proliferative DR'];

export default function DoctorReviewScreen() {
  const navigate = useNavigate();
  const { visitId } = useParams();
  const { token, submitDoctorReview, patients } = useWorkflow();
  const { visit, assets, loading, error } = useVisitData(visitId, token);
  const patient = patients.find((p) => p.id === visit?.patient_id);

  const [eye, setEye] = useState<EyeKey>('od');
  const [notes, setNotes] = useState('');
  const [prescription, setPrescription] = useState('');
  const [diet, setDiet] = useState('');
  const [isDictating, setIsDictating] = useState(false);
  const [decision, setDecision] = useState<'agree' | 'override' | null>(null);
  const [overrideGrade, setOverrideGrade] = useState(2);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Start on whichever eye exists, and prefill from an earlier sign-off.
  useEffect(() => {
    if (!visit) return;
    setEye(visit.od ? 'od' : 'os');
    const ev = visit.clinical_evaluation;
    if (ev?.status === 'finalized') {
      setDecision(ev.decision);
      if (ev.override_grade != null) setOverrideGrade(ev.override_grade);
      setNotes(ev.doctor_notes ?? '');
      setPrescription(ev.prescription ?? '');
      setDiet(ev.diet ?? '');
    }
  }, [visit]);

  const applyTemplate = (type: 'mild' | 'healthy') => {
    if (type === 'mild') {
      setNotes('Mild non-proliferative diabetic retinopathy detected. AI findings verified. Microaneurysms noted in the macula region. No immediate surgical intervention required.');
      setPrescription('Nepafenac 0.1% Eye Drops - 1 drop twice daily.');
      setDiet('Strictly avoid refined sugars. Monitor blood glucose daily. High protein, low carbohydrate diet.');
    } else {
      setNotes('Fundus appears completely healthy. No signs of diabetic retinopathy. AI confirmed. Retinal blood vessels normal.');
      setPrescription('No medication required.');
      setDiet('Maintain current balanced diet to keep blood sugar stable.');
    }
  };

  const textareaClass = "w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-slate-200 text-sm placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 focus:bg-white/5 transition-all resize-none";

  const finalized = visit?.clinical_evaluation?.status === 'finalized';
  const canFinalize = decision !== null && notes.trim().length > 0 && !saving;

  const handleFinalize = async () => {
    if (!visitId || !decision) return;
    setSaving(true);
    setSaveError('');
    try {
      await submitDoctorReview(visitId, { decision, overrideGrade, notes, prescription, diet });
      navigate('/doctor');
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Could not save the review.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-10 flex items-center gap-3 text-slate-300">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading scans and AI results…
      </div>
    );
  }
  if (error || !visit) {
    return (
      <div className="p-10 space-y-4">
        <p className="text-rose-300 flex items-center gap-2"><AlertCircle className="h-5 w-5" /> {error ?? 'Visit not found'}</p>
        <button onClick={() => navigate('/doctor')} className="text-sm text-slate-400 hover:text-white underline underline-offset-4">Back to queue</button>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-2">
        <div>
          <button onClick={() => navigate('/doctor')} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-medium mb-2">
            <ArrowLeft className="h-4 w-4" /> Back to Queue
          </button>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            {visit.patient_name ?? 'Patient'}
            <span className="ml-3 text-sm font-medium text-slate-400">
              {visit.patient_age != null ? `${visit.patient_age} yrs` : ''}
              {patient?.gender ? ` · ${patient.gender.charAt(0).toUpperCase()}${patient.gender.slice(1)}` : ''}
              {patient?.diabeticHistory != null ? ` · Diabetic history: ${patient.diabeticHistory ? 'Yes' : 'No'}` : ''}
              {visit.created_at ? ` · scanned ${new Date(visit.created_at).toLocaleString()}` : ''}
            </span>
          </h1>
          {finalized && (
            <p className="text-xs text-emerald-300 mt-1">
              Already signed off by {visit.clinical_evaluation?.finalized_by}
              {visit.clinical_evaluation?.finalized_at ? ` on ${new Date(visit.clinical_evaluation.finalized_at).toLocaleDateString()}` : ''} — this report has been sent to the patient and can no longer be changed.
            </p>
          )}
        </div>
        <button
          onClick={handleFinalize}
          disabled={!canFinalize || finalized}
          className="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:scale-[1.02] transition-all duration-300 disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} {finalized ? 'Report Finalized' : 'Finalize & Push to Patient'}
        </button>
      </div>

      {saveError && <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">{saveError}</div>}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">

        {/* Left: real AI output -- Grad-CAM, lesions, vessels, findings */}
        <div className="xl:col-span-8 space-y-5">
          <VisitDiagnostics visit={visit} assets={assets} eye={eye} onEyeChange={setEye} />
        </div>

        {/* Right: clinical sign-off */}
        <div className="xl:col-span-4 flex flex-col">
          <div className="flex-1 flex flex-col backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2"><Stethoscope className="h-5 w-5 text-emerald-400" /> Clinical Assessment</h2>
              <button className="text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-lg text-xs font-bold hover:bg-emerald-500/20 transition-all flex items-center gap-1.5" disabled={finalized} onClick={() => applyTemplate('mild')}>
                <Zap className="h-3 w-3" /> Auto-fill Demo
              </button>
            </div>

            <div className="bg-black/20 rounded-xl p-4 border border-white/5">
              <p className="text-sm font-medium text-slate-300 mb-3">AI Agreement</p>
              <div className="flex gap-3">
                <button
                  disabled={finalized} onClick={() => setDecision('agree')}
                  className={`flex-1 py-2 rounded-lg border text-sm font-bold transition-all ${decision === 'agree' ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' : 'border-white/10 text-slate-400 hover:bg-white/5'}`}
                >
                  Agree with AI
                </button>
                <button
                  disabled={finalized} onClick={() => setDecision('override')}
                  className={`flex-1 py-2 rounded-lg border text-sm font-bold transition-all ${decision === 'override' ? 'bg-rose-500/20 border-rose-500/40 text-rose-300' : 'border-white/10 text-slate-400 hover:bg-white/5'}`}
                >
                  Override Grade
                </button>
              </div>
              {decision === 'override' && (
                <select disabled={finalized}
                  value={overrideGrade}
                  onChange={(e) => setOverrideGrade(Number(e.target.value))}
                  className="mt-3 w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-rose-500/50"
                >
                  {GRADES.map((g, i) => <option key={i} value={i} className="bg-slate-900">{g}</option>)}
                </select>
              )}
            </div>

            <div className="flex-1 flex flex-col gap-4">
              <div className="flex-1 flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-semibold text-slate-300">Doctor's Notes</label>
                  <button onClick={() => setIsDictating(!isDictating)} className={`p-1.5 rounded-md transition-all ${isDictating ? 'bg-rose-500/20 text-rose-400' : 'text-slate-500 hover:text-white hover:bg-white/10'}`}>
                    <Mic className="h-4 w-4" />
                  </button>
                </div>
                <textarea readOnly={finalized} rows={4} className={`${textareaClass} flex-1 min-h-[110px]`} placeholder="Enter clinical findings..." value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>

              <div className="flex-1 flex flex-col">
                <label className="text-sm font-semibold text-slate-300 mb-2 block">Prescription</label>
                <textarea readOnly={finalized} rows={3} className={`${textareaClass} flex-1 min-h-[90px]`} placeholder="Enter medication details..." value={prescription} onChange={(e) => setPrescription(e.target.value)} />
              </div>

              <div className="flex-1 flex flex-col">
                <label className="text-sm font-semibold text-slate-300 mb-2 block">Dietary Recommendations</label>
                <textarea readOnly={finalized} rows={3} className={`${textareaClass} flex-1 min-h-[90px]`} placeholder="Enter diet plan..." value={diet} onChange={(e) => setDiet(e.target.value)} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
