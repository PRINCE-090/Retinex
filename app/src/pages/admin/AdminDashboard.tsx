import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, FileText, UserCheck, Stethoscope, Check, X,
  ScanLine, AlertTriangle, CheckCircle2, ArrowUpRight, Activity as ActivityIcon,
} from 'lucide-react';
import {
  PLATFORM_KPIS, PENDING_STAFF, SYSTEM_STATUS, WEEKLY_VOLUME,
  SEVERITY_DISTRIBUTION, ACTIVITY_LOG, type StaffMember,
} from './adminMockData';
import { WeeklyVolumeChart, SeverityDistributionChart } from './AdminCharts';

// BACKEND: `PLATFORM_KPIS`/`SYSTEM_STATUS`/`WEEKLY_VOLUME`/
// `SEVERITY_DISTRIBUTION`/`ACTIVITY_LOG` (adminMockData.ts) are all
// hardcoded -- no admin endpoints exist yet. Approve/Reject below only
// update local component state, not a real staff-approval route. See
// API_ROUTES.md's "Admin endpoints" gap.

const kpis = [
  { label: 'Total Patients', value: PLATFORM_KPIS.totalPatients.toLocaleString(), icon: Users, color: 'from-cyan-500 to-blue-600', glow: 'shadow-cyan-500/20' },
  { label: 'Reports Generated', value: PLATFORM_KPIS.reportsGenerated.toLocaleString(), icon: FileText, color: 'from-emerald-500 to-teal-600', glow: 'shadow-emerald-500/20' },
  { label: 'Scans Today', value: String(PLATFORM_KPIS.scansToday), icon: ScanLine, color: 'from-blue-500 to-indigo-600', glow: 'shadow-blue-500/20' },
  { label: 'Referable This Week', value: String(PLATFORM_KPIS.referableThisWeek), icon: AlertTriangle, color: 'from-rose-500 to-pink-600', glow: 'shadow-rose-500/20' },
  { label: 'Active Doctors', value: String(PLATFORM_KPIS.activeDoctors), icon: Stethoscope, color: 'from-violet-500 to-indigo-600', glow: 'shadow-violet-500/20' },
  { label: 'Active Technicians', value: String(PLATFORM_KPIS.activeTechnicians), icon: UserCheck, color: 'from-amber-500 to-orange-600', glow: 'shadow-amber-500/20' },
];

const activityStyles: Record<string, { icon: typeof CheckCircle2; classes: string }> = {
  registration: { icon: Users, classes: 'bg-blue-500/15 text-blue-400' },
  upload: { icon: ScanLine, classes: 'bg-violet-500/15 text-violet-400' },
  finalized: { icon: CheckCircle2, classes: 'bg-emerald-500/15 text-emerald-400' },
  approval: { icon: Check, classes: 'bg-emerald-500/15 text-emerald-400' },
  rejection: { icon: X, classes: 'bg-slate-500/15 text-slate-400' },
  alert: { icon: AlertTriangle, classes: 'bg-rose-500/15 text-rose-400' },
};

export default function AdminDashboard() {
  const [pending, setPending] = useState<StaffMember[]>(PENDING_STAFF);

  const resolve = (id: string) => setPending((prev) => prev.filter((p) => p.id !== id));

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">
      <div className="pt-2">
        <h1 className="text-3xl font-bold text-white tracking-tight">Platform Overview</h1>
        <p className="text-slate-400 mt-1">System management and staff access control</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
        {kpis.map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={i} className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-white/20 hover:scale-[1.01] transition-all duration-300">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-slate-400 text-sm font-medium">{s.label}</p>
                  <h2 className="text-3xl font-bold text-white mt-2">{s.value}</h2>
                </div>
                <div className={`h-12 w-12 rounded-2xl bg-gradient-to-br ${s.color} flex items-center justify-center shadow-lg ${s.glow} flex-shrink-0`}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* System Health */}
      <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl shadow-2xl p-6">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-widest mb-4">System Health</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {SYSTEM_STATUS.map((c) => (
            <div key={c.name} className="flex items-start gap-3 p-3.5 rounded-xl bg-black/20 border border-white/5">
              <span className="relative flex h-2.5 w-2.5 mt-1.5 flex-shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              <div className="min-w-0">
                <p className="text-white text-sm font-semibold">{c.name}</p>
                <p className="text-slate-500 text-xs mt-0.5 truncate">{c.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl shadow-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-widest">Weekly Scan Volume</h2>
            <span className="text-xs text-slate-500">Last 8 weeks</span>
          </div>
          <WeeklyVolumeChart data={WEEKLY_VOLUME} />
        </div>
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl shadow-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-widest">Severity Distribution</h2>
            <Link to="/admin/insights" className="text-xs text-violet-400 hover:text-violet-300 font-semibold flex items-center gap-1">
              Full insights <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          <SeverityDistributionChart data={SEVERITY_DISTRIBUTION} />
        </div>
      </div>

      {/* Staff Approvals */}
      <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-widest">Pending Staff Approvals</h2>
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/20">{pending.length} pending</span>
            <Link to="/admin/staff" className="text-xs text-violet-400 hover:text-violet-300 font-semibold flex items-center gap-1">
              Staff directory <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-white/5">
              {['Name', 'Role', 'Email', 'Actions'].map(h => (
                <th key={h} className="px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-widest">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {pending.map((p) => (
              <tr key={p.id} className="hover:bg-white/5 transition-colors duration-150">
                <td className="px-6 py-4 text-white font-semibold text-sm">{p.name}</td>
                <td className="px-6 py-4">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${p.role === 'Doctor' ? 'bg-teal-500/15 text-teal-400 border-teal-500/20' : 'bg-violet-500/15 text-violet-400 border-violet-500/20'}`}>{p.role}</span>
                </td>
                <td className="px-6 py-4 text-slate-400 text-sm">{p.email}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <button onClick={() => resolve(p.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/25 transition-all text-xs font-bold">
                      <Check className="h-3.5 w-3.5" /> Approve
                    </button>
                    <button onClick={() => resolve(p.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 transition-all text-xs font-bold">
                      <X className="h-3.5 w-3.5" /> Reject
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {pending.length === 0 && (
              <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-500 text-sm">No pending approvals.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Recent Activity */}
      <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <ActivityIcon className="h-4 w-4" /> Recent Activity
          </h2>
          <Link to="/admin/activity" className="text-xs text-violet-400 hover:text-violet-300 font-semibold flex items-center gap-1">
            View full log <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="divide-y divide-white/5">
          {ACTIVITY_LOG.slice(0, 5).map((a) => {
            const style = activityStyles[a.kind];
            const Icon = style.icon;
            return (
              <div key={a.id} className="px-6 py-3.5 flex items-start gap-3 hover:bg-white/5 transition-colors">
                <div className={`p-1.5 rounded-lg mt-0.5 flex-shrink-0 ${style.classes}`}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-slate-200 text-sm leading-snug">{a.message}</p>
                  <p className="text-slate-500 text-xs mt-0.5">{a.actor} &bull; {a.timestamp}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
