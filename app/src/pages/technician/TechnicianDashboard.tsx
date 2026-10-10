import { useEffect, useRef, useState } from 'react';
import { useWorkflow } from '../../context/WorkflowContext';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { Plus, X, Camera, CheckCircle2, Loader2 } from 'lucide-react';

/** "started 2m 05s ago", ticking once a second. */
function Elapsed({ since }: { since: string | null }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => tick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, []);
  if (!since) return null;
  const secs = Math.max(0, Math.floor((Date.now() - new Date(since).getTime()) / 1000));
  return <>{Math.floor(secs / 60)}m {String(secs % 60).padStart(2, '0')}s</>;
}

export default function TechnicianDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'waiting'|'processing'|'sent'>('waiting');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [newPatient, setNewPatient] = useState<{ name: string; age: string; phone: string; gender: '' | 'male' | 'female' | 'other'; diabetic: boolean | null }>({ name: '', age: '', phone: '', gender: '', diabetic: null });
  const { patients, addPatient, uploadErrors, error: loadError } = useWorkflow();
  const failureFor = (p: { id: string; processingError: string | null }) => uploadErrors[p.id] ?? p.processingError;
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleAddPatient = async () => {
    const age = parseInt(newPatient.age, 10);
    const phone = newPatient.phone.replace(/\D/g, '').slice(-10);
    if (!newPatient.name.trim()) return setFormError('Enter the full name of the patient.');
    if (!Number.isFinite(age) || age < 0 || age > 120) return setFormError('Enter a valid age.');
    if (phone.length !== 10) return setFormError('Enter a valid 10-digit phone number.');
    setFormError('');
    setSaving(true);
    try {
      await addPatient({ name: newPatient.name.trim(), age, phone, gender: newPatient.gender, diabeticHistory: newPatient.diabetic });
      setDrawerOpen(false);
      setNewPatient({ name: '', age: '', phone: '', gender: '', diabetic: null });
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Could not register the patient.');
    } finally {
      setSaving(false);
    }
  };
  
  const prevProcessing = useRef(0);
  const processingCount = patients.filter(p => p.status === 'processing').length;
  useEffect(() => {
    if (processingCount > prevProcessing.current) setActiveTab('processing');
    prevProcessing.current = processingCount;
  }, [processingCount]);

  const roster = {
    waiting: patients.filter(p => p.status === 'waiting'),
    processing: patients.filter(p => p.status === 'processing'),
    sent: patients.filter(p => p.status === 'doctor_review' || p.status === 'report_ready')
  };

  
  const inputClass = "w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-slate-200 text-sm placeholder:text-slate-500 focus:outline-none focus:border-violet-500/50 transition-all";

  return (
    <div className="relative h-full w-full overflow-y-auto p-6 md:p-10 space-y-8 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-2">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Live Clinic Roster</h1>
          <p className="text-slate-400 mt-1">Manage patient flow and scan acquisition</p>
        </div>
        <button onClick={() => { setFormError(''); setDrawerOpen(true); }} className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-600 text-white font-bold shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:scale-[1.02] transition-all duration-300">
          <Plus className="h-4 w-4" /> Add New Patient
        </button>
      </div>

      {loadError && <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">Could not reach the server: {loadError}</div>}

      {/* Pipeline Tabs */}
      <div className="flex p-1 bg-white/5 border border-white/10 rounded-2xl w-fit">
        {[ 
          { id: 'waiting', label: 'Waiting for Scan', count: roster.waiting.length, color: 'text-amber-400' },
          { id: 'processing', label: 'AI Processing', count: roster.processing.length, color: 'text-blue-400' },
          { id: 'sent', label: 'Sent to Doctor', count: roster.sent.length, color: 'text-emerald-400' }
        ].map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${activeTab === tab.id ? 'bg-white/10 text-white shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}
          >
            {tab.label} <span className={`px-2 py-0.5 rounded-full bg-black/20 text-xs ${tab.color}`}>{tab.count}</span>
          </button>
        ))}
      </div>

      {/* Roster Table */}
      <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-white/10 bg-black/20">
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-widest">Patient</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-widest">Status</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-widest text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {roster[activeTab].map((p, i) => (
              <tr key={i} className="hover:bg-white/5 transition-colors group">
                <td className="px-6 py-4">
                  <p className="text-white font-bold text-sm">{p.name}</p>
                  <p className="text-slate-500 text-xs mt-0.5">{p.code} &bull; {p.age} yrs &bull; {p.phone}</p>
                  {failureFor(p) && <p className="text-rose-400 text-xs mt-1 max-w-md">{failureFor(p)}</p>}
                </td>
                <td className="px-6 py-4">
                  {activeTab === 'waiting' && <span className="px-3 py-1 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20 text-xs font-bold inline-flex items-center gap-1.5"><Camera className="h-3 w-3"/> {p.status}</span>}
                  {activeTab === 'processing' && (
                    <div>
                      <span className="px-3 py-1 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/20 text-xs font-bold inline-flex items-center gap-1.5"><Loader2 className="h-3 w-3 animate-spin"/> AI analysing scans…</span>
                      <p className="text-slate-500 text-xs mt-1.5">Running quality check, grading and Grad-CAM · <Elapsed since={p.processingStartedAt} /></p>
                    </div>
                  )}
                  {activeTab === 'sent' && <span className="px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 text-xs font-bold inline-flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3"/> {p.status === 'report_ready' ? 'report ready' : 'with doctor'}{p.assignedDoctorName ? ` · ${p.assignedDoctorName}` : ''}</span>}
                </td>
                <td className="px-6 py-4 text-right">
                  {activeTab === 'waiting' && (
                    <button onClick={() => navigate(`/technician/patient/${p.id}`)} className="px-4 py-2 rounded-xl bg-violet-500/20 text-violet-300 font-bold text-sm border border-violet-500/30 hover:bg-violet-500/30 transition-all opacity-0 group-hover:opacity-100">
                      {failureFor(p) ? 'Retry Scans' : 'Capture Scans'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {roster[activeTab].length === 0 && (
              <tr><td colSpan={3} className="px-6 py-8 text-center text-slate-500 text-sm">No patients in this queue.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Overlay + drawer are portalled to <body>: inside the page they sit
          in a lower stacking context than the (glass) navbar and slid under it. */}
      {createPortal(<>
      {/* Sliding Drawer Overlay */}
      {drawerOpen && <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] transition-opacity" onClick={() => setDrawerOpen(false)} />}
      
      {/* Sliding Drawer */}
      <div className={`fixed top-0 right-0 h-full w-full max-w-md backdrop-blur-2xl bg-slate-900/90 border-l border-white/10 shadow-2xl z-[70] transform transition-transform duration-300 ease-in-out ${drawerOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="p-6 h-full flex flex-col">
          <div className="flex justify-between items-center border-b border-white/10 pb-4 mb-6">
            <h2 className="text-xl font-bold text-white">Register Patient</h2>
            <button onClick={() => setDrawerOpen(false)} className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>
          
          <div className="space-y-5 flex-1 overflow-y-auto">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Full Name</label>
              <input type="text" className={inputClass} placeholder="e.g. Ramesh Kumar" value={newPatient.name} onChange={e => setNewPatient({ ...newPatient, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Phone Number</label>
              <input type="tel" className={inputClass} placeholder="+91" value={newPatient.phone} onChange={e => setNewPatient({ ...newPatient, phone: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Age</label>
                <input type="number" className={inputClass} placeholder="Yrs" value={newPatient.age} onChange={e => setNewPatient({ ...newPatient, age: e.target.value })} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Gender</label>
                <select className={inputClass} value={newPatient.gender} onChange={e => setNewPatient({ ...newPatient, gender: e.target.value as typeof newPatient.gender })}>
                  <option value="" className="bg-slate-900">Select…</option>
                  <option value="male" className="bg-slate-900">Male</option>
                  <option value="female" className="bg-slate-900">Female</option>
                  <option value="other" className="bg-slate-900">Other</option>
                </select>
              </div>
            </div>
            <div className="space-y-2 pt-2">
              <label className="text-sm font-medium text-slate-300">Diabetic History?</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-slate-300 cursor-pointer"><input type="radio" name="diabetic" className="accent-violet-500" checked={newPatient.diabetic === true} onChange={() => setNewPatient({ ...newPatient, diabetic: true })} /> Yes</label>
                <label className="flex items-center gap-2 text-slate-300 cursor-pointer"><input type="radio" name="diabetic" className="accent-violet-500" checked={newPatient.diabetic === false} onChange={() => setNewPatient({ ...newPatient, diabetic: false })} /> No</label>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-white/10 mt-auto">
            {formError && <p className="mb-3 text-sm text-rose-400">{formError}</p>}
            <button onClick={handleAddPatient} disabled={saving} className="w-full py-3.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white font-bold shadow-lg shadow-violet-500/25 transition-all">{saving ? 'Saving…' : 'Save & Add to Queue'}</button>
          </div>
        </div>
      </div>
      </>, document.body)}
    </div>
  );
}
