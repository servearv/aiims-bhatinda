import React, { useState, useEffect } from 'react';
import DoctorWorkflow from './DoctorWorkflow';
import AdminDashboard from './AdminDashboard';
import SchoolDashboard from './SchoolDashboard';
import {
  Activity, Stethoscope, ActivitySquare,
  LogOut, ShieldCheck, Sun, Moon, School,
  HeartPulse, Eye, Ear, Scan, ChevronLeft, Menu, X
} from 'lucide-react';

// --- Types ---
type User = {
  username: string;
  role: string;
  name: string;
  specialization?: string;
  designation?: string;
};

// Specialist categories
const SPECIALIST_ROLES = [
  'Community_Medicine', 'Dental', 'ENT',
  'Eye_Specialist', 'Skin_Specialist', 'Other',
];

function isSpecialist(role: string) {
  return SPECIALIST_ROLES.includes(role);
}

// --- Main App Component ---
export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [checkingSession, setCheckingSession] = useState(true);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window !== 'undefined') return (localStorage.getItem('theme') as 'dark' | 'light') || 'light';
    return 'light';
  });

  // Restore session on mount (fixes page refresh logout)
  useEffect(() => {
    fetch('/api/session').then(r => r.json()).then(data => {
      if (data.success) setUser(data.user);
    }).catch(() => {}).finally(() => setCheckingSession(false));
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

  const handleLogout = async () => {
    try { await fetch('/api/logout', { method: 'POST' }); } catch {}
    setUser(null);
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-[0_0_30px_rgba(34,211,238,0.5)] animate-pulse">
            <ActivitySquare className="w-6 h-6 text-white" />
          </div>
          <p className="text-slate-400 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen onLogin={setUser} />;
  }

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 font-sans selection:bg-cyan-500/30">
      {/* Sidebar */}
      <aside className={`bg-slate-900/80 border-r border-slate-800 backdrop-blur-xl flex flex-col relative z-20 transition-all duration-300 overflow-hidden ${sidebarOpen ? 'w-72' : 'w-0 border-r-0'}`}>
        <div className="p-6 border-b border-slate-800/50 whitespace-nowrap">
          <div className="flex items-center space-x-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-[0_0_15px_rgba(34,211,238,0.4)] flex-shrink-0">
              <ActivitySquare className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">AIIMS Bathinda</h1>
            </div>
          </div>
        </div>
        
        <div className="p-6 border-b border-slate-800/50 whitespace-nowrap">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">{user.name}</p>
              <p className="text-xs text-slate-400">{formatRoleDisplay(user.role)}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <div className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Navigation</div>
          <div className="px-3 py-3 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center space-x-3">
            {getRoleIcon(user.role)}
            <span className="font-medium">{formatRoleDisplay(user.role)} Dashboard</span>
          </div>
        </nav>

        <div className="p-4 border-t border-slate-800/50 space-y-2">
          <button
            onClick={toggleTheme}
            className="w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-yellow-400 transition-all border border-transparent hover:border-yellow-500/20"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            <span className="font-medium text-sm">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-xl bg-slate-800 hover:bg-red-500/10 text-slate-300 hover:text-red-400 transition-all border border-transparent hover:border-red-500/20"
          >
            <LogOut className="w-4 h-4" />
            <span className="font-medium text-sm">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative flex flex-col">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-[120px] pointer-events-none"></div>
        
        {/* Topbar with Sidebar Toggle */}
        <div className="p-4 flex items-center relative z-20">
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-all backdrop-blur-xl border border-slate-700 hover:border-cyan-500/50"
            title={sidebarOpen ? "Hide Sidebar" : "Show Sidebar"}
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        <div className="px-8 pb-8 flex-1 relative z-10">
          {user.role === 'Admin' && <AdminDashboard user={user} />}
          {user.role === 'School POC' && <SchoolDashboard user={user} />}
          {isSpecialist(user.role) && <DoctorWorkflow user={user} />}
        </div>
      </main>
    </div>
  );
}

function formatRoleDisplay(role: string): string {
  switch (role) {
    case 'Community_Medicine': return 'Community Medicine';
    case 'Eye_Specialist': return 'Ophthalmology';
    case 'Skin_Specialist': return 'Dermatology';
    case 'School POC': return 'School POC';
    default: return role;
  }
}

function getRoleIcon(role: string) {
  switch (role) {
    case 'Admin': return <Activity className="w-5 h-5" />;
    case 'School POC': return <School className="w-5 h-5" />;
    case 'Community_Medicine': return <HeartPulse className="w-5 h-5" />;
    case 'Dental': return <span className="text-lg">🦷</span>;
    case 'ENT': return <Ear className="w-5 h-5" />;
    case 'Eye_Specialist': return <Eye className="w-5 h-5" />;
    case 'Skin_Specialist': return <Scan className="w-5 h-5" />;
    case 'Other': return <Stethoscope className="w-5 h-5" />;
    default: return <Activity className="w-5 h-5" />;
  }
}

// --- Category data for login ---
const CATEGORIES = [
  { key: 'Community_Medicine', label: 'Community Medicine', icon: <HeartPulse className="w-7 h-7" />, color: 'from-rose-500 to-pink-600', ring: 'ring-rose-500/40', border: 'border-rose-500/30', bg: 'bg-rose-500/10', text: 'text-rose-400' },
  { key: 'Dental', label: 'Dental', icon: <span className="text-2xl">🦷</span>, color: 'from-sky-500 to-blue-600', ring: 'ring-sky-500/40', border: 'border-sky-500/30', bg: 'bg-sky-500/10', text: 'text-sky-400' },
  { key: 'ENT', label: 'ENT', icon: <Ear className="w-7 h-7" />, color: 'from-amber-500 to-orange-600', ring: 'ring-amber-500/40', border: 'border-amber-500/30', bg: 'bg-amber-500/10', text: 'text-amber-400' },
  { key: 'Eye_Specialist', label: 'Ophthalmology', icon: <Eye className="w-7 h-7" />, color: 'from-emerald-500 to-teal-600', ring: 'ring-emerald-500/40', border: 'border-emerald-500/30', bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
  { key: 'Skin_Specialist', label: 'Dermatology', icon: <Scan className="w-7 h-7" />, color: 'from-violet-500 to-purple-600', ring: 'ring-violet-500/40', border: 'border-violet-500/30', bg: 'bg-violet-500/10', text: 'text-violet-400' },
  { key: 'Other', label: 'Other', icon: <Stethoscope className="w-7 h-7" />, color: 'from-slate-500 to-zinc-600', ring: 'ring-slate-500/40', border: 'border-slate-500/30', bg: 'bg-slate-500/10', text: 'text-slate-400' },
];

// --- Multi-Step Login Screen ---
function LoginScreen({ onLogin }: { onLogin: (u: User) => void }) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRoleSelect = (role: string) => {
    setSelectedRole(role);
    setError('');
    if (role === 'Doctor') {
      setStep(2);
    } else {
      setSelectedCategory('');
      setStep(3);
    }
  };

  const handleCategorySelect = (cat: string) => {
    setSelectedCategory(cat);
    setError('');
    setStep(3);
  };

  const goBack = () => {
    setError('');
    if (step === 3 && selectedRole === 'Doctor') {
      setStep(2);
      setSelectedCategory('');
    } else {
      setStep(1);
      setSelectedRole('');
      setSelectedCategory('');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username, password,
          selectedRole,
          selectedCategory,
        }),
      });
      const data = await res.json();
      if (data.success) {
        onLogin(data.user);
      } else {
        setError(data.message);
      }
    } catch {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const catMeta = CATEGORIES.find(c => c.key === selectedCategory);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center relative overflow-hidden">
      {/* Futuristic Background */}
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-cyan-500/20 rounded-full blur-[150px] pointer-events-none"></div>

      <div className="relative z-10 w-full max-w-lg px-4">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-[0_0_30px_rgba(34,211,238,0.5)] mb-4">
            <ActivitySquare className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">AIIMS Bathinda</h2>
        </div>

        {/* Step 1: Role Selection */}
        {step === 1 && (
          <div className="animate-in fade-in duration-500 space-y-4">
            <p className="text-center text-slate-400 text-sm mb-6">Select your role to continue</p>
            <div className="grid grid-cols-3 gap-4">
              {[
                { key: 'Admin', label: 'Admin', icon: <ShieldCheck className="w-8 h-8" />, desc: 'System management', color: 'from-cyan-500 to-blue-600', glow: 'rgba(34,211,238,0.3)' },
                { key: 'School', label: 'School', icon: <School className="w-8 h-8" />, desc: 'School PoC', color: 'from-violet-500 to-purple-600', glow: 'rgba(139,92,246,0.3)' },
                { key: 'Doctor', label: 'Doctor', icon: <Stethoscope className="w-8 h-8" />, desc: 'Medical specialist', color: 'from-emerald-500 to-teal-600', glow: 'rgba(16,185,129,0.3)' },
              ].map(r => (
                <button key={r.key} onClick={() => handleRoleSelect(r.key)}
                  className="group flex flex-col items-center p-6 bg-slate-900/80 backdrop-blur-2xl border border-slate-800 rounded-3xl hover:border-cyan-500/40 transition-all duration-300 hover:shadow-[0_0_30px_rgba(34,211,238,0.15)] hover:-translate-y-1">
                  <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${r.color} flex items-center justify-center text-white mb-3 shadow-[0_0_20px_${r.glow}] group-hover:scale-110 transition-transform`}>
                    {r.icon}
                  </div>
                  <h3 className="text-white font-bold text-sm">{r.label}</h3>
                  <p className="text-slate-500 text-xs mt-1">{r.desc}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Specialist Category Selection */}
        {step === 2 && (
          <div className="animate-in fade-in duration-500">
            <button onClick={goBack} className="flex items-center space-x-1.5 text-slate-400 hover:text-cyan-400 transition-colors text-sm mb-5">
              <ChevronLeft className="w-4 h-4" /><span>Back to roles</span>
            </button>
            <p className="text-center text-slate-400 text-sm mb-6">Select your specialization</p>
            <div className="grid grid-cols-3 gap-3">
              {CATEGORIES.map(cat => (
                <button key={cat.key} onClick={() => handleCategorySelect(cat.key)}
                  className={`group flex flex-col items-center p-5 bg-slate-900/80 backdrop-blur-2xl border border-slate-800 rounded-2xl hover:${cat.border} transition-all duration-300 hover:-translate-y-1 hover:shadow-lg`}>
                  <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${cat.color} flex items-center justify-center text-white mb-2.5 group-hover:scale-110 transition-transform`}>
                    {cat.icon}
                  </div>
                  <h3 className="text-white font-semibold text-xs text-center leading-tight">{cat.label}</h3>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Credentials */}
        {step === 3 && (
          <div className="animate-in fade-in duration-500">
            <button onClick={goBack} className="flex items-center space-x-1.5 text-slate-400 hover:text-cyan-400 transition-colors text-sm mb-5">
              <ChevronLeft className="w-4 h-4" /><span>Back</span>
            </button>

            <div className="p-8 bg-slate-900/80 backdrop-blur-2xl border border-slate-800 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.5)]">
              {/* Category/role chip */}
              <div className="flex justify-center mb-6">
                {selectedRole === 'Doctor' && catMeta ? (
                  <span className={`inline-flex items-center space-x-2 px-4 py-2 rounded-xl ${catMeta.bg} ${catMeta.text} border ${catMeta.border} font-semibold text-sm`}>
                    {catMeta.icon}
                    <span>{catMeta.label}</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-semibold text-sm">
                    {selectedRole === 'Admin' ? <ShieldCheck className="w-5 h-5" /> : <School className="w-5 h-5" />}
                    <span>{selectedRole === 'Admin' ? 'Admin' : 'School PoC'}</span>
                  </span>
                )}
              </div>

              <form onSubmit={handleLogin} className="space-y-5">
                {error && (
                  <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-xl text-sm text-center">
                    {error}
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Username</label>
                  <input 
                    type="text" 
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all placeholder-slate-600"
                    placeholder="e.g. admin, doctor"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Password</label>
                  <input 
                    type="password" 
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all placeholder-slate-600"
                    placeholder="••••••••"
                    required
                  />
                </div>
                <button 
                  type="submit" 
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold py-3.5 rounded-xl shadow-[0_0_20px_rgba(34,211,238,0.3)] transition-all disabled:opacity-50 mt-4"
                >
                  {loading ? 'Logging in...' : 'Login'}
                </button>
              </form>
              

            </div>
          </div>
        )}
      </div>
    </div>
  );
}
