import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone, ArrowLeft, Loader2 } from 'lucide-react';
import { useWorkflow } from '../../context/WorkflowContext';
import { backgroundStyle } from '../../lib/roleBackgrounds';

export default function PatientLogin() {
  const navigate = useNavigate();
  const { loginPatient } = useWorkflow();
  const [step, setStep] = useState<1 | 2>(1);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // DEMO: the backend signs a registered phone number in without an OTP
  // (POST /api/auth/patient/login). The OTP screen below is a placeholder
  // step -- any 6 digits continue -- until real OTP delivery exists.
  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phone.length < 10) { setError('Please enter a valid 10-digit number'); return; }

    setError(''); setIsLoading(true);
    try {
      await loginPatient(phone);
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (isNaN(Number(value))) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
    if (value && index === 5 && newOtp.every(v => v)) {
      setIsLoading(true);
      setTimeout(() => { setIsLoading(false); navigate('/patient'); }, 1000);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) otpRefs.current[index - 1]?.focus();
  };

  return (
    <div className="role-bg min-h-screen flex flex-col items-center justify-center p-4" style={backgroundStyle('patient')}>
      <div className="absolute top-1/3 left-1/3 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md z-10">
        <button onClick={() => step === 2 ? setStep(1) : navigate('/login/role-selection')} className="flex items-center text-slate-400 hover:text-white transition-colors mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </button>

        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl shadow-2xl p-8 space-y-6">
          <div className="text-center">
            <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/30 mb-4">
              <Phone className="h-7 w-7 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white">{step === 1 ? 'Patient Login' : 'Verify Your Number'}</h2>
            <p className="mt-2 text-slate-400 text-sm">
              {step === 1 ? 'Enter your registered phone number' : `6-digit code sent to +91 ${phone}`}
            </p>
          </div>

          {error && <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm text-center">{error}</div>}

          {step === 1 && (
            <form onSubmit={handlePhoneSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Phone Number</label>
                <div className="relative flex items-center">
                  <span className="absolute left-4 text-slate-300 font-semibold text-lg z-10">+91</span>
                  <input
                    type="tel" autoFocus maxLength={10} value={phone}
                    onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
                    className="w-full pl-16 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-white text-xl tracking-widest placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/70 focus:bg-white/10 transition-all"
                    placeholder="XXXX XXXXXX"
                  />
                </div>
              </div>
              <button type="submit" disabled={isLoading || phone.length < 10}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-lg shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 hover:scale-[1.02] transition-all duration-300 disabled:opacity-50 flex items-center justify-center">
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Get OTP'}
              </button>
            </form>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="flex justify-center gap-3">
                {otp.map((digit, i) => (
                  <input key={i} ref={el => { otpRefs.current[i] = el; }}
                    autoFocus={i === 0}
                    type="text" maxLength={1} value={digit}
                    onChange={e => handleOtpChange(i, e.target.value)}
                    onKeyDown={e => handleKeyDown(i, e)}
                    className="w-12 h-14 text-center text-2xl font-bold bg-white/5 border-2 border-white/10 rounded-xl text-white focus:outline-none focus:border-cyan-500 focus:bg-white/10 transition-all"
                  />
                ))}
              </div>
              <button onClick={() => { setIsLoading(true); setTimeout(() => navigate('/patient'), 1000); }}
                disabled={isLoading || otp.some(d => !d)}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-lg shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 hover:scale-[1.02] transition-all duration-300 disabled:opacity-50 flex items-center justify-center">
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Verify & Login'}
              </button>
              <p className="text-center text-slate-500 text-sm">Didn't get the code? <button className="text-cyan-400 hover:underline">Resend</button></p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}