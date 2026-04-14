import React, { useState, useEffect, useCallback } from 'react';
import DoctorWorkflow from './DoctorWorkflow';
import AdminDashboard from './AdminDashboard';
import SchoolDashboard from './SchoolDashboard';
import OfflineBanner from './components/OfflineBanner';
import UpdatePrompt from './components/UpdatePrompt';
import { usePWAInstall } from './hooks/usePWAInstall';
import {
  Activity, Stethoscope, ActivitySquare,
  LogOut, ShieldCheck, Sun, Moon, School,
  HeartPulse, Eye, Ear, Scan, Menu, X, User as UserIcon,
  Mail, KeyRound, ArrowRight, Loader2, Check, AlertCircle, RefreshCw, Settings
} from 'lucide-react';

// --- Types ---
type User = {
  username: string;
  email?: string;
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
  const [needsPasswordSetup, setNeedsPasswordSetup] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'profile'>('dashboard');
  const { canInstall, promptInstall } = usePWAInstall();
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window !== 'undefined') return (localStorage.getItem('theme') as 'dark' | 'light') || 'light';
    return 'light';
  });

  // Restore session on mount
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
    setNeedsPasswordSetup(false);
    setActiveTab('dashboard');
  };

  const handleLogin = (u: User, needsPw: boolean) => {
    setUser(u);
    setNeedsPasswordSetup(needsPw);
  };

  const handlePasswordSet = () => {
    setNeedsPasswordSetup(false);
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-[100px] pointer-events-none"></div>
        
        <div className="relative z-10 flex flex-col items-center space-y-6 animate-in pwa-fade-in duration-700">
          <div className="relative">
            <div className="absolute inset-0 bg-cyan-500 blur-xl opacity-20 animate-pulse rounded-full"></div>
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-[0_0_40px_rgba(34,211,238,0.4)] relative">
              <ActivitySquare className="w-10 h-10 text-white" />
            </div>
          </div>
          
          <div className="flex flex-col items-center space-y-3">
            <h1 className="text-2xl font-bold tracking-tight text-white">AIIMS Bathinda</h1>
            <div className="flex items-center space-x-2 bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-full px-4 py-1.5">
              <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
              <span className="text-slate-400 text-xs font-medium uppercase tracking-wider">Starting Portal</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  // First-time password setup wizard
  if (needsPasswordSetup) {
    return <PasswordSetupWizard userName={user.name} onComplete={handlePasswordSet} />;
  }

  const handleTabSwitch = (tab: 'dashboard' | 'profile') => {
    setActiveTab(tab);
    if (window.innerWidth < 768) setSidebarOpen(false);
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 font-sans selection:bg-cyan-500/30 overflow-hidden">
      <OfflineBanner />
      <UpdatePrompt />
      
      {/* Sidebar Overlay for Mobile */}
      {sidebarOpen && (
        <div 
          className="md:hidden sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      {/* Sidebar */}
      <aside className={`bg-slate-900/95 border-r border-slate-800 backdrop-blur-2xl flex flex-col absolute md:relative z-40 h-full transition-all duration-300 ease-in-out shadow-2xl md:shadow-none overflow-hidden ${
        sidebarOpen ? 'translate-x-0 w-72' : '-translate-x-full w-72 md:translate-x-0 md:w-0 md:border-r-0'
      }`}>
        <div className="w-72 flex flex-col h-full flex-shrink-0">
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
          <button onClick={() => handleTabSwitch('dashboard')}
            className={`w-full px-3 py-3 rounded-xl flex items-center space-x-3 transition-all pwa-no-print ${
              activeTab === 'dashboard'
                ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
            }`}>
            {getRoleIcon(user.role)}
            <span className="font-medium">{formatRoleDisplay(user.role)} Dashboard</span>
          </button>
          <button onClick={() => handleTabSwitch('profile')}
            className={`w-full px-3 py-3 rounded-xl flex items-center space-x-3 transition-all pwa-no-print ${
              activeTab === 'profile'
                ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
            }`}>
            <Settings className="w-5 h-5" />
            <span className="font-medium">Profile Settings</span>
          </button>
        </nav>

        <div className="p-4 border-t border-slate-800/50 space-y-2 pwa-no-print">
          {canInstall && (
            <button onClick={promptInstall}
              className="w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-medium transition-all shadow-lg text-sm mb-4">
              <ArrowRight className="w-4 h-4 rotate-90" />
              <span>Install App</span>
            </button>
          )}
          <button onClick={toggleTheme}
            className="w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-yellow-400 transition-all border border-transparent hover:border-yellow-500/20">
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            <span className="font-medium text-sm">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
          <button onClick={handleLogout}
            className="w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-xl bg-slate-800 hover:bg-red-500/10 text-slate-300 hover:text-red-400 transition-all border border-transparent hover:border-red-500/20">
            <LogOut className="w-4 h-4" />
            <span className="font-medium text-sm">Logout</span>
          </button>
        </div>
        </div>
      </aside>

      {/* Main Content */}
      <main
        className={`relative flex flex-1 flex-col ${
          isSpecialist(user.role) && activeTab === 'dashboard' ? 'min-h-0 overflow-hidden' : 'overflow-y-auto'
        }`}
      >
        {!(isSpecialist(user.role) && activeTab === 'dashboard') && (
          <>
            <div className="pointer-events-none absolute top-1/2 left-1/4 h-96 w-96 rounded-full bg-cyan-500/10 blur-[120px]" />
            <div className="pointer-events-none absolute bottom-0 right-1/4 h-96 w-96 rounded-full bg-blue-600/10 blur-[120px]" />
          </>
        )}

        <div className="relative z-20 flex flex-shrink-0 items-center p-3 pwa-no-print md:p-4">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="rounded-xl border border-slate-700 bg-slate-800/80 p-2.5 text-slate-300 backdrop-blur-xl transition-all hover:border-cyan-500/50 hover:bg-slate-700 hover:text-white"
            title="Toggle Menu"
            type="button"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>

        <div
          className={`relative z-10 flex-1 ${
            isSpecialist(user.role) && activeTab === 'dashboard'
              ? 'flex min-h-0 flex-col overflow-hidden px-0 pb-0'
              : 'px-8 pb-8'
          }`}
        >
          {activeTab === 'profile' ? (
            <ProfileSettings user={user} onBack={() => setActiveTab('dashboard')} />
          ) : (
            <>
              {user.role === 'Admin' && <AdminDashboard user={user} />}
              {user.role === 'School POC' && <SchoolDashboard user={user} />}
              {isSpecialist(user.role) && <DoctorWorkflow user={user} />}
            </>
          )}
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

// ═══════════════════════════════════════════
// ██ UNIFIED LOGIN SCREEN
// ═══════════════════════════════════════════
type LoginStep = 'identify' | 'password' | 'otp_send' | 'otp_verify';

function LoginScreen({ onLogin }: { onLogin: (u: User, needsPw: boolean) => void }) {
  const [step, setStep] = useState<LoginStep>('identify');
  const [identifier, setIdentifier] = useState('');
  const [userName, setUserName] = useState('');
  const [hasPassword, setHasPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);

  const handleIdentify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/identify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim() }),
      });
      const data = await res.json();
      if (!data.found) {
        setError('No account found with this email or username');
        return;
      }
      setUserName(data.name);
      setHasPassword(data.has_password);
      // Always default to OTP login flow
      setStep('otp_send');
    } catch {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim(), password }),
      });
      const data = await res.json();
      if (data.success) {
        onLogin(data.user, false);
      } else {
        setError(data.message || 'Invalid password');
      }
    } catch {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setOtpSent(true);
        setStep('otp_verify');
      } else {
        setError(data.message || 'Failed to send code');
      }
    } catch {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const isOnline = navigator.onLine;

    try {
      if (!isOnline && step === 'otp_send') {
        setError('Login with OTP requires an internet connection.');
        setLoading(false);
        return;
      }

      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim(), otp }),
      });
      const data = await res.json();
      if (data.success) {
        onLogin(data.user, data.needs_password_setup === true);
      } else {
        setError(data.message || 'Invalid code');
      }
    } catch {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => {
    setError('');
    setPassword('');
    setOtp('');
    setOtpSent(false);
    if (step === 'otp_verify') {
      setStep('otp_send');
    } else {
      setStep('identify');
      setUserName('');
    }
  };

  const inputClass = "w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all placeholder-slate-600";
  const btnClass = "w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold py-3.5 rounded-xl shadow-[0_0_20px_rgba(34,211,238,0.3)] transition-all disabled:opacity-50";

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-cyan-500/20 rounded-full blur-[150px] pointer-events-none"></div>

      <div className="relative z-10 w-full max-w-md px-4">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-[0_0_30px_rgba(34,211,238,0.5)] mb-4">
            <ActivitySquare className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">AIIMS Bathinda</h2>
          <p className="text-slate-400 text-sm mt-1">Health Screening Portal</p>
        </div>

        <div className="p-8 bg-slate-900/80 backdrop-blur-2xl border border-slate-800 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.5)]">

          {/* Step: Identify */}
          {step === 'identify' && (
            <form onSubmit={handleIdentify} className="space-y-5 animate-in fade-in duration-300">
              <div className="text-center mb-2">
                <h3 className="text-lg font-semibold text-white">Welcome back</h3>
                <p className="text-slate-400 text-sm mt-1">Enter your email or username to continue</p>
              </div>
              {error && <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-xl text-sm text-center flex items-center justify-center space-x-2"><AlertCircle className="w-4 h-4 flex-shrink-0" /><span>{error}</span></div>}
              <div>
                <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Email or Username</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input type="text" value={identifier} onChange={e => setIdentifier(e.target.value)}
                    className={`${inputClass} pl-10`} placeholder="you@example.com" required autoFocus />
                </div>
              </div>
              <button type="submit" disabled={loading} className={btnClass}>
                {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : <span className="flex items-center justify-center space-x-2"><span>Continue</span><ArrowRight className="w-4 h-4" /></span>}
              </button>
            </form>
          )}

          {/* Step: Password Login */}
          {step === 'password' && (
            <form onSubmit={handlePasswordLogin} className="space-y-5 animate-in fade-in duration-300">
              <button type="button" onClick={goBack} className="text-slate-400 hover:text-cyan-400 text-sm flex items-center space-x-1 transition-colors">
                <ArrowRight className="w-3 h-3 rotate-180" /><span>Back</span>
              </button>
              <div className="text-center">
                <p className="text-slate-400 text-sm">Welcome back,</p>
                <p className="text-lg font-semibold text-white">{userName}</p>
              </div>
              {error && <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-xl text-sm text-center flex items-center justify-center space-x-2"><AlertCircle className="w-4 h-4 flex-shrink-0" /><span>{error}</span></div>}
              <div>
                <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Password</label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                    className={`${inputClass} pl-10`} placeholder="••••••••" required autoFocus />
                </div>
              </div>
              <button type="submit" disabled={loading} className={btnClass}>
                {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Log In'}
              </button>
              <button type="button" onClick={() => { setError(''); setStep('otp_send'); }}
                className="w-full text-center text-sm text-slate-500 hover:text-cyan-400 transition-colors mt-2">
                Use OTP instead →
              </button>
            </form>
          )}

          {/* Step: OTP Send */}
          {step === 'otp_send' && (
            <div className="space-y-5 animate-in fade-in duration-300">
              <button type="button" onClick={goBack} className="text-slate-400 hover:text-cyan-400 text-sm flex items-center space-x-1 transition-colors">
                <ArrowRight className="w-3 h-3 rotate-180" /><span>Back</span>
              </button>
              <div className="text-center">
                {!hasPassword ? (
                  <>
                    <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto mb-3">
                      <Mail className="w-7 h-7 text-emerald-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-white">Welcome, {userName}!</h3>
                    <p className="text-slate-400 text-sm mt-1">Let's verify your email to get started.</p>
                  </>
                ) : (
                  <>
                    <h3 className="text-lg font-semibold text-white">Login with OTP</h3>
                    <p className="text-slate-400 text-sm mt-1">We'll send a 6-digit code to your email.</p>
                  </>
                )}
              </div>
              {error && <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-xl text-sm text-center">{error}</div>}
              <button onClick={handleSendOtp} disabled={loading} className={btnClass}>
                {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : <span className="flex items-center justify-center space-x-2"><Mail className="w-4 h-4" /><span>Send Code</span></span>}
              </button>
              {hasPassword && (
                <button type="button" onClick={() => { setError(''); setStep('password'); }}
                  className="w-full text-center text-sm text-slate-500 hover:text-cyan-400 transition-colors mt-2">
                  Login using password →
                </button>
              )}
            </div>
          )}

          {/* Step: OTP Verify */}
          {step === 'otp_verify' && (
            <form onSubmit={handleVerifyOtp} className="space-y-5 animate-in fade-in duration-300">
              <button type="button" onClick={goBack} className="text-slate-400 hover:text-cyan-400 text-sm flex items-center space-x-1 transition-colors">
                <ArrowRight className="w-3 h-3 rotate-180" /><span>Back</span>
              </button>
              <div className="text-center">
                <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center mx-auto mb-3">
                  <KeyRound className="w-7 h-7 text-cyan-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">Enter Code</h3>
                <p className="text-slate-400 text-sm mt-1">Check your email for a 6-digit code</p>
              </div>
              {error && <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-xl text-sm text-center">{error}</div>}
              <div>
                <input type="text" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className={`${inputClass} text-center text-2xl tracking-[0.5em] font-mono`}
                  placeholder="000000" maxLength={6} required autoFocus />
              </div>
              <button type="submit" disabled={loading || otp.length < 6} className={btnClass}>
                {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Verify & Log In'}
              </button>
              <button type="button" onClick={() => { setOtp(''); handleSendOtp(); }}
                className="w-full text-center text-sm text-slate-500 hover:text-cyan-400 transition-colors flex items-center justify-center space-x-1">
                <RefreshCw className="w-3 h-3" /><span>Resend code</span>
              </button>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// ██ FIRST-TIME PASSWORD SETUP WIZARD
// ═══════════════════════════════════════════
function PasswordSetupWizard({ userName, onComplete }: { userName: string; onComplete: () => void }) {
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const match = pw.length >= 4 && pw === confirm;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!match) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/users/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_password: pw }),
      });
      const data = await res.json();
      if (data.success) {
        onComplete();
      } else {
        setError(data.message || 'Failed to set password');
      }
    } catch {
      setError('Connection error');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all placeholder-slate-600";

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-emerald-500/15 rounded-full blur-[150px] pointer-events-none"></div>
      <div className="relative z-10 w-full max-w-md px-4">
        <div className="p-8 bg-slate-900/80 backdrop-blur-2xl border border-slate-800 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.5)]">
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4">
              <KeyRound className="w-8 h-8 text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold text-white">Welcome, {userName}! 👋</h2>
            <p className="text-slate-400 text-sm mt-2">Create a password to secure your account.</p>
          </div>

          {error && <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-xl text-sm text-center mb-4">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">New Password</label>
              <input type="password" value={pw} onChange={e => setPw(e.target.value)}
                className={inputClass} placeholder="At least 4 characters" required autoFocus />
              {pw.length > 0 && pw.length < 4 && <p className="text-amber-400 text-xs mt-1">Must be at least 4 characters</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Confirm Password</label>
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                className={inputClass} placeholder="Type it again" required />
              {confirm.length > 0 && (
                <div className={`flex items-center space-x-1 mt-1 text-xs ${pw === confirm ? 'text-emerald-400' : 'text-red-400'}`}>
                  {pw === confirm ? <Check className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                  <span>{pw === confirm ? 'Passwords match' : 'Passwords don\'t match'}</span>
                </div>
              )}
            </div>
            <button type="submit" disabled={!match || loading}
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold py-3.5 rounded-xl shadow-lg transition-all disabled:opacity-50 mt-2">
              {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Save & Continue →'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// ██ PROFILE SETTINGS
// ═══════════════════════════════════════════
function ProfileSettings({ user, onBack }: { user: User; onBack: () => void }) {
  // --- Change Display Name ---
  const [newUsername, setNewUsername] = useState(user.username);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [usernameChecking, setUsernameChecking] = useState(false);
  const [usernameMsg, setUsernameMsg] = useState('');
  const [usernameSaving, setUsernameSaving] = useState(false);

  // --- Change Password ---
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwMsg, setPwMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [pwSaving, setPwSaving] = useState(false);

  // Debounced username check
  useEffect(() => {
    if (newUsername === user.username || newUsername.length < 3) {
      setUsernameAvailable(null);
      return;
    }
    setUsernameChecking(true);
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/users/check-username?q=${encodeURIComponent(newUsername)}`);
        const data = await res.json();
        setUsernameAvailable(data.available);
      } catch {
        setUsernameAvailable(null);
      } finally {
        setUsernameChecking(false);
      }
    }, 400);
    return () => clearTimeout(timeout);
  }, [newUsername, user.username]);

  const handleUsernameChange = async () => {
    if (!usernameAvailable || newUsername.length < 3) return;
    setUsernameSaving(true);
    setUsernameMsg('');
    try {
      const res = await fetch('/api/users/profile/display-name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_username: newUsername }),
      });
      const data = await res.json();
      if (data.success) {
        setUsernameMsg('Display name updated! Reload to see changes.');
        user.username = data.username;
      } else {
        setUsernameMsg(data.message || 'Failed');
      }
    } catch {
      setUsernameMsg('Connection error');
    } finally {
      setUsernameSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw !== confirmPw || newPw.length < 4) return;
    setPwSaving(true);
    setPwMsg(null);
    try {
      const res = await fetch('/api/users/profile/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ old_password: oldPw, new_password: newPw }),
      });
      const data = await res.json();
      if (data.success) {
        setPwMsg({ type: 'success', text: 'Password updated successfully!' });
        setOldPw(''); setNewPw(''); setConfirmPw('');
      } else {
        setPwMsg({ type: 'error', text: data.message || 'Failed to update' });
      }
    } catch {
      setPwMsg({ type: 'error', text: 'Connection error' });
    } finally {
      setPwSaving(false);
    }
  };

  const inputClass = "w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white text-sm focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all placeholder-slate-600";
  const pwMatch = newPw.length >= 4 && newPw === confirmPw;

  return (
    <div className="max-w-xl mx-auto space-y-6 animate-in fade-in duration-500">
      <button onClick={onBack}
        className="text-slate-400 hover:text-cyan-400 transition-colors text-sm flex items-center space-x-1 mb-4">
        <ArrowRight className="w-3 h-3 rotate-180" /><span>Back to Dashboard</span>
      </button>
      <h2 className="text-2xl font-bold text-white tracking-tight flex items-center space-x-2">
        <UserIcon className="w-6 h-6 text-violet-400" /><span>Profile Settings</span>
      </h2>

      {/* Email (read-only) */}
      <div className="bg-slate-900/80 backdrop-blur-xl p-5 rounded-2xl border border-slate-800">
        <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Email</label>
        <p className="text-white text-sm bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 opacity-60">{user.email || '(not set)'}</p>
      </div>

      {/* Display Name */}
      <div className="bg-slate-900/80 backdrop-blur-xl p-5 rounded-2xl border border-slate-800 space-y-3">
        <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider">Display Name</label>
        <div className="flex items-center space-x-3">
          <div className="relative flex-1">
            <input type="text" value={newUsername} onChange={e => setNewUsername(e.target.value.replace(/[^a-zA-Z0-9._-]/g, '').toLowerCase())}
              className={inputClass} placeholder="your.display.name" />
            {newUsername !== user.username && newUsername.length >= 3 && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2">
                {usernameChecking ? <Loader2 className="w-4 h-4 text-slate-500 animate-spin" /> :
                  usernameAvailable === true ? <Check className="w-4 h-4 text-emerald-400" /> :
                  usernameAvailable === false ? <AlertCircle className="w-4 h-4 text-red-400" /> : null}
              </span>
            )}
          </div>
          <button onClick={handleUsernameChange} disabled={!usernameAvailable || usernameSaving || newUsername === user.username}
            className="px-4 py-2.5 rounded-xl bg-cyan-500/20 text-cyan-400 font-bold text-sm border border-cyan-500/30 disabled:opacity-30 hover:bg-cyan-500/30 transition-all">
            {usernameSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
          </button>
        </div>
        {usernameAvailable === false && <p className="text-red-400 text-xs">This name is already taken</p>}
        {usernameMsg && <p className="text-emerald-400 text-xs">{usernameMsg}</p>}
      </div>

      {/* Change Password */}
      <div className="bg-slate-900/80 backdrop-blur-xl p-5 rounded-2xl border border-slate-800">
        <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">Change Password</label>
        {pwMsg && (
          <div className={`p-3 rounded-xl text-sm mb-3 border ${pwMsg.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
            {pwMsg.text}
          </div>
        )}
        <form onSubmit={handlePasswordChange} className="space-y-3">
          <input type="password" value={oldPw} onChange={e => setOldPw(e.target.value)}
            className={inputClass} placeholder="Current password" required />
          <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)}
            className={inputClass} placeholder="New password (min 4 chars)" required />
          <div>
            <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)}
              className={inputClass} placeholder="Confirm new password" required />
            {confirmPw.length > 0 && (
              <div className={`flex items-center space-x-1 mt-1 text-xs ${newPw === confirmPw ? 'text-emerald-400' : 'text-red-400'}`}>
                {newPw === confirmPw ? <Check className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                <span>{newPw === confirmPw ? 'Passwords match' : 'Passwords don\'t match'}</span>
              </div>
            )}
          </div>
          <button type="submit" disabled={!pwMatch || pwSaving}
            className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold py-3 rounded-xl shadow-lg disabled:opacity-50 transition-all mt-1">
            {pwSaving ? 'Saving...' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
