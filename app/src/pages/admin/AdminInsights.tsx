import { BrainCircuit, ThumbsUp } from 'lucide-react';
import { DOCTOR_AGREEMENT, SEVERITY_DISTRIBUTION, WEEKLY_VOLUME } from './adminMockData';
import { SeverityDistributionChart, WeeklyVolumeChart } from './AdminCharts';

// BACKEND: every number on this page (adminMockData.ts) is hardcoded --
// no admin analytics endpoint exists (see API_ROUTES.md's "Admin
// endpoints" gap). Unlike a doctor-scoped equivalent, this needs to
// aggregate across every doctor's visits, not just one account's -- GET
// /api/visits today is scoped to the JWT owner, so this needs a new
// platform-wide route rather than reusing that one directly. Aggregate
// counts only (agreement rate, volume, per-doctor breakdown) -- no
// patient identity or clinical content.

const totalCases = DOCTOR_AGREEMENT.reduce((sum, d) => sum + d.casesReviewed, 0);
const weightedAgreement = Math.round(
  DOCTOR_AGREEMENT.reduce((sum, d) => sum + d.agreementRate * d.casesReviewed, 0) / totalCases,
);
const totalScans = WEEKLY_VOLUME.reduce((sum, w) => sum + w.scans, 0);

export default function AdminInsights() {
  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="pt-2">
        <h1 className="text-3xl font-bold text-white tracking-tight">AI Insights & Accuracy</h1>
        <p className="text-slate-400 mt-1">Platform-wide AI performance against doctors' final diagnoses</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-8 flex flex-col items-center justify-center text-center hover:border-white/20 transition-all duration-300">
          <div className="h-20 w-20 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mb-5">
            <ThumbsUp className="h-10 w-10 text-emerald-400" />
          </div>
          <h2 className="text-5xl font-bold text-white mb-2">{weightedAgreement}%</h2>
          <p className="text-emerald-400 font-medium">Doctor-AI Agreement Rate</p>
          <p className="text-slate-500 text-sm mt-3 max-w-xs">Across all doctors, the AI's preliminary classification was agreed with in {weightedAgreement}% of finalized cases this month.</p>
        </div>

        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-8 flex flex-col items-center justify-center text-center hover:border-white/20 transition-all duration-300">
          <div className="h-20 w-20 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center mb-5">
            <BrainCircuit className="h-10 w-10 text-blue-400" />
          </div>
          <h2 className="text-5xl font-bold text-white mb-2">{totalScans}</h2>
          <p className="text-blue-400 font-medium">Scans Processed</p>
          <p className="text-slate-500 text-sm mt-3 max-w-xs">Total number of fundus images analyzed platform-wide over the last 8 weeks.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl shadow-2xl p-6">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-widest mb-5">Weekly Scan Volume</h2>
          <WeeklyVolumeChart data={WEEKLY_VOLUME} />
        </div>
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl shadow-2xl p-6">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-widest mb-5">Severity Distribution</h2>
          <SeverityDistributionChart data={SEVERITY_DISTRIBUTION} />
        </div>
      </div>

      {/* Per-doctor breakdown */}
      <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-widest">Agreement Rate by Doctor</h2>
        </div>
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-white/5 bg-black/20">
              <th className="px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-widest">Doctor</th>
              <th className="px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-widest">Cases Reviewed</th>
              <th className="px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-widest">Agreement Rate</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {DOCTOR_AGREEMENT.map((d) => (
              <tr key={d.name} className="hover:bg-white/5 transition-colors duration-150">
                <td className="px-6 py-4 text-white font-semibold text-sm">{d.name}</td>
                <td className="px-6 py-4 text-slate-400 text-sm tabular-nums">{d.casesReviewed}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3 max-w-xs">
                    <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                      <div className="h-full rounded-full bg-emerald-500/80" style={{ width: `${d.agreementRate}%` }} />
                    </div>
                    <span className="text-emerald-400 font-bold text-sm tabular-nums w-11 text-right">{d.agreementRate}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
