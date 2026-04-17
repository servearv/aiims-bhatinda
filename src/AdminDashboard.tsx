import React, { useState, useEffect, useRef } from 'react';
import {
  Calendar, Users, UserPlus, Search, Plus, X, Check,
  MapPin, Phone, Mail, Clock, Tag, ChevronDown, ChevronRight,
  Activity, FileText, Stethoscope, School, ExternalLink,
  HeartPulse, Eye, Ear, Scan, Bell, ClipboardCheck, AlertCircle, Loader2,
  ScrollText, RefreshCw, Filter, ShieldCheck
} from 'lucide-react';

type User = { username: string; role: string; name: string };

// ── Tag colors ──
const TAG_STYLES: Record<string, string> = {
  Upcoming: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  Ongoing: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  Completed: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  Cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const TAGS = ['Upcoming', 'Ongoing', 'Completed', 'Cancelled'];

// Specialist roles for registration
const SPECIALIST_ROLES = [
  { key: 'Community_Medicine', label: 'Community Medicine' },
  { key: 'Dental', label: 'Dental' },
  { key: 'ENT', label: 'ENT' },
  { key: 'Eye_Specialist', label: 'Ophthalmology' },
  { key: 'Skin_Specialist', label: 'Dermatology' },
  { key: 'Other', label: 'Other' },
];

const ALL_REGISTER_ROLES = [
  { key: 'Admin', label: 'Admin' },
  { key: 'School POC', label: 'School POC' },
  ...SPECIALIST_ROLES,
];

// Category display helpers
function getCategoryIcon(cat: string) {
  switch (cat) {
    case 'Community_Medicine': return <HeartPulse className="w-3.5 h-3.5" />;
    case 'Dental': return <span className="text-xs">🦷</span>;
    case 'ENT': return <Ear className="w-3.5 h-3.5" />;
    case 'Eye_Specialist': return <Eye className="w-3.5 h-3.5" />;
    case 'Skin_Specialist': return <Scan className="w-3.5 h-3.5" />;
    case 'Other': return <Stethoscope className="w-3.5 h-3.5" />;
    default: return <Stethoscope className="w-3.5 h-3.5" />;
  }
}

function getCategoryColor(cat: string): string {
  switch (cat) {
    case 'Community_Medicine': return 'bg-rose-500/20 text-rose-400 border-rose-500/30';
    case 'Dental': return 'bg-sky-500/20 text-sky-400 border-sky-500/30';
    case 'ENT': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    case 'Eye_Specialist': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    case 'Skin_Specialist': return 'bg-violet-500/20 text-violet-400 border-violet-500/30';
    case 'Other': return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
  }
}

function formatCategoryLabel(cat: string): string {
  switch (cat) {
    case 'Community_Medicine': return 'Community Medicine';
    case 'Eye_Specialist': return 'Ophthalmology';
    case 'Skin_Specialist': return 'Dermatology';
    default: return cat;
  }
}

interface EventData {
  event_id: number;
  school_name: string;
  school_address: string;
  poc_name: string;
  poc_designation: string;
  poc_phone: string;
  poc_email: string;
  start_date: string;
  end_date: string;
  operational_hours: string;
  tag: string;
  computed_status?: string;
  created_at: string;
  staff_count?: number;
  student_count?: number;
  screened_count?: number;
}

interface CampRequest {
  request_id: number;
  school_id: number;
  school_name: string;
  preferred_date: string;
  alternate_date: string;
  student_count: number;
  classes: string;
  notes: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  created_at: string;
  reviewed_at?: string;
  reviewed_by?: string;
}

interface Volunteer {
  username: string;
  name: string;
  designation: string;
  category: string;
  joined_at?: string;
}

interface EventStats {
  total_students: number;
  screened: number;
  normal: number;
  observation: number;
  referred: number;
  records: any[];
  staff: Volunteer[];
}

// ── Helpers ──
function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = String(d.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
}

// ══════════════════════════════════════════
// ██ ADMIN DASHBOARD
// ══════════════════════════════════════════
export default function AdminDashboard({ user }: { user: User }) {
  const [activeTab, setActiveTab] = useState<'events' | 'register' | 'camp-requests' | 'logs'>('events');
  const [defaultRole, setDefaultRole] = useState('');
  const [pendingCount, setPendingCount] = useState(0);

  const fetchPendingCount = () => {
    fetch('/api/camp-requests/count')
      .then(r => r.json())
      .then(d => setPendingCount(d.pending || 0))
      .catch(() => { });
  };

  useEffect(() => {
    fetchPendingCount();
    const interval = setInterval(fetchPendingCount, 30000);
    return () => clearInterval(interval);
  }, []);

  const switchToRegisterSchool = () => {
    setDefaultRole('School POC');
    setActiveTab('register');
  };

  const switchToCampRequests = () => {
    setActiveTab('camp-requests');
  };

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl space-y-6 animate-in fade-in duration-500">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Admin Dashboard ⚙️</h2>
          <p className="text-slate-400 text-sm mt-0.5">Manage screening camps, medical staff, and health records.</p>
        </div>
        {pendingCount > 0 && (
          <button
            onClick={switchToCampRequests}
            className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 hover:bg-amber-500/25 transition-all text-sm font-semibold"
          >
            <Bell className="w-4 h-4 animate-pulse" />
            <span>{pendingCount} New Camp Request{pendingCount !== 1 ? 's' : ''}</span>
          </button>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-2 bg-slate-900/80 backdrop-blur-xl p-1.5 rounded-2xl border border-slate-800 flex-wrap gap-1">
        <button
          onClick={() => { setActiveTab('events'); setDefaultRole(''); }}
          className={`flex items-center space-x-2 px-4 py-3 rounded-xl text-sm font-medium transition-all flex-1 justify-center min-w-0 ${activeTab === 'events'
              ? 'bg-gradient-to-r from-cyan-500/20 to-blue-600/20 text-cyan-400 border border-cyan-500/30 shadow-[0_0_12px_rgba(34,211,238,0.1)]'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
        >
          <Calendar className="w-4 h-4" /><span>Events</span>
        </button>
        <button
          onClick={() => setActiveTab('register')}
          className={`flex items-center space-x-2 px-4 py-3 rounded-xl text-sm font-medium transition-all flex-1 justify-center min-w-0 ${activeTab === 'register'
              ? 'bg-gradient-to-r from-cyan-500/20 to-blue-600/20 text-cyan-400 border border-cyan-500/30 shadow-[0_0_12px_rgba(34,211,238,0.1)]'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
        >
          <UserPlus className="w-4 h-4" /><span>Register Users</span>
        </button>
        <button
          onClick={() => { setActiveTab('camp-requests'); fetchPendingCount(); }}
          className={`flex items-center space-x-2 px-4 py-3 rounded-xl text-sm font-medium transition-all flex-1 justify-center min-w-0 relative ${activeTab === 'camp-requests'
              ? 'bg-gradient-to-r from-amber-500/20 to-orange-600/20 text-amber-400 border border-amber-500/30 shadow-[0_0_12px_rgba(251,191,36,0.1)]'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
        >
          <ClipboardCheck className="w-4 h-4" />
          <span>Camp Requests</span>
          {pendingCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center justify-center shadow-lg">
              {pendingCount > 9 ? '9+' : pendingCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`flex items-center space-x-2 px-4 py-3 rounded-xl text-sm font-medium transition-all flex-1 justify-center min-w-0 ${activeTab === 'logs'
              ? 'bg-gradient-to-r from-violet-500/20 to-purple-600/20 text-violet-400 border border-violet-500/30 shadow-[0_0_12px_rgba(139,92,246,0.1)]'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
        >
          <ScrollText className="w-4 h-4" /><span>Activity Log</span>
        </button>
      </div>

      {activeTab === 'events' && <EventsTab user={user} onAddNewSchool={switchToRegisterSchool} />}
      {activeTab === 'register' && <RegisterTab user={user} defaultRole={defaultRole} onRoleConsumed={() => setDefaultRole('')} />}
      {activeTab === 'camp-requests' && <CampRequestsTab user={user} onCountChange={fetchPendingCount} />}
      {activeTab === 'logs' && <AdminLogsTab />}
    </div>
  );
}

// ═══════════════════════════════════════════
// TAB 1: EVENTS
// ═══════════════════════════════════════════
function EventsTab({ user, onAddNewSchool }: { user: User; onAddNewSchool: () => void }) {
  const [events, setEvents] = useState<EventData[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [filterTag, setFilterTag] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchEvents = () => {
    fetch('/api/events').then(r => r.json()).then(setEvents);
  };

  useEffect(() => { fetchEvents(); }, []);

  const filtered = events
    .filter(e => {
      const matchTag = filterTag ? e.tag === filterTag : true;
      const matchSearch = e.school_name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchTag && matchSearch;
    })
    .sort((a, b) => {
      const dateA = new Date(a.start_date || 0).getTime();
      const dateB = new Date(b.start_date || 0).getTime();
      return dateB - dateA; // Most recent first
    });

  const updateTag = async (eventId: number, newTag: string) => {
    await fetch(`/api/events/${eventId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag: newTag, user_id: user.username }),
    });
    fetchEvents();
  };

  return (
    <div className="space-y-4">
      {/* Header + Filter + Create */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="relative flex-shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4.5 h-4.5" />
            <input
              type="text"
              placeholder="Search by school name..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all placeholder-slate-600 w-full md:w-96 shadow-sm"
            />
          </div>
          <div className="flex items-center space-x-2 overflow-x-auto pb-1 md:pb-0 hide-scrollbar">
            <span className="text-sm text-slate-500 font-medium whitespace-nowrap">Filter:</span>
            <button onClick={() => setFilterTag('')}
              className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all border whitespace-nowrap ${!filterTag ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30 shadow-[0_0_15px_rgba(34,211,238,0.1)]' : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-600'}`}>
              All
            </button>
            {TAGS.map(t => (
              <button key={t} onClick={() => setFilterTag(t)}
                className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all border whitespace-nowrap ${filterTag === t ? TAG_STYLES[t] : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-600'}`}>
                {t}
              </button>
            ))}
          </div>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white px-5 py-2.5 rounded-xl font-bold transition-all flex items-center justify-center space-x-2 shadow-lg text-sm flex-shrink-0 whitespace-nowrap">
          <Plus className="w-4 h-4" /><span>Create Event</span>
        </button>
      </div>

      {/* Events List */}
      {filtered.length === 0 ? (
        <div className="bg-slate-900/40 backdrop-blur-xl p-12 rounded-2xl border border-slate-800/50 text-center">
          <Calendar className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">No events found.</p>
        </div>
      ) : (
        <div className="bg-slate-900/40 backdrop-blur-xl rounded-2xl border border-slate-800/50 shadow-sm overflow-hidden divide-y divide-slate-800/50">
          {filtered.map(event => (
            <div key={event.event_id} className="group">
              <button onClick={() => setExpandedId(expandedId === event.event_id ? null : event.event_id)}
                className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-800/40 transition-colors text-left">
                <div className="flex items-center space-x-4 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center flex-shrink-0">
                    <Calendar className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-white font-semibold truncate">{event.school_name}</h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {formatDateDisplay(event.start_date)}{event.end_date ? ` → ${formatDateDisplay(event.end_date)}` : ''} · {event.operational_hours || 'TBD'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-3 flex-shrink-0 ml-4">
                  <span className="text-xs text-slate-500">
                    <Users className="w-3.5 h-3.5 inline mr-1" />{event.staff_count ?? 0} staff
                  </span>
                  <span className="text-xs text-slate-500">
                    <Activity className="w-3.5 h-3.5 inline mr-1" />{event.screened_count ?? 0}/{event.student_count ?? 0} screened
                  </span>
                  <div className="flex items-center space-x-2" onClick={e => e.stopPropagation()}>
                    <span className={`px-3 py-1 rounded-lg text-xs font-bold border ${TAG_STYLES[event.computed_status || event.tag] || TAG_STYLES.Upcoming}`}>
                      {event.computed_status || event.tag}
                    </span>
                    {(event.computed_status || event.tag) !== 'Cancelled' && (event.computed_status || event.tag) !== 'Completed' && (
                      <button
                        onClick={() => {
                          if (window.confirm(`Are you sure you want to cancel the camp at ${event.school_name}?`)) {
                            updateTag(event.event_id, 'Cancelled');
                          }
                        }}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold border bg-red-500/10 text-red-500 border-red-500/30 hover:bg-red-500/20 transition-colors shadow-sm cursor-pointer"
                      >
                        Cancel
                      </button>
                    )}
                    {(event.computed_status || event.tag) === 'Ongoing' && (
                      <button
                        onClick={async () => {
                          if (window.confirm(`Are you sure you want to completely END the camp at ${event.school_name}? This will mark it as Completed immediately.`)) {
                            const yesterday = new Date();
                            yesterday.setDate(yesterday.getDate() - 1);
                            await fetch(`/api/events/${event.event_id}`, {
                              method: 'PUT',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ end_date: yesterday.toISOString().split('T')[0], user_id: user.username })
                            });
                            fetchEvents();
                          }
                        }}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold border bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700 transition-colors shadow-sm cursor-pointer"
                      >
                        End Camp
                      </button>
                    )}
                  </div>
                  {expandedId === event.event_id ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                </div>
              </button>

              {/* Expanded: Details + Records (staff tab removed) */}
              {expandedId === event.event_id && (
                <EventExpandedPanel eventId={event.event_id} event={event} user={user} onRefresh={fetchEvents} />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Event Modal */}
      {showCreate && <CreateEventModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); fetchEvents(); }} user={user} onAddNewSchool={() => { setShowCreate(false); onAddNewSchool(); }} />}
    </div>
  );
}

// ── Expanded panel (details + records — NO staff tab) ──
function EventExpandedPanel({ eventId, event, user, onRefresh }: {
  eventId: number; event: EventData; user: User; onRefresh: () => void;
}) {
  const [activeSection, setActiveSection] = useState<'details' | 'records'>('details');
  const [stats, setStats] = useState<EventStats | null>(null);

  useEffect(() => {
    if (activeSection === 'records') {
      fetch(`/api/events/${eventId}/stats`).then(r => r.json()).then(setStats);
    }
  }, [activeSection, eventId]);

  const sectionBtns = [
    { key: 'details' as const, label: 'Details', icon: <MapPin className="w-3.5 h-3.5" /> },
    { key: 'records' as const, label: 'Camp Records', icon: <FileText className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="border-t border-slate-800/50">
      {/* Section Tabs */}
      <div className="flex space-x-1 px-6 pt-3">
        {sectionBtns.map(s => (
          <button key={s.key} onClick={() => setActiveSection(s.key)}
            className={`flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all ${activeSection === s.key
              ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/25'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}>
            {s.icon}<span>{s.label}</span>
          </button>
        ))}
      </div>

      <div className="px-6 pb-5 pt-3">
        {/* DETAILS */}
        {activeSection === 'details' && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <DetailItem icon={<MapPin className="w-3.5 h-3.5" />} label="Address" value={event.school_address} />
            <DetailItem icon={<Users className="w-3.5 h-3.5" />} label="PoC Name" value={event.poc_name} />
            <DetailItem icon={<Tag className="w-3.5 h-3.5" />} label="PoC Designation" value={event.poc_designation} />
            <DetailItem icon={<Phone className="w-3.5 h-3.5" />} label="PoC Phone" value={event.poc_phone} />
            <DetailItem icon={<Mail className="w-3.5 h-3.5" />} label="PoC Email" value={event.poc_email} />
            <DetailItem icon={<Clock className="w-3.5 h-3.5" />} label="Hours" value={event.operational_hours} />
          </div>
        )}

        {/* CAMP RECORDS (with Active Volunteers at top) */}
        {activeSection === 'records' && (
          stats ? (
            <div className="space-y-4">
              {/* Active Volunteers */}
              {stats.staff.length > 0 && (
                <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800">
                  <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-3 flex items-center">
                    <Activity className="w-3.5 h-3.5 mr-1.5" /> Screening Staff ({stats.staff.length})
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {stats.staff.map((v: Volunteer) => (
                      <span key={v.username} className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium ${getCategoryColor(v.category)}`}>
                        {getCategoryIcon(v.category)}
                        <span className="text-white font-semibold">{v.name}</span>
                        <span className="opacity-60">{formatCategoryLabel(v.category)}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Stats */}
              <div className="grid grid-cols-5 gap-3">
                <MiniStat label="Students" value={stats.total_students} color="text-cyan-400" />
                <MiniStat label="Screened" value={stats.screened} color="text-blue-400" />
                <MiniStat label="Normal" value={stats.normal} color="text-emerald-400" />
                <MiniStat label="Observation" value={stats.observation} color="text-amber-400" />
                <MiniStat label="Referred" value={stats.referred} color="text-red-400" />
              </div>

              {/* Records */}
              {stats.records.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-4">No records yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-slate-500 border-b border-slate-800">
                      <tr>
                        <th className="pb-2 pr-4 font-medium text-xs">Student</th>
                        <th className="pb-2 pr-4 font-medium text-xs">Specialist</th>
                        <th className="pb-2 pr-4 font-medium text-xs">Category</th>
                        <th className="pb-2 pr-4 font-medium text-xs">Assessment</th>
                        <th className="pb-2 font-medium text-xs">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {stats.records.map((rec: any) => {
                        let assessment = '—';
                        try {
                          const d = JSON.parse(rec.json_data);
                          assessment = d.assessment === 'N' ? 'Normal' : d.assessment === 'O' ? 'Observation' : d.assessment === 'R' ? 'Referred' : '—';
                        } catch { }
                        const assessColor = assessment === 'Normal' ? 'text-emerald-400' : assessment === 'Referred' ? 'text-red-400' : assessment === 'Observation' ? 'text-amber-400' : 'text-slate-400';
                        return (
                          <tr key={rec.record_id} className="hover:bg-slate-800/30">
                            <td className="py-2.5 pr-4 text-white font-medium text-xs">{rec.student_name}</td>
                            <td className="py-2.5 pr-4 text-cyan-400 text-xs">{rec.doctor_id}</td>
                            <td className="py-2.5 pr-4">
                              <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded text-xs font-medium border ${getCategoryColor(rec.category)}`}>
                                {getCategoryIcon(rec.category)}
                                <span>{formatCategoryLabel(rec.category)}</span>
                              </span>
                            </td>
                            <td className={`py-2.5 pr-4 font-semibold text-xs ${assessColor}`}>{assessment}</td>
                            <td className="py-2.5 text-slate-400 text-xs">{new Date(rec.timestamp).toLocaleString()}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <p className="text-slate-400 text-sm text-center py-6">Loading...</p>
          )
        )}
      </div>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800 text-center">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">{label}</p>
    </div>
  );
}

function DetailItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div>
      <div className="flex items-center space-x-1.5 text-slate-500 mb-1">
        {icon}<span className="text-xs uppercase tracking-wider font-medium">{label}</span>
      </div>
      <p className="text-white font-medium">{value || '—'}</p>
    </div>
  );
}

// ── Create Event Modal (with school dropdown) ──
interface SchoolOption {
  school_id: number;
  school_name: string;
  school_address: string;
  poc_name: string;
  poc_designation: string;
  poc_phone: string;
  poc_email: string;
}

function CreateEventModal({ onClose, onCreated, user, onAddNewSchool }: {
  onClose: () => void; onCreated: () => void; user: User; onAddNewSchool: () => void;
}) {
  const [f, setF] = useState({
    school_id: null as number | null,
    start_date: '', end_date: '', operational_hours: '', tag: 'Upcoming',
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [schoolSearch, setSchoolSearch] = useState('');
  const [schoolResults, setSchoolResults] = useState<SchoolOption[]>([]);
  const [selectedSchool, setSelectedSchool] = useState<SchoolOption | null>(null);
  const [showSchoolDropdown, setShowSchoolDropdown] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      fetch(`/api/schools/search?q=${encodeURIComponent(schoolSearch)}`)
        .then(r => r.json())
        .then(setSchoolResults);
    }, 200);
  }, [schoolSearch]);

  const selectSchool = (s: SchoolOption) => {
    setSelectedSchool(s);
    setF(p => ({ ...p, school_id: s.school_id }));
    setSchoolSearch(s.school_name);
    setShowSchoolDropdown(false);
    setErrors(p => ({ ...p, school_id: '' }));
  };

  const upd = (k: string, v: string) => {
    setF(p => ({ ...p, [k]: v }));
    setErrors(p => ({ ...p, [k]: '' }));
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!f.school_id) e.school_id = 'Please select a school';
    if (!f.start_date) e.start_date = 'Required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const computedTag = (() => {
    if (!f.start_date) return 'Upcoming';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(f.start_date);
    if (isNaN(startDate.getTime())) return 'Upcoming';
    startDate.setHours(0, 0, 0, 0);

    if (startDate > today) return 'Upcoming';
    if (!f.end_date) return 'Ongoing';

    const endDate = new Date(f.end_date);
    if (isNaN(endDate.getTime())) return 'Ongoing';
    endDate.setHours(0, 0, 0, 0);

    return endDate >= today ? 'Ongoing' : 'Completed';
  })();

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...f, tag: computedTag, created_by: user.username }),
      });
      const data = await res.json();
      if (data.success) onCreated();
    } catch { alert('Error creating event'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-2xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        <h3 className="text-xl font-bold text-white mb-5 flex items-center"><Calendar className="w-5 h-5 mr-2 text-cyan-400" /> Create New Event</h3>
        <form onSubmit={handleSave} className="space-y-4">
          {/* School Selection */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">School</h4>
            <div className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-500 w-3.5 h-3.5" />
                <input
                  type="text"
                  value={schoolSearch}
                  onChange={e => { setSchoolSearch(e.target.value); setShowSchoolDropdown(true); setSelectedSchool(null); setF(p => ({ ...p, school_id: null })); }}
                  onFocus={() => setShowSchoolDropdown(true)}
                  placeholder="Search for a school..."
                  className={`w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-950 border text-white text-sm focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all placeholder-slate-600 ${errors.school_id ? 'border-red-500/50' : 'border-slate-800'}`}
                />
              </div>
              {errors.school_id && <p className="text-red-400 text-xs mt-1">{errors.school_id}</p>}

              {showSchoolDropdown && (
                <div className="absolute z-20 w-full mt-1 bg-slate-900 border border-slate-700 rounded-xl max-h-48 overflow-y-auto shadow-2xl">
                  {schoolResults.length === 0 ? (
                    <p className="text-slate-500 text-xs text-center py-3">No schools found.</p>
                  ) : (
                    schoolResults.map(s => (
                      <button key={s.school_id} type="button" onClick={() => selectSchool(s)}
                        className="w-full text-left px-4 py-2.5 hover:bg-slate-800 transition-colors flex items-center justify-between">
                        <div>
                          <p className="text-white text-sm font-medium">{s.school_name}</p>
                          <p className="text-xs text-slate-400">{s.poc_name}{s.school_address ? ` · ${s.school_address}` : ''}</p>
                        </div>
                        {selectedSchool?.school_id === s.school_id && <Check className="w-4 h-4 text-emerald-400" />}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {selectedSchool && (
              <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800 text-xs space-y-1">
                <p className="text-white font-medium">{selectedSchool.school_name}</p>
                {selectedSchool.school_address && <p className="text-slate-400"><MapPin className="w-3 h-3 inline mr-1" />{selectedSchool.school_address}</p>}
                {selectedSchool.poc_name && <p className="text-slate-400"><Users className="w-3 h-3 inline mr-1" />PoC: {selectedSchool.poc_name} ({selectedSchool.poc_designation})</p>}
                {selectedSchool.poc_phone && <p className="text-slate-400"><Phone className="w-3 h-3 inline mr-1" />{selectedSchool.poc_phone}</p>}
              </div>
            )}

            <button type="button" onClick={onAddNewSchool}
              className="flex items-center space-x-1.5 text-cyan-400 hover:text-cyan-300 text-xs font-medium transition-colors">
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Register a new school →</span>
            </button>
          </div>

          {/* Scheduling */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Scheduling</h4>
            <div className="grid grid-cols-3 gap-3">
              <ModalInput label="Start Date *" value={f.start_date} onChange={v => upd('start_date', v)} type="date" required error={errors.start_date} />
              <ModalInput label="End Date" value={f.end_date} onChange={v => upd('end_date', v)} type="date" />
              <ModalInput label="Operational Hours" value={f.operational_hours} onChange={v => upd('operational_hours', v)} placeholder="e.g. 9 AM - 4 PM" />
            </div>
          </div>


          <button type="submit" disabled={saving}
            className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold py-3.5 rounded-xl shadow-lg transition-all disabled:opacity-50 mt-2">
            {saving ? 'Creating...' : 'Create Event'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Modal Input Helper ──
const ModalInput = React.forwardRef<HTMLInputElement, {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; required?: boolean; error?: string;
}>(({ label, value, onChange, placeholder, type = 'text', required, error }, ref) => (
  <div>
    <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">{label}</label>
    <input ref={ref} type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} required={required}
      className={`w-full bg-slate-950 border rounded-xl px-3 py-2.5 text-white text-sm focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all placeholder-slate-600 ${error ? 'border-red-500/50' : 'border-slate-800'}`} />
    {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
  </div>
));

// ═══════════════════════════════════════════
// TAB 2: REGISTER USERS (updated roles)
// ═══════════════════════════════════════════
function RegisterTab({ user, defaultRole, onRoleConsumed }: { user: User; defaultRole?: string; onRoleConsumed?: () => void }) {
  const [f, setF] = useState({
    email: '', name: '', role: 'Other', designation: '',
    // School POC fields
    school_name: '', school_address: '', poc_name: '', poc_designation: '', poc_phone: '',
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (defaultRole) {
      setF(p => ({ ...p, role: defaultRole }));
      onRoleConsumed?.();
    }
  }, [defaultRole]);

  const upd = (k: string, v: string) => setF(p => ({ ...p, [k]: v }));

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const payload: Record<string, string> = {
        email: f.email,
        name: f.role === 'School POC' ? (f.poc_name || f.school_name) : f.name,
        role: f.role,
        designation: f.designation,
        specialization: f.role,
        admin_user: user.username,
      };

      // Add School POC fields
      if (f.role === 'School POC') {
        payload.school_name = f.school_name;
        payload.school_address = f.school_address;
        payload.poc_designation = f.poc_designation;
        payload.poc_phone = f.poc_phone;
      }

      const res = await fetch('/api/users/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        const displayName = f.role === 'School POC' ? f.school_name : f.name;
        const emailNote = data.email_sent
          ? `📧 A welcome email with credentials has been sent to ${f.email}.`
          : `⚠️ Email could not be sent (SMTP not configured). Please share credentials manually.`;
        setMessage({
          type: 'success',
          text: `✅ ${displayName} registered as ${f.role}.\n\n🔑 User ID: ${data.username}\n🔒 Password: ${data.password}\n\n${emailNote}`
        });
        setF({
          email: '', name: '', role: 'Other', designation: '',
          school_name: '', school_address: '', poc_name: '', poc_designation: '', poc_phone: '',
        });
      } else {
        setMessage({ type: 'error', text: data.message || 'Registration failed' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Connection error' });
    } finally {
      setSaving(false);
    }
  };

  const isSchoolPOC = f.role === 'School POC';
  const isSpecialist = SPECIALIST_ROLES.some(r => r.key === f.role);

  return (
    <div className="max-w-xl mx-auto">
      <div className="bg-slate-900/80 backdrop-blur-xl p-6 rounded-2xl border border-slate-800 shadow-xl">
        <h3 className="text-lg font-semibold text-white mb-5 flex items-center">
          <UserPlus className="w-5 h-5 mr-2 text-cyan-400" />
          Register New User
        </h3>

        {message && (
          <div className={`p-3 rounded-xl text-sm mb-4 border whitespace-pre-line ${message.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
            : 'bg-red-500/10 border-red-500/30 text-red-400'
            }`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          {/* Email — always shown */}
          <ModalInput label="Email *" value={f.email} onChange={v => upd('email', v)} placeholder="user@example.com" type="email" required />

          {/* Name — for non-School-POC roles */}
          {!isSchoolPOC && (
            <ModalInput label="Full Name *" value={f.name} onChange={v => upd('name', v)} placeholder="e.g. Dr. Anil Kumar" required />
          )}

          <div>
            <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Role</label>
            <div className="flex flex-wrap gap-2">
              {ALL_REGISTER_ROLES.map(role => (
                <button key={role.key} type="button" onClick={() => upd('role', role.key)}
                  className={`px-3 py-2 rounded-xl font-bold text-xs transition-all border ${f.role === role.key
                    ? role.key === 'School POC'
                      ? 'bg-violet-500/20 text-violet-400 border-violet-500/30'
                      : SPECIALIST_ROLES.some(r => r.key === role.key)
                        ? getCategoryColor(role.key)
                        : 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-600'
                    }`}>
                  {role.key === 'School POC' && <School className="w-3.5 h-3.5 inline mr-1" />}
                  {role.label}
                </button>
              ))}
            </div>
          </div>

          {/* School POC specific fields */}
          {isSchoolPOC && (
            <div className="space-y-3 p-4 bg-violet-500/5 border border-violet-500/20 rounded-2xl">
              <h4 className="text-xs font-bold text-violet-400 uppercase tracking-wider flex items-center">
                <School className="w-3.5 h-3.5 mr-1.5" /> School Information
              </h4>
              <ModalInput label="School Name *" value={f.school_name} onChange={v => upd('school_name', v)} placeholder="e.g. Govt High School, Bathinda" required />
              <ModalInput label="School Address" value={f.school_address} onChange={v => upd('school_address', v)} placeholder="Full address" />
              <ModalInput label="PoC Name *" value={f.poc_name} onChange={v => upd('poc_name', v)} placeholder="e.g. Principal Sharma" required />
              <div className="grid grid-cols-2 gap-3">
                <ModalInput label="PoC Designation" value={f.poc_designation} onChange={v => upd('poc_designation', v)} placeholder="e.g. Principal" />
                <ModalInput label="PoC Phone" value={f.poc_phone} onChange={v => upd('poc_phone', v)} placeholder="e.g. 9876543210" type="tel" />
              </div>
            </div>
          )}

          <button type="submit" disabled={saving}
            className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold py-3.5 rounded-xl shadow-lg transition-all disabled:opacity-50 mt-4">
            {saving ? 'Creating...' : 'Create User'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// TAB 3: CAMP REQUESTS
// ═══════════════════════════════════════════
const REQUEST_STATUS_STYLES: Record<string, string> = {
  Pending: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  Approved: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  Rejected: 'bg-red-500/20 text-red-400 border-red-500/30',
};

function CampRequestsTab({ user, onCountChange }: { user: User; onCountChange: () => void }) {
  const [requests, setRequests] = useState<CampRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'' | 'Pending' | 'Approved' | 'Rejected'>('');
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchRequests = () => {
    setLoading(true);
    const url = filterStatus ? `/api/camp-requests?status=${filterStatus}` : '/api/camp-requests';
    fetch(url)
      .then(r => r.json())
      .then(data => { setRequests(data); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchRequests(); }, [filterStatus]);

  const handleApprove = async (req: CampRequest) => {
    if (!window.confirm(`Approve camp request from ${req.school_name} on ${formatDateDisplay(req.preferred_date)}?\n\nThis will create a new event.`)) return;
    setActionLoading(req.request_id);
    setMessage(null);
    try {
      const res = await fetch(`/api/camp-requests/${req.request_id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: `✅ Approved! Event created (ID: ${data.event_id})` });
        fetchRequests();
        onCountChange();
      } else {
        setMessage({ type: 'error', text: data.message || 'Approval failed' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Connection error' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (req: CampRequest) => {
    if (!window.confirm(`Reject camp request from ${req.school_name}?`)) return;
    setActionLoading(req.request_id);
    setMessage(null);
    try {
      const res = await fetch(`/api/camp-requests/${req.request_id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: '❌ Request rejected.' });
        fetchRequests();
        onCountChange();
      } else {
        setMessage({ type: 'error', text: data.message || 'Rejection failed' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Connection error' });
    } finally {
      setActionLoading(null);
    }
  };

  const pendingRequests = requests.filter(r => r.status === 'Pending');

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center space-x-2">
            <ClipboardCheck className="w-5 h-5 text-amber-400" />
            <span>Camp Requests</span>
            {pendingRequests.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold border border-amber-500/30">
                {pendingRequests.length} pending
              </span>
            )}
          </h3>
          <p className="text-slate-400 text-sm mt-0.5">Review and action screening camp requests from schools.</p>
        </div>
        {/* Status Filter */}
        <div className="flex items-center space-x-2">
          {(['', 'Pending', 'Approved', 'Rejected'] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${filterStatus === s
                  ? s === '' ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                    : REQUEST_STATUS_STYLES[s]
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-600'
                }`}
            >
              {s === '' ? 'All' : s}
            </button>
          ))}
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`p-3 rounded-xl text-sm border ${message.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
            : 'bg-red-500/10 border-red-500/30 text-red-400'
          }`}>
          {message.text}
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />Loading requests...
        </div>
      ) : requests.length === 0 ? (
        <div className="bg-slate-900/40 backdrop-blur-xl p-12 rounded-2xl border border-slate-800/50 text-center">
          <ClipboardCheck className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">No camp requests {filterStatus ? `with status "${filterStatus}"` : 'found'}.</p>
        </div>
      ) : (
        <div className="bg-slate-900/40 backdrop-blur-xl rounded-2xl border border-slate-800/50 shadow-sm overflow-hidden divide-y divide-slate-800/50">
          {requests.map(req => {
            const isActioning = actionLoading === req.request_id;
            return (
              <div key={req.request_id} className="px-5 py-4 hover:bg-slate-800/20 transition-colors">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  {/* Info */}
                  <div className="flex items-start space-x-4 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <School className="w-5 h-5 text-amber-400" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-white font-semibold truncate">{req.school_name}</h4>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-slate-400">
                        <span className="flex items-center space-x-1">
                          <Calendar className="w-3 h-3" />
                          <span>Preferred: <span className="text-slate-200">{formatDateDisplay(req.preferred_date)}</span></span>
                        </span>
                        {req.alternate_date && (
                          <span className="flex items-center space-x-1">
                            <Calendar className="w-3 h-3" />
                            <span>Alt: <span className="text-slate-200">{formatDateDisplay(req.alternate_date)}</span></span>
                          </span>
                        )}
                        <span className="flex items-center space-x-1">
                          <Users className="w-3 h-3" />
                          <span><span className="text-slate-200">{req.student_count}</span> students</span>
                        </span>
                        {req.classes && (
                          <span className="flex items-center space-x-1">
                            <Tag className="w-3 h-3" />
                            <span>Classes: <span className="text-slate-200">{req.classes}</span></span>
                          </span>
                        )}
                        <span className="flex items-center space-x-1">
                          <Clock className="w-3 h-3" />
                          <span>{new Date(req.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                        </span>
                      </div>
                      {req.notes && (
                        <p className="text-xs text-slate-500 mt-1 italic truncate max-w-md">
                          📝 {req.notes}
                        </p>
                      )}
                      {req.status !== 'Pending' && req.reviewed_by && (
                        <p className="text-xs text-slate-600 mt-1">
                          Reviewed by {req.reviewed_by}{req.reviewed_at ? ` · ${new Date(req.reviewed_at).toLocaleDateString('en-IN')}` : ''}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-3 flex-shrink-0">
                    <span className={`px-3 py-1 rounded-lg text-xs font-bold border ${REQUEST_STATUS_STYLES[req.status]}`}>
                      {req.status}
                    </span>
                    {req.status === 'Pending' && (
                      <>
                        <button
                          onClick={() => handleApprove(req)}
                          disabled={isActioning}
                          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 text-xs font-bold transition-all disabled:opacity-50"
                        >
                          {isActioning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                          <span>Approve</span>
                        </button>
                        <button
                          onClick={() => handleReject(req)}
                          disabled={isActioning}
                          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-bold transition-all disabled:opacity-50"
                        >
                          {isActioning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                          <span>Reject</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
// TAB 4: ADMIN ACTIVITY LOG — Compact Feed
// ═══════════════════════════════════════════

interface AuditLog {
  log_id: number;
  timestamp: string;
  user_id: string;
  action: string;
  details: string;
}

// ── Action colour / label map ──────────────────────────────────────────────
function getActionDot(action: string): { dot: string; label: string; textColor: string } {
  const a = (action || '').toUpperCase();
  if (a === 'LOGIN' || a === 'LOGIN_OTP')
    return { dot: 'bg-emerald-400', label: a === 'LOGIN_OTP' ? 'Login · OTP' : 'Login', textColor: 'text-emerald-400' };
  if (a === 'LOGOUT')
    return { dot: 'bg-slate-500', label: 'Logout', textColor: 'text-slate-400' };
  if (a === 'SET_PASSWORD')
    return { dot: 'bg-blue-400', label: 'Set password', textColor: 'text-blue-400' };
  if (a === 'CHANGE_PASSWORD')
    return { dot: 'bg-blue-400', label: 'Changed password', textColor: 'text-blue-400' };
  if (a === 'CHANGE_USERNAME')
    return { dot: 'bg-blue-400', label: 'Changed username', textColor: 'text-blue-400' };
  if (a === 'CREATE_EVENT')
    return { dot: 'bg-cyan-400', label: 'Created event', textColor: 'text-cyan-400' };
  if (a === 'UPDATE_EVENT')
    return { dot: 'bg-cyan-400', label: 'Updated event', textColor: 'text-cyan-400' };
  if (a === 'REGISTER_USER')
    return { dot: 'bg-violet-400', label: 'Registered user', textColor: 'text-violet-400' };
  if (a === 'SAVE_EXAM')
    return { dot: 'bg-rose-400', label: 'Exam record', textColor: 'text-rose-400' };
  if (a === 'AUTOSAVE_EXAM' || a === 'AUTOSAVE')
    return { dot: 'bg-rose-300', label: 'Autosaved', textColor: 'text-rose-300' };
  if (a.includes('APPROVE') || a.includes('CAMP') || a.includes('REQUEST'))
    return { dot: 'bg-amber-400', label: action.replace(/_/g, ' ').toLowerCase(), textColor: 'text-amber-400' };
  if (a.includes('STUDENT') || a.includes('RECORD') || a.includes('EXAM'))
    return { dot: 'bg-rose-400', label: action.replace(/_/g, ' ').toLowerCase(), textColor: 'text-rose-400' };
  return { dot: 'bg-slate-500', label: action.replace(/_/g, ' ').toLowerCase(), textColor: 'text-slate-400' };
}

// ── Compact detail parser ──────────────────────────────────────────────────
// Converts verbose detail strings into short "a • b • c" summaries
function compactDetail(details: string): string {
  if (!details) return '';
  // "Saved Community_Medicine exam for student 10" → "Community Medicine · Student 10"
  // (the action label already says "Exam record", so no need to repeat "Saved exam")
  const examMatch = details.match(/saved\s+([\w_]+)\s+exam\s+for\s+student\s+(\d+)/i);
  if (examMatch) {
    const spec = examMatch[1].replace(/_/g, ' ');
    return `${spec} · Student ${examMatch[2]}`;
  }
  // "Created event 5: School Name" → "Event 5 · School Name"
  const createEvt = details.match(/created event (\d+):\s*(.*)/i);
  if (createEvt) return `Event #${createEvt[1]} · ${createEvt[2]}`;
  // "Updated event 5" → "Event #5"
  const updEvt = details.match(/updated event (\d+)/i);
  if (updEvt) return `Event #${updEvt[1]}`;
  // "Changed from X to Y"
  const changed = details.match(/changed from (.+) to (.+)/i);
  if (changed) return `${changed[1]} → ${changed[2]}`;
  // Generic: truncate to ~60 chars
  return details.length > 65 ? details.slice(0, 62) + '…' : details;
}

// ── Date-key helpers ───────────────────────────────────────────────────────
function toIso(ts: string): Date {
  return new Date(ts && !ts.endsWith('Z') ? ts + 'Z' : ts);
}

function dateKey(ts: string): string {
  const d = toIso(ts);
  if (isNaN(d.getTime())) return 'Unknown';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function timeOnly(ts: string): string {
  const d = toIso(ts);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

function timeAgoShort(ts: string): string {
  const diff = Math.floor((Date.now() - toIso(ts).getTime()) / 1000);
  if (isNaN(diff) || diff < 0) return '';
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

// ── Filter options ─────────────────────────────────────────────────────────
const KNOWN_ACTIONS = [
  'LOGIN', 'LOGIN_OTP', 'LOGOUT',
  'SET_PASSWORD', 'CHANGE_PASSWORD', 'CHANGE_USERNAME',
  'CREATE_EVENT', 'UPDATE_EVENT', 'REGISTER_USER',
];

// ══════════════════════════════════════════════════════════════════════════
function AdminLogsTab() {
  const [logs, setLogs]             = React.useState<AuditLog[]>([]);
  const [loading, setLoading]       = React.useState(true);
  const [actionFilter, setAction]   = React.useState('');
  const [userFilter, setUser]       = React.useState('');
  const [limit, setLimit]           = React.useState(200);
  const [lastRefreshed, setRefreshed] = React.useState<Date>(new Date());
  const [autoRefresh, setAuto]      = React.useState(true);
  const intervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchLogs = React.useCallback(() => {
    setLoading(true);
    const p = new URLSearchParams({ limit: String(limit) });
    if (actionFilter) p.set('action', actionFilter);
    if (userFilter.trim()) p.set('user_id', userFilter.trim());
    fetch(`/api/admin/logs?${p}`)
      .then(r => r.json())
      .then(data => { setLogs(Array.isArray(data) ? data : []); setRefreshed(new Date()); })
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, [actionFilter, userFilter, limit]);

  React.useEffect(() => { fetchLogs(); }, [fetchLogs]);
  React.useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (autoRefresh) intervalRef.current = setInterval(fetchLogs, 30000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [autoRefresh, fetchLogs]);

  // Group logs by date key
  const groups: { date: string; items: AuditLog[] }[] = React.useMemo(() => {
    const map = new Map<string, AuditLog[]>();
    for (const log of logs) {
      const dk = dateKey(log.timestamp);
      if (!map.has(dk)) map.set(dk, []);
      map.get(dk)!.push(log);
    }
    return Array.from(map.entries()).map(([date, items]) => ({ date, items }));
  }, [logs]);

  return (
    <div className="space-y-3">

      {/* ── Header bar ─────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center space-x-2">
          <ShieldCheck className="w-4 h-4 text-violet-400" />
          <span className="text-sm font-bold text-white">Activity Log</span>
          {!loading && (
            <span className="text-[11px] text-slate-500 font-mono">{logs.length} entries</span>
          )}
          {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500" />}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Actor search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 w-3 h-3" />
            <input
              type="text" placeholder="Actor…" value={userFilter}
              onChange={e => setUser(e.target.value)}
              className="pl-7 pr-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-white text-[11px] focus:ring-1 focus:ring-violet-500/50 focus:border-violet-500 outline-none transition-all placeholder-slate-600 w-28"
            />
          </div>
          {/* Action filter */}
          <select value={actionFilter} onChange={e => setAction(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-300 focus:ring-1 focus:ring-violet-500/50 outline-none transition-all">
            <option value="">All actions</option>
            {KNOWN_ACTIONS.map(a => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}
          </select>
          {/* Limit */}
          <select value={limit} onChange={e => setLimit(Number(e.target.value))}
            className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-300 focus:ring-1 focus:ring-violet-500/50 outline-none transition-all">
            {[100, 200, 500].map(n => <option key={n} value={n}>Last {n}</option>)}
          </select>
          {(actionFilter || userFilter) && (
            <button onClick={() => { setAction(''); setUser(''); }}
              className="text-[11px] text-red-400 hover:text-red-300 transition-colors flex items-center space-x-0.5">
              <X className="w-3 h-3" /><span>Clear</span>
            </button>
          )}
          {/* Auto-refresh toggle */}
          <button onClick={() => setAuto(v => !v)}
            className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-all ${autoRefresh ? 'bg-violet-500/15 text-violet-400 border-violet-500/25' : 'bg-slate-900 text-slate-500 border-slate-800'}`}>
            <RefreshCw className={`w-3 h-3 ${autoRefresh && !loading ? 'animate-spin' : ''}`}
              style={autoRefresh && !loading ? { animationDuration: '4s' } : {}} />
            <span>{autoRefresh ? 'Live' : 'Paused'}</span>
          </button>
          {/* Manual refresh */}
          <button onClick={fetchLogs} disabled={loading}
            className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-[11px] border bg-slate-900 text-slate-400 border-slate-800 hover:text-white hover:bg-slate-800 transition-all disabled:opacity-40">
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── Empty / loading states ──────────────────────── */}
      {loading && logs.length === 0 && (
        <div className="py-12 text-center text-slate-500 text-sm">
          <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />Loading logs…
        </div>
      )}
      {!loading && logs.length === 0 && (
        <div className="py-12 text-center">
          <ScrollText className="w-10 h-10 text-slate-700 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">No log entries found.</p>
          {(actionFilter || userFilter) && <p className="text-slate-600 text-xs mt-1">Try clearing the filters.</p>}
        </div>
      )}

      {/* ── Date-grouped feed ──────────────────────────── */}
      {logs.length > 0 && (
        <div className="rounded-2xl border border-slate-800/60 bg-slate-900/30 backdrop-blur-xl overflow-hidden">

          {/* Column headers */}
          <div className="grid grid-cols-[72px_100px_1fr] gap-0 border-b border-slate-800/60 bg-slate-950/60 px-4 py-2">
            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Time</span>
            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Actor</span>
            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Action · Details</span>
          </div>

          {/* Date groups */}
          {groups.map(({ date, items }) => (
            <div key={date}>

              {/* Sticky date header */}
              <div className="sticky top-0 z-10 px-4 py-1 bg-slate-950/80 backdrop-blur border-b border-t border-slate-800/40 flex items-center space-x-2">
                <Calendar className="w-3 h-3 text-slate-600" />
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{date}</span>
                <span className="text-[10px] text-slate-700 font-mono">{items.length} events</span>
              </div>

              {/* Log rows */}
              {items.map((log, idx) => {
                const meta = getActionDot(log.action);
                const compact = compactDetail(log.details);
                const ago = timeAgoShort(log.timestamp);
                return (
                  <div
                    key={log.log_id ?? idx}
                    className="grid grid-cols-[72px_100px_1fr] gap-0 px-4 py-1.5 border-b border-slate-800/30 hover:bg-slate-800/20 transition-colors group items-center"
                  >
                    {/* Time */}
                    <div className="flex flex-col min-w-0">
                      <span className="text-[11px] font-mono text-slate-300 leading-none">
                        {timeOnly(log.timestamp)}
                      </span>
                      <span className="text-[10px] font-mono text-slate-600 mt-0.5">{ago}</span>
                    </div>

                    {/* Actor */}
                    <div className="min-w-0 pr-2">
                      <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-slate-800/70 border border-slate-700/50 text-[11px] font-mono text-cyan-400/80 max-w-[90px]">
                        <span className="truncate">{log.user_id || '—'}</span>
                      </span>
                    </div>

                    {/* Action + detail inline */}
                    <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
                      {/* Colour dot */}
                      <span className={`flex-shrink-0 w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                      {/* Action label */}
                      <span className={`text-[12px] font-semibold whitespace-nowrap ${meta.textColor}`}>
                        {meta.label}
                      </span>
                      {/* Separator + compact detail */}
                      {compact && (
                        <>
                          <span className="text-slate-700 text-[11px] flex-shrink-0">·</span>
                          <span
                            className="text-[11px] text-slate-400 truncate group-hover:text-slate-200 transition-colors"
                            title={log.details}
                          >
                            {compact}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}

          {/* Footer */}
          <div className="px-4 py-2 border-t border-slate-800/50 flex items-center justify-between bg-slate-950/40">
            <span className="text-[11px] text-slate-600">
              {logs.length} entries · updated {lastRefreshed.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              {autoRefresh && ' · live'}
            </span>
            <button onClick={fetchLogs} disabled={loading}
              className="flex items-center space-x-1 text-[11px] text-violet-500 hover:text-violet-300 transition-colors disabled:opacity-40">
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
