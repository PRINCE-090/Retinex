import { useMemo, useState } from 'react';
import { Search, Check, X, Ban, RotateCcw, UserCog } from 'lucide-react';
import { STAFF, type StaffMember, type StaffStatus } from './adminMockData';

// BACKEND: `STAFF` (adminMockData.ts) is hardcoded -- no staff-directory
// endpoint exists yet. Every action below (Approve/Reject/Suspend/
// Reactivate) only mutates local component state, not a real account.
// See API_ROUTES.md's "Admin endpoints" gap.

const STATUS_META: Record<StaffStatus, { label: string; classes: string }> = {
  active: { label: 'Active', classes: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' },
  pending: { label: 'Pending', classes: 'bg-amber-500/15 text-amber-400 border-amber-500/20' },
  suspended: { label: 'Suspended', classes: 'bg-rose-500/15 text-rose-400 border-rose-500/20' },
};

type RoleFilter = 'All' | 'Doctor' | 'Technician';
type StatusFilter = 'All' | StaffStatus;

export default function AdminStaff() {
  const [staff, setStaff] = useState<StaffMember[]>(STAFF);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('All');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');

  const setStatus = (id: string, status: StaffStatus) =>
    setStaff((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return staff.filter((s) => {
      if (roleFilter !== 'All' && s.role !== roleFilter) return false;
      if (statusFilter !== 'All' && s.status !== statusFilter) return false;
      if (q && !s.name.toLowerCase().includes(q) && !s.email.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [staff, query, roleFilter, statusFilter]);

  const counts = {
    All: staff.length,
    active: staff.filter((s) => s.status === 'active').length,
    pending: staff.filter((s) => s.status === 'pending').length,
    suspended: staff.filter((s) => s.status === 'suspended').length,
  };

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-6">
      <div className="pt-2 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Staff Directory</h1>
          <p className="text-slate-400 mt-1">Every doctor and technician account on the platform</p>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold">
          <span className="px-3 py-1.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">{counts.active} active</span>
          <span className="px-3 py-1.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20">{counts.pending} pending</span>
          <span className="px-3 py-1.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/20">{counts.suspended} suspended</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            type="text"
            placeholder="Search by name or email..."
            className="w-full pl-10 pr-4 py-2.5 bg-black/20 border border-white/10 rounded-xl text-slate-200 placeholder:text-slate-500 text-sm focus:outline-none focus:border-violet-500/50 transition-all"
          />
        </div>
        <div className="flex p-1 bg-white/5 border border-white/10 rounded-xl w-fit">
          {(['All', 'Doctor', 'Technician'] as RoleFilter[]).map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${roleFilter === r ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >
              {r === 'All' ? 'All Roles' : `${r}s`}
            </button>
          ))}
        </div>
        <div className="flex p-1 bg-white/5 border border-white/10 rounded-xl w-fit">
          {(['All', 'active', 'pending', 'suspended'] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${statusFilter === s ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >
              {s === 'All' ? 'All Statuses' : s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-white/10 bg-black/20">
              {['Name', 'Role', 'Email', 'Status', 'Patients Handled', 'Joined', 'Last Active', 'Actions'].map((h) => (
                <th key={h} className="px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-widest whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filtered.map((s) => {
              const meta = STATUS_META[s.status];
              return (
                <tr key={s.id} className="hover:bg-white/5 transition-colors duration-150">
                  <td className="px-5 py-4">
                    <p className="text-white font-semibold text-sm">{s.name}</p>
                    <p className="text-slate-500 text-xs mt-0.5">{s.id}</p>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${s.role === 'Doctor' ? 'bg-teal-500/15 text-teal-400 border-teal-500/20' : 'bg-violet-500/15 text-violet-400 border-violet-500/20'}`}>{s.role}</span>
                  </td>
                  <td className="px-5 py-4 text-slate-400 text-sm whitespace-nowrap">{s.email}</td>
                  <td className="px-5 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${meta.classes}`}>{meta.label}</span>
                  </td>
                  <td className="px-5 py-4 text-slate-300 text-sm tabular-nums">{s.patientsHandled}</td>
                  <td className="px-5 py-4 text-slate-500 text-xs whitespace-nowrap">{s.joinedAt}</td>
                  <td className="px-5 py-4 text-slate-500 text-xs whitespace-nowrap">{s.lastActive}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      {s.status === 'pending' && (
                        <>
                          <button onClick={() => setStatus(s.id, 'active')} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/25 transition-all text-xs font-bold">
                            <Check className="h-3.5 w-3.5" /> Approve
                          </button>
                          <button onClick={() => setStaff((prev) => prev.filter((p) => p.id !== s.id))} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 transition-all text-xs font-bold">
                            <X className="h-3.5 w-3.5" /> Reject
                          </button>
                        </>
                      )}
                      {s.status === 'active' && (
                        <button onClick={() => setStatus(s.id, 'suspended')} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-rose-400 hover:border-rose-500/20 hover:bg-rose-500/10 transition-all text-xs font-bold">
                            <Ban className="h-3.5 w-3.5" /> Suspend
                        </button>
                      )}
                      {s.status === 'suspended' && (
                        <button onClick={() => setStatus(s.id, 'active')} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-emerald-400 hover:border-emerald-500/20 hover:bg-emerald-500/10 transition-all text-xs font-bold">
                          <RotateCcw className="h-3.5 w-3.5" /> Reactivate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-slate-500 text-sm">
                  <UserCog className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  No staff match this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
