import React, { useState, useEffect, useRef } from 'react';
import {
  Calendar, Users, UserPlus, BarChart3, Search, Plus, X, Check,
  MapPin, Phone, Mail, Clock, Tag, ChevronDown, ChevronRight,
  Activity, FileText, Stethoscope, AlertTriangle, Trash2, Eye
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
  staff?: StaffMember[];
}

interface StaffMember {
  username: string;
  name: string;
  designation: string;
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

// ══════════════════════════════════════════
// ██ ADMIN DASHBOARD
// ══════════════════════════════════════════
export default function AdminDashboard({ user }: { user: User }) {
  const [activeTab, setActiveTab] = useState<'events' | 'roster' | 'register' | 'records'>('events');

  const tabs = [
    { key: 'events' as const, label: 'Events', icon: <Calendar className="w-4 h-4" /> },
    { key: 'roster' as const, label: 'Roster', icon: <Users className="w-4 h-4" /> },
    { key: 'register' as const, label: 'Register Users', icon: <UserPlus className="w-4 h-4" /> },
    { key: 'records' as const, label: 'Camp Records', icon: <BarChart3 className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-6xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Admin Dashboard ⚙️</h2>
        <p className="text-slate-400 text-sm mt-0.5">Manage events, staff rosters, and camp records.</p>
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
      {activeTab === 'roster' && <RosterTab user={user} />}
      {activeTab === 'register' && <RegisterTab user={user} />}
      {activeTab === 'records' && <RecordsTab user={user} />}
    </div>
  );
}

// ═══════════════════════════════════════════
// TAB 1: EVENTS
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
                      {event.start_date}{event.end_date ? ` → ${event.end_date}` : ''} · {event.operational_hours || 'TBD'}
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

              {/* Expanded Details */}
              {expandedId === event.event_id && (
                <div className="px-6 pb-5 border-t border-slate-800/50 pt-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    <DetailItem icon={<MapPin className="w-3.5 h-3.5" />} label="Address" value={event.school_address} />
                    <DetailItem icon={<Users className="w-3.5 h-3.5" />} label="PoC Name" value={event.poc_name} />
                    <DetailItem icon={<Tag className="w-3.5 h-3.5" />} label="PoC Designation" value={event.poc_designation} />
                    <DetailItem icon={<Phone className="w-3.5 h-3.5" />} label="PoC Phone" value={event.poc_phone} />
                    <DetailItem icon={<Mail className="w-3.5 h-3.5" />} label="PoC Email" value={event.poc_email} />
                    <DetailItem icon={<Clock className="w-3.5 h-3.5" />} label="Hours" value={event.operational_hours} />
                  </div>
                </div>
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

// ── Create Event Modal ──
function CreateEventModal({ onClose, onCreated, user }: { onClose: () => void; onCreated: () => void; user: User }) {
  const [f, setF] = useState({
    school_name: '', school_address: '', poc_name: '', poc_designation: '', poc_phone: '', poc_email: '',
    start_date: '', end_date: '', operational_hours: '', tag: 'Upcoming',
  });
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => { nameRef.current?.focus(); }, []);

  const upd = (k: string, v: string) => setF(p => ({ ...p, [k]: v }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
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
              <ModalInput ref={nameRef} label="School Name *" value={f.school_name} onChange={v => upd('school_name', v)} placeholder="e.g. Govt High School, Bathinda" required />
              <ModalInput label="School Address" value={f.school_address} onChange={v => upd('school_address', v)} placeholder="Full address" />
            </div>
          </div>

          {/* PoC */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">School Point of Contact</h4>
            <div className="grid grid-cols-2 gap-3">
              <ModalInput label="PoC Name" value={f.poc_name} onChange={v => upd('poc_name', v)} placeholder="e.g. Principal Singh" />
              <ModalInput label="PoC Designation" value={f.poc_designation} onChange={v => upd('poc_designation', v)} placeholder="e.g. Principal" />
              <ModalInput label="PoC Phone" value={f.poc_phone} onChange={v => upd('poc_phone', v)} placeholder="e.g. 9876543210" type="tel" />
              <ModalInput label="PoC Email" value={f.poc_email} onChange={v => upd('poc_email', v)} placeholder="e.g. poc@school.edu" type="email" />
            </div>
          </div>

          {/* Scheduling */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Scheduling</h4>
            <div className="grid grid-cols-3 gap-3">
              <ModalInput label="Start Date *" value={f.start_date} onChange={v => upd('start_date', v)} type="date" required />
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

// ── Modal Input Helper ──
const ModalInput = React.forwardRef<HTMLInputElement, {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; required?: boolean;
}>(({ label, value, onChange, placeholder, type = 'text', required }, ref) => (
  <div>
    <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">{label}</label>
    <input ref={ref} type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} required={required}
      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white text-sm focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all placeholder-slate-600" />
  </div>
));

// ═══════════════════════════════════════════
// TAB 2: ROSTER MANAGEMENT
// ═══════════════════════════════════════════
function RosterTab({ user }: { user: User }) {
  const [events, setEvents] = useState<EventData[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [assignedStaff, setAssignedStaff] = useState<StaffMember[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/events').then(r => r.json()).then(data => {
      setEvents(data);
      if (data.length > 0 && !selectedEventId) setSelectedEventId(data[0].event_id);
    });
  }, []);

  useEffect(() => {
    if (selectedEventId) {
      fetch(`/api/events/${selectedEventId}`).then(r => r.json()).then(data => {
        setAssignedStaff(data.staff || []);
      });
    }
  }, [selectedEventId]);

  const doSearch = async (q: string) => {
    setSearchQuery(q);
    if (q.length === 0) {
      // Show all staff when empty
      const res = await fetch('/api/staff/search?q=');
      setSearchResults(await res.json());
      return;
    }
    const res = await fetch(`/api/staff/search?q=${encodeURIComponent(q)}`);
    setSearchResults(await res.json());
  };

  // Load all staff on mount
  useEffect(() => { doSearch(''); }, []);

  const assignStaff = async (username: string) => {
    if (!selectedEventId) return;
    setLoading(true);
    const res = await fetch(`/api/events/${selectedEventId}/staff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, user_id: user.username }),
    });
    const data = await res.json();
    if (!data.success && data.message) {
      alert(data.message);
    }
    // Refresh assigned list
    const eventRes = await fetch(`/api/events/${selectedEventId}`);
    const eventData = await eventRes.json();
    setAssignedStaff(eventData.staff || []);
    setLoading(false);
  };

  const removeStaff = async (username: string) => {
    if (!selectedEventId) return;
    await fetch(`/api/events/${selectedEventId}/staff/${username}?user_id=${user.username}`, { method: 'DELETE' });
    setAssignedStaff(prev => prev.filter(s => s.username !== username));
  };

  const assignedUsernames = new Set(assignedStaff.map(s => s.username));
  const availableStaff = searchResults.filter(s => !assignedUsernames.has(s.username));

  return (
    <div className="space-y-4">
      {/* Event Selector */}
      <div className="bg-slate-900/80 backdrop-blur-xl p-4 rounded-2xl border border-slate-800">
        <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Select Event</label>
        <select value={selectedEventId ?? ''} onChange={e => setSelectedEventId(Number(e.target.value))}
          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 text-sm">
          {events.map(ev => (
            <option key={ev.event_id} value={ev.event_id}>
              {ev.school_name} — {ev.start_date} ({ev.tag})
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Assigned Staff */}
        <div className="bg-slate-900/80 backdrop-blur-xl p-5 rounded-2xl border border-slate-800 shadow-xl">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center">
            <Users className="w-4 h-4 mr-2 text-emerald-400" />
            Assigned Staff ({assignedStaff.length})
          </h3>
          {assignedStaff.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-6">No staff assigned yet.</p>
          ) : (
            <div className="space-y-2">
              {assignedStaff.map(s => (
                <div key={s.username} className="flex items-center justify-between bg-slate-950 px-4 py-3 rounded-xl border border-slate-800">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-sm">
                      {s.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">{s.name}</p>
                      <p className="text-xs text-slate-400">{s.designation} · @{s.username}</p>
                    </div>
                  </div>
                  <button onClick={() => removeStaff(s.username)}
                    className="text-slate-500 hover:text-red-400 transition-colors p-1">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Staff Search */}
        <div className="bg-slate-900/80 backdrop-blur-xl p-5 rounded-2xl border border-slate-800 shadow-xl">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center">
            <Search className="w-4 h-4 mr-2 text-cyan-400" />
            Search & Add Staff
          </h3>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-500 w-4 h-4" />
            <input type="text" placeholder="Search by name, designation..."
              value={searchQuery} onChange={e => doSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 outline-none transition-all" />
          </div>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {availableStaff.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-4">No available staff found.</p>
            ) : (
              availableStaff.map(s => (
                <div key={s.username} className="flex items-center justify-between bg-slate-950 px-4 py-3 rounded-xl border border-slate-800 hover:border-cyan-500/30 transition-all">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center text-cyan-400 font-bold text-sm">
                      {s.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">{s.name}</p>
                      <p className="text-xs text-slate-400">{s.designation}</p>
                    </div>
                  </div>
                  <button onClick={() => assignStaff(s.username)} disabled={loading}
                    className="bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 border border-cyan-500/40 px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-50 flex items-center space-x-1">
                    <Plus className="w-3 h-3" /><span>Add</span>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// TAB 3: REGISTER USERS
// ═══════════════════════════════════════════
function RegisterTab({ user }: { user: User }) {
  const [f, setF] = useState({ username: '', password: '', name: '', role: 'Medical Staff', designation: '' });
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
        setF({ username: '', password: '', name: '', role: 'Medical Staff', designation: '' });
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

// ═══════════════════════════════════════════
// TAB 4: CAMP RECORDS
// ═══════════════════════════════════════════
function RecordsTab({ user }: { user: User }) {
  const [events, setEvents] = useState<EventData[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [stats, setStats] = useState<EventStats | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/events').then(r => r.json()).then(data => {
      setEvents(data);
      if (data.length > 0) setSelectedEventId(data[0].event_id);
    });
  }, []);

  useEffect(() => {
    if (selectedEventId) {
      setLoading(true);
      fetch(`/api/events/${selectedEventId}/stats`).then(r => r.json()).then(data => {
        setStats(data);
        setLoading(false);
      });
    }
  }, [selectedEventId]);

  return (
    <div className="space-y-4">
      {/* Event Selector */}
      <div className="bg-slate-900/80 backdrop-blur-xl p-4 rounded-2xl border border-slate-800">
        <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Select Event</label>
        <select value={selectedEventId ?? ''} onChange={e => setSelectedEventId(Number(e.target.value))}
          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 text-sm">
          {events.map(ev => (
            <option key={ev.event_id} value={ev.event_id}>
              {ev.school_name} — {ev.start_date} ({ev.tag})
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading stats...</div>
      ) : stats ? (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <StatCard label="Total Students" value={stats.total_students} color="cyan" />
            <StatCard label="Screened" value={stats.screened} color="blue" />
            <StatCard label="Normal" value={stats.normal} color="emerald" />
            <StatCard label="Observation" value={stats.observation} color="amber" />
            <StatCard label="Referred" value={stats.referred} color="red" />
          </div>

          {/* Staff on this event */}
          <div className="bg-slate-900/80 backdrop-blur-xl p-5 rounded-2xl border border-slate-800 shadow-xl">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center">
              <Stethoscope className="w-4 h-4 mr-2 text-emerald-400" />
              Assigned Staff
            </h3>
            {stats.staff.length === 0 ? (
              <p className="text-slate-500 text-sm">No staff assigned.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {stats.staff.map(s => (
                  <span key={s.username} className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-300">
                    <span className="font-medium text-white">{s.name}</span>
                    <span className="text-slate-500 ml-1.5">({s.designation})</span>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Records Table */}
          <div className="bg-slate-900/80 backdrop-blur-xl p-5 rounded-2xl border border-slate-800 shadow-xl">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center">
              <FileText className="w-4 h-4 mr-2 text-cyan-400" />
              Health Records ({stats.records.length})
            </h3>
            {stats.records.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-6">No records yet for this event.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-slate-500 border-b border-slate-800">
                    <tr>
                      <th className="pb-3 pr-4 font-medium">Student</th>
                      <th className="pb-3 pr-4 font-medium">Doctor</th>
                      <th className="pb-3 pr-4 font-medium">Assessment</th>
                      <th className="pb-3 font-medium">Time</th>
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
                          <td className="py-3 pr-4 text-white font-medium">{rec.student_name}</td>
                          <td className="py-3 pr-4 text-cyan-400">{rec.doctor_id}</td>
                          <td className={`py-3 pr-4 font-semibold ${assessColor}`}>{assessment}</td>
                          <td className="py-3 text-slate-400">{new Date(rec.timestamp).toLocaleString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="text-center py-12 text-slate-500">Select an event to view records.</div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    cyan: 'text-cyan-400 drop-shadow-[0_0_10px_rgba(34,211,238,0.8)]',
    blue: 'text-blue-400 drop-shadow-[0_0_10px_rgba(96,165,250,0.8)]',
    emerald: 'text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.8)]',
    amber: 'text-amber-400 drop-shadow-[0_0_10px_rgba(245,158,11,0.8)]',
    red: 'text-red-400 drop-shadow-[0_0_10px_rgba(239,68,68,0.8)]',
  };
  return (
    <div className="bg-slate-900/80 backdrop-blur-xl p-5 rounded-2xl border border-slate-800 shadow-xl relative overflow-hidden group hover:border-slate-700 transition-all">
      <div className="absolute top-0 right-0 w-20 h-20 bg-white/5 rounded-full blur-2xl -mr-6 -mt-6 group-hover:bg-white/10 transition-all" />
      <h4 className="text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">{label}</h4>
      <p className={`text-3xl font-bold ${colors[color]}`}>{value}</p>
    </div>
  );
}
