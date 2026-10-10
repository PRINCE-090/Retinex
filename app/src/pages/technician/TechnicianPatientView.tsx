import { useState, useRef, useEffect, type ChangeEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, UploadCloud, CheckCircle2, ChevronDown, AlertCircle } from 'lucide-react';
import { useWorkflow } from '../../context/WorkflowContext';

type Side = 'left' | 'right';

export default function TechnicianPatientView() {
  const navigate = useNavigate();
  const { patientId } = useParams();
  const { patients, doctors, startVisit, ready } = useWorkflow();
  const patient = patients.find((p) => p.id === patientId);

  // Keep the File objects: they are what gets sent to the AI pipeline. The
  // object URLs are only for the on-screen preview.
  const [files, setFiles] = useState<Record<Side, File | null>>({ left: null, right: null });
  const [previews, setPreviews] = useState<Record<Side, string | null>>({ left: null, right: null });
  const [doctorId, setDoctorId] = useState<string>('');
  const [error, setError] = useState('');

  const leftInputRef = useRef<HTMLInputElement>(null);
  const rightInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => {
    Object.values(previews).forEach((u) => u && URL.revokeObjectURL(u));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>, side: Side) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setFiles((f) => ({ ...f, [side]: file }));
    setPreviews((p) => {
      if (p[side]) URL.revokeObjectURL(p[side] as string);
      return { ...p, [side]: URL.createObjectURL(file) };
    });
  };

  // Both eyes are required (the backend enforces this too).
  const isReady = files.left !== null && files.right !== null;

  const handleUploadToPipeline = () => {
    if (!isReady || !patientId) return;
    // Left eye = OS, right eye = OD. The upload runs in the background
    // (MATLAB quality gate + AI can take a while); the roster shows this
    // patient under "AI Processing" until it finishes.
    startVisit(patientId, files.right, files.left, doctorId || null);
    navigate('/technician');
  };

  if (!ready) return <div className="p-10 text-slate-400">Loading…</div>;
  if (!patient) return <div className="p-10 text-white">Patient not found</div>;

  const zone = (side: Side, label: string, ref: typeof leftInputRef) => (
    <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6 shadow-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-widest">{label}</h2>
        {previews[side] && <span className="px-2 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-lg text-xs font-bold flex items-center gap-1"><CheckCircle2 className="h-3 w-3"/> Acquired</span>}
      </div>
      <div
        onClick={() => ref.current?.click()}
        className={`aspect-video cursor-pointer overflow-hidden rounded-xl border-2 border-dashed flex flex-col items-center justify-center transition-all ${previews[side] ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-white/20 bg-black/20 hover:border-violet-500/40 hover:bg-white/5'}`}
      >
        <input type="file" accept="image/jpeg,image/png,image/tiff" className="hidden" ref={ref} onChange={(e) => handleFileUpload(e, side)} />
        {previews[side] ? (
          <img src={previews[side] as string} alt={`${label} scan`} className="w-full h-full object-cover" />
        ) : (
          <div className="text-center text-slate-400 p-4">
            <UploadCloud className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm font-medium">Click to upload scan</p>
            <p className="text-xs opacity-60 mt-1">JPEG, PNG or TIFF</p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">

      <div className="flex items-center justify-between pt-2">
        <div>
          <button onClick={() => navigate('/technician')} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-medium mb-3">
            <ArrowLeft className="h-4 w-4" /> Back to Roster
          </button>
          <h1 className="text-3xl font-bold text-white tracking-tight">Scan Acquisition</h1>
          <p className="text-slate-400 mt-1">Patient: <span className="text-white font-semibold">{patient.name}</span> <span className="text-slate-500">({patient.code})</span></p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {zone('left', 'Left Eye (OS)', leftInputRef)}
        {zone('right', 'Right Eye (OD)', rightInputRef)}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}

      {!isReady && (
        <p className="text-sm text-slate-400 -mt-4">
          Both eyes are needed for a screening —{' '}
          {files.left === null && files.right === null ? 'upload the left and right eye scans' : files.left === null ? 'the left eye (OS) is still missing' : 'the right eye (OD) is still missing'}.
        </p>
      )}

      {/* Action Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between p-6 bg-white/5 border border-white/10 rounded-2xl">
        <div>
          <p className="text-sm font-medium text-slate-300">Doctor Assignment</p>
          <div className="relative mt-1">
            <select
              value={doctorId}
              onChange={(e) => setDoctorId(e.target.value)}
              className="appearance-none bg-black/20 border border-white/10 rounded-lg px-4 py-2 pr-10 text-white text-sm focus:outline-none focus:border-violet-500/50 min-w-[220px] cursor-pointer"
            >
              <option value="" className="bg-slate-900">Any available doctor</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id} className="bg-slate-900">{d.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          </div>
        </div>
        <button
          disabled={!isReady}
          onClick={handleUploadToPipeline}
          className={`px-8 py-3.5 rounded-xl font-bold shadow-lg transition-all mt-4 md:mt-0 ${isReady ? 'bg-gradient-to-r from-violet-500 to-indigo-600 text-white shadow-violet-500/25 hover:shadow-violet-500/40 hover:scale-[1.02]' : 'bg-white/5 text-slate-500 cursor-not-allowed'}`}
        >
          Upload &amp; Analyze
        </button>
      </div>
    </div>
  );
}
