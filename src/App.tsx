import React, { useState, useEffect } from 'react';
import { 
  Activity, Users, FileSpreadsheet, Stethoscope, UserCircle, 
  Database as DbIcon, Search, Upload, Save, AlertTriangle,
  LogOut, ShieldCheck, Download, FileText, Pill, HeartPulse,
  Eye, Droplet, ActivitySquare, Calendar, CheckCircle
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, AreaChart, Area
} from 'recharts';
import Papa from 'papaparse';
import { QRCodeSVG } from 'qrcode.react';
import jsPDF from 'jspdf';

// --- Types ---
type User = { username: string, role: string, name: string };

// --- Main App Component ---
export default function App() {
  const [user, setUser] = useState<User | null>(null);

  if (!user) {
    return <LoginScreen onLogin={setUser} />;
  }

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 font-sans selection:bg-cyan-500/30">
      {/* Sidebar */}
      <aside className="w-72 bg-slate-900/80 border-r border-slate-800 backdrop-blur-xl flex flex-col relative z-20">
        <div className="p-6 border-b border-slate-800/50">
          <div className="flex items-center space-x-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-[0_0_15px_rgba(34,211,238,0.4)]">
              <ActivitySquare className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">AIIMS Bathinda</h1>
              <p className="text-cyan-400 text-xs font-medium tracking-wider uppercase">Enterprise Portal</p>
            </div>
          </div>
        </div>
        
        <div className="p-6 border-b border-slate-800/50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">{user.name}</p>
              <p className="text-xs text-slate-400">{user.role}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <div className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Navigation</div>
          <div className="px-3 py-3 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center space-x-3">
            {getRoleIcon(user.role)}
            <span className="font-medium">{user.role} Dashboard</span>
          </div>
        </nav>

        <div className="p-4 border-t border-slate-800/50">
          <button 
            onClick={() => setUser(null)}
            className="w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-xl bg-slate-800 hover:bg-red-500/10 text-slate-300 hover:text-red-400 transition-all border border-transparent hover:border-red-500/20"
          >
            <LogOut className="w-4 h-4" />
            <span className="font-medium text-sm">Secure Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative">
        {/* Background glow effects */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-[120px] pointer-events-none"></div>
        
        <div className="p-8 relative z-10">
          {user.role === 'Super Admin' && <SuperAdminView />}
          {user.role === 'Camp Admin' && <CampAdminView user={user} />}
          {user.role === 'School PoC' && <SchoolPoCView user={user} />}
          {user.role === 'Medical Staff' && <MedicalStaffView user={user} />}
          {user.role === 'Parent' && <ParentView />}
        </div>
      </main>
    </div>
  );
}

function getRoleIcon(role: string) {
  switch (role) {
    case 'Super Admin': return <Activity className="w-5 h-5" />;
    case 'Camp Admin': return <Users className="w-5 h-5" />;
    case 'School PoC': return <FileSpreadsheet className="w-5 h-5" />;
    case 'Medical Staff': return <Stethoscope className="w-5 h-5" />;
    case 'Parent': return <UserCircle className="w-5 h-5" />;
    default: return <Activity className="w-5 h-5" />;
  }
}

// --- Login Screen ---
function LoginScreen({ onLogin }: { onLogin: (u: User) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (data.success) {
        onLogin(data.user);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center relative overflow-hidden">
      {/* Futuristic Background */}
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-cyan-500/20 rounded-full blur-[150px] pointer-events-none"></div>

      <div className="w-full max-w-md p-8 bg-slate-900/80 backdrop-blur-2xl border border-slate-800 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.5)] relative z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-[0_0_30px_rgba(34,211,238,0.5)] mb-4">
            <ActivitySquare className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">AIIMS Bathinda</h2>
          <p className="text-cyan-400 text-sm font-medium tracking-widest uppercase mt-1">Enterprise Gateway</p>
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
              placeholder="e.g. admin, doctor, school"
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
            {loading ? 'Authenticating...' : 'Secure Login'}
          </button>
        </form>
        
        <div className="mt-8 pt-6 border-t border-slate-800/50 text-center">
          <p className="text-xs text-slate-500">Demo Accounts: admin/admin, doctor/doc, school/school, coord/coord, parent/parent</p>
        </div>
      </div>
    </div>
  );
}

// --- Views ---

function SuperAdminView() {
  const [metrics, setMetrics] = useState({ students: 0, camps: 0, referrals: 0 });
  const [heatmapData, setHeatmapData] = useState([]);
  const [logs, setLogs] = useState([]);
  const [showLogs, setShowLogs] = useState(false);

  useEffect(() => {
    fetch('/api/admin/metrics').then(r => r.json()).then(setMetrics);
    fetch('/api/admin/heatmap').then(r => r.json()).then(setHeatmapData);
  }, []);

  const fetchLogs = () => {
    if (!showLogs) {
      fetch('/api/admin/audit-logs').then(r => r.json()).then(setLogs);
    }
    setShowLogs(!showLogs);
  };

  const exportCSV = () => {
    const csvContent = "data:text/csv;charset=utf-8,District,Camps Organised\n" 
      + heatmapData.map((d: any) => `${d.district},${d.camp_count}`).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "state_health_report.csv");
    document.body.appendChild(link);
    link.click();
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight">The Analytics Hub 📊</h2>
          <p className="text-slate-400 mt-1">Real-time state health overview and predictive insights.</p>
        </div>
        <div className="flex space-x-4">
          <button 
            onClick={async () => {
              try {
                const res = await fetch('/api/digitise/launch', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ user_id: 'admin' })
                });
                const data = await res.json();
                if (data.success) {
                  window.open(data.url, '_blank');
                } else {
                  alert('Failed to launch MedDigitizer');
                }
              } catch (err) {
                alert('Error connecting to server');
              }
            }}
            className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white px-4 py-2.5 rounded-xl transition-colors text-sm font-medium"
          >
            <FileText className="w-4 h-4" />
            <span>Digitise Old Forms</span>
          </button>
          <button onClick={exportCSV} className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white px-4 py-2.5 rounded-xl transition-colors text-sm font-medium">
            <Download className="w-4 h-4" />
            <span>Export State Report</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <GlowingMetric title="Total Screened" value={metrics.students} delta="+12% this month" color="cyan" />
        <GlowingMetric title="Camps Conducted" value={metrics.camps} delta="+3 this week" color="blue" />
        <GlowingMetric title="Critical Referrals" value={metrics.referrals} delta="-5% this month" color="emerald" />
        <GlowingMetric title="Active Doctors" value={12} delta="Online now" color="indigo" />
      </div>

      <div className="bg-slate-900/80 backdrop-blur-xl p-6 rounded-3xl border border-slate-800 shadow-xl">
        <h3 className="text-lg font-semibold mb-6 text-white flex items-center">
          <Activity className="w-5 h-5 mr-2 text-cyan-400" />
          Camps Organised by Region
        </h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={heatmapData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1E293B" />
              <XAxis dataKey="district" axisLine={false} tickLine={false} stroke="#94A3B8" />
              <YAxis axisLine={false} tickLine={false} stroke="#94A3B8" />
              <Tooltip 
                cursor={{fill: '#1E293B'}} 
                contentStyle={{backgroundColor: '#0F172A', borderColor: '#1E293B', borderRadius: '12px', color: '#fff'}} 
              />
              <Bar dataKey="camp_count" name="Camps Organised" fill="url(#colorCyan)" radius={[6, 6, 0, 0]} />
              <defs>
                <linearGradient id="colorCyan" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={1}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.8}/>
                </linearGradient>
              </defs>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Audit Logs Expander */}
      <div className="bg-slate-900/80 backdrop-blur-xl rounded-3xl border border-slate-800 shadow-xl overflow-hidden">
        <button 
          onClick={fetchLogs}
          className="w-full px-6 py-4 flex justify-between items-center hover:bg-slate-800/50 transition-colors"
        >
          <div className="flex items-center space-x-3">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <h3 className="text-lg font-semibold text-white">Live Audit Logs (Data Integrity)</h3>
          </div>
          <span className="text-slate-400 text-sm">{showLogs ? 'Collapse' : 'Expand'}</span>
        </button>
        
        {showLogs && (
          <div className="p-6 border-t border-slate-800">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm font-mono">
                <thead className="text-slate-500 border-b border-slate-800">
                  <tr>
                    <th className="pb-3 pr-4 font-medium">Timestamp</th>
                    <th className="pb-3 pr-4 font-medium">User ID</th>
                    <th className="pb-3 pr-4 font-medium">Action</th>
                    <th className="pb-3 font-medium">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {logs.map((log: any) => (
                    <tr key={log.log_id} className="hover:bg-slate-800/30">
                      <td className="py-3 pr-4 text-slate-400">{new Date(log.timestamp).toLocaleString()}</td>
                      <td className="py-3 pr-4 text-cyan-400">{log.user_id}</td>
                      <td className="py-3 pr-4 text-emerald-400">{log.action}</td>
                      <td className="py-3 text-slate-300">{log.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function GlowingMetric({ title, value, delta, color }: { title: string, value: number, delta: string, color: string }) {
  const colors: Record<string, string> = {
    cyan: 'text-cyan-400 drop-shadow-[0_0_10px_rgba(34,211,238,0.8)]',
    blue: 'text-blue-400 drop-shadow-[0_0_10px_rgba(96,165,250,0.8)]',
    emerald: 'text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.8)]',
    indigo: 'text-indigo-400 drop-shadow-[0_0_10px_rgba(129,140,248,0.8)]',
  };

  return (
    <div className="bg-slate-900/80 backdrop-blur-xl p-6 rounded-3xl border border-slate-800 shadow-xl relative overflow-hidden group hover:border-slate-700 transition-all">
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-3xl -mr-10 -mt-10 group-hover:bg-white/10 transition-all"></div>
      <h3 className="text-sm font-medium text-slate-400 mb-2 uppercase tracking-wider">{title}</h3>
      <p className={`text-4xl font-bold mb-2 ${colors[color]}`}>{value.toLocaleString()}</p>
      <p className="text-xs font-medium text-slate-500">{delta}</p>
    </div>
  );
}

function CampAdminView({ user }: { user: User }) {
  const [schools, setSchools] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [selectedSchool, setSelectedSchool] = useState('');
  const [date, setDate] = useState('');
  const [pendingRequests, setPendingRequests] = useState([]);
  const [doctorInput, setDoctorInput] = useState<Record<number, string>>({});

  const fetchPending = () => {
    fetch('/api/camps/pending').then(r => r.json()).then(setPendingRequests);
  };

  useEffect(() => {
    fetch('/api/schools').then(r => r.json()).then(data => {
      setSchools(data);
      if (data.length > 0) setSelectedSchool(data[0].school_id.toString());
    });
    fetch('/api/inventory').then(r => r.json()).then(setInventory);
    fetchPending();
  }, []);

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch('/api/camps', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ school_id: parseInt(selectedSchool), date, assigned_doctors: 'Dr. Verma', user_id: user.username })
    });
    alert('Camp Scheduled Successfully!');
  };

  const handleApprove = async (campId: number) => {
    const doc = doctorInput[campId] || 'Dr. Verma';
    await fetch(`/api/camps/${campId}/approve`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assigned_doctors: doc, user_id: user.username })
    });
    alert('Camp Approved & Scheduled!');
    fetchPending();
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 max-w-6xl mx-auto">
      <div>
        <h2 className="text-3xl font-bold text-white tracking-tight">Logistics & Coordination 🚐</h2>
        <p className="text-slate-400 mt-1">Manage "Sehat Saathi" van deployments and inventory.</p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-slate-900/80 backdrop-blur-xl p-8 rounded-3xl border border-slate-800 shadow-xl">
          <h3 className="text-xl font-semibold mb-6 text-white flex items-center">
            <Users className="w-5 h-5 mr-3 text-cyan-400" />
            Camp Creator
          </h3>
          <form onSubmit={handleSchedule} className="space-y-5">
            <div>
              <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Select School</label>
              <select 
                value={selectedSchool} 
                onChange={e => setSelectedSchool(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500"
                required
              >
                {schools.map((s: any) => (
                  <option key={s.school_id} value={s.school_id}>{s.name} ({s.district})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Camp Date</label>
              <input 
                type="date" 
                value={date} 
                onChange={e => setDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500"
                required
              />
            </div>
            <button type="submit" className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold py-3.5 rounded-xl shadow-[0_0_20px_rgba(34,211,238,0.3)] transition-all mt-4">
              Deploy Sehat Saathi Van
            </button>
          </form>
        </div>

        <div className="bg-slate-900/80 backdrop-blur-xl p-8 rounded-3xl border border-slate-800 shadow-xl">
          <h3 className="text-xl font-semibold mb-6 text-white flex items-center">
            <Pill className="w-5 h-5 mr-3 text-emerald-400" />
            Inventory Tracker
          </h3>
          <div className="space-y-6">
            {inventory.map((item: any) => {
              const percentage = Math.round((item.stock_count / (item.stock_count + item.camp_allocated)) * 100);
              const isLow = percentage < 20;
              return (
                <div key={item.item_id}>
                  <div className="flex justify-between items-end mb-2">
                    <span className="text-sm font-medium text-slate-300">{item.item_name}</span>
                    <span className={`text-xs font-bold ${isLow ? 'text-red-400' : 'text-emerald-400'}`}>
                      {item.stock_count} units ({percentage}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-950 rounded-full h-3 border border-slate-800 overflow-hidden">
                    <div 
                      className={`h-3 rounded-full ${isLow ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]' : 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]'}`} 
                      style={{width: `${percentage}%`}}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Pending Requests Section */}
      <div className="bg-slate-900/80 backdrop-blur-xl p-8 rounded-3xl border border-slate-800 shadow-xl mt-8">
        <h3 className="text-xl font-semibold mb-6 text-white flex items-center">
          <CheckCircle className="w-5 h-5 mr-3 text-emerald-400" />
          Pending Camp Requests
        </h3>
        {pendingRequests.length === 0 ? (
          <p className="text-slate-500 text-sm">No pending requests at the moment.</p>
        ) : (
          <div className="space-y-4">
            {pendingRequests.map((req: any) => (
              <div key={req.camp_id} className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <p className="font-bold text-white">{req.school_name}</p>
                  <p className="text-xs text-slate-400">District: {req.district} • Requested Date: {req.date}</p>
                </div>
                <div className="flex items-center space-x-3">
                  <input 
                    type="text" 
                    placeholder="Assign Doctor(s)"
                    value={doctorInput[req.camp_id] || ''}
                    onChange={e => setDoctorInput({...doctorInput, [req.camp_id]: e.target.value})}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-emerald-500 outline-none w-48"
                  />
                  <button 
                    onClick={() => handleApprove(req.camp_id)}
                    className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/50 px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap"
                  >
                    Approve & Schedule
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SchoolPoCView({ user }: { user: User }) {
  const [data, setData] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [campDate, setCampDate] = useState('');
  const [requesting, setRequesting] = useState(false);

  const handleCampRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setRequesting(true);
    try {
      await fetch('/api/camps/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ school_id: 1, date: campDate, user_id: user.username })
      });
      alert('Camp requested successfully! Waiting for AIIMS approval.');
      setCampDate('');
    } catch (err) {
      alert('Error requesting camp');
    } finally {
      setRequesting(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => setData(results.data)
    });
  };

  const handleSubmit = async () => {
    if (data.length === 0) return;
    setUploading(true);
    
    const formattedData = data.map(row => ({
      name: row['Name'],
      age: parseInt(row['Age']),
      gender: row['Gender']
    }));

    try {
      await fetch('/api/students/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ students: formattedData, user_id: user.username })
      });
      alert('Roster uploaded successfully! QR Codes generated.');
      // Keep data to show QR codes
    } catch (err) {
      alert('Error uploading data');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 max-w-5xl mx-auto">
      <div>
        <h2 className="text-3xl font-bold text-white tracking-tight">Student Registry Management 🏫</h2>
        <p className="text-slate-400 mt-1">Request health camps and register students for upcoming checkups.</p>
      </div>

      {/* Request Camp Section */}
      <div className="bg-slate-900/80 backdrop-blur-xl p-8 rounded-3xl border border-slate-800 shadow-xl">
        <h3 className="text-xl font-semibold mb-6 text-white flex items-center">
          <Calendar className="w-5 h-5 mr-3 text-cyan-400" />
          Request Health Camp
        </h3>
        <form onSubmit={handleCampRequest} className="flex flex-col md:flex-row items-end gap-4">
          <div className="flex-1 w-full">
            <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Preferred Date</label>
            <input 
              type="date" 
              value={campDate}
              onChange={e => setCampDate(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500"
              required
            />
          </div>
          <button 
            type="submit" 
            disabled={requesting}
            className="w-full md:w-auto bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold px-8 py-3.5 rounded-xl shadow-[0_0_20px_rgba(34,211,238,0.3)] transition-all disabled:opacity-50"
          >
            {requesting ? 'Submitting...' : 'Submit Request'}
          </button>
        </form>
      </div>
      
      <div className="bg-slate-900/80 backdrop-blur-xl p-8 rounded-3xl border border-slate-800 shadow-xl text-center border-dashed border-2 hover:border-cyan-500/50 transition-all">
        <Upload className="w-16 h-16 text-cyan-500/50 mx-auto mb-6 drop-shadow-[0_0_15px_rgba(34,211,238,0.3)]" />
        <label className="cursor-pointer bg-slate-800 hover:bg-slate-700 text-white px-6 py-3 rounded-xl font-medium transition-colors inline-block border border-slate-700">
          Upload CSV
          <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
        </label>
        <p className="text-sm text-slate-400 mt-4 max-w-lg mx-auto leading-relaxed">
          Please upload a CSV file containing basic student details to register them in the system. 
          This allows us to generate their Smart Health IDs before the camp begins.
        </p>
        <p className="text-xs text-slate-500 mt-2">Required columns: Name, Age, Gender</p>
      </div>

      {data.length > 0 && (
        <div className="bg-slate-900/80 backdrop-blur-xl p-8 rounded-3xl border border-slate-800 shadow-xl">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-semibold text-white">Smart ID Roster Preview</h3>
            <button 
              onClick={handleSubmit}
              disabled={uploading}
              className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white px-6 py-2.5 rounded-xl font-bold transition-all disabled:opacity-50 shadow-[0_0_15px_rgba(16,185,129,0.4)]"
            >
              {uploading ? 'Processing...' : 'Generate Batch IDs'}
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.slice(0, 12).map((row, i) => (
              <div key={i} className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex items-center space-x-4">
                <div className="bg-white p-1 rounded-lg">
                  <QRCodeSVG value={`STUDENT-${row.Name}-${i}`} size={64} />
                </div>
                <div>
                  <p className="font-bold text-white">{row.Name}</p>
                  <p className="text-xs text-slate-400">Age: {row.Age} • {row.Gender}</p>
                  <p className="text-[10px] text-cyan-500 mt-1 font-mono">ID: STU-{1000+i}</p>
                </div>
              </div>
            ))}
          </div>
          {data.length > 12 && <p className="text-center text-sm text-slate-500 mt-6">Showing first 12 records...</p>}
        </div>
      )}
    </div>
  );
}

function MedicalStaffView({ user }: { user: User }) {
  const [selectedCamp, setSelectedCamp] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('vitals');
  
  // AI Risk State
  const [aiAlert, setAiAlert] = useState<string | null>(null);

  const mockCamps = [
    { id: 1, name: 'Camp 1 - Govt High School', date: '2026-04-10', students: 500, district: 'Bathinda' },
    { id: 2, name: 'Camp 2 - City Public School', date: '2026-04-15', students: 350, district: 'Mansa' },
    { id: 3, name: 'Camp 3 - Rural Outreach Prep', date: '2026-04-20', students: 200, district: 'Muktsar' }
  ];

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery) return;
    const res = await fetch(`/api/students/search?query=${searchQuery}`);
    setSearchResults(await res.json());
  };

  const selectStudent = (student: any) => {
    setSelectedStudent(student);
    setSearchResults([]);
    setSearchQuery('');
    setAiAlert(null);
  };

  const generateReferralPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(22);
    doc.text('AIIMS Bathinda - Clinical Referral Slip', 20, 20);
    doc.setFontSize(14);
    doc.text(`Student Name: ${selectedStudent.name}`, 20, 40);
    doc.text(`Student ID: ${selectedStudent.student_id}`, 20, 50);
    doc.text(`Age: ${selectedStudent.age} | Gender: ${selectedStudent.gender}`, 20, 60);
    
    doc.setFontSize(16);
    doc.setTextColor(220, 38, 38); // Red
    doc.text('CRITICAL FLAGS:', 20, 80);
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(aiAlert || 'General Referral', 20, 90, { maxWidth: 170 });
    
    doc.text(`Referred by: ${user.name}`, 20, 120);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, 130);
    
    doc.save(`Referral_${selectedStudent.name}.pdf`);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-700 max-w-5xl mx-auto">
      <div>
        <h2 className="text-3xl font-bold text-white tracking-tight">Clinical Examination Portal 🩺</h2>
        <p className="text-slate-400 mt-1">Select an active camp and enter patient findings to generate health risk assessments.</p>
      </div>

      {!selectedCamp ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          {mockCamps.map(camp => (
            <div 
              key={camp.id} 
              onClick={() => setSelectedCamp(camp)} 
              className="cursor-pointer bg-slate-900/80 backdrop-blur-xl p-6 rounded-3xl border border-slate-800 shadow-xl hover:border-cyan-500/50 hover:shadow-[0_0_30px_rgba(34,211,238,0.15)] transition-all group"
            >
              <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center mb-4 group-hover:bg-cyan-500/20 transition-colors">
                <ActivitySquare className="w-6 h-6 text-cyan-400" />
              </div>
              <h3 className="text-xl font-bold text-white group-hover:text-cyan-400 transition-colors">{camp.name}</h3>
              <p className="text-slate-400 text-sm mt-2">Date: {camp.date}</p>
              <p className="text-slate-400 text-sm">District: {camp.district}</p>
              <div className="mt-4 inline-block bg-slate-950 px-3 py-1 rounded-lg border border-slate-800 text-cyan-400 text-sm font-medium">
                {camp.students} Students
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-6 animate-in slide-in-from-bottom-4">
          {/* Camp Context Header */}
          <div className="flex items-center justify-between bg-gradient-to-r from-cyan-900/20 to-blue-900/20 p-6 rounded-3xl border border-cyan-500/20">
            <div>
              <h3 className="text-2xl font-bold text-white">{selectedCamp.name}</h3>
              <p className="text-cyan-400 mt-1">{selectedCamp.students} Registered Students • {selectedCamp.district}</p>
            </div>
            <button 
              onClick={() => { setSelectedCamp(null); setSelectedStudent(null); setSearchResults([]); setSearchQuery(''); }} 
              className="bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-xl text-sm font-medium transition-colors border border-slate-700 text-white"
            >
              Change Camp
            </button>
          </div>

          {/* Search */}
          <div className="bg-slate-900/80 backdrop-blur-xl p-6 rounded-3xl border border-slate-800 shadow-xl">
            <form onSubmit={handleSearch} className="flex space-x-4">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-cyan-500 w-5 h-5" />
                <input 
                  type="text" 
                  placeholder="Scan QR or Search by Name/ID..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 rounded-2xl bg-slate-950 border border-slate-800 text-white focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 outline-none transition-all text-lg"
                />
              </div>
              <button type="submit" className="bg-slate-800 hover:bg-slate-700 text-white px-8 py-4 rounded-2xl font-bold transition-colors border border-slate-700">
                Search
              </button>
            </form>

            {searchResults.length > 0 && (
              <div className="mt-4 space-y-2">
                {searchResults.map((s: any) => (
                  <button 
                    key={s.student_id}
                    onClick={() => selectStudent(s)}
                    className="w-full text-left px-6 py-4 rounded-2xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/50 transition-all flex justify-between items-center group"
                  >
                    <div>
                      <span className="font-bold text-white text-lg">{s.name}</span>
                      <span className="text-cyan-500 text-sm ml-3 font-mono">ID: {s.student_id}</span>
                    </div>
                    <span className="text-sm text-slate-400 group-hover:text-white transition-colors">Select Patient →</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedStudent && (
        <div className="bg-slate-900/80 backdrop-blur-xl rounded-3xl border border-slate-800 shadow-xl overflow-hidden">
          {/* Patient Header */}
          <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-8 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <div className="bg-white p-2 rounded-xl">
                <QRCodeSVG value={`STUDENT-${selectedStudent.student_id}`} size={80} />
              </div>
              <div>
                <h3 className="text-3xl font-bold text-white mb-1">{selectedStudent.name}</h3>
                <div className="flex space-x-4 text-sm font-medium text-slate-400">
                  <span className="bg-slate-950 px-3 py-1 rounded-lg border border-slate-800">Age: {selectedStudent.age}</span>
                  <span className="bg-slate-950 px-3 py-1 rounded-lg border border-slate-800">Gender: {selectedStudent.gender}</span>
                  <span className="bg-slate-950 px-3 py-1 rounded-lg border border-slate-800 text-cyan-400">ID: {selectedStudent.student_id}</span>
                </div>
              </div>
            </div>
            {aiAlert && (
              <button onClick={generateReferralPDF} className="bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 text-red-400 px-6 py-3 rounded-xl font-bold flex items-center space-x-2 transition-all shadow-[0_0_20px_rgba(239,68,68,0.2)]">
                <FileText className="w-5 h-5" />
                <span>Generate AIIMS Referral Slip</span>
              </button>
            )}
          </div>

          {/* Alert Box */}
          {aiAlert && (
            <div className="m-6 bg-red-500/10 border border-red-500/50 p-6 rounded-2xl flex items-start space-x-4 animate-in slide-in-from-top-4">
              <div className="bg-red-500/20 p-3 rounded-xl">
                <AlertTriangle className="w-8 h-8 text-red-400" />
              </div>
              <div>
                <h4 className="text-red-400 font-bold text-lg">⚠️ Critical Health Alert Triggered</h4>
                <p className="text-red-300/80 mt-1 leading-relaxed">{aiAlert}</p>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="flex border-b border-slate-800 px-6 pt-2">
            <TabButton active={activeTab === 'vitals'} onClick={() => setActiveTab('vitals')} icon={<HeartPulse className="w-4 h-4 mr-2"/>}>Vitals & Assessment</TabButton>
            <TabButton active={activeTab === 'vision'} onClick={() => setActiveTab('vision')} icon={<Eye className="w-4 h-4 mr-2"/>}>Vision</TabButton>
            <TabButton active={activeTab === 'dental'} onClick={() => setActiveTab('dental')} icon={<Droplet className="w-4 h-4 mr-2"/>}>Dental</TabButton>
          </div>

          {/* Tab Content */}
          <div className="p-8">
            {activeTab === 'vitals' && <VitalsForm studentId={selectedStudent.student_id} user={user} setAiAlert={setAiAlert} />}
            {activeTab === 'vision' && <VisionForm studentId={selectedStudent.student_id} user={user} setAiAlert={setAiAlert} />}
            {activeTab === 'dental' && <DentalForm studentId={selectedStudent.student_id} user={user} />}
          </div>
        </div>
      )}
        </div>
      )}
    </div>
  );
}

function TabButton({ children, active, onClick, icon }: { children: React.ReactNode, active: boolean, onClick: () => void, icon: React.ReactNode }) {
  return (
    <button 
      onClick={onClick}
      className={`flex items-center px-6 py-4 text-sm font-bold border-b-2 transition-all ${
        active ? 'border-cyan-500 text-cyan-400 bg-cyan-500/5' : 'border-transparent text-slate-500 hover:text-slate-300 hover:border-slate-700'
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function VitalsForm({ studentId, user, setAiAlert }: { studentId: number, user: User, setAiAlert: (msg: string) => void }) {
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [hb, setHb] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const h = parseFloat(height) / 100;
    const w = parseFloat(weight);
    const bmi = h > 0 ? (w / (h * h)) : 0;
    const hemoglobin = parseFloat(hb);

    // AI Risk Scoring Logic
    if (hemoglobin < 11 && bmi < 18.5) {
      setAiAlert(`High risk of severe anemia (Hb: ${hemoglobin}) and malnutrition (BMI: ${bmi.toFixed(1)}). Immediate Iron-Folic Acid supplementation and AIIMS Pediatric referral recommended.`);
    } else {
      setAiAlert('');
    }

    const findings = JSON.stringify({ Height: height, Weight: weight, BMI: bmi.toFixed(1), Hb: hb });
    await fetch('/api/health-records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student_id: studentId, camp_id: 1, doctor_id: user.username, category: 'Vitals', json_data: findings })
    });
    alert('Vitals saved & analysis complete.');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      <div className="grid grid-cols-3 gap-6">
        <div>
          <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Height (cm)</label>
          <input type="number" value={height} onChange={e => setHeight(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500" required />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Weight (kg)</label>
          <input type="number" value={weight} onChange={e => setWeight(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500" required />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Hemoglobin (g/dL)</label>
          <input type="number" step="0.1" value={hb} onChange={e => setHb(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500" required />
        </div>
      </div>
      <button type="submit" className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold px-8 py-3.5 rounded-xl shadow-[0_0_20px_rgba(34,211,238,0.3)] transition-all">
        Run Analysis & Save
      </button>
    </form>
  );
}

function VisionForm({ studentId, user, setAiAlert }: { studentId: number, user: User, setAiAlert: (msg: string) => void }) {
  const [leftEye, setLeftEye] = useState('6/6');
  const [rightEye, setRightEye] = useState('6/6');
  const options = ["6/6", "6/9", "6/12", "6/18", "6/24", "6/36", "6/60"];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let findings = JSON.stringify({ Left: leftEye, Right: rightEye });
    
    if (leftEye === "6/60" || rightEye === "6/60") {
      findings += " | Referral: Ophthalmology";
      setAiAlert("Severe visual impairment detected (6/60). Generate AIIMS Ophthalmology referral immediately.");
    }

    await fetch('/api/health-records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student_id: studentId, camp_id: 1, doctor_id: user.username, category: 'Vision', json_data: findings })
    });
    alert('Vision record saved!');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-md">
      <div className="grid grid-cols-2 gap-6">
        <div>
          <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Left Eye</label>
          <select value={leftEye} onChange={e => setLeftEye(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500">
            {options.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Right Eye</label>
          <select value={rightEye} onChange={e => setRightEye(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500">
            {options.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      </div>
      <button type="submit" className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold px-8 py-3.5 rounded-xl transition-all">
        Save Vision Data
      </button>
    </form>
  );
}

function DentalForm({ studentId, user }: { studentId: number, user: User }) {
  const [remarks, setRemarks] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch('/api/health-records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student_id: studentId, camp_id: 1, doctor_id: user.username, category: 'Dental', json_data: remarks })
    });
    alert('Dental record saved!');
    setRemarks('');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      <div>
        <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Dental Findings / Cavities</label>
        <textarea 
          value={remarks} 
          onChange={e => setRemarks(e.target.value)} 
          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 h-32 resize-none" 
          placeholder="Enter detailed remarks here..."
          required 
        />
      </div>
      <button type="submit" className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold px-8 py-3.5 rounded-xl transition-all">
        Save Dental Data
      </button>
    </form>
  );
}

function ParentView() {
  const [studentId, setStudentId] = useState('');
  const [records, setRecords] = useState([]);
  const [searched, setSearched] = useState(false);

  // Mock longitudinal data for the chart as requested
  const mockChartData = [
    { year: '2024', bmi: 16.2, height: 130 },
    { year: '2025', bmi: 17.5, height: 135 },
    { year: '2026', bmi: 18.1, height: 142 },
  ];

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch(`/api/health-records/${studentId}`);
    setRecords(await res.json());
    setSearched(true);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 max-w-4xl mx-auto">
      <div className="text-center mb-12">
        <h2 className="text-4xl font-bold text-white tracking-tight mb-4">Beneficiary Dashboard</h2>
        <p className="text-slate-400 text-lg">Access your child's longitudinal health records securely.</p>
      </div>
      
      <div className="bg-slate-900/80 backdrop-blur-xl p-8 rounded-3xl border border-slate-800 shadow-xl max-w-xl mx-auto">
        <form onSubmit={handleSearch} className="space-y-6">
          <div>
            <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2 text-center">Enter Student ID</label>
            <input 
              type="text" 
              value={studentId}
              onChange={e => setStudentId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-white text-center text-2xl tracking-widest focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 outline-none"
              placeholder="e.g. 1"
              required
            />
          </div>
          <button type="submit" className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold py-4 rounded-2xl shadow-[0_0_20px_rgba(34,211,238,0.3)] transition-all text-lg">
            Access Records
          </button>
        </form>
      </div>

      {searched && (
        <div className="space-y-8 animate-in slide-in-from-bottom-8">
          <div className="bg-slate-900/80 backdrop-blur-xl p-8 rounded-3xl border border-slate-800 shadow-xl">
            <h3 className="text-xl font-semibold mb-8 text-white text-center">3-Year Growth Progression (BMI)</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={mockChartData}>
                  <defs>
                    <linearGradient id="colorBmi" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1E293B" />
                  <XAxis dataKey="year" axisLine={false} tickLine={false} stroke="#94A3B8" />
                  <YAxis domain={['dataMin - 2', 'dataMax + 2']} axisLine={false} tickLine={false} stroke="#94A3B8" />
                  <Tooltip contentStyle={{backgroundColor: '#0F172A', borderColor: '#1E293B', borderRadius: '12px'}} />
                  <Area type="monotone" dataKey="bmi" stroke="#06b6d4" strokeWidth={4} fillOpacity={1} fill="url(#colorBmi)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-slate-900/80 backdrop-blur-xl p-8 rounded-3xl border border-slate-800 shadow-xl">
            <h3 className="text-xl font-semibold mb-6 text-white">Doctor's Remarks & Referrals</h3>
            {records.length > 0 ? (
              <div className="space-y-4">
                {records.map((record: any, i) => {
                  const isReferral = record.json_data.includes('Referral');
                  return (
                    <div key={i} className={`p-6 rounded-2xl border ${isReferral ? 'bg-red-500/10 border-red-500/30' : 'bg-emerald-500/10 border-emerald-500/30'}`}>
                      <div className="flex justify-between items-start mb-3">
                        <span className={`inline-block px-3 py-1 text-xs font-bold rounded-lg uppercase tracking-wider ${isReferral ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                          {record.category}
                        </span>
                        <span className="text-sm text-slate-400">{new Date(record.timestamp).toLocaleDateString()}</span>
                      </div>
                      <p className={`font-medium text-lg ${isReferral ? 'text-red-300' : 'text-emerald-300'}`}>{record.json_data}</p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-slate-500 text-center py-8">No clinical records found for this ID.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
