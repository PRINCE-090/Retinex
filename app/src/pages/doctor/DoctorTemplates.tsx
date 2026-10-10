
import { FileSignature, Plus } from 'lucide-react';

// BACKEND: entirely new feature -- no template storage or endpoints
// exist at all. Both cards below are hardcoded demo content, not data
// from any account-scoped template collection.
export default function DoctorTemplates() {
  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center pt-2">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Clinical Templates</h1>
          <p className="text-slate-400 mt-1">Manage your 1-click auto-fill snippets</p>
        </div>
        <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30 hover:bg-emerald-500/30 transition-all">
          <Plus className="h-4 w-4" /> New Template
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-emerald-500/30 transition-all cursor-pointer">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <FileSignature className="h-4 w-4 text-emerald-400" />
            </div>
            <h3 className="text-white font-bold text-lg">Mild NPDR Standard</h3>
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-slate-500 font-semibold uppercase mb-1">Notes Snippet</p>
              <p className="text-sm text-slate-300 line-clamp-2">Mild non-proliferative diabetic retinopathy detected. AI findings verified...</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 font-semibold uppercase mb-1">Prescription Snippet</p>
              <p className="text-sm text-slate-300">Nepafenac 0.1% Eye Drops - 1 drop twice daily.</p>
            </div>
          </div>
        </div>
        
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-emerald-500/30 transition-all cursor-pointer">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-slate-800 border border-white/10">
              <FileSignature className="h-4 w-4 text-slate-400" />
            </div>
            <h3 className="text-white font-bold text-lg">Healthy Protocol</h3>
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-slate-500 font-semibold uppercase mb-1">Notes Snippet</p>
              <p className="text-sm text-slate-300 line-clamp-2">Fundus appears completely healthy. No signs of diabetic retinopathy...</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
