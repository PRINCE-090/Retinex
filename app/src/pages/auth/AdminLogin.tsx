import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkflow } from '../../context/WorkflowContext';
import { Shield, Mail, Lock, Loader2 } from 'lucide-react';

export default function AdminLogin() {
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
      await loginStaff(email.trim(), password, 'admin');
      navigate('/admin');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-slate-900 to-gray-950 flex flex-col items-center justify-center p-4">
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-96 h-96 bg-violet-900/20 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md z-10">
        <div className="backdrop-blur-xl bg-slate-950/60 border border-violet-500/20 rounded-3xl shadow-2xl shadow-violet-900/20 p-8 space-y-6">
          <div className="text-center">
            <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-gradient-to-br from-violet-800 to-slate-800 border border-violet-500/30 shadow-lg shadow-violet-900/30 mb-4">
              <Shield className="h-7 w-7 text-violet-300" />
            </div>
            <h2 className="text-2xl font-bold text-white">System Administration</h2>
            <p className="mt-2 text-slate-500 text-sm">Manage staff accounts and platform-wide settings</p>
          </div>

          {error && <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm text-center">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Admin Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-600" />
                <input type="email" autoFocus required value={email} onChange={e => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-slate-950/60 border border-slate-700 rounded-2xl text-white placeholder:text-slate-700 focus:outline-none focus:border-violet-500/60 transition-all"
                  placeholder="admin@retinex.local" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Master Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-600" />
                <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-slate-950/60 border border-slate-700 rounded-2xl text-white placeholder:text-slate-700 focus:outline-none focus:border-violet-500/60 transition-all"
                  placeholder="••••••••" />
              </div>
            </div>
            <button type="submit" disabled={isLoading || !email || !password}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-violet-700 to-slate-700 border border-violet-500/30 text-white font-bold text-lg hover:from-violet-600 hover:to-slate-600 transition-all duration-300 disabled:opacity-40 flex items-center justify-center mt-2">
              {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Authenticate'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}