import { CheckCircle, Activity, User, Camera, FileText } from 'lucide-react';
import { useWorkflow } from '../../context/WorkflowContext';
import { Navigate } from 'react-router-dom';
import LanguageSelect from './LanguageSelect';
import { openPatientReportPdf } from '../../lib/generateReport';
import { UI } from '../../lib/i18n';

export default function PatientHome() {
  const { currentPatient: patient, currentPatientId, language, token } = useWorkflow();

  if (!currentPatientId) {
    return <Navigate to="/login/patient" replace />;
  }

  if (!patient) return <div className="p-10 text-sky-200/70">Loading your records…</div>;
  const t = UI[language as 'English' | 'Hindi'].home;

  const steps = [
    { key: 'Registered' as const, icon: User, done: true, active: false },
    { key: 'Scans Uploaded' as const, icon: Camera, done: patient.status !== 'waiting', active: patient.status === 'waiting' },
    { key: 'Under Review' as const, icon: Activity, done: patient.status === 'report_ready', active: patient.status === 'processing' || patient.status === 'doctor_review' },
    { key: 'Report Ready' as const, icon: CheckCircle, done: patient.status === 'report_ready', active: patient.status === 'report_ready' },
  ];

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">

      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-2">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">{t.welcomeBack(patient.name.split(' ')[0])}</h1>
          <p className="text-sky-200/80 mt-1">{t.subtitle}</p>
        </div>

        <LanguageSelect />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Basic Details Card */}
        <div className="lg:col-span-1 backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-6 shadow-2xl">
          <h2 className="text-xs font-semibold text-sky-200/70 uppercase tracking-widest mb-5">{t.patientProfile}</h2>

          <div className="flex flex-col items-center text-center mb-6">
            <div className="h-20 w-20 rounded-full bg-white/15 border border-white/30 flex items-center justify-center mb-3 shadow-inner">
              <User className="h-9 w-9 text-white" />
            </div>
            <h3 className="text-xl font-bold text-white">{patient.name}</h3>
            <p className="text-sm text-sky-300 font-mono mt-1">{patient.code}</p>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center py-2 border-b border-white/10">
              <span className="text-sky-200/70 text-sm">{t.age}</span>
              <span className="text-white font-medium">{patient.age} {t.yrs}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-white/10">
              <span className="text-sky-200/70 text-sm">{t.phone}</span>
              <span className="text-white font-medium">+91 {patient.phone}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-sky-200/70 text-sm">{t.lastVisit}</span>
              <span className="text-white font-medium text-right">{patient.visitCreatedAt ? new Date(patient.visitCreatedAt).toLocaleDateString() : '—'}</span>
            </div>
          </div>
        </div>

        {/* Status Timeline */}
        <div className="lg:col-span-2 backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-6 shadow-2xl flex flex-col">
          <h2 className="text-xs font-semibold text-sky-200/70 uppercase tracking-widest mb-6">{t.visitStatus}</h2>

          <div className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full relative">
            <div className="absolute left-6 top-8 bottom-8 w-1 bg-white/10 rounded-full z-0"></div>

            {steps.map((step, i) => (
              <div key={i} className="relative z-10 flex items-center gap-5 mb-8 last:mb-0 transition-all duration-500">
                <div className={`h-12 w-12 rounded-full flex items-center justify-center border-4 flex-shrink-0 transition-colors ${step.done ? 'bg-sky-500 border-sky-400 text-white' : step.active ? 'bg-sky-500/20 border-sky-400 text-sky-200 animate-pulse' : 'bg-white/5 border-white/10 text-slate-500'}`}>
                  <step.icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className={`text-lg font-bold ${step.done || step.active ? 'text-white' : 'text-slate-500'}`}>
                    {t.steps[step.key]}
                  </h3>
                  <p className={`text-sm mt-0.5 ${step.done ? 'text-emerald-300' : step.active ? 'text-sky-300' : 'text-slate-500'}`}>
                    {step.done ? t.stepStatus.completed : step.active ? t.stepStatus.inProgress : t.stepStatus.pending}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {patient.status === 'report_ready' && (
            <div className="mt-8 p-4 bg-sky-500/20 border border-sky-400/30 rounded-xl flex items-center gap-4 animate-in slide-in-from-bottom-4">
              <div className="h-10 w-10 bg-sky-500 rounded-full flex items-center justify-center flex-shrink-0">
                <CheckCircle className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold text-sm">{t.reportReadyTitle}</p>
                <p className="text-sky-200 text-xs">{t.reportReadySubtitle}</p>
              </div>
              <button
                onClick={() => openPatientReportPdf(patient, token).catch(() => undefined)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-sky-700 font-bold text-sm hover:bg-sky-50 transition-all flex-shrink-0"
              >
                <FileText className="h-4 w-4" /> {t.view}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}