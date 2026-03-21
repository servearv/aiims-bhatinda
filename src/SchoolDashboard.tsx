import React, { useState, useEffect, useRef } from 'react';
import Papa from 'papaparse';
import {
  Calendar, Users, Plus, X, Check, ChevronRight, ArrowRight,
  Upload, Download, FileText, Activity, UserPlus, Search,
  ChevronDown, AlertTriangle, BarChart3, ClipboardList
} from 'lucide-react';
import GeneralInfoForm from './GeneralInfoForm';

// ── Types ──
type User = { username: string; role: string; name: string };

interface EventData {
  event_id: number;
  school_name: string;
  school_address: string;
  start_date: string;
  end_date: string;
  operational_hours: string;
  tag: string;
  student_count?: number;
  screened_count?: number;
}

interface Student {
  student_id: number;
  name: string;
  age: number;
  dob: string;
  gender: string;
  student_class: string;
  section: string;
  blood_group: string;
  father_name: string;
  phone: string;
  status: string;
  is_examined?: number;
  last_exam_data?: string;
}

interface EventStats {
  total_students: number;
  screened: number;
  normal: number;
  observation: number;
  referred: number;
  records: any[];
  staff: any[];
}

// ── Helpers ──
function formatDate(d: string): string {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${String(dt.getFullYear()).slice(-2)}`;
}

function calcAge(dob: string): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

const CLASSES = ['', 'Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
const SECTIONS = ['', 'A', 'B', 'C', 'D', 'E'];
const BLOOD_GROUPS = ['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

// ════════════════════════════════════════
// ██ SCHOOL DASHBOARD (Main Export)
// ════════════════════════════════════════
export default function SchoolDashboard({ user }: { user: User }) {
  const [selectedEvent, setSelectedEvent] = useState<EventData | null>(null);

  if (!selectedEvent) {
    return <SchoolEventList user={user} onSelect={setSelectedEvent} />;
  }

  return <EventWorkspace user={user} event={selectedEvent} onBack={() => setSelectedEvent(null)} />;
}

// ════════════════════════════════════════
// ██ EVENT LIST (Homepage)
// ════════════════════════════════════════
function SchoolEventList({ user, onSelect }: { user: User; onSelect: (e: EventData) => void }) {
  const [events, setEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/events/school?username=${encodeURIComponent(user.username)}`)
      .then(r => r.json())
      .then(data => { setEvents(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [user.username]);

  const tagStyle = (tag: string) => {
    switch (tag) {
      case 'Ongoing': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'Upcoming': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'Completed': return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-4xl mx-auto">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white tracking-tight">School Dashboard 🏫</h2>
        <p className="text-slate-400 text-sm mt-1">Manage student rosters and track camp progress.</p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading events...</div>
      ) : events.length === 0 ? (
        <div className="bg-slate-900/80 backdrop-blur-xl p-12 rounded-2xl border border-slate-800 text-center">
          <Calendar className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">No events assigned to your school.</p>
          <p className="text-slate-500 text-sm mt-1">Contact an administrator to create events for your school.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map(event => (
            <button key={event.event_id} onClick={() => onSelect(event)}
              className="w-full text-left bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-slate-800 hover:border-cyan-500/40 transition-all p-5 group shadow-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 rounded-xl bg-violet-500/10 flex items-center justify-center group-hover:bg-violet-500/20 transition-all">
                    <Calendar className="w-6 h-6 text-violet-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold text-lg group-hover:text-violet-300 transition-colors">{event.school_name}</h3>
                    <p className="text-sm text-slate-400 mt-0.5">
                      {formatDate(event.start_date)}{event.end_date ? ` → ${formatDate(event.end_date)}` : ''}
                      {event.operational_hours ? ` · ${event.operational_hours}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <span className="text-xs text-slate-500">
                    <Users className="w-3.5 h-3.5 inline mr-1" />{event.student_count ?? 0} students
                  </span>
                  <span className="text-xs text-slate-500">
                    <Activity className="w-3.5 h-3.5 inline mr-1" />{event.screened_count ?? 0} screened
                  </span>
                  <span className={`px-3 py-1 rounded-lg text-xs font-bold border ${tagStyle(event.tag)}`}>{event.tag}</span>
                  <ArrowRight className="w-5 h-5 text-slate-500 group-hover:text-violet-400 transition-colors" />
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════
// ██ EVENT WORKSPACE (dual option)
// ════════════════════════════════════════
function EventWorkspace({ user, event, onBack }: { user: User; event: EventData; onBack: () => void }) {
  const [activeView, setActiveView] = useState<'roster' | 'progress'>('roster');

  return (
    <div className="space-y-5 animate-in fade-in duration-500 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-3">
            <button onClick={onBack} className="text-slate-400 hover:text-violet-400 transition-colors text-sm flex items-center space-x-1">
              <ChevronRight className="w-4 h-4 rotate-180" /><span>Back</span>
            </button>
            <h2 className="text-2xl font-bold text-white tracking-tight">{event.school_name}</h2>
          </div>
          <p className="text-slate-400 text-sm mt-0.5">
            {formatDate(event.start_date)}{event.end_date ? ` → ${formatDate(event.end_date)}` : ''} · {event.operational_hours || 'TBD'}
          </p>
        </div>
      </div>

      {/* View Toggle */}
      <div className="flex space-x-2 bg-slate-900/80 backdrop-blur-xl p-1.5 rounded-2xl border border-slate-800">
        <button onClick={() => setActiveView('roster')}
          className={`flex items-center space-x-2 px-5 py-3 rounded-xl text-sm font-medium transition-all flex-1 justify-center ${
            activeView === 'roster'
              ? 'bg-gradient-to-r from-violet-500/20 to-purple-600/20 text-violet-400 border border-violet-500/30 shadow-[0_0_12px_rgba(139,92,246,0.1)]'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}>
          <Users className="w-4 h-4" /><span>Manage Students</span>
        </button>
        <button onClick={() => setActiveView('progress')}
          className={`flex items-center space-x-2 px-5 py-3 rounded-xl text-sm font-medium transition-all flex-1 justify-center ${
            activeView === 'progress'
              ? 'bg-gradient-to-r from-violet-500/20 to-purple-600/20 text-violet-400 border border-violet-500/30 shadow-[0_0_12px_rgba(139,92,246,0.1)]'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}>
          <BarChart3 className="w-4 h-4" /><span>Progress Tracking</span>
        </button>
      </div>

      {activeView === 'roster' && <RosterManagement user={user} eventId={event.event_id} />}
      {activeView === 'progress' && <ProgressTracking eventId={event.event_id} />}
    </div>
  );
}

// ════════════════════════════════════════
// ██ OPTION A: ROSTER MANAGEMENT
// ════════════════════════════════════════
function RosterManagement({ user, eventId }: { user: User; eventId: number }) {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCSVUpload, setShowCSVUpload] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);

  const fetchStudents = () => {
    setLoading(true);
    const params = new URLSearchParams({ event_id: String(eventId) });
    if (searchQuery) params.set('query', searchQuery);
    fetch(`/api/students/search?${params}`)
      .then(r => r.json())
      .then(data => { setStudents(data); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchStudents(); }, [eventId, searchQuery]);

  const totalStudents = students.length;
  const examinedStudents = students.filter(s => s.is_examined).length;
  const progressPct = totalStudents > 0 ? Math.round((examinedStudents / totalStudents) * 100) : 0;

  // If editing a student's general info, show the form
  if (editingStudent) {
    return (
      <div className="space-y-4">
        <button onClick={() => { setEditingStudent(null); fetchStudents(); }}
          className="text-slate-400 hover:text-violet-400 transition-colors text-sm flex items-center space-x-1">
          <ChevronRight className="w-4 h-4 rotate-180" /><span>Back to Roster</span>
        </button>
        <GeneralInfoForm
          student={editingStudent as any}
          eventId={eventId}
          user={user}
          onClose={() => { setEditingStudent(null); fetchStudents(); }}
        />
      </div>
    );
  }

  // Empty state
  if (!loading && students.length === 0 && !searchQuery) {
    return (
      <div className="space-y-4">
        <div className="bg-slate-900/80 backdrop-blur-xl p-12 rounded-2xl border border-slate-800 text-center">
          <Users className="w-16 h-16 text-slate-600 mx-auto mb-5" />
          <h3 className="text-xl font-bold text-white mb-2">No Students Yet</h3>
          <p className="text-slate-400 text-sm mb-8">Add students to this event to get started.</p>
          <div className="flex justify-center space-x-4">
            <button onClick={() => setShowAddModal(true)}
              className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-400 hover:to-purple-500 text-white px-8 py-4 rounded-2xl font-bold transition-all flex items-center space-x-3 shadow-[0_0_25px_rgba(139,92,246,0.3)]">
              <UserPlus className="w-6 h-6" /><span>Add Single Student</span>
            </button>
            <button onClick={() => setShowCSVUpload(true)}
              className="bg-slate-800 hover:bg-slate-700 text-white px-8 py-4 rounded-2xl font-bold transition-all flex items-center space-x-3 border border-slate-700 hover:border-violet-500/30">
              <Upload className="w-6 h-6 text-violet-400" /><span>Bulk Upload via CSV</span>
            </button>
          </div>
        </div>

        {showAddModal && <AddStudentModal onClose={() => setShowAddModal(false)} onCreated={() => { setShowAddModal(false); fetchStudents(); }} userId={user.username} eventId={eventId} />}
        {showCSVUpload && <CSVUploadPanel eventId={eventId} userId={user.username} onClose={() => setShowCSVUpload(false)} onDone={() => { setShowCSVUpload(false); fetchStudents(); }} />}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Progress Bar */}
      <div className="bg-slate-900/80 backdrop-blur-xl p-4 rounded-2xl border border-slate-800">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-slate-400">Roster Progress</span>
          <span className="text-sm font-bold text-violet-400">{examinedStudents}/{totalStudents} screened ({progressPct}%)</span>
        </div>
        <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-violet-500 to-purple-500 rounded-full transition-all duration-700 ease-out"
            style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      {/* Search + Actions */}
      <div className="bg-slate-900/80 backdrop-blur-xl p-4 rounded-2xl border border-slate-800">
        <div className="flex space-x-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-violet-500 w-4 h-4" />
            <input type="text" placeholder="Search students..."
              value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 outline-none transition-all text-sm" />
          </div>
          <button onClick={() => setShowAddModal(true)}
            className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-400 hover:to-purple-500 text-white px-5 py-3 rounded-xl font-bold transition-all flex items-center space-x-2 shadow-lg whitespace-nowrap text-sm">
            <Plus className="w-4 h-4" /><span>Add Student</span>
          </button>
          <button onClick={() => setShowCSVUpload(true)}
            className="bg-slate-800 hover:bg-slate-700 text-violet-400 border border-slate-700 hover:border-violet-500/30 px-5 py-3 rounded-xl font-bold transition-all flex items-center space-x-2 whitespace-nowrap text-sm">
            <Upload className="w-4 h-4" /><span>CSV Upload</span>
          </button>
        </div>
      </div>

      {/* Student Table */}
      {loading ? (
        <div className="text-center py-8 text-slate-400">Loading students...</div>
      ) : (
        <div className="bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-slate-500 border-b border-slate-800 bg-slate-950/50">
                <tr>
                  <th className="px-5 py-3 font-medium text-xs uppercase tracking-wider">Name</th>
                  <th className="px-5 py-3 font-medium text-xs uppercase tracking-wider">Class</th>
                  <th className="px-5 py-3 font-medium text-xs uppercase tracking-wider">Gender</th>
                  <th className="px-5 py-3 font-medium text-xs uppercase tracking-wider">Age</th>
                  <th className="px-5 py-3 font-medium text-xs uppercase tracking-wider">Phone</th>
                  <th className="px-5 py-3 font-medium text-xs uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3 font-medium text-xs uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {students.map(s => {
                  const statusStyle = s.is_examined
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-400 border-amber-500/30';
                  const statusLabel = s.is_examined ? 'Examined' : (s.status || 'Pending Examination');
                  return (
                    <tr key={s.student_id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-5 py-3 text-white font-medium">{s.name}</td>
                      <td className="px-5 py-3 text-slate-300">{s.student_class || '—'}{s.section ? `-${s.section}` : ''}</td>
                      <td className="px-5 py-3 text-slate-300">{s.gender === 'M' ? 'Male' : s.gender === 'F' ? 'Female' : '—'}</td>
                      <td className="px-5 py-3 text-slate-300">{s.age || '—'}</td>
                      <td className="px-5 py-3 text-slate-300">{s.phone || '—'}</td>
                      <td className="px-5 py-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${statusStyle}`}>{statusLabel}</span>
                      </td>
                      <td className="px-5 py-3">
                        <button onClick={() => setEditingStudent(s)}
                          className="bg-violet-500/20 hover:bg-violet-500/30 text-violet-400 border border-violet-500/30 px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5">
                          <ClipboardList className="w-3 h-3" /><span>Fill Info</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showAddModal && <AddStudentModal onClose={() => setShowAddModal(false)} onCreated={() => { setShowAddModal(false); fetchStudents(); }} userId={user.username} eventId={eventId} />}
      {showCSVUpload && <CSVUploadPanel eventId={eventId} userId={user.username} onClose={() => setShowCSVUpload(false)} onDone={() => { setShowCSVUpload(false); fetchStudents(); }} />}
    </div>
  );
}

// ════════════════════════════════════════
// ██ ADD STUDENT MODAL (reused from DoctorWorkflow)
// ════════════════════════════════════════
function AddStudentModal({ onClose, onCreated, userId, eventId }: {
  onClose: () => void; onCreated: () => void; userId: string; eventId: number;
}) {
  const [f, setF] = useState({ name: '', age: '', dob: '', gender: '', student_class: '', section: '', blood_group: '', father_name: '', phone: '' });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => { nameRef.current?.focus(); }, []);

  const upd = (k: string, v: string) => {
    setF(p => ({ ...p, [k]: v }));
    setErrors(p => ({ ...p, [k]: '' }));
    // Auto-calc age from DOB
    if (k === 'dob' && v) {
      const age = calcAge(v);
      if (age !== null) setF(p => ({ ...p, dob: v, age: String(age) }));
    }
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!f.name.trim()) e.name = 'Name is required';
    if (!f.gender) e.gender = 'Sex is required';
    if (f.phone?.trim() && !/^\d{10}$/.test(f.phone.replace(/\D/g, ''))) e.phone = 'Valid 10-digit phone is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/students', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...f, age: f.age ? parseInt(f.age) : null, user_id: userId, event_id: eventId, added_by: userId }),
      });
      const data = await res.json();
      if (data.success) onCreated();
    } catch { alert('Error creating student'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-lg p-6 shadow-2xl relative" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        <h3 className="text-xl font-bold text-white mb-5 flex items-center"><UserPlus className="w-5 h-5 mr-2 text-violet-400" /> Add New Student</h3>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">Student Name *</label>
              <input ref={nameRef} value={f.name} onChange={e => upd('name', e.target.value)} required
                className={`w-full bg-slate-950 border rounded-xl px-4 py-3 text-white text-lg focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 placeholder-slate-600 ${errors.name ? 'border-red-500/50' : 'border-slate-800'}`} placeholder="Full name" />
              {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name}</p>}
            </div>

            {/* Sex */}
            <div>
              <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">Sex *</label>
              <div className="flex space-x-3 mt-1">
                {[{ v: 'M', label: 'Male' }, { v: 'F', label: 'Female' }].map(opt => (
                  <button key={opt.v} type="button" onClick={() => upd('gender', opt.v)}
                    className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all border flex items-center justify-center space-x-2 ${
                      f.gender === opt.v
                        ? 'bg-violet-500/20 text-violet-400 border-violet-500/30'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-600'
                    }`}>
                    {f.gender === opt.v && <Check className="w-3.5 h-3.5" />}
                    <span>{opt.label}</span>
                  </button>
                ))}
              </div>
              {errors.gender && <p className="text-red-400 text-xs mt-1">{errors.gender}</p>}
            </div>

            {/* DOB */}
            <div>
              <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">Date of Birth *</label>
              <input type="date" value={f.dob} onChange={e => upd('dob', e.target.value)}
                className={`w-full bg-slate-950 border rounded-xl px-3 py-2.5 text-white text-sm focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all ${errors.dob ? 'border-red-500/50' : 'border-slate-800'}`} />
              {errors.dob && <p className="text-red-400 text-xs mt-1">{errors.dob}</p>}
              {f.age && <p className="text-violet-400 text-xs mt-1">Age: {f.age} years</p>}
            </div>

            {/* Class */}
            <div>
              <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">Class</label>
              <select value={f.student_class} onChange={e => upd('student_class', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white text-sm focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all">
                {CLASSES.map(o => <option key={o} value={o}>{o || '— Select —'}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">Section</label>
              <select value={f.section} onChange={e => upd('section', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white text-sm focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all">
                {SECTIONS.map(o => <option key={o} value={o}>{o || '— Select —'}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">Blood Group</label>
              <select value={f.blood_group} onChange={e => upd('blood_group', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white text-sm focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all">
                {BLOOD_GROUPS.map(o => <option key={o} value={o}>{o || '— Select —'}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">Father's Name</label>
              <input value={f.father_name} onChange={e => upd('father_name', e.target.value)} placeholder="Optional"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white text-sm focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all placeholder-slate-600" />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">Phone</label>
              <input value={f.phone} onChange={e => upd('phone', e.target.value)} placeholder="Optional" type="tel"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white text-sm focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all placeholder-slate-600" />
            </div>
          </div>
          <button type="submit" disabled={saving}
            className="w-full bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-400 hover:to-purple-500 text-white font-bold py-3.5 rounded-xl shadow-lg transition-all disabled:opacity-50 mt-2">
            {saving ? 'Saving...' : 'Add Student'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ════════════════════════════════════════
// ██ CSV UPLOAD PANEL
// ════════════════════════════════════════
interface ParsedRow {
  data: Record<string, string>;
  valid: boolean;
  errors: string[];
}

function CSVUploadPanel({ eventId, userId, onClose, onDone }: {
  eventId: number; userId: string; onClose: () => void; onDone: () => void;
}) {
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ inserted: any[]; errors: any[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = () => {
    window.open('/api/students/csv-template', '_blank');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows: ParsedRow[] = results.data.map((row: any) => {
          const errors: string[] = [];
          if (!row.name?.trim()) errors.push('Name is required');
          if (row.gender && !['M', 'F', 'm', 'f'].includes(row.gender.trim())) errors.push('Gender must be M or F');
          if (row.dob) {
            const d = new Date(row.dob);
            if (isNaN(d.getTime())) errors.push('Invalid DOB format (use YYYY-MM-DD)');
          }
          if (row.phone?.trim()) {
            if (!/^\d{10}$/.test(row.phone.replace(/\D/g, ''))) errors.push('Invalid 10-digit phone number');
          }
          return { data: row, valid: errors.length === 0, errors };
        });
        setParsedRows(rows);
        setResult(null);
      },
    });
  };

  const handleUpload = async () => {
    const validRows = parsedRows.filter(r => r.valid).map(r => r.data);
    if (validRows.length === 0) return;

    setUploading(true);
    try {
      const res = await fetch('/api/students/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ students: validRows, event_id: eventId, added_by: userId }),
      });
      const data = await res.json();
      setResult({ inserted: data.inserted, errors: data.errors });
    } catch { alert('Upload failed'); }
    finally { setUploading(false); }
  };

  const validCount = parsedRows.filter(r => r.valid).length;
  const errorCount = parsedRows.filter(r => !r.valid).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-3xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        <h3 className="text-xl font-bold text-white mb-5 flex items-center"><Upload className="w-5 h-5 mr-2 text-violet-400" /> Bulk Student Upload</h3>

        {/* Step 1: Template + File */}
        <div className="space-y-4">
          <div className="flex space-x-3">
            <button onClick={downloadTemplate}
              className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 text-violet-400 border border-slate-700 px-4 py-2.5 rounded-xl text-sm font-medium transition-all">
              <Download className="w-4 h-4" /><span>Download Template</span>
            </button>
            <button onClick={() => fileRef.current?.click()}
              className="flex items-center space-x-2 bg-violet-500/20 hover:bg-violet-500/30 text-violet-400 border border-violet-500/30 px-4 py-2.5 rounded-xl text-sm font-medium transition-all">
              <FileText className="w-4 h-4" /><span>Choose CSV File</span>
            </button>
            <input ref={fileRef} type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
          </div>

          {/* Dry Run Preview */}
          {parsedRows.length > 0 && !result && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="text-sm text-slate-400">Preview: {parsedRows.length} rows</span>
                  <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-full text-xs font-bold">{validCount} valid</span>
                  {errorCount > 0 && <span className="bg-red-500/20 text-red-400 border border-red-500/30 px-2.5 py-0.5 rounded-full text-xs font-bold">{errorCount} errors</span>}
                </div>
                <button onClick={handleUpload} disabled={uploading || validCount === 0}
                  className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-400 hover:to-purple-500 text-white px-5 py-2 rounded-xl font-bold text-sm transition-all disabled:opacity-50 flex items-center space-x-2">
                  <Upload className="w-4 h-4" /><span>{uploading ? 'Uploading...' : `Upload ${validCount} Students`}</span>
                </button>
              </div>

              <div className="overflow-x-auto max-h-60 overflow-y-auto rounded-xl border border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-500 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 font-medium">#</th>
                      <th className="px-3 py-2 font-medium">Name</th>
                      <th className="px-3 py-2 font-medium">Gender</th>
                      <th className="px-3 py-2 font-medium">DOB</th>
                      <th className="px-3 py-2 font-medium">Class</th>
                      <th className="px-3 py-2 font-medium">Phone</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {parsedRows.map((row, i) => (
                      <tr key={i} className={row.valid ? 'bg-emerald-500/5' : 'bg-red-500/5'}>
                        <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                        <td className="px-3 py-2 text-white font-medium">{row.data.name || '—'}</td>
                        <td className="px-3 py-2 text-slate-300">{row.data.gender || '—'}</td>
                        <td className="px-3 py-2 text-slate-300">{row.data.dob || '—'}</td>
                        <td className="px-3 py-2 text-slate-300">{row.data.student_class || '—'}</td>
                        <td className="px-3 py-2 text-slate-300">{row.data.phone || '—'}</td>
                        <td className="px-3 py-2">
                          {row.valid ? (
                            <span className="text-emerald-400 font-bold">✓ Valid</span>
                          ) : (
                            <span className="text-red-400 font-bold" title={row.errors.join('; ')}>✗ {row.errors.join(', ')}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="space-y-3">
              <div className="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-xl">
                <p className="text-emerald-400 font-bold text-sm"><Check className="w-4 h-4 inline mr-1" /> {result.inserted.length} students uploaded successfully!</p>
              </div>
              {result.errors.length > 0 && (
                <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-xl">
                  <p className="text-red-400 font-bold text-sm mb-2"><AlertTriangle className="w-4 h-4 inline mr-1" /> {result.errors.length} rows failed:</p>
                  <div className="space-y-1">
                    {result.errors.map((err: any, i: number) => (
                      <p key={i} className="text-red-300 text-xs">Row {err.row}: {err.errors.map((e: any) => `${e.column}: ${e.reason}`).join(', ')}</p>
                    ))}
                  </div>
                </div>
              )}
              <button onClick={onDone}
                className="w-full bg-gradient-to-r from-violet-500 to-purple-600 text-white font-bold py-3 rounded-xl transition-all">
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════
// ██ OPTION B: PROGRESS TRACKING
// ════════════════════════════════════════
function ProgressTracking({ eventId }: { eventId: number }) {
  const [stats, setStats] = useState<EventStats | null>(null);
  const [expandedReferral, setExpandedReferral] = useState<number | null>(null);

  useEffect(() => {
    fetch(`/api/events/${eventId}/stats`)
      .then(r => r.json())
      .then(setStats);
  }, [eventId]);

  if (!stats) return <div className="text-center py-8 text-slate-400">Loading statistics...</div>;

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-5 gap-3">
        <StatCard label="Total Students" value={stats.total_students} color="text-violet-400" />
        <StatCard label="Screened" value={stats.screened} color="text-blue-400" />
        <StatCard label="Normal" value={stats.normal} color="text-emerald-400" />
        <StatCard label="Observation" value={stats.observation} color="text-amber-400" />
        <StatCard label="Referred" value={stats.referred} color="text-red-400" />
      </div>

      {/* Screening Progress */}
      {stats.total_students > 0 && (
        <div className="bg-slate-900/80 backdrop-blur-xl p-4 rounded-2xl border border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-400">Screening Progress</span>
            <span className="text-sm font-bold text-violet-400">
              {stats.screened}/{stats.total_students} ({Math.round((stats.screened / stats.total_students) * 100)}%)
            </span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-violet-500 to-purple-500 rounded-full transition-all duration-700 ease-out"
              style={{ width: `${Math.round((stats.screened / stats.total_students) * 100)}%` }} />
          </div>
        </div>
      )}

      {/* Records Table */}
      {stats.records.length === 0 ? (
        <div className="bg-slate-900/80 backdrop-blur-xl p-8 rounded-2xl border border-slate-800 text-center">
          <FileText className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">No screening records yet.</p>
        </div>
      ) : (
        <div className="bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-slate-500 border-b border-slate-800 bg-slate-950/50">
                <tr>
                  <th className="px-5 py-3 font-medium text-xs uppercase tracking-wider">Student</th>
                  <th className="px-5 py-3 font-medium text-xs uppercase tracking-wider">Doctor</th>
                  <th className="px-5 py-3 font-medium text-xs uppercase tracking-wider">Assessment</th>
                  <th className="px-5 py-3 font-medium text-xs uppercase tracking-wider">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {stats.records.map((rec: any) => {
                  let assessment = '—';
                  let referralDepts: string[] = [];
                  try {
                    const d = JSON.parse(rec.json_data);
                    assessment = d.assessment === 'N' ? 'Normal' : d.assessment === 'O' ? 'Observation' : d.assessment === 'R' ? 'Referred' : '—';
                    if (d.referralDepts) referralDepts = d.referralDepts;
                  } catch {}

                  const badgeStyle = assessment === 'Normal'
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                    : assessment === 'Referred'
                    ? 'bg-red-500/20 text-red-400 border-red-500/30 cursor-pointer hover:bg-red-500/30'
                    : assessment === 'Observation'
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                    : 'text-slate-400';

                  const isExpanded = expandedReferral === rec.record_id;

                  return (
                    <React.Fragment key={rec.record_id}>
                      <tr className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-5 py-3 text-white font-medium">{rec.student_name}</td>
                        <td className="px-5 py-3 text-violet-400">{rec.doctor_id}</td>
                        <td className="px-5 py-3">
                          <button onClick={() => assessment === 'Referred' && setExpandedReferral(isExpanded ? null : rec.record_id)}
                            className={`px-3 py-1 rounded-full text-xs font-bold border ${badgeStyle} inline-flex items-center space-x-1`}>
                            <span>{assessment}</span>
                            {assessment === 'Referred' && (
                              isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />
                            )}
                          </button>
                        </td>
                        <td className="px-5 py-3 text-slate-400 text-xs">{new Date(rec.timestamp).toLocaleString()}</td>
                      </tr>
                      {isExpanded && referralDepts.length > 0 && (
                        <tr>
                          <td colSpan={4} className="px-5 py-2 bg-red-500/5">
                            <div className="flex items-center space-x-2">
                              <span className="text-xs text-slate-500">Referred to:</span>
                              {referralDepts.map(dept => (
                                <span key={dept} className="bg-red-500/10 text-red-300 border border-red-500/20 px-2.5 py-0.5 rounded-full text-xs font-medium">
                                  {dept}
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Stat Card ──
function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-slate-900/80 backdrop-blur-xl p-4 rounded-2xl border border-slate-800 text-center shadow-xl">
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
      <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">{label}</p>
    </div>
  );
}
