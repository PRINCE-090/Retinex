import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, History, ChevronDown, ChevronRight } from 'lucide-react';
import { useWorkflow } from '../../context/WorkflowContext';

const STATUS_LABEL = {
  waiting: 'No scans yet',
  processing: 'AI processing',
  doctor_review: 'Awaiting review',
  report_ready: 'Report ready',
} as const;

export default function DoctorDatabase() {
  const navigate = useNavigate();
  const { patients, visits } = useWorkflow();
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? patients.filter((p) => p.name.toLowerCase().includes(q) || p.phone.includes(q) || p.code.toLowerCase().includes(q))
      : patients;
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [patients, query]);

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="pt-2">
        <h1 className="text-3xl font-bold text-white tracking-tight">Patient Database</h1>
        <p className="text-slate-400 mt-1">Search and review historical patient records</p>
      </div>

      <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl shadow-2xl overflow-hidden min-h-[400px] flex flex-col">
        <div className="p-4 border-b border-white/10">
          <div className="relative max-w-lg">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, phone, or Patient ID…"
              className="w-full pl-11 pr-4 py-3 bg-black/20 border border-white/10 rounded-xl text-slate-300 placeholder:text-slate-500 text-sm focus:outline-none focus:border-emerald-500/50 transition-all"
            />
          </div>
        </div>

        {results.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-10 opacity-50">
            <History className="h-12 w-12 text-slate-500 mb-4" />
            <p className="text-slate-400 font-medium">{patients.length === 0 ? 'No patients are registered yet.' : 'No patient matches your search.'}</p>
          </div>
        ) : (
          <ul className="divide-y divide-white/5">
            {results.map((p) => {
              const history = visits.filter((v) => v.patient_id === p.id);
              const open = openId === p.id;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => setOpenId(open ? null : p.id)}
                    className="w-full flex items-center gap-3 px-6 py-4 text-left hover:bg-white/5 transition-colors"
                  >
                    {open ? <ChevronDown className="h-4 w-4 text-slate-500" /> : <ChevronRight className="h-4 w-4 text-slate-500" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-bold text-sm">{p.name}</p>
                      <p className="text-slate-500 text-xs mt-0.5">{p.code} · {p.age} yrs · {p.phone}</p>
                    </div>
                    <span className="text-xs font-semibold text-slate-300">{p.aiGrade ?? '—'}</span>
                    <span className="text-xs text-slate-400 w-32 text-right">{STATUS_LABEL[p.status]}</span>
                  </button>

                  {open && (
                    <div className="px-6 pb-4 pl-14">
                      {history.length === 0 ? (
                        <p className="text-sm text-slate-500">No visits on record.</p>
                      ) : (
                        <ul className="space-y-2">
                          {history.map((v) => (
                            <li key={v.visit_id} className="flex flex-wrap items-center gap-3 rounded-xl bg-black/20 border border-white/5 px-4 py-2.5 text-sm">
                              <span className="text-slate-300">{new Date(v.created_at).toLocaleString()}</span>
                              <span className="text-slate-500">
                                OD {v.od ? (v.od.quality === 'reject' ? 'rejected' : `G${v.od.grade ?? '?'}`) : '—'} · OS {v.os ? (v.os.quality === 'reject' ? 'rejected' : `G${v.os.grade ?? '?'}`) : '—'}
                              </span>
                              <span className={v.clinical_evaluation?.status === 'finalized' ? 'text-emerald-400' : 'text-amber-400'}>
                                {v.clinical_evaluation?.status === 'finalized' ? 'Finalized' : 'Pending review'}
                              </span>
                              <button
                                onClick={() => navigate('/doctor/review/' + v.visit_id)}
                                className="ml-auto px-3 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold hover:bg-emerald-500/20 transition-all"
                              >
                                Open
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
