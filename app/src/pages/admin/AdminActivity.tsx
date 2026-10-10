import { useMemo, useState } from 'react';
import { Search, Users, ScanLine, CheckCircle2, Check, X, AlertTriangle, History } from 'lucide-react';
import { ACTIVITY_LOG, type ActivityKind } from './adminMockData';

// BACKEND: `ACTIVITY_LOG` (adminMockData.ts) is hardcoded -- no audit-log
// endpoint exists yet. A real one would need every mutating route
// (patient create, visit upload, evaluation finalize, staff approval) to
// write an entry somewhere queryable, which none of them do today. See
// API_ROUTES.md's "Admin endpoints" gap.

const KIND_META: Record<ActivityKind, { label: string; icon: typeof CheckCircle2; classes: string }> = {
  registration: { label: 'Registration', icon: Users, classes: 'bg-blue-500/15 text-blue-400' },
  upload: { label: 'Scan Upload', icon: ScanLine, classes: 'bg-violet-500/15 text-violet-400' },
  finalized: { label: 'Report Finalized', icon: CheckCircle2, classes: 'bg-emerald-500/15 text-emerald-400' },
  approval: { label: 'Staff Approval', icon: Check, classes: 'bg-emerald-500/15 text-emerald-400' },
  rejection: { label: 'Quality Rejection', icon: X, classes: 'bg-slate-500/15 text-slate-400' },
  alert: { label: 'Alert', icon: AlertTriangle, classes: 'bg-rose-500/15 text-rose-400' },
};

type KindFilter = 'All' | ActivityKind;

export default function AdminActivity() {
  const [query, setQuery] = useState('');
  const [kindFilter, setKindFilter] = useState<KindFilter>('All');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ACTIVITY_LOG.filter((a) => {
      if (kindFilter !== 'All' && a.kind !== kindFilter) return false;
      if (q && !a.message.toLowerCase().includes(q) && !a.actor.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [query, kindFilter]);

  const kinds: KindFilter[] = ['All', 'registration', 'upload', 'finalized', 'approval', 'rejection', 'alert'];

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-6">
      <div className="pt-2">
        <h1 className="text-3xl font-bold text-white tracking-tight">Activity Log</h1>
        <p className="text-slate-400 mt-1">Audit trail of platform-wide events, most recent first</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            type="text"
            placeholder="Search by event or actor..."
            className="w-full pl-10 pr-4 py-2.5 bg-black/20 border border-white/10 rounded-xl text-slate-200 placeholder:text-slate-500 text-sm focus:outline-none focus:border-violet-500/50 transition-all"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {kinds.map((k) => (
            <button
              key={k}
              onClick={() => setKindFilter(k)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all border ${kindFilter === k ? 'bg-white/10 text-white border-white/20' : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-white/5'}`}
            >
              {k === 'All' ? 'All Events' : KIND_META[k].label}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline */}
      <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        <div className="divide-y divide-white/5">
          {filtered.map((a) => {
            const meta = KIND_META[a.kind];
            const Icon = meta.icon;
            return (
              <div key={a.id} className="px-6 py-4 flex items-start gap-4 hover:bg-white/5 transition-colors">
                <div className={`p-2 rounded-xl mt-0.5 flex-shrink-0 ${meta.classes}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${meta.classes}`}>{meta.label}</span>
                    <span className="text-slate-500 text-xs">{a.id}</span>
                  </div>
                  <p className="text-slate-200 text-sm leading-relaxed mt-1">{a.message}</p>
                  <p className="text-slate-500 text-xs mt-1">{a.actor} &bull; {a.timestamp}</p>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="px-6 py-16 text-center text-slate-500 text-sm">
              <History className="h-8 w-8 mx-auto mb-2 opacity-40" />
              No events match this filter.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
