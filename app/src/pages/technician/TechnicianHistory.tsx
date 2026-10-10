import { History } from 'lucide-react';
import { useWorkflow } from '../../context/WorkflowContext';
import type { RealEyeSummary } from '../../api/realApi';

function eyeCell(eye: RealEyeSummary | null) {
  if (!eye) return <span className="text-slate-600">—</span>;
  if (eye.quality === 'reject') return <span className="text-amber-400 text-xs font-semibold">Rejected (poor quality)</span>;
  return (
    <span className="text-sm text-slate-200">
      <span className="font-semibold">G{eye.grade ?? '?'}</span>{' '}
      <span className="text-slate-400 text-xs">{eye.grade_name ?? eye.quality}</span>
    </span>
  );
}

export default function TechnicianHistory() {
  const { visits } = useWorkflow();

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="pt-2">
        <h1 className="text-3xl font-bold text-white tracking-tight">Scan History</h1>
        <p className="text-slate-400 mt-1">Every scan session processed by the clinic</p>
      </div>

      {visits.length === 0 ? (
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl shadow-2xl flex flex-col items-center justify-center p-20 opacity-50">
          <History className="h-12 w-12 text-slate-500 mb-4" />
          <p className="text-slate-400 font-medium">No scans have been processed yet.</p>
        </div>
      ) : (
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/10 bg-black/20">
                {['Patient', 'Date', 'Right eye (OD)', 'Left eye (OS)', 'Status'].map((h) => (
                  <th key={h} className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-widest">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {visits.map((v) => (
                <tr key={v.visit_id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4">
                    <p className="text-white font-bold text-sm">{v.patient_name}</p>
                    <p className="text-slate-500 text-xs mt-0.5">{v.patient_age != null ? `${v.patient_age} yrs` : ''}</p>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-300">{new Date(v.created_at).toLocaleString()}</td>
                  <td className="px-6 py-4">{eyeCell(v.od)}</td>
                  <td className="px-6 py-4">{eyeCell(v.os)}</td>
                  <td className="px-6 py-4">
                    {v.processing_status === 'processing' ? (
                      <span className="px-3 py-1 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/20 text-xs font-bold">Analysing…</span>
                    ) : v.processing_status === 'failed' ? (
                      <span className="px-3 py-1 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/20 text-xs font-bold" title={v.processing_error ?? ''}>Failed</span>
                    ) : v.clinical_evaluation?.status === 'finalized' ? (
                      <span className="px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 text-xs font-bold">Report ready</span>
                    ) : (
                      <span className="px-3 py-1 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/20 text-xs font-bold">
                        With {v.assigned_doctor_name ?? 'doctor'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
