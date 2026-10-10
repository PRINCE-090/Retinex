import { useNavigate } from 'react-router-dom';
import { Clock, AlertTriangle, Eye } from 'lucide-react';
import { useWorkflow } from '../../context/WorkflowContext';

export default function DoctorDashboard() {
  const navigate = useNavigate();
  const { patients } = useWorkflow();
  
  // Most severe first, so the urgent cases are at the top of the queue.
  const doctorQueue = patients
    .filter(p => p.status === 'doctor_review')
    .sort((a, b) => (b.gradeNumber ?? -1) - (a.gradeNumber ?? -1));
  const referableCount = doctorQueue.filter(p => p.referable).length;

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="pt-2">
        <h1 className="text-3xl font-bold text-white tracking-tight">Today's Triage Queue</h1>
        <p className="text-slate-400 mt-1">AI-prioritized patient list for immediate review</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6 flex items-center gap-5 hover:border-emerald-500/30 transition-all duration-300">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-600/20 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
            <Clock className="h-6 w-6 text-emerald-400" />
          </div>
          <div>
            <p className="text-slate-400 text-sm font-medium">Pending Reviews</p>
            <h2 className="text-3xl font-bold text-white mt-0.5">{doctorQueue.length}</h2>
          </div>
        </div>

        <div className="backdrop-blur-xl bg-white/5 border border-rose-500/20 rounded-2xl p-6 flex items-center gap-5 hover:border-rose-500/40 transition-all duration-300 shadow-lg shadow-rose-900/10">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-rose-500/20 to-pink-600/20 border border-rose-500/20 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="h-6 w-6 text-rose-400" />
          </div>
          <div>
            <p className="text-rose-200/70 text-sm font-medium">Referable Cases</p>
            <h2 className="text-3xl font-bold text-white mt-0.5">{referableCount}</h2>
          </div>
        </div>
      </div>

      <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-white/10 bg-black/20">
              <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-widest">Patient Details</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-widest">AI Classification</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-widest text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {doctorQueue.map((p, i) => {
              const isReferable = p.referable;
              return (
              <tr key={i} className="hover:bg-white/5 transition-colors group">
                <td className="px-6 py-4">
                  <p className="text-white font-bold text-sm">{p.name}</p>
                  <p className="text-slate-400 text-xs mt-0.5">{p.code} &bull; {p.age} yrs &bull; Ph: {p.phone}</p>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">{p.aiGrade || 'Awaiting analysis'}</span>
                    {isReferable && <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[10px] font-bold uppercase tracking-wider border border-rose-500/30">Referable</span>}
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                    <button onClick={() => navigate('/doctor/review/' + p.visitId)} className="px-5 py-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 font-bold text-sm border border-emerald-500/20 hover:bg-emerald-500/20 transition-all opacity-0 group-hover:opacity-100 flex items-center gap-2 ml-auto">
                      <Eye className="h-4 w-4" /> Analyze
                    </button>
                </td>
              </tr>
            )})}
            {doctorQueue.length === 0 && (
              <tr><td colSpan={3} className="px-6 py-8 text-center text-slate-500 text-sm">No patients pending review.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}