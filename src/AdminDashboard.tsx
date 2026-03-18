import React, { useState, useEffect, useRef } from 'react';
import {
  Calendar, Users, UserPlus, Search, Plus, X, Check,
  MapPin, Phone, Mail, Clock, Tag, ChevronDown, ChevronRight,
  Activity, FileText, Stethoscope, Trash2
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

const SPECIALIZATIONS = [
  'General Medicine', 'Pediatrics', 'Ophthalmology', 'ENT',
  'Dentistry', 'Dermatology', 'Orthopedics', 'Cardiology',
  'Psychiatry', 'Nursing', 'Emergency Medicine', 'Other',
];

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
  created_at: string;
  staff_count?: number;
  student_count?: number;
  screened_count?: number;
}

interface StaffMember {
  username: string;
  name: string;
  designation: string;
  specialization?: string;
  assigned_at?: string;
}

interface EventStats {
  total_students: number;
  screened: number;
  normal: number;
  observation: number;
  referred: number;
  records: any[];
  staff: StaffMember[];
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

function isValidPhone(phone: string): boolean {
  if (!phone) return true;
  return /^[+]?[\d\s\-()]{7,15}$/.test(phone.trim());
}

function isValidEmail(email: string): boolean {
  if (!email) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

// ══════════════════════════════════════════
// ██ ADMIN DASHBOARD
// ══════════════════════════════════════════
export default function AdminDashboard({ user }: { user: User }) {
  const [activeTab, setActiveTab] = useState<'events' | 'register'>('events');

  const tabs = [
    { key: 'events' as const, label: 'Events', icon: <Calendar className="w-4 h-4" /> },
    { key: 'register' as const, label: 'Register Users', icon: <UserPlus className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-6xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Admin Dashboard ⚙️</h2>
        <p className="text-slate-400 text-sm mt-0.5">Manage events, staff assignments, and camp records.</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-2 bg-slate-900/80 backdrop-blur-xl p-1.5 rounded-2xl border border-slate-800">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center space-x-2 px-5 py-3 rounded-xl text-sm font-medium transition-all flex-1 justify-center ${
              activeTab === tab.key
                ? 'bg-gradient-to-r from-cyan-500/20 to-blue-600/20 text-cyan-400 border border-cyan-500/30 shadow-[0_0_12px_rgba(34,211,238,0.1)]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {activeTab === 'events' && <EventsTab user={user} />}
      {activeTab === 'register' && <RegisterTab user={user} />}
    </div>
  );
}

// ═══════════════════════════════════════════
// TAB 1: EVENTS (with inline roster + records)
// ═══════════════════════════════════════════
function EventsTab({ user }: { user: User }) {
  const [events, setEvents] = useState<EventData[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [filterTag, setFilterTag] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editingTag, setEditingTag] = useState<number | null>(null);

  const fetchEvents = () => {
    fetch('/api/events').then(r => r.json()).then(setEvents);
  };

  useEffect(() => { fetchEvents(); }, []);

  const filtered = filterTag ? events.filter(e => e.tag === filterTag) : events;

  const updateTag = async (eventId: number, newTag: string) => {
    await fetch(`/api/events/${eventId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag: newTag, user_id: user.username }),
    });
    setEditingTag(null);
    fetchEvents();
  };

  return (
    <div className="space-y-4">
      {/* Header + Filter + Create */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-xs text-slate-500 font-medium">Filter:</span>
          <button onClick={() => setFilterTag('')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${!filterTag ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-600'}`}>
            All
          </button>
          {TAGS.map(t => (
            <button key={t} onClick={() => setFilterTag(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${filterTag === t ? TAG_STYLES[t] : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-600'}`}>
              {t}
            </button>
          ))}
        </div>
        <button onClick={() => setShowCreate(true)}
          className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white px-5 py-2.5 rounded-xl font-bold transition-all flex items-center space-x-2 shadow-lg text-sm">
          <Plus className="w-4 h-4" /><span>Create Event</span>
        </button>
      </div>

      {/* Events List */}
      {filtered.length === 0 ? (
        <div className="bg-slate-900/80 backdrop-blur-xl p-12 rounded-2xl border border-slate-800 text-center">
          <Calendar className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">No events found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(event => (
            <div key={event.event_id} className="bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
              {/* Row */}
              <button onClick={() => setExpandedId(expandedId === event.event_id ? null : event.event_id)}
                className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-800/30 transition-colors text-left">
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
                  {editingTag === event.event_id ? (
                    <div className="flex space-x-1" onClick={e => e.stopPropagation()}>
                      {TAGS.map(t => (
                        <button key={t} onClick={() => updateTag(event.event_id, t)}
                          className={`px-2 py-1 rounded text-xs font-medium border ${TAG_STYLES[t]}`}>{t}</button>
                      ))}
                    </div>
                  ) : (
                    <button onClick={e => { e.stopPropagation(); setEditingTag(event.event_id); }}
                      className={`px-3 py-1 rounded-lg text-xs font-bold border ${TAG_STYLES[event.tag] || TAG_STYLES.Upcoming}`}>
                      {event.tag}
                    </button>
                  )}
                  {expandedId === event.event_id ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                </div>
              </button>

              {/* Expanded: Details + Staff + Records */}
              {expandedId === event.event_id && (
                <EventExpandedPanel eventId={event.event_id} event={event} user={user} onStaffChange={fetchEvents} />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Event Modal */}
      {showCreate && <CreateEventModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); fetchEvents(); }} user={user} />}
    </div>
  );
}

// ── Expanded panel for each event (details + staff + records) ──
function EventExpandedPanel({ eventId, event, user, onStaffChange }: {
  eventId: number; event: EventData; user: User; onStaffChange: () => void;
}) {
  const [activeSection, setActiveSection] = useState<'details' | 'staff' | 'records'>('details');
  const [assignedStaff, setAssignedStaff] = useState<StaffMember[]>([]);
  const [stats, setStats] = useState<EventStats | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`/api/events/${eventId}`).then(r => r.json()).then(data => {
      setAssignedStaff(data.staff || []);
    });
    doSearch('');
  }, [eventId]);

  useEffect(() => {
    if (activeSection === 'records') {
      fetch(`/api/events/${eventId}/stats`).then(r => r.json()).then(setStats);
    }
  }, [activeSection, eventId]);

  const doSearch = async (q: string) => {
    setSearchQuery(q);
    const res = await fetch(`/api/staff/search?q=${encodeURIComponent(q)}`);
    setSearchResults(await res.json());
  };

  const assignStaff = async (username: string) => {
    setLoading(true);
    await fetch(`/api/events/${eventId}/staff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, user_id: user.username }),
    });
    const eventRes = await fetch(`/api/events/${eventId}`);
    const eventData = await eventRes.json();
    setAssignedStaff(eventData.staff || []);
    onStaffChange();
    setLoading(false);
  };

  const removeStaff = async (username: string) => {
    await fetch(`/api/events/${eventId}/staff/${username}?user_id=${user.username}`, { method: 'DELETE' });
    setAssignedStaff(prev => prev.filter(s => s.username !== username));
    onStaffChange();
  };

  const assignedUsernames = new Set(assignedStaff.map(s => s.username));
  const availableStaff = searchResults.filter(s => !assignedUsernames.has(s.username));

  const sectionBtns = [
    { key: 'details' as const, label: 'Details', icon: <MapPin className="w-3.5 h-3.5" /> },
    { key: 'staff' as const, label: 'Medical Staff', icon: <Users className="w-3.5 h-3.5" /> },
    { key: 'records' as const, label: 'Camp Records', icon: <FileText className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="border-t border-slate-800/50">
      {/* Section Tabs */}
      <div className="flex space-x-1 px-6 pt-3">
        {sectionBtns.map(s => (
          <button key={s.key} onClick={() => setActiveSection(s.key)}
            className={`flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all ${
              activeSection === s.key
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

        {/* MEDICAL STAFF */}
        {activeSection === 'staff' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Assigned */}
            <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800">
              <h4 className="text-sm font-semibold text-white mb-3 flex items-center">
                <Stethoscope className="w-4 h-4 mr-2 text-emerald-400" />
                Assigned ({assignedStaff.length})
              </h4>
              {assignedStaff.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-4">No staff assigned yet.</p>
              ) : (
                <div className="space-y-2">
                  {assignedStaff.map(s => (
                    <div key={s.username} className="flex items-center justify-between bg-slate-900 px-3 py-2.5 rounded-lg border border-slate-800">
                      <div className="flex items-center space-x-2.5">
                        <div className="w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-xs">
                          {s.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-white text-sm font-medium">{s.name}</p>
                          <p className="text-xs text-slate-400">{s.designation}{s.specialization ? ` · ${s.specialization}` : ''}</p>
                        </div>
                      </div>
                      <button onClick={() => removeStaff(s.username)}
                        className="text-slate-500 hover:text-red-400 transition-colors p-1">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Search & Add */}
            <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800">
              <h4 className="text-sm font-semibold text-white mb-3 flex items-center">
                <Search className="w-4 h-4 mr-2 text-cyan-400" />
                Search & Add Staff
              </h4>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-500 w-3.5 h-3.5" />
                <input type="text" placeholder="Search by name, designation, specialization..."
                  value={searchQuery} onChange={e => doSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-slate-900 border border-slate-800 text-white text-sm focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 outline-none transition-all" />
              </div>
              <div className="space-y-1.5 max-h-52 overflow-y-auto">
                {availableStaff.length === 0 ? (
                  <p className="text-slate-500 text-xs text-center py-3">No available staff found.</p>
                ) : (
                  availableStaff.map(s => (
                    <div key={s.username} className="flex items-center justify-between bg-slate-900 px-3 py-2.5 rounded-lg border border-slate-800 hover:border-cyan-500/30 transition-all">
                      <div className="flex items-center space-x-2.5">
                        <div className="w-7 h-7 rounded-lg bg-cyan-500/20 flex items-center justify-center text-cyan-400 font-bold text-xs">
                          {s.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-white text-sm font-medium">{s.name}</p>
                          <p className="text-xs text-slate-400">{s.designation}{s.specialization ? ` · ${s.specialization}` : ''}</p>
                        </div>
                      </div>
                      <button onClick={() => assignStaff(s.username)} disabled={loading}
                        className="bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 border border-cyan-500/40 px-2.5 py-1 rounded-lg text-xs font-bold transition-all disabled:opacity-50 flex items-center space-x-1">
                        <Plus className="w-3 h-3" /><span>Add</span>
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* CAMP RECORDS */}
        {activeSection === 'records' && (
          stats ? (
            <div className="space-y-4">
              {/* Stats */}
              <div className="grid grid-cols-5 gap-3">
                <MiniStat label="Students" value={stats.total_students} color="text-cyan-400" />
                <MiniStat label="Screened" value={stats.screened} color="text-blue-400" />
                <MiniStat label="Normal" value={stats.normal} color="text-emerald-400" />
                <MiniStat label="Observation" value={stats.observation} color="text-amber-400" />
                <MiniStat label="Referred" value={stats.referred} color="text-red-400" />
              </div>

              {/* Staff */}
              {stats.staff.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {stats.staff.map(s => (
                    <span key={s.username} className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300">
                      <span className="font-medium text-white">{s.name}</span>
                      <span className="text-slate-500 ml-1">({s.designation})</span>
                    </span>
                  ))}
                </div>
              )}

              {/* Records */}
              {stats.records.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-4">No records yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-slate-500 border-b border-slate-800">
                      <tr>
                        <th className="pb-2 pr-4 font-medium text-xs">Student</th>
                        <th className="pb-2 pr-4 font-medium text-xs">Doctor</th>
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
                        } catch {}
                        const assessColor = assessment === 'Normal' ? 'text-emerald-400' : assessment === 'Referred' ? 'text-red-400' : assessment === 'Observation' ? 'text-amber-400' : 'text-slate-400';
                        return (
                          <tr key={rec.record_id} className="hover:bg-slate-800/30">
                            <td className="py-2.5 pr-4 text-white font-medium text-xs">{rec.student_name}</td>
                            <td className="py-2.5 pr-4 text-cyan-400 text-xs">{rec.doctor_id}</td>
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

// ── Create Event Modal (with validation) ──
function CreateEventModal({ onClose, onCreated, user }: { onClose: () => void; onCreated: () => void; user: User }) {
  const [f, setF] = useState({
    school_name: '', school_address: '', poc_name: '', poc_designation: '', poc_phone: '', poc_email: '',
    start_date: '', end_date: '', operational_hours: '', tag: 'Upcoming',
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => { nameRef.current?.focus(); }, []);

  const upd = (k: string, v: string) => {
    setF(p => ({ ...p, [k]: v }));
    setErrors(p => ({ ...p, [k]: '' }));
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!f.school_name.trim()) e.school_name = 'Required';
    if (!f.start_date) e.start_date = 'Required';
    if (f.poc_phone && !isValidPhone(f.poc_phone)) e.poc_phone = 'Invalid phone number';
    if (f.poc_email && !isValidEmail(f.poc_email)) e.poc_email = 'Invalid email address';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...f, created_by: user.username }),
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
          {/* School Info */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">School Information</h4>
            <div className="grid grid-cols-1 gap-3">
              <ModalInput ref={nameRef} label="School Name *" value={f.school_name} onChange={v => upd('school_name', v)} placeholder="e.g. Govt High School, Bathinda" required error={errors.school_name} />
              <ModalInput label="School Address" value={f.school_address} onChange={v => upd('school_address', v)} placeholder="Full address" />
            </div>
          </div>

          {/* PoC */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">School Point of Contact</h4>
            <div className="grid grid-cols-2 gap-3">
              <ModalInput label="PoC Name" value={f.poc_name} onChange={v => upd('poc_name', v)} placeholder="e.g. Principal Singh" />
              <ModalInput label="PoC Designation" value={f.poc_designation} onChange={v => upd('poc_designation', v)} placeholder="e.g. Principal" />
              <ModalInput label="PoC Phone" value={f.poc_phone} onChange={v => upd('poc_phone', v)} placeholder="e.g. 9876543210" type="tel" error={errors.poc_phone} />
              <ModalInput label="PoC Email" value={f.poc_email} onChange={v => upd('poc_email', v)} placeholder="e.g. poc@school.edu" type="email" error={errors.poc_email} />
            </div>
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

          {/* Tag */}
          <div>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Status Tag</h4>
            <div className="flex space-x-2">
              {TAGS.map(t => (
                <button key={t} type="button" onClick={() => upd('tag', t)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all border ${f.tag === t ? TAG_STYLES[t] : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-600'}`}>
                  {f.tag === t && <Check className="w-3 h-3 inline mr-1" />}{t}
                </button>
              ))}
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

// ── Modal Input Helper (with error support) ──
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
// TAB 2: REGISTER USERS (with specialization)
// ═══════════════════════════════════════════
function RegisterTab({ user }: { user: User }) {
  const [f, setF] = useState({ username: '', password: '', name: '', role: 'Medical Staff', designation: '', specialization: '' });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const upd = (k: string, v: string) => setF(p => ({ ...p, [k]: v }));

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/users/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...f, admin_user: user.username }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: `Successfully registered ${f.name} as ${f.role}` });
        setF({ username: '', password: '', name: '', role: 'Medical Staff', designation: '', specialization: '' });
      } else {
        setMessage({ type: 'error', text: data.message || 'Registration failed' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Connection error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto">
      <div className="bg-slate-900/80 backdrop-blur-xl p-6 rounded-2xl border border-slate-800 shadow-xl">
        <h3 className="text-lg font-semibold text-white mb-5 flex items-center">
          <UserPlus className="w-5 h-5 mr-2 text-cyan-400" />
          Register New User
        </h3>

        {message && (
          <div className={`p-3 rounded-xl text-sm mb-4 border ${
            message.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-red-500/10 border-red-500/30 text-red-400'
          }`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <ModalInput label="Username *" value={f.username} onChange={v => upd('username', v)} placeholder="e.g. doc_kumar" required />
            <ModalInput label="Password *" value={f.password} onChange={v => upd('password', v)} placeholder="Min 4 chars" type="password" required />
          </div>
          <ModalInput label="Full Name *" value={f.name} onChange={v => upd('name', v)} placeholder="e.g. Dr. Anil Kumar" required />

          <div>
            <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Role</label>
            <div className="flex space-x-3">
              {['Admin', 'Medical Staff'].map(role => (
                <button key={role} type="button" onClick={() => upd('role', role)}
                  className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all border ${
                    f.role === role
                      ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-600'
                  }`}>
                  {role}
                </button>
              ))}
            </div>
          </div>

          {f.role === 'Medical Staff' && (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Designation</label>
                <div className="flex flex-wrap gap-2">
                  {['Doctor', 'Nurse', 'Dentist', 'Paramedic', 'Specialist'].map(d => (
                    <button key={d} type="button" onClick={() => upd('designation', d)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
                        f.designation === d
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-600'
                      }`}>
                      {f.designation === d && <Check className="w-3 h-3 inline mr-1" />}{d}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Specialization</label>
                <div className="flex flex-wrap gap-2">
                  {SPECIALIZATIONS.map(s => (
                    <button key={s} type="button" onClick={() => upd('specialization', s)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                        f.specialization === s
                          ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-600'
                      }`}>
                      {f.specialization === s && <Check className="w-3 h-3 inline mr-1" />}{s}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          <button type="submit" disabled={saving}
            className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold py-3.5 rounded-xl shadow-lg transition-all disabled:opacity-50 mt-2">
            {saving ? 'Registering...' : 'Register User'}
          </button>
        </form>
      </div>
    </div>
  );
}
