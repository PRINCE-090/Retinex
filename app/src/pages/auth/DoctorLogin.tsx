import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Stethoscope, ArrowLeft, Mail, Lock, Loader2 } from 'lucide-react';
import { useWorkflow } from '../../context/WorkflowContext';
import { backgroundStyle } from '../../lib/roleBackgrounds';

export default function DoctorLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { loginStaff } = useWorkflow();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      await loginStaff(email.trim(), password, 'doctor');
      navigate('/doctor');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="role-bg min-h-screen flex flex-col items-center justify-center p-4" style={backgroundStyle('doctor')}>
      <div className="absolute top-1/3 right-1/3 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md z-10">
        <button onClick={() => navigate('/login/role-selection')} className="flex items-center text-slate-400 hover:text-white transition-colors mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </button>

        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl shadow-2xl p-8 space-y-6">
          <div className="text-center">
            <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/30 mb-4">
              <Stethoscope className="h-7 w-7 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white">Doctor Portal</h2>
            <p className="mt-2 text-slate-400 text-sm">Login to review scans and AI diagnostics</p>
          </div>

          {error && <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm text-center">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
                <input type="email" autoFocus required value={email} onChange={e => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/70 focus:bg-white/10 transition-all"
                  placeholder="doctor@retinex.com" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
                <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/70 focus:bg-white/10 transition-all"
                  placeholder="••••••••" />
              </div>
            </div>
            <button type="submit" disabled={isLoading || !email || !password}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold text-lg shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:scale-[1.02] transition-all duration-300 disabled:opacity-50 flex items-center justify-center mt-2">
              {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Login'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}