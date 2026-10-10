import { useNavigate } from 'react-router-dom';
import { User, Stethoscope, Cpu, ArrowRight } from 'lucide-react';
import { backgroundStyle } from '../../lib/roleBackgrounds';

export default function RoleSelection() {
  const navigate = useNavigate();
  const roles = [
    {
      label: 'I am a Patient',
      sub: 'Access your reports and eye scans',
      icon: User,
      color: 'from-cyan-500 to-blue-600',
      glow: 'hover:shadow-cyan-500/30',
      border: 'hover:border-cyan-500/50',
      route: '/login/patient',
    },
    {
      label: 'I am a Doctor',
      sub: 'Review scans and AI heatmaps',
      icon: Stethoscope,
      color: 'from-emerald-500 to-teal-600',
      glow: 'hover:shadow-emerald-500/30',
      border: 'hover:border-emerald-500/50',
      route: '/login/doctor',
    },
    {
      label: 'I am a Technician',
      sub: 'Register patients and upload images',
      icon: Cpu,
      color: 'from-violet-500 to-indigo-600',
      glow: 'hover:shadow-violet-500/30',
      border: 'hover:border-violet-500/50',
      route: '/login/technician',
    },
  ];

  return (
    <div className="role-bg min-h-screen flex flex-col items-center justify-center p-4" style={backgroundStyle('login')}>
      {/* Ambient blobs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md z-10">
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl shadow-2xl p-8 space-y-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-white tracking-tight">Retinex</h1>
            <p className="mt-2 text-slate-400 text-sm">Select your role to continue</p>
          </div>

          <div className="space-y-3">
            {roles.map((role) => {
              const Icon = role.icon;
              return (
                <button
                  key={role.route}
                  onClick={() => navigate(role.route)}
                  className={`w-full group flex items-center p-5 rounded-2xl border border-white/10 bg-white/5 ${role.border} ${role.glow} hover:bg-white/10 hover:shadow-xl transition-all duration-300 text-left`}
                >
                  <div className={`h-11 w-11 rounded-xl bg-gradient-to-br ${role.color} flex items-center justify-center flex-shrink-0 shadow-lg`}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <div className="ml-4 flex-1 min-w-0">
                    <p className="text-white font-semibold">{role.label}</p>
                    <p className="text-slate-400 text-sm mt-0.5">{role.sub}</p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-slate-500 group-hover:text-white group-hover:translate-x-1 transition-all duration-300 flex-shrink-0" />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}