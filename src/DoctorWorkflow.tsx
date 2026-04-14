import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search, Plus, ChevronDown, ChevronRight, X, Save,
  ArrowRight, AlertTriangle, Eye, Ear, Stethoscope,
  Activity, Check, UserPlus, Calendar, HeartPulse, Scan,
  Users, CheckCircle, Loader2, ClipboardList, Printer, Trash2, PlusCircle, FileText, RefreshCw
} from 'lucide-react';
import GeneralInfoForm, { GeneralInfoSummary } from './GeneralInfoForm';

// Socket.IO client (optional)
let io: any = null;
try { io = require('socket.io-client'); } catch {}

// ── Types ──
type User = { username: string; role: string; name: string; specialization?: string };

interface Student {
  student_id: number; name: string; age: number; dob: string; gender: string;
  student_class: string; section: string; blood_group: string;
  father_name: string; phone: string; is_examined?: number;
  examined_categories?: string;
}

const BLOOD_GROUPS = ['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const CLASSES = ['', 'Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
const SECTIONS = ['', 'A', 'B', 'C', 'D', 'E'];

const DOMAIN_TAGS = [
  { key: 'Community_Medicine', short: 'CM', color: 'bg-rose-500' },
  { key: 'Dental', short: 'Dental', color: 'bg-sky-500' },
  { key: 'ENT', short: 'ENT', color: 'bg-amber-500' },
  { key: 'Eye_Specialist', short: 'Ophthal', color: 'bg-emerald-500' },
  { key: 'Skin_Specialist', short: 'Derm', color: 'bg-violet-500' },
];

const SYMPTOM_CHECKLIST = [
  'Child rubs eyes frequently',
  'Child cannot see what is written on the board',
  'Child constantly pokes fingers into or pulls ear',
  'Child tends to breathe through their mouth',
  'Teeth look black or rotten',
  'Breath has a bad odour',
  'Cracks at corners of the mouth',
  'Child constantly scratches the head',
  'White patches on the skin',
  'Child bites nails',
  'Child complains of frequent headaches',
  'Episodes of fainting (especially in summers)',
  'Child gets attacks of breathlessness',
  'Limping gait',
  'Child stammers or cannot speak properly',
  'Frequent urination',
  'Diarrhea',
  'Vomiting',
  'Blood passed with stools',
];

// ── IndexedDB Offline Queue ──
const DB_NAME = 'aiims_offline';
const STORE = 'exam_queue';
function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true }); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function queueOffline(payload: any) {
  const db = await openIDB();
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).add({ ...payload, queued_at: Date.now() });
}
async function syncOfflineQueue() {
  const db = await openIDB();
  const tx = db.transaction(STORE, 'readwrite');
  const store = tx.objectStore(STORE);
  const all: any[] = await new Promise(r => { const req = store.getAll(); req.onsuccess = () => r(req.result); });
  for (const item of all) {
    try {
      const { id, queued_at, ...payload } = item;
      const res = await fetch('/api/health-records/exam', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      if (res.ok) store.delete(id);
    } catch { /* still offline */ }
  }
}
async function getOfflineQueueCount(): Promise<number> {
  try {
    const db = await openIDB();
    const tx = db.transaction(STORE, 'readonly');
    return new Promise(r => { 
      const req = tx.objectStore(STORE).count(); 
      req.onsuccess = () => r(req.result); 
      req.onerror = () => r(0); 
    });
  } catch { return 0; }
}

// ── Clinical design tokens (layout / surface only) ──
const cls = {
  input:
    'min-h-[44px] w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2.5 text-[15px] leading-snug text-[#1F2937] transition-all placeholder-[#9CA3AF] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20',
  inputLg:
    'min-h-[44px] w-full rounded-lg border border-[#E5E7EB] bg-white px-4 py-3 text-base leading-snug text-[#1F2937] transition-all placeholder-[#9CA3AF] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20',
  select:
    'min-h-[44px] w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2.5 text-[15px] text-[#1F2937] transition-all focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20',
  selectSm:
    'min-h-[32px] rounded-md border border-[#E5E7EB] bg-white px-2 py-1.5 text-xs text-[#374151] transition-all focus:border-[#2563EB] focus:outline-none focus:ring-1 focus:ring-[#2563EB]/25',
  textarea:
    'min-h-[120px] w-full resize-y rounded-lg border border-[#E5E7EB] bg-white px-3 py-3 text-[15px] leading-relaxed text-[#1F2937] transition-all placeholder-[#9CA3AF] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20',
  // Labels
  label: 'mb-1.5 block text-xs font-medium uppercase tracking-wider text-[#6B7280]',
  sectionTitle: 'text-xs font-semibold uppercase tracking-wider text-[#6B7280]',
  // Buttons
  btnPrimary: 'rounded-lg bg-[#2563EB] px-4 py-2.5 font-semibold text-white shadow-sm transition-colors hover:bg-[#1D4ED8]',
  btnSecondary: 'rounded-lg border border-[#E5E7EB] bg-white px-4 py-2.5 font-medium text-[#374151] transition-colors hover:bg-[#F9FAFB]',
  btnGhost: 'rounded-lg px-3 py-2 font-medium text-[#6B7280] transition-colors hover:bg-[#F3F4F6]',
};

// ── Reusable UI ──
function FormSelect({ label, value, onChange, options, id, disabled }: {
  label: string; value: string; onChange: (v: string) => void; options: string[]; id: string; disabled?: boolean;
}) {
  const [customValue, setCustomValue] = useState('');
  const isOther = value === 'Other' || (value && !options.includes(value) && value !== '');
  const showCustom = options.includes('Other') && isOther;
  return (
    <div>
      <label htmlFor={id} className={cls.label}>{label}</label>
      <select id={id} value={isOther && value !== 'Other' ? 'Other' : value} disabled={disabled} onChange={e => {
        if (e.target.value === 'Other') onChange('Other'); else { onChange(e.target.value); setCustomValue(''); }
      }} className={`${cls.select} w-full disabled:opacity-50`}>
        {options.map(o => <option key={o} value={o}>{o || '—'}</option>)}
      </select>
      {showCustom && !disabled && (
        <input type="text" placeholder="Specify..." value={value === 'Other' ? customValue : value}
          onChange={e => { setCustomValue(e.target.value); onChange(e.target.value || 'Other'); }}
          className={`${cls.input} mt-1.5`} />
      )}
    </div>
  );
}

function FormInput({ label, value, onChange, type = 'text', placeholder = '', id, disabled }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; id: string; disabled?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className={cls.label}>{label}</label>
      <input id={id} type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} disabled={disabled}
        className={`${cls.input} disabled:opacity-50`} />
    </div>
  );
}

function SectionHeading({ title, icon }: { title: string; icon: React.ReactNode }) {
  return (
    <div className="mb-6 flex items-center gap-2 border-b border-[#E5E7EB] pb-3">
      <span className="text-[#9CA3AF]">{icon}</span>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-[#6B7280]">{title}</h3>
    </div>
  );
}

function SectionCard({ title, icon, children, defaultOpen = true }: {
  title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <button type="button" onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors">
        <div className="flex items-center space-x-2.5">
          <span className="text-gray-400">{icon}</span>
          <span className="font-semibold text-gray-800 text-sm">{title}</span>
        </div>
        {open ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
      </button>
      {open && <div className="px-5 pb-5 border-t border-gray-50 pt-4">{children}</div>}
    </div>
  );
}

function DomainProgressBar({ examinedCategories }: { examinedCategories?: string }) {
  const done = new Set((examinedCategories || '').split(',').filter(Boolean));
  return (
    <div className="flex flex-wrap items-center gap-1">
      {DOMAIN_TAGS.map(d => {
        const isDone = done.has(d.key) || done.has('FullExam');
        return (
          <span
            key={d.key}
            className={`inline-flex items-center gap-0.5 rounded border px-1.5 py-0.5 text-[10px] font-semibold ${
              isDone ? 'border-[#BBF7D0] bg-[#F0FDF4] text-[#166534]' : 'border-[#E5E7EB] bg-[#F9FAFB] text-[#9CA3AF]'
            }`}
          >
            {isDone && <CheckCircle className="h-2.5 w-2.5 text-[#16A34A]" />}
            {d.short}
          </span>
        );
      })}
    </div>
  );
}

// ── Add Student Modal ──
function AddStudentModal({ onClose, onCreated, userId, campId }: {
  onClose: () => void; onCreated: (s: Student) => void; userId: string; campId: number;
}) {
  const [f, setF] = useState({ name: '', age: '', dob: '', gender: '', student_class: '', section: '', blood_group: '', father_name: '', phone: '' });
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [showSymptoms, setShowSymptoms] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => { nameRef.current?.focus(); }, []);
  const upd = (k: string, v: string) => {
    setF(p => {
      const next = { ...p, [k]: v };
      // Auto-calc age from DOB
      if (k === 'dob' && v) {
        const today = new Date(); const bd = new Date(v);
        let age = today.getFullYear() - bd.getFullYear();
        const m = today.getMonth() - bd.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < bd.getDate())) age--;
        if (age >= 0) next.age = String(age);
      }
      return next;
    });
    setErrors(p => ({ ...p, [k]: '' }));
  };
  const toggleSymptom = (s: string) => {
    setSymptoms(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  };
  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!f.name.trim()) e.name = 'Name is required';
    if (!f.student_class) e.student_class = 'Class is required';
    if (!f.dob) e.dob = 'Date of birth is required';
    if (!f.gender) e.gender = 'Sex is required';
    if (f.phone?.trim() && !/^\d{10}$/.test(f.phone.replace(/\D/g, ''))) e.phone = 'Valid 10-digit phone is required';
    setErrors(e); return Object.keys(e).length === 0;
  };
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault(); if (!validate()) return; setSaving(true);
    try {
      const res = await fetch('/api/students', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...f, age: f.age ? parseInt(f.age) : null, user_id: userId, event_id: campId }),
      });
      const data = await res.json();
      if (data.success) {
        // Save symptoms as general info if any were checked
        if (symptoms.length > 0) {
          await fetch(`/api/students/${data.student.student_id}/general-info`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event_id: campId, symptoms, filled_by: userId }),
          });
        }
        onCreated(data.student); onClose();
      }
    } catch { alert('Error creating student'); }
    finally { setSaving(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-2xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto border border-gray-200" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"><X className="w-5 h-5" /></button>
        <h3 className="text-lg font-bold text-gray-900 mb-5 flex items-center"><UserPlus className="w-5 h-5 mr-2 text-blue-600" /> Register New Student</h3>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className={cls.label}>Student Name *</label>
              <input ref={nameRef} value={f.name} onChange={e => upd('name', e.target.value)} required
                className={`${cls.inputLg} ${errors.name ? 'border-red-300 focus:ring-red-500/30 focus:border-red-500' : ''}`} placeholder="Full name" />
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
            </div>
            <FormInput label="Age" value={f.age} onChange={() => {}} type="number" id="add-age" placeholder="Auto from DOB" disabled />
            <div>
              <label className={cls.label}>Sex *</label>
              <div className="flex space-x-3 mt-1">
                {[{ v: 'M', label: 'Male' }, { v: 'F', label: 'Female' }].map(opt => (
                  <button key={opt.v} type="button" onClick={() => upd('gender', opt.v)}
                    className={`flex-1 py-2.5 rounded-lg font-semibold text-sm transition-all border flex items-center justify-center space-x-2 ${
                      f.gender === opt.v ? 'bg-blue-50 text-blue-700 border-blue-300' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                    }`}>
                    {f.gender === opt.v && <Check className="w-3.5 h-3.5" />}<span>{opt.label}</span>
                  </button>
                ))}
              </div>
              {errors.gender && <p className="text-red-500 text-xs mt-1">{errors.gender}</p>}
            </div>
            <div>
              <label className={cls.label}>Class *</label>
              <select value={f.student_class} onChange={e => upd('student_class', e.target.value)}
                className={`${cls.select} w-full ${errors.student_class ? 'border-red-300' : ''}`}>
                {CLASSES.map(o => <option key={o} value={o}>{o || '— Select —'}</option>)}
              </select>
            </div>
            <FormSelect label="Section" value={f.section} onChange={v => upd('section', v)} options={SECTIONS} id="add-section" />
            <FormSelect label="Blood Group" value={f.blood_group} onChange={v => upd('blood_group', v)} options={BLOOD_GROUPS} id="add-bg" />
            <FormInput label="Father's Name" value={f.father_name} onChange={v => upd('father_name', v)} id="add-father" placeholder="Optional" />
            <FormInput label="Contact Number" value={f.phone} onChange={v => upd('phone', v)} id="add-phone" placeholder="Optional" type="tel" />
            <div>
              <label className={cls.label}>Date of Birth *</label>
              <input type="date" value={f.dob} onChange={e => upd('dob', e.target.value)}
                className={`${cls.input} ${errors.dob ? 'border-red-300' : ''}`} />
              {errors.dob && <p className="text-red-500 text-xs mt-1">{errors.dob}</p>}
            </div>
          </div>

          {/* Symptoms Checklist */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <button type="button" onClick={() => setShowSymptoms(!showSymptoms)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
              <div className="flex items-center space-x-2">
                <ClipboardList className="w-4 h-4 text-amber-500" />
                <span className="text-sm font-semibold text-gray-700">Observed Symptoms</span>
                {symptoms.length > 0 && (
                  <span className="bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded text-xs font-bold">{symptoms.length}</span>
                )}
              </div>
              {showSymptoms ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
            </button>
            {showSymptoms && (
              <div className="px-4 pb-4 border-t border-gray-100 pt-3">
                <p className="text-xs text-gray-500 mb-2">Check all symptoms observed in the child:</p>
                <div className="grid grid-cols-1 gap-1.5 max-h-60 overflow-y-auto">
                  {SYMPTOM_CHECKLIST.map(symptom => {
                    const active = symptoms.includes(symptom);
                    return (
                      <button key={symptom} type="button" onClick={() => toggleSymptom(symptom)}
                        className={`flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs text-left transition-all border ${
                          active ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-white text-gray-600 border-gray-100 hover:border-gray-300'
                        }`}>
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                          active ? 'bg-amber-500 border-amber-500' : 'border-gray-300'
                        }`}>
                          {active && <Check className="w-2.5 h-2.5 text-white" />}
                        </div>
                        <span>{symptom}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <button type="submit" disabled={saving}
            className={`w-full ${cls.btnPrimary} py-3.5 text-base disabled:opacity-50`}>
            {saving ? 'Saving...' : 'Register & Continue →'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════
// ██ ACTIVE CAMPS DIRECTORY
// ════════════════════════════════════════════════
function ActiveCampsDirectory({ user, onVolunteer }: { user: User; onVolunteer: (campId: number, campName: string) => void; }) {
  const [camps, setCamps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState<number | null>(null);
  useEffect(() => {
    fetch('/api/events/active').then(r => r.json()).then(data => { setCamps(data); setLoading(false); }).catch(() => setLoading(false));
  }, []);
  const formatDate = (d: string) => {
    if (!d) return ''; const dt = new Date(d); if (isNaN(dt.getTime())) return d;
    return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${String(dt.getFullYear()).slice(-2)}`;
  };
  const handleVolunteer = async (camp: any) => {
    setJoining(camp.event_id);
    try {
      await fetch(`/api/events/${camp.event_id}/volunteer`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user.username, category: user.role }),
      });
      onVolunteer(camp.event_id, camp.school_name);
    } catch { alert('Failed to join camp'); } finally { setJoining(null); }
  };

  const [searchQuery, setSearchQuery] = useState('');
  const filteredCamps = camps.filter(c => c.school_name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="clinical-camps space-y-6 max-w-4xl mx-auto py-8">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Screening Camps</h2>
        <p className="text-gray-500 text-sm mt-1">Select an active camp to begin clinical screening</p>
      </div>

      <div className="relative max-w-md mx-auto">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
        <input 
          type="text" 
          placeholder="Search camps..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className={`${cls.input} pl-10`}
        />
      </div>

      {loading ? <div className="text-center py-12 text-gray-400">Loading camps...</div>
      : filteredCamps.length === 0 ? (
        <div className="bg-white p-12 rounded-xl border border-gray-100 text-center">
          <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No active camps available.</p>
          {searchQuery && <p className="text-gray-400 text-sm mt-1">Try adjusting your search query.</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredCamps.map((camp: any) => (
            <div key={camp.event_id} className="w-full text-left bg-white rounded-xl border border-gray-100 hover:border-blue-200 transition-all p-5 hover:shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-11 h-11 rounded-lg bg-blue-50 flex items-center justify-center"><Calendar className="w-5 h-5 text-blue-600" /></div>
                  <div>
                    <h3 className="text-gray-900 font-semibold text-base">{camp.school_name}</h3>
                    <p className="text-sm text-gray-400 mt-0.5">{formatDate(camp.start_date)}{camp.end_date ? ` → ${formatDate(camp.end_date)}` : ''}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="text-right mr-2 hidden sm:block">
                    <span className="text-xs text-gray-400 block"><Users className="w-3.5 h-3.5 inline mr-1" />{camp.volunteer_count ?? 0} staff</span>
                    <span className="text-xs text-gray-400 block mt-0.5"><Activity className="w-3.5 h-3.5 inline mr-1" />{camp.screened_count ?? 0}/{camp.student_count ?? 0}</span>
                  </div>
                  <span className={`px-2.5 py-1 rounded-md text-xs font-semibold border ${(camp.computed_status || camp.tag) === 'Ongoing' ? 'bg-green-50 text-green-700 border-green-200' : (camp.computed_status || camp.tag) === 'Completed' ? 'bg-gray-50 text-gray-500 border-gray-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>{(camp.computed_status || camp.tag) === 'Ongoing' ? 'Live' : (camp.computed_status || camp.tag)}</span>
                  <button onClick={() => handleVolunteer(camp)} disabled={joining === camp.event_id}
                    className={`${cls.btnPrimary} flex items-center space-x-2 text-sm disabled:opacity-50`}>
                    <ArrowRight className="w-4 h-4" /><span>{joining === camp.event_id ? 'Joining...' : 'Join Camp'}</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════
// ██ SPECIALIST EXAM FORMS (per-category)
// ════════════════════════════════════════════════

// --- Ophthalmology Form ---
function EyeExamForm({ data, onChange, disabled, doctorInfo, studentInfo, campName }: { data: any; onChange: (d: any) => void; disabled?: boolean; doctorInfo?: any; studentInfo?: any; campName?: string }) {
  const u = (k: string, v: any) => onChange({ ...data, [k]: v });
  return (
    <div className="space-y-5">
      <SectionHeading title="Ophthalmology Examination" icon={<Eye className="w-4 h-4" />} />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <FormSelect label="Vision - Right Eye" value={data.rightEye || '6/6'} onChange={v => u('rightEye', v)}
          options={['6/6', '6/9', '6/12', '6/18', '6/24', '6/36', '6/60', 'Other']} id="eye-r" disabled={disabled} />
        <FormSelect label="Vision - Left Eye" value={data.leftEye || '6/6'} onChange={v => u('leftEye', v)}
          options={['6/6', '6/9', '6/12', '6/18', '6/24', '6/36', '6/60', 'Other']} id="eye-l" disabled={disabled} />
        <div>
          <label className={cls.label}>Spectacles / Lenses</label>
          <div className="flex space-x-2">
            {['Yes', 'No'].map(o => (
              <button key={o} type="button" onClick={() => !disabled && u('accessories', o)} disabled={disabled}
                className={`min-h-[44px] flex-1 rounded-lg border text-sm font-semibold transition-all ${data.accessories === o ? 'border-[#2563EB] bg-[#EFF6FF] text-[#1D4ED8]' : 'border-[#E5E7EB] bg-white text-[#6B7280] hover:border-[#D1D5DB]'} disabled:opacity-50`}>
                {o}
              </button>
            ))}
          </div>
        </div>
      </div>
      <StatusAndRemarks data={data} onChange={onChange} disabled={disabled} doctorInfo={doctorInfo} studentInfo={studentInfo} campName={campName} />
    </div>
  );
}

// --- Dental Form ---
function DentalExamForm({ data, onChange, disabled, doctorInfo, studentInfo, campName }: { data: any; onChange: (d: any) => void; disabled?: boolean; doctorInfo?: any; studentInfo?: any; campName?: string }) {
  const u = (k: string, v: any) => onChange({ ...data, [k]: v });
  return (
    <div className="space-y-6">
      <SectionHeading title="Dental Examination" icon={<span className="text-base">🦷</span>} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <label htmlFor="dental-exam" className={cls.label}>
            Teeth &amp; gums examination
          </label>
          <textarea
            id="dental-exam"
            value={data.teethGums || ''}
            onChange={e => u('teethGums', e.target.value)}
            disabled={disabled}
            rows={6}
            placeholder='e.g. "Caries CBA ABE"'
            className={`${cls.textarea} min-h-[160px] disabled:opacity-50`}
          />
        </div>
        <div className="flex flex-col gap-6">
          <div>
            <label className={cls.label}>Dental implants</label>
            <div className="flex gap-2">
              {['Yes', 'No'].map(o => (
                <button key={o} type="button" onClick={() => !disabled && u('implants', o)} disabled={disabled}
                  className={`min-h-[44px] flex-1 rounded-lg border text-sm font-semibold transition-all ${data.implants === o ? 'border-[#2563EB] bg-[#EFF6FF] text-[#1D4ED8]' : 'border-[#E5E7EB] bg-white text-[#6B7280] hover:border-[#D1D5DB]'} disabled:opacity-50`}>{o}</button>
              ))}
            </div>
          </div>
          <div>
            <label className={cls.label}>Braces</label>
            <div className="flex gap-2">
              {['Yes', 'No'].map(o => (
                <button key={o} type="button" onClick={() => !disabled && u('braces', o)} disabled={disabled}
                  className={`min-h-[44px] flex-1 rounded-lg border text-sm font-semibold transition-all ${data.braces === o ? 'border-[#2563EB] bg-[#EFF6FF] text-[#1D4ED8]' : 'border-[#E5E7EB] bg-white text-[#6B7280] hover:border-[#D1D5DB]'} disabled:opacity-50`}>{o}</button>
              ))}
            </div>
          </div>
        </div>
      </div>
      <StatusAndRemarks data={data} onChange={onChange} disabled={disabled} doctorInfo={doctorInfo} studentInfo={studentInfo} campName={campName} />
    </div>
  );
}

// --- ENT Form ---
function ENTExamForm({ data, onChange, disabled, doctorInfo, studentInfo, campName }: { data: any; onChange: (d: any) => void; disabled?: boolean; doctorInfo?: any; studentInfo?: any; campName?: string }) {
  const u = (k: string, v: any) => onChange({ ...data, [k]: v });
  return (
    <div className="space-y-5">
      <SectionHeading title="ENT Examination" icon={<Ear className="w-4 h-4" />} />
      <div className="grid grid-cols-3 gap-4">
        <FormInput label="Ear Examination" value={data.ear || ''} onChange={v => u('ear', v)} id="ent-ear" placeholder='e.g. "B/L EAC Wax"' disabled={disabled} />
        <FormInput label="Nose Examination" value={data.nose || ''} onChange={v => u('nose', v)} id="ent-nose" placeholder="NAD or specify" disabled={disabled} />
        <FormInput label="Throat Examination" value={data.throat || ''} onChange={v => u('throat', v)} id="ent-throat" placeholder="NAD or specify" disabled={disabled} />
      </div>
      <StatusAndRemarks data={data} onChange={onChange} disabled={disabled} doctorInfo={doctorInfo} studentInfo={studentInfo} campName={campName} />
    </div>
  );
}

// --- Skin Form ---
function SkinExamForm({ data, onChange, disabled, doctorInfo, studentInfo, campName }: { data: any; onChange: (d: any) => void; disabled?: boolean; doctorInfo?: any; studentInfo?: any; campName?: string }) {
  const u = (k: string, v: any) => onChange({ ...data, [k]: v });
  return (
    <div className="space-y-5">
      <SectionHeading title="Dermatology Examination" icon={<Scan className="w-4 h-4" />} />
      <div className="grid grid-cols-1 gap-4">
        <FormInput label="Skin, Nails & Hair Examination" value={data.skinExam || ''} onChange={v => u('skinExam', v)}
          id="skin-exam" placeholder='e.g. "Seborrheic dermatitis / crusting on scalp"' disabled={disabled} />
      </div>
      <StatusAndRemarks data={data} onChange={onChange} disabled={disabled} doctorInfo={doctorInfo} studentInfo={studentInfo} campName={campName} />
    </div>
  );
}

// --- Community Medicine Form ---
function CommunityMedForm({ data, onChange, disabled, doctorInfo, studentInfo, campName }: { data: any; onChange: (d: any) => void; disabled?: boolean; doctorInfo?: any; studentInfo?: any; campName?: string }) {
  const u = (k: string, v: any) => onChange({ ...data, [k]: v });
  const PAST_HISTORY = ['Jaundice', 'Allergies', 'Blood Transfusion', 'Major Illness/Surgery'];
  const VACCINATIONS = ['Hep-B', 'Typhoid', 'D.T. & Polio', 'Tetanus'];
  const SYSTEMS = [
    { key: 'locomotor', label: 'Locomotor System' },
    { key: 'abdomen', label: 'Abdomen' },
    { key: 'respiratory', label: 'Respiratory System' },
    { key: 'cardiovascular', label: 'Cardiovascular System' },
    { key: 'cns', label: 'Central Nervous System' },
  ];
  const toggleList = (key: string, item: string) => {
    const arr = data[key] || [];
    u(key, arr.includes(item) ? arr.filter((x: string) => x !== item) : [...arr, item]);
  };
  return (
    <>
      {/* Past History & Immunisation */}
      <div className="space-y-5">
        <SectionHeading title="Past History & Immunisation" icon={<HeartPulse className="w-4 h-4" />} />
        <div className="space-y-4">
          <div>
            <label className={cls.label}>Past History</label>
            <div className="flex flex-wrap gap-2">
              {PAST_HISTORY.map(h => {
                const active = (data.pastHistory || []).includes(h);
                return (
                  <button key={h} type="button" onClick={() => !disabled && toggleList('pastHistory', h)} disabled={disabled}
                    className={`min-h-[40px] rounded-lg border px-3 py-2 text-sm font-medium transition-all ${active ? 'border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8]' : 'border-[#E5E7EB] bg-white text-[#6B7280] hover:border-[#D1D5DB]'} disabled:opacity-50`}>
                    {active && <Check className="w-3 h-3 inline mr-1" />}{h}
                  </button>
                );
              })}
            </div>
            <FormInput label="Other Past History" value={data.pastHistoryOther || ''} onChange={v => u('pastHistoryOther', v)} id="cm-ph-other" placeholder="Specify if any" disabled={disabled} />
          </div>
          <div>
            <label className={cls.label}>Immunisation Status</label>
            <div className="space-y-2">
              {VACCINATIONS.map(v => {
                const val = (data.vaccinationStatus || {})[v] || 'unknown';
                return (
                  <div key={v} className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600 w-28 flex-shrink-0">{v}</span>
                    <div className="flex space-x-1.5">
                      {[
                        { key: 'given', label: 'Given', color: 'green' },
                        { key: 'not_given', label: 'Not Given', color: 'red' },
                        { key: 'unknown', label: 'Unknown', color: 'gray' },
                      ].map(opt => (
                        <button key={opt.key} type="button" disabled={disabled}
                          onClick={() => !disabled && u('vaccinationStatus', { ...(data.vaccinationStatus || {}), [v]: opt.key })}
                          className={`min-h-[36px] rounded-md border px-2.5 py-1.5 text-xs font-semibold transition-all ${
                            val === opt.key
                              ? opt.color === 'green' ? 'border-[#BBF7D0] bg-[#F0FDF4] text-[#166534]'
                              : opt.color === 'red' ? 'border-[#FECACA] bg-[#FEF2F2] text-[#B91C1C]'
                              : 'border-[#E5E7EB] bg-[#F9FAFB] text-[#4B5563]'
                              : 'border-[#E5E7EB] bg-white text-[#9CA3AF] hover:border-[#D1D5DB]'
                          } disabled:opacity-50`}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Present Complaint & Medication */}
      <div className="space-y-5 mt-6">
        <SectionHeading title="Present Complaint & Medication" icon={<Stethoscope className="w-4 h-4" />} />
        <div className="grid grid-cols-2 gap-4">
          <FormInput label="Present Complaint" value={data.presentComplaint || ''} onChange={v => u('presentComplaint', v)} id="cm-complaint" placeholder='e.g. "White crusting on scalp"' disabled={disabled} />
          <FormInput label="Current Medication" value={data.currentMedication || ''} onChange={v => u('currentMedication', v)} id="cm-med" placeholder='e.g. "Medicated shampoo"' disabled={disabled} />
        </div>
        <div>
          <label className={cls.label}>General Appearance: Anaemia</label>
          <div className="flex space-x-2">
            {['No', 'Yes', 'Clinical Pallor'].map(o => (
              <button key={o} type="button" onClick={() => !disabled && u('anaemia', o)} disabled={disabled}
                className={`min-h-[44px] flex-1 rounded-lg border text-sm font-semibold transition-all ${data.anaemia === o ? 'border-[#2563EB] bg-[#EFF6FF] text-[#1D4ED8]' : 'border-[#E5E7EB] bg-white text-[#6B7280] hover:border-[#D1D5DB]'} disabled:opacity-50`}>{o}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Systemic Examination */}
      <div className="space-y-5 mt-6">
        <SectionHeading title="Systemic Examination" icon={<HeartPulse className="w-4 h-4" />} />
        <div className="space-y-3">
          {SYSTEMS.map(sys => (
            <div key={sys.key}>
              <label className={cls.label}>{sys.label}</label>
              <div className="flex space-x-2">
                {['NAD', 'Abnormal'].map(o => (
                  <button key={o} type="button" onClick={() => !disabled && u(sys.key, o)} disabled={disabled}
                    className={`min-h-[40px] rounded-lg border px-4 py-2 text-sm font-semibold transition-all ${data[sys.key] === o ? (o === 'NAD' ? 'border-[#BBF7D0] bg-[#F0FDF4] text-[#166534]' : 'border-[#FECACA] bg-[#FEF2F2] text-[#B91C1C]') : 'border-[#E5E7EB] bg-white text-[#6B7280] hover:border-[#D1D5DB]'} disabled:opacity-50`}>{o}</button>
                ))}
                {data[sys.key] === 'Abnormal' && (
                  <input value={data[`${sys.key}Detail`] || ''} onChange={e => u(`${sys.key}Detail`, e.target.value)} disabled={disabled}
                    placeholder="Specify..." className={`flex-1 ${cls.input}`} />
                )}
              </div>
            </div>
          ))}
          <FormInput label="Other Findings" value={data.otherFindings || ''} onChange={v => u('otherFindings', v)} id="cm-other" placeholder="Additional findings" disabled={disabled} />
        </div>
      </div>

      {/* Final Assessment */}
      <div className="space-y-5 mt-6">
        <SectionHeading title="Final Assessment" icon={<Stethoscope className="w-4 h-4" />} />
        <StatusAndRemarks data={data} onChange={onChange} disabled={disabled} doctorInfo={doctorInfo} studentInfo={studentInfo} campName={campName} />
      </div>
    </>
  );
}

// --- Shared Status + Prescription/Referral component ---
const FREQUENCIES = ['OD', 'BD', 'TDS', 'QID', 'SOS', 'HS'];

function PrintableDocument({ data, doctorInfo, studentInfo, campName }: { data: any; doctorInfo?: any; studentInfo?: any; campName?: string }) {
  const isReferral = data.status === 'R';
  const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const specialty = (doctorInfo?.role || '').replace(/_/g, ' ');
  return (
    <div className="printable-document" style={{ fontFamily: 'serif', color: '#000', background: '#fff', padding: '40px', maxWidth: '210mm', margin: '0 auto' }}>
      <div style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: '12px', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 'bold', margin: 0 }}>AIIMS BATHINDA — SCHOOL HEALTH CAMP</h1>
        <p style={{ fontSize: '12px', margin: '4px 0 0', color: '#555' }}>{campName || ''}</p>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div>
          <span style={{ display: 'inline-block', padding: '4px 14px', border: '2px solid #000', fontWeight: 'bold', fontSize: '14px', textTransform: 'uppercase', borderRadius: '4px' }}>
            {isReferral ? 'REFERRAL SHEET' : 'PRESCRIPTION'}
          </span>
          <span style={{ marginLeft: '12px', fontSize: '13px', color: '#555' }}>Department: {specialty}</span>
        </div>
        <div style={{ fontSize: '13px' }}>Date: {today}</div>
      </div>
      <table style={{ width: '100%', fontSize: '13px', marginBottom: '16px', borderCollapse: 'collapse' }}>
        <tbody>
          <tr><td style={{ padding: '3px 0', fontWeight: 'bold', width: '120px' }}>Student Name:</td><td>{studentInfo?.name || '—'}</td><td style={{ fontWeight: 'bold', width: '60px' }}>Age:</td><td style={{ width: '50px' }}>{studentInfo?.age || '—'}</td><td style={{ fontWeight: 'bold', width: '60px' }}>Sex:</td><td style={{ width: '50px' }}>{studentInfo?.gender === 'M' ? 'Male' : studentInfo?.gender === 'F' ? 'Female' : '—'}</td></tr>
          <tr><td style={{ padding: '3px 0', fontWeight: 'bold' }}>Class:</td><td>{studentInfo?.student_class || '—'}{studentInfo?.section ? `-${studentInfo.section}` : ''}</td><td style={{ fontWeight: 'bold' }}>Father:</td><td colSpan={3}>{studentInfo?.father_name || '—'}</td></tr>
          {studentInfo?.phone && <tr><td style={{ padding: '3px 0', fontWeight: 'bold' }}>Contact:</td><td colSpan={5}>{studentInfo.phone}</td></tr>}
        </tbody>
      </table>
      <div style={{ borderTop: '1px solid #ccc', paddingTop: '12px', marginBottom: '12px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 'bold', margin: '0 0 6px' }}>Clinical Findings</h3>
        <p style={{ fontSize: '13px', whiteSpace: 'pre-wrap' }}>{data.clinicalFindings || '—'}</p>
      </div>
      {!isReferral && (
        <div style={{ borderTop: '1px solid #ccc', paddingTop: '12px', marginBottom: '12px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 'bold', margin: '0 0 6px' }}>Diagnosis</h3>
          <p style={{ fontSize: '13px' }}>{data.diagnosis || '—'}</p>
          <h3 style={{ fontSize: '14px', fontWeight: 'bold', margin: '12px 0 6px' }}>Prescription (Rx)</h3>
          {(data.medicines || []).length > 0 ? (
            <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
              <thead><tr style={{ borderBottom: '1px solid #999' }}>
                <th style={{ textAlign: 'left', padding: '4px', fontWeight: 'bold' }}>#</th>
                <th style={{ textAlign: 'left', padding: '4px', fontWeight: 'bold' }}>Medicine</th>
                <th style={{ textAlign: 'left', padding: '4px', fontWeight: 'bold' }}>Dosage</th>
                <th style={{ textAlign: 'left', padding: '4px', fontWeight: 'bold' }}>Freq</th>
                <th style={{ textAlign: 'left', padding: '4px', fontWeight: 'bold' }}>Duration</th>
              </tr></thead>
              <tbody>
                {(data.medicines || []).map((m: any, i: number) => (
                  <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '4px' }}>{i + 1}.</td>
                    <td style={{ padding: '4px' }}>{m.name || '—'}</td>
                    <td style={{ padding: '4px' }}>{m.dosage || '—'}</td>
                    <td style={{ padding: '4px' }}>{m.frequency || '—'}</td>
                    <td style={{ padding: '4px' }}>{m.duration || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p style={{ fontSize: '13px', color: '#999' }}>No medicines prescribed.</p>}
          {data.advice && (
            <div style={{ marginTop: '12px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 'bold', margin: '0 0 6px' }}>Advice</h3>
              <p style={{ fontSize: '13px', whiteSpace: 'pre-wrap' }}>{data.advice}</p>
            </div>
          )}
        </div>
      )}
      {isReferral && (
        <div style={{ borderTop: '1px solid #ccc', paddingTop: '12px', marginBottom: '12px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 'bold', margin: '0 0 6px' }}>Reason for Referral</h3>
          <p style={{ fontSize: '13px', whiteSpace: 'pre-wrap' }}>{data.referralReason || '—'}</p>
          <div style={{ display: 'flex', gap: '40px', marginTop: '10px' }}>
            <div><span style={{ fontWeight: 'bold', fontSize: '13px' }}>Recommended Dept/Hospital: </span><span style={{ fontSize: '13px' }}>{data.referralDept || '—'}</span></div>
            <div><span style={{ fontWeight: 'bold', fontSize: '13px' }}>Urgency: </span><span style={{ fontSize: '13px' }}>{data.urgency || 'Routine'}</span></div>
          </div>
        </div>
      )}
      <div style={{ borderTop: '2px solid #000', paddingTop: '16px', marginTop: '30px', display: 'flex', justifyContent: 'space-between' }}>
        <div style={{ fontSize: '13px' }}>
          <p style={{ fontWeight: 'bold' }}>{doctorInfo?.name || doctorInfo?.username || '—'}</p>
          <p style={{ color: '#555' }}>{specialty}</p>
        </div>
        <div style={{ textAlign: 'right', fontSize: '13px' }}>
          <p style={{ marginTop: '30px', borderTop: '1px solid #000', paddingTop: '4px' }}>Signature</p>
        </div>
      </div>
    </div>
  );
}

function StatusAndRemarks({ data, onChange, disabled, doctorInfo, studentInfo, campName }: {
  data: any; onChange: (d: any) => void; disabled?: boolean;
  doctorInfo?: any; studentInfo?: any; campName?: string;
}) {
  const u = (k: string, v: any) => onChange({ ...data, [k]: v });
  const statusIsNormal = data.status === 'N';
  const isObservation = data.status === 'O';
  const isReferred = data.status === 'R';
  const printRef = useRef<HTMLDivElement>(null);

  const addMedicine = () => {
    const meds = data.medicines || [];
    onChange({ ...data, medicines: [...meds, { name: '', dosage: '', frequency: 'OD', duration: '' }] });
  };
  const updateMedicine = (idx: number, field: string, value: string) => {
    const meds = [...(data.medicines || [])];
    meds[idx] = { ...meds[idx], [field]: value };
    onChange({ ...data, medicines: meds });
  };
  const removeMedicine = (idx: number) => {
    const meds = [...(data.medicines || [])];
    meds.splice(idx, 1);
    onChange({ ...data, medicines: meds });
  };

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`<html><head><title>Print Document</title><style>body{margin:0;padding:0;font-family:serif;}@page{size:A4;margin:15mm;}</style></head><body>`);
    printWindow.document.write(printContent.innerHTML);
    printWindow.document.write('</body></html>');
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 300);
  };

  return (
    <div className="mt-8 space-y-6 border-t border-[#E5E7EB] pt-8">
      <div>
        <label className={cls.label}>Assessment</label>
        <div className="flex overflow-hidden rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] p-1">
          {[
            { v: 'N', label: 'Normal', active: 'bg-white text-[#166534] shadow-sm ring-1 ring-[#BBF7D0]' },
            { v: 'O', label: 'Observation', active: 'bg-white text-[#B45309] shadow-sm ring-1 ring-[#FDE68A]' },
            { v: 'R', label: 'Referral', active: 'bg-white text-[#B91C1C] shadow-sm ring-1 ring-[#FECACA]' },
          ].map(opt => (
            <button key={opt.v} type="button" onClick={() => !disabled && u('status', opt.v)} disabled={disabled}
              className={`min-h-[48px] flex-1 rounded-md px-2 text-center text-sm font-semibold transition-all disabled:opacity-50 ${
                data.status === opt.v ? opt.active : 'text-[#6B7280] hover:bg-white/80'
              }`}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Normal — show nothing extra */}
      {statusIsNormal && (
        <p className="py-2 text-sm text-[#6B7280]">No prescription or referral for a normal assessment.</p>
      )}

      {/* Observation — Prescription form */}
      {isObservation && !disabled && (
        <div className="space-y-5 rounded-lg border border-[#FDE68A] bg-[#FFFBEB] p-6">
          <div className="flex items-center gap-2 border-b border-[#FDE68A] pb-3">
            <FileText className="h-4 w-4 text-[#B45309]" />
            <span className="text-xs font-semibold uppercase tracking-wider text-[#92400E]">Prescription</span>
          </div>
          <div className="grid grid-cols-2 gap-4 text-xs text-[#6B7280]">
            <div>
              <span className="text-[#9CA3AF]">Clinician </span>
              {doctorInfo?.name || doctorInfo?.username || '—'} · {(doctorInfo?.role || '').replace(/_/g, ' ')}
            </div>
            <div>
              <span className="text-[#9CA3AF]">Date </span>
              {new Date().toLocaleDateString('en-IN')}
            </div>
          </div>
          <div>
            <label className={cls.label}>Clinical findings</label>
            <textarea value={data.clinicalFindings || ''} onChange={e => u('clinicalFindings', e.target.value)}
              rows={3} placeholder="Summarize clinical findings..."
              className={cls.textarea} />
          </div>
          <div>
            <label className={cls.label}>Diagnosis</label>
            <input value={data.diagnosis || ''} onChange={e => u('diagnosis', e.target.value)}
              placeholder="e.g. Myopia, dental caries"
              className={cls.input} />
          </div>
          <div>
            <label className={cls.label}>Medicines (Rx)</label>
            <div className="overflow-x-auto rounded-lg border border-[#E5E7EB] bg-white">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b border-[#E5E7EB] bg-[#F9FAFB] text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
                  <tr>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2 w-28">Dosage</th>
                    <th className="px-3 py-2 w-24">Freq</th>
                    <th className="px-3 py-2 w-28">Duration</th>
                    <th className="w-10 px-2 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3F4F6]">
                  {(data.medicines || []).map((med: any, idx: number) => (
                    <tr key={idx}>
                      <td className="p-2">
                        <input value={med.name} onChange={e => updateMedicine(idx, 'name', e.target.value)} placeholder="Medicine" className={`${cls.input} min-h-[40px]`} />
                      </td>
                      <td className="p-2">
                        <input value={med.dosage} onChange={e => updateMedicine(idx, 'dosage', e.target.value)} placeholder="Dose" className={`${cls.input} min-h-[40px]`} />
                      </td>
                      <td className="p-2">
                        <select value={med.frequency} onChange={e => updateMedicine(idx, 'frequency', e.target.value)} className={`${cls.select} min-h-[40px]`}>
                          {FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                      </td>
                      <td className="p-2">
                        <input value={med.duration} onChange={e => updateMedicine(idx, 'duration', e.target.value)} placeholder="Duration" className={`${cls.input} min-h-[40px]`} />
                      </td>
                      <td className="p-2 text-center">
                        <button type="button" onClick={() => removeMedicine(idx)} className="rounded p-1.5 text-[#DC2626] hover:bg-[#FEF2F2]" aria-label="Remove row">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button" onClick={addMedicine}
              className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-[#B45309] hover:text-[#92400E]">
              <PlusCircle className="h-4 w-4" /><span>Add medicine</span>
            </button>
          </div>
          <div>
            <label className={cls.label}>General advice</label>
            <textarea value={data.advice || ''} onChange={e => u('advice', e.target.value)}
              rows={3} placeholder="Follow-up, precautions…"
              className={cls.textarea} />
          </div>
          <div className="flex justify-end border-t border-[#FDE68A] pt-4">
            <button type="button" onClick={handlePrint}
              className="inline-flex items-center gap-2 rounded-lg border border-[#F59E0B] bg-white px-4 py-2.5 text-sm font-semibold text-[#B45309] transition-colors hover:bg-[#FFFBEB]">
              <Printer className="h-4 w-4" /><span>Print prescription</span>
            </button>
          </div>
        </div>
      )}

      {/* Referred — Referral form */}
      {isReferred && !disabled && (
        <div className="space-y-5 rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-6">
          <div className="flex items-center gap-2 border-b border-[#FECACA] pb-3">
            <FileText className="h-4 w-4 text-[#B91C1C]" />
            <span className="text-xs font-semibold uppercase tracking-wider text-[#991B1B]">Referral</span>
          </div>
          {/* Auto-filled info */}
          <div className="grid grid-cols-2 gap-4 text-xs text-[#6B7280]">
            <div><span className="text-[#9CA3AF]">Referring </span>{doctorInfo?.name || doctorInfo?.username || '—'} · {(doctorInfo?.role || '').replace(/_/g, ' ')}</div>
            <div><span className="text-[#9CA3AF]">Date </span>{new Date().toLocaleDateString('en-IN')}</div>
          </div>
          <div>
            <label className={cls.label}>Clinical Findings</label>
            <textarea value={data.clinicalFindings || ''} onChange={e => u('clinicalFindings', e.target.value)}
              rows={2} placeholder="Summarize clinical findings..."
              className={cls.textarea} />
          </div>
          <div>
            <label className={cls.label}>Reason for Referral</label>
            <textarea value={data.referralReason || ''} onChange={e => u('referralReason', e.target.value)}
              rows={2} placeholder="Why is this student being referred?"
              className={cls.textarea} />
          </div>
          <div>
            <label className={cls.label}>Recommended Dept / Hospital</label>
            <input value={data.referralDept || ''} onChange={e => u('referralDept', e.target.value)}
              placeholder="e.g. Ophthalmology, Civil Hospital Bathinda"
              className={cls.input} />
          </div>
          <div>
            <label className={cls.label}>Urgency</label>
            <div className="flex space-x-2">
              {['Routine', 'Priority', 'Urgent'].map(urg => (
                <button key={urg} type="button" onClick={() => u('urgency', urg)}
                  className={`min-h-[44px] flex-1 rounded-lg border text-sm font-semibold transition-all ${
                    data.urgency === urg
                      ? urg === 'Routine' ? 'border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8]'
                      : urg === 'Priority' ? 'border-[#FDE68A] bg-[#FFFBEB] text-[#B45309]'
                      : 'border-[#FECACA] bg-[#FEF2F2] text-[#B91C1C]'
                      : 'border-[#E5E7EB] bg-white text-[#6B7280] hover:border-[#D1D5DB]'
                  }`}>
                  {urg}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end border-t border-[#FECACA] pt-4">
            <button type="button" onClick={handlePrint}
              className="inline-flex items-center gap-2 rounded-lg border border-[#DC2626] bg-white px-4 py-2.5 text-sm font-semibold text-[#B91C1C] transition-colors hover:bg-[#FEF2F2]">
              <Printer className="h-4 w-4" /><span>Print referral</span>
            </button>
          </div>
        </div>
      )}

      {/* Read-only view when disabled and not Normal */}
      {(isObservation || isReferred) && disabled && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2">
          <span className={`text-xs font-bold uppercase ${isObservation ? 'text-amber-600' : 'text-red-600'}`}>
            {isObservation ? '📝 Prescription' : '🏥 Referral Sheet'}
          </span>
          {data.clinicalFindings && <p className="text-xs text-gray-600"><span className="text-gray-400">Findings:</span> {data.clinicalFindings}</p>}
          {data.diagnosis && <p className="text-xs text-gray-600"><span className="text-gray-400">Dx:</span> {data.diagnosis}</p>}
          {(data.medicines || []).length > 0 && (
            <div className="text-xs text-gray-600">
              <span className="text-gray-400">Rx:</span>
              {data.medicines.map((m: any, i: number) => (
                <span key={i} className="ml-1">{m.name} {m.dosage} {m.frequency} {m.duration}{i < data.medicines.length - 1 ? ',' : ''}</span>
              ))}
            </div>
          )}
          {data.referralReason && <p className="text-xs text-gray-600"><span className="text-gray-400">Reason:</span> {data.referralReason}</p>}
          {data.referralDept && <p className="text-xs text-gray-600"><span className="text-gray-400">Refer to:</span> {data.referralDept}</p>}
          {data.urgency && <p className="text-xs text-gray-600"><span className="text-gray-400">Urgency:</span> {data.urgency}</p>}
          {data.advice && <p className="text-xs text-gray-600"><span className="text-gray-400">Advice:</span> {data.advice}</p>}
        </div>
      )}

      {/* Hidden printable document */}
      <div ref={printRef} style={{ display: 'none' }}>
        <PrintableDocument data={data} doctorInfo={doctorInfo} studentInfo={studentInfo} campName={campName} />
      </div>
    </div>
  );
}

// ── Other Specialists' Records (Read-Only) ──
function RecordField({ label, value, className = '' }: { label: string; value?: string; className?: string }) {
  if (!value) return null;
  return (
    <div className={className}>
      <span className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">{label}</span>
      <p className="text-sm text-gray-700 mt-0.5 leading-snug">{value}</p>
    </div>
  );
}

function RecordPill({ label, color }: { label: string; color: string }) {
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${color}`}>{label}</span>;
}

function StatusBadge({ status }: { status: string }) {
  const cfg = status === 'N'
    ? { label: '✓ Normal', bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' }
    : status === 'O'
    ? { label: '⦿ Observation', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' }
    : status === 'R'
    ? { label: '⚑ Referred', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' }
    : { label: status || '—', bg: 'bg-gray-50', text: 'text-gray-500', border: 'border-gray-200' };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      {cfg.label}
    </span>
  );
}

function RemarksBlock({ data }: { data: any }) {
  const hasRemarks = data.remarks || data.clinicalFindings || data.diagnosis || data.referralReason;
  if (!hasRemarks) return null;
  return (
    <div className="mt-2.5 pt-2 border-t border-gray-100 space-y-1">
      {data.clinicalFindings && (
        <p className="text-xs text-gray-500"><span className="text-gray-400 font-medium">Findings:</span> {data.clinicalFindings}</p>
      )}
      {data.diagnosis && (
        <p className="text-xs text-gray-500"><span className="text-gray-400 font-medium">Diagnosis:</span> {data.diagnosis}</p>
      )}
      {data.remarks && (
        <p className="text-xs text-gray-500 italic">"{data.remarks}"</p>
      )}
      {data.referralReason && (
        <p className="text-xs text-gray-500"><span className="text-gray-400 font-medium">Referral:</span> {data.referralReason}</p>
      )}
      {data.referralDept && (
        <p className="text-xs text-gray-500"><span className="text-gray-400 font-medium">Refer to:</span> {data.referralDept}</p>
      )}
      {data.urgency && (
        <p className="text-xs text-gray-500"><span className="text-gray-400 font-medium">Urgency:</span> {data.urgency}</p>
      )}
      {(data.medicines || []).length > 0 && (
        <div className="text-xs text-gray-500">
          <span className="text-gray-400 font-medium">Rx:</span>
          {data.medicines.map((m: any, i: number) => (
            <span key={i} className="ml-1">{m.name} {m.dosage} {m.frequency}{m.duration ? ` ×${m.duration}` : ''}{i < data.medicines.length - 1 ? ',' : ''}</span>
          ))}
        </div>
      )}
      {data.advice && (
        <p className="text-xs text-gray-500"><span className="text-gray-400 font-medium">Advice:</span> {data.advice}</p>
      )}
    </div>
  );
}

// ── Specialist-Specific Read-Only Cards ──

function EyeRecordCard({ d }: { d: any }) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-green-50 border border-green-100 rounded-lg px-3 py-2 text-center">
          <span className="text-[10px] text-green-600 uppercase tracking-wider block">Right Eye</span>
          <span className="text-base font-bold text-green-800 mt-0.5 block">{d.rightEye || '—'}</span>
        </div>
        <div className="bg-green-50 border border-green-100 rounded-lg px-3 py-2 text-center">
          <span className="text-[10px] text-green-600 uppercase tracking-wider block">Left Eye</span>
          <span className="text-base font-bold text-green-800 mt-0.5 block">{d.leftEye || '—'}</span>
        </div>
        <div className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 text-center">
          <span className="text-[10px] text-gray-500 uppercase tracking-wider block">Spectacles</span>
          <span className={`text-sm font-bold mt-0.5 block ${d.accessories === 'Yes' ? 'text-blue-600' : 'text-gray-400'}`}>
            {d.accessories === 'Yes' ? '🤓 Yes' : d.accessories === 'No' ? 'No' : '—'}
          </span>
        </div>
      </div>
      <RemarksBlock data={d} />
    </div>
  );
}

function DentalRecordCard({ d }: { d: any }) {
  return (
    <div className="space-y-2">
      {d.teethGums && (
        <div className="bg-sky-50 border border-sky-100 rounded-lg px-3 py-2">
          <span className="text-[10px] text-sky-600 uppercase tracking-wider">Teeth & Gums</span>
          <p className="text-sm text-sky-800 mt-1 font-medium">{d.teethGums}</p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 flex items-center justify-between">
          <span className="text-xs text-gray-400">Implants</span>
          <span className={`text-xs font-bold ${d.implants === 'Yes' ? 'text-sky-600' : 'text-gray-400'}`}>{d.implants || '—'}</span>
        </div>
        <div className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 flex items-center justify-between">
          <span className="text-xs text-gray-400">Braces</span>
          <span className={`text-xs font-bold ${d.braces === 'Yes' ? 'text-sky-600' : 'text-gray-400'}`}>{d.braces || '—'}</span>
        </div>
      </div>
      <RemarksBlock data={d} />
    </div>
  );
}

function ENTRecordCard({ d }: { d: any }) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: '👂 Ear', value: d.ear, key: 'ear' },
          { label: '👃 Nose', value: d.nose, key: 'nose' },
          { label: '🗣 Throat', value: d.throat, key: 'throat' },
        ].map(item => (
          <div key={item.key} className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            <span className="text-[10px] text-amber-600 uppercase tracking-wider block">{item.label}</span>
            <p className="text-sm text-amber-800 mt-1 font-medium leading-snug">{item.value || 'NAD'}</p>
          </div>
        ))}
      </div>
      <RemarksBlock data={d} />
    </div>
  );
}

function SkinRecordCard({ d }: { d: any }) {
  return (
    <div className="space-y-2">
      {d.skinExam && (
        <div className="bg-violet-50 border border-violet-100 rounded-lg px-3 py-2">
          <span className="text-[10px] text-violet-600 uppercase tracking-wider">Skin, Nails & Hair</span>
          <p className="text-sm text-violet-800 mt-1 font-medium">{d.skinExam}</p>
        </div>
      )}
      <RemarksBlock data={d} />
    </div>
  );
}

function CommunityMedRecordCard({ d }: { d: any }) {
  const vaccStatus = d.vaccinationStatus || {};
  const vaccEntries = Object.entries(vaccStatus) as [string, string][];
  const vaccColor = (s: string) =>
    s === 'given' ? 'text-green-700 bg-green-50 border-green-200' :
    s === 'not_given' ? 'text-red-700 bg-red-50 border-red-200' :
    'text-gray-500 bg-gray-50 border-gray-200';
  const vaccIcon = (s: string) => s === 'given' ? '✓' : s === 'not_given' ? '✗' : '?';
  const pastHistory = Array.isArray(d.pastHistory) ? d.pastHistory : [];
  const SYSTEMS = ['locomotor', 'abdomen', 'respiratory', 'cardiovascular', 'cns'];
  const SYSTEM_LABELS: Record<string, string> = {
    locomotor: 'Locomotor', abdomen: 'Abdomen', respiratory: 'Respiratory',
    cardiovascular: 'Cardiovascular', cns: 'CNS'
  };
  const sysEntries = SYSTEMS.filter(s => d[s]).map(s => ({ key: s, val: d[s], detail: d[`${s}Detail`] }));

  return (
    <div className="space-y-2">
      {/* Past History */}
      {(pastHistory.length > 0 || d.pastHistoryOther) && (
        <div className="bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
          <span className="text-[10px] text-rose-600 uppercase tracking-wider block mb-1.5">Past History</span>
          {pastHistory.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {pastHistory.map((h: string) => (
                <span key={h} className="text-[11px] text-rose-700 bg-rose-100 border border-rose-200 px-2 py-0.5 rounded-md font-medium">{h}</span>
              ))}
            </div>
          )}
          {d.pastHistoryOther && <p className="text-xs text-rose-600 mt-1">Other: {d.pastHistoryOther}</p>}
        </div>
      )}

      {/* Vaccinations */}
      {vaccEntries.length > 0 && (
        <div className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
          <span className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1.5">Immunisation</span>
          <div className="grid grid-cols-2 gap-1.5">
            {vaccEntries.map(([name, status]) => (
              <div key={name} className={`flex items-center justify-between px-2 py-1 rounded-md border text-[11px] ${vaccColor(status)}`}>
                <span className="font-medium">{name}</span>
                <span className="font-bold">{vaccIcon(status)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Present Complaint & Medication */}
      {(d.presentComplaint || d.currentMedication) && (
        <div className="grid grid-cols-2 gap-2">
          {d.presentComplaint && (
            <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
              <span className="text-[10px] text-blue-600 uppercase tracking-wider">Present Complaint</span>
              <p className="text-sm text-blue-800 mt-1 font-medium">{d.presentComplaint}</p>
            </div>
          )}
          {d.currentMedication && (
            <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
              <span className="text-[10px] text-blue-600 uppercase tracking-wider">Current Medication</span>
              <p className="text-sm text-blue-800 mt-1 font-medium">{d.currentMedication}</p>
            </div>
          )}
        </div>
      )}

      {/* Anaemia */}
      {d.anaemia && (
        <div className="flex items-center space-x-2">
          <span className="text-xs text-gray-400">Anaemia:</span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-md border ${
            d.anaemia === 'No' ? 'text-green-700 bg-green-50 border-green-200'
            : d.anaemia === 'Yes' ? 'text-red-700 bg-red-50 border-red-200'
            : 'text-amber-700 bg-amber-50 border-amber-200'
          }`}>{d.anaemia}</span>
        </div>
      )}

      {/* Systemic Examination */}
      {sysEntries.length > 0 && (
        <div className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
          <span className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1.5">Systemic</span>
          <div className="grid grid-cols-1 gap-1">
            {sysEntries.map(s => (
              <div key={s.key} className="flex items-center justify-between py-1 text-xs">
                <span className="text-gray-500 font-medium">{SYSTEM_LABELS[s.key] || s.key}</span>
                <span className={`font-bold px-2 py-0.5 rounded border ${
                  s.val === 'NAD' ? 'text-green-700 bg-green-50 border-green-200' : 'text-red-700 bg-red-50 border-red-200'
                }`}>
                  {s.val === 'Abnormal' && s.detail ? `Abnormal: ${s.detail}` : s.val}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {d.otherFindings && (
        <RecordField label="Other Findings" value={d.otherFindings} />
      )}

      <RemarksBlock data={d} />
    </div>
  );
}

/** Fallback for unrecognized specialty — show key-value pairs cleanly. */
function GenericRecordCard({ d }: { d: any }) {
  const entries = Object.entries(d).filter(([k]) => !['status', 'assessment', 'clinicalFindings', 'diagnosis', 'remarks', 'medicines', 'advice', 'referralReason', 'referralDept', 'urgency'].includes(k));
  if (entries.length === 0) return null;
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {entries.map(([k, v]) => {
          if (v === null || v === undefined || v === '') return null;
          let display: string;
          if (Array.isArray(v)) display = v.map(i => typeof i === 'object' ? Object.entries(i).map(([a,b])=>`${a}: ${b}`).join(', ') : String(i)).join(' | ');
          else if (typeof v === 'object') display = Object.entries(v).map(([a,b])=>`${a}: ${b}`).join(', ');
          else display = String(v);
          return <div key={k}><RecordField label={k.replace(/_/g, ' ')} value={display} /></div>;
        })}
      </div>
      <RemarksBlock data={d} />
    </div>
  );
}

function SpecialistRecordBody({ category, d }: { category: string; d: any }) {
  switch (category) {
    case 'Eye_Specialist': return <EyeRecordCard d={d} />;
    case 'Dental': return <DentalRecordCard d={d} />;
    case 'ENT': return <ENTRecordCard d={d} />;
    case 'Skin_Specialist': return <SkinRecordCard d={d} />;
    case 'Community_Medicine': return <CommunityMedRecordCard d={d} />;
    default: return <GenericRecordCard d={d} />;
  }
}

// Category metadata (read-only other-records rows)
const SPECIALIST_META: Record<string, { icon: React.ReactNode; label: string }> = {
  Eye_Specialist: { icon: <Eye className="h-4 w-4 text-[#6B7280]" />, label: 'Ophthalmology' },
  Dental: { icon: <span className="text-sm">🦷</span>, label: 'Dental' },
  ENT: { icon: <Ear className="h-4 w-4 text-[#6B7280]" />, label: 'ENT' },
  Skin_Specialist: { icon: <Scan className="h-4 w-4 text-[#6B7280]" />, label: 'Dermatology' },
  Community_Medicine: { icon: <Stethoscope className="h-4 w-4 text-[#6B7280]" />, label: 'Community Medicine' },
};

function OtherRecordsPanel({ studentId, eventId, currentCategory }: {
  studentId: number; eventId: number; currentCategory: string;
}) {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/students/${studentId}/all-records?event_id=${eventId}`)
      .then(r => r.json())
      .then(d => { setRecords(d.records || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [studentId, eventId]);

  // Also listen for real-time updates
  useEffect(() => {
    if (!io) return;
    try {
      const socket = io.connect(window.location.origin, { transports: ['websocket', 'polling'] });
      socket.on('exam_saved', (data: any) => {
        if (data.student_id === studentId || !data.student_id) {
          fetch(`/api/students/${studentId}/all-records?event_id=${eventId}`)
            .then(r => r.json())
            .then(d => setRecords(d.records || []))
            .catch(() => {});
        }
      });
      return () => { socket.disconnect(); };
    } catch {}
  }, [studentId, eventId]);

  const otherRecords = records.filter(r => r.category !== currentCategory);
  const evaluatedCount = otherRecords.length;
  const totalOtherSpecs = Object.keys(SPECIALIST_META).filter(k => k !== currentCategory).length;

  return (
    <div className="overflow-hidden rounded-lg border border-[#E5E7EB] bg-white">
      <button type="button" onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between border-b border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3 text-left transition-colors hover:bg-[#F3F4F6]">
        <div className="flex min-w-0 items-center gap-3">
          <ClipboardList className="h-4 w-4 shrink-0 text-[#9CA3AF]" />
          <div className="min-w-0">
            <span className="block text-sm font-semibold text-[#1F2937]">Other specialists</span>
            <span className="text-xs text-[#6B7280]">
              {loading ? 'Loading…' : `${evaluatedCount} of ${totalOtherSpecs} completed`}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {!loading && evaluatedCount > 0 && (
            <span className="rounded-md border border-[#E5E7EB] bg-white px-2 py-0.5 text-xs font-semibold text-[#374151]">
              {evaluatedCount}
            </span>
          )}
          {open ? <ChevronDown className="h-4 w-4 text-[#9CA3AF]" /> : <ChevronRight className="h-4 w-4 text-[#9CA3AF]" />}
        </div>
      </button>

      {open && (
        <div className="divide-y divide-[#F3F4F6]">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8">
              <Loader2 className="h-4 w-4 animate-spin text-[#9CA3AF]" />
              <span className="text-sm text-[#6B7280]">Loading…</span>
            </div>
          ) : otherRecords.length === 0 ? (
            <div className="py-8 text-center">
              <ClipboardList className="mx-auto mb-2 h-9 w-9 text-[#E5E7EB]" />
              <p className="text-sm font-medium text-[#6B7280]">No other specialist records yet</p>
              <p className="mt-1 text-xs text-[#9CA3AF]">They appear here when colleagues save an exam</p>
            </div>
          ) : (
            otherRecords.map((r, i) => {
              const d = r.parsed_data || {};
              const meta = SPECIALIST_META[r.category] || {
                icon: <Activity className="h-4 w-4 text-[#6B7280]" />,
                label: r.category.replace(/_/g, ' '),
              };
              const ts = r.timestamp
                ? new Date(r.timestamp).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                : null;

              return (
                <div key={i} className="bg-[#FAFBFC] px-4 py-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="text-[#9CA3AF]">{meta.icon}</span>
                      <span className="text-sm font-semibold text-[#1F2937]">{meta.label}</span>
                      <span className="truncate text-xs text-[#9CA3AF]">
                        · {r.doctor_id}{ts ? ` · ${ts}` : ''}
                      </span>
                    </div>
                    {d.status ? <StatusBadge status={d.status} /> : null}
                  </div>
                  <div className="rounded-md border border-[#E5E7EB] bg-white px-3 py-2">
                    <SpecialistRecordBody category={r.category} d={d} />
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════
// ██ MAIN DOCTOR WORKFLOW
// ════════════════════════════════════════════════
export default function DoctorWorkflow({ user }: { user: User }) {
  const [selectedCampId, setSelectedCampId] = useState<number | null>(null);
  const [selectedCampName, setSelectedCampName] = useState('');
  if (!selectedCampId) {
    return <ActiveCampsDirectory user={user} onVolunteer={(id, name) => { setSelectedCampId(id); setSelectedCampName(name); }} />;
  }
  return <ClinicalWorkflow user={user} campId={selectedCampId} campName={selectedCampName} onBack={() => { setSelectedCampId(null); setSelectedCampName(''); }} />;
}

// ════════════════════════════════════════════════
// ██ CLINICAL WORKFLOW (3-region workstation layout)
// ════════════════════════════════════════════════
function ClinicalWorkflow({ user, campId, campName, onBack }: {
  user: User; campId: number; campName: string; onBack: () => void;
}) {
  const specialistCategory = user.role;
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [filterClass, setFilterClass] = useState('');
  const [filterSection, setFilterSection] = useState('');
  const [filterGender, setFilterGender] = useState('');
  const [filterExamined, setFilterExamined] = useState('');
  const [examData, setExamData] = useState<any>({ status: 'N' });
  const [showFullRecord, setShowFullRecord] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [online, setOnline] = useState(navigator.onLine);
  const [offlineCount, setOfflineCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Online/offline logic
  useEffect(() => {
    const checkQueue = async () => setOfflineCount(await getOfflineQueueCount());
    checkQueue();
    const on = async () => {
      setOnline(true);
      setSyncing(true);
      try { await syncOfflineQueue(); } finally { setSyncing(false); }
      checkQueue();
    };
    const off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    const intv = setInterval(checkQueue, 5000);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); clearInterval(intv); };
  }, []);

  const handleManualSync = async () => {
    if (!online) return;
    setSyncing(true);
    setSaveStatus('saving');
    try {
      await syncOfflineQueue();
      setOfflineCount(await getOfflineQueueCount());
    } finally {
      setSyncing(false);
      setSaveStatus('idle');
    }
  };

  // Search
  const doSearch = useCallback(async (q?: string) => {
    const query = q ?? searchQuery;
    const params = new URLSearchParams();
    if (query) params.set('query', query);
    if (filterClass) params.set('class', filterClass);
    if (filterSection) params.set('section', filterSection);
    if (filterGender) params.set('gender', filterGender);
    if (filterExamined) params.set('examined', filterExamined);
    params.set('event_id', String(campId));
    try {
      const res = await fetch(`/api/students/search?${params}`);
      if (res.ok) setSearchResults(await res.json());
    } catch { /* ignore network errors */ }
  }, [searchQuery, filterClass, filterSection, filterGender, filterExamined, campId]);

  // Load all students on mount
  useEffect(() => { doSearch(); }, [campId]);
  // Re-fetch when filters change
  useEffect(() => { doSearch(); }, [filterClass, filterSection, filterGender, filterExamined]);

  // Real-time Socket.IO listener for live updates
  useEffect(() => {
    if (!io) return;
    try {
      const socket = io.connect(window.location.origin, { transports: ['websocket', 'polling'] });
      const refresh = (data: any) => {
        if (!data.event_id || data.event_id === campId) doSearch();
      };
      socket.on('student_created', refresh);
      socket.on('students_bulk_created', refresh);
      socket.on('exam_saved', refresh);
      return () => { socket.disconnect(); };
    } catch {}
  }, [campId, doSearch]);

  // Load existing exam data when student selected
  const selectStudent = async (s: Student) => {
    // Force save the current student's data before switching
    if (selectedStudent && examData) {
      await autoSave(examData);
    }
    
    setSelectedStudent(s); 
    setSearchQuery('');

    // Load existing record for this specialist
    try {
      const res = await fetch(`/api/students/${s.student_id}/all-records?event_id=${campId}`);
      const d = await res.json();
      const myRecord = (d.records || []).find((r: any) => r.category === specialistCategory);
      if (myRecord?.parsed_data) {
        setExamData(myRecord.parsed_data);
      } else {
        setExamData({ status: 'N' });
      }
    } catch {
      setExamData({ status: 'N' });
    }
  };

  // Autosave exam data
  const autoSave = useCallback(async (data: any) => {
    if (!selectedStudent) return;
    setSaveStatus('saving');
    const payload = {
      student_id: selectedStudent.student_id,
      event_id: campId,
      doctor_id: user.username,
      specialist_category: specialistCategory,
      exam_data: data,
    };
    try {
      if (online) {
        const res = await fetch('/api/health-records/exam', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        });
        const result = await res.json();
        setSaveStatus(result.success ? 'saved' : 'error');
        if (result.success) setTimeout(() => setSaveStatus('idle'), 2000);
      } else {
        await queueOffline(payload); setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      }
    } catch {
      await queueOffline(payload); setSaveStatus('error');
    }
  }, [selectedStudent, campId, user.username, specialistCategory, online]);

  const handleExamChange = (newData: any) => {
    setExamData(newData);
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => autoSave(newData), 800);
  };

  const handleBack = async () => {
    try {
      await fetch(`/api/events/${campId}/volunteer`, {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user.username }),
      });
    } catch {} onBack();
  };

  const specBadgeColor = 'border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8]';

  const rosterTotal = searchResults.length;
  const rosterExamined = searchResults.filter(s => !!s.is_examined).length;

  return (
    <div className="clinical-workstation flex h-full w-full min-w-0 flex-col overflow-hidden text-[15px] text-[#1F2937]">
      {/* ── STICKY TOP BAR ── */}
      <div className="clinical-topbar sticky top-0 z-30 flex h-14 min-h-[56px] flex-shrink-0 items-center justify-between border-b border-[#E5E7EB] bg-[#F7F9FB] px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-4">
          <button type="button" onClick={handleBack} className="flex shrink-0 items-center gap-1 text-sm font-medium text-[#6B7280] transition-colors hover:text-[#2563EB]">
            <ChevronRight className="h-4 w-4 rotate-180" /><span className="hidden sm:inline">Exit</span>
          </button>
          <div className="hidden h-6 w-px shrink-0 bg-[#E5E7EB] sm:block" />
          <div className="min-w-0">
            <h2 className="truncate text-base font-bold leading-tight text-[#1F2937]">{campName}</h2>
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <span className={`rounded-md border px-2 py-0.5 text-xs font-semibold ${specBadgeColor}`}>{specialistCategory.replace(/_/g, ' ')}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-shrink-0 flex-wrap items-center justify-end gap-2 sm:gap-3">
          {saveStatus === 'saving' && !syncing && (
            <span className="flex items-center gap-1 text-xs text-[#B45309]">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /><span>Saving…</span>
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="flex items-center gap-1 text-xs text-[#16A34A]">
              <Check className="h-3.5 w-3.5" /><span>Saved</span>
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="flex items-center gap-1 text-xs text-[#DC2626]">
              <AlertTriangle className="h-3.5 w-3.5" /><span>Error</span>
            </span>
          )}

          {syncing && (
            <span className="flex items-center gap-1 text-xs font-medium text-[#2563EB]">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /><span>Syncing</span>
            </span>
          )}

          {!online ? (
            <span className="inline-flex items-center gap-1 rounded-md border border-[#FECACA] bg-[#FEF2F2] px-2.5 py-1 text-xs font-semibold text-[#B91C1C]">
              <Activity className="h-3.5 w-3.5" />Offline
            </span>
          ) : !syncing ? (
            <span className="hidden rounded-md border border-[#BBF7D0] bg-[#F0FDF4] px-2.5 py-1 text-xs font-semibold text-[#166534] sm:inline-flex">Online</span>
          ) : null}

          {offlineCount > 0 && (
            <button type="button" onClick={handleManualSync} disabled={!online || syncing}
              className="inline-flex items-center gap-1.5 rounded-md border border-[#FDE68A] bg-[#FFFBEB] px-2.5 py-1 text-xs font-semibold text-[#B45309] transition-colors hover:bg-[#FEF3C7] disabled:opacity-50"
              title={online ? 'Sync pending exams' : 'Waiting for connection'}>
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
              <span>Queue {offlineCount}</span>
            </button>
          )}

          <div className="hidden rounded-md border border-[#E5E7EB] bg-white px-2.5 py-1 text-xs text-[#6B7280] lg:block">
            <span className="text-[#9CA3AF]">Roster </span>
            <span className="font-semibold text-[#1F2937]">{rosterExamined}</span>
            <span className="text-[#9CA3AF]"> / {rosterTotal}</span>
            <span className="text-[#9CA3AF]"> screened</span>
          </div>
        </div>
      </div>

      {/* ── MAIN BODY: LEFT + RIGHT ── */}
      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
        {/* ── LEFT PANE: Student List ── */}
        <div className="clinical-left-pane flex w-[min(100%,340px)] min-w-[280px] max-w-[340px] flex-shrink-0 flex-col overflow-hidden border-r border-[#E5E7EB] bg-[#F1F4F8]">
          {/* Search */}
          <div className="flex-shrink-0 space-y-2 border-b border-[#E5E7EB] bg-[#F7F9FB] p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
              <input ref={searchRef} type="text" placeholder="Search students..."
                value={searchQuery} onChange={e => { setSearchQuery(e.target.value); doSearch(e.target.value); }}
                onKeyDown={e => e.key === 'Enter' && doSearch()}
                className={`${cls.input} pl-9 py-2.5 text-sm`} />
            </div>
            {/* Compact Filters */}
            <div className="flex items-center space-x-1.5 flex-wrap gap-y-1.5">
              <select value={filterClass} onChange={e => setFilterClass(e.target.value)} className={cls.selectSm}>
                <option value="">Class</option>{CLASSES.filter(Boolean).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={filterSection} onChange={e => setFilterSection(e.target.value)} className={cls.selectSm}>
                <option value="">Sec</option>{SECTIONS.filter(Boolean).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={filterExamined} onChange={e => setFilterExamined(e.target.value)} className={cls.selectSm}>
                <option value="">Status</option><option value="0">Pending</option><option value="1">Done</option>
              </select>
              <select value={filterGender} onChange={e => setFilterGender(e.target.value)} className={cls.selectSm}>
                <option value="">Sex</option><option value="M">M</option><option value="F">F</option>
              </select>
              {(filterClass || filterSection || filterExamined || filterGender) && (
                <button type="button" onClick={() => { setFilterClass(''); setFilterSection(''); setFilterExamined(''); setFilterGender(''); }} className="text-[10px] font-medium text-[#DC2626] transition-colors hover:text-[#991B1B]">Clear</button>
              )}
            </div>
            {/* Add Student */}
            <button type="button" onClick={() => setShowAddModal(true)}
              className={`${cls.btnPrimary} flex w-full items-center justify-center gap-1.5 py-2.5 text-sm`}>
              <Plus className="h-4 w-4" /><span>Add student</span>
            </button>
          </div>

          {/* Student List */}
          <div className="flex-1 overflow-y-auto">
            {searchResults.length === 0 ? (
              <div className="text-center py-12 px-4">
                <Users className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                <p className="text-xs text-gray-400">No students found</p>
              </div>
            ) : (
              <div className="py-1">
                {searchResults.map(s => {
                  const isSelected = selectedStudent?.student_id === s.student_id;
                  return (
                    <button key={s.student_id} type="button" onClick={() => selectStudent(s)}
                      className={`flex w-full items-center gap-3 border-l-[3px] border-solid px-3 py-2.5 text-left transition-colors ${
                        isSelected ? 'border-l-[#2563EB] bg-white shadow-sm' : 'border-l-transparent hover:bg-white/90'
                      }`}>
                      <div className={`h-2 w-2 shrink-0 rounded-full ${s.is_examined ? 'bg-[#16A34A]' : 'bg-[#D1D5DB]'}`} />
                      <div className="min-w-0 flex-1">
                        <p className={`truncate text-sm font-semibold ${isSelected ? 'text-[#1E3A8A]' : 'text-[#1F2937]'}`}>{s.name}</p>
                        <p className="mt-0.5 text-xs text-[#6B7280]">
                          {s.student_class && `Class ${s.student_class}`}{s.section && `-${s.section}`}
                          {s.age != null && ` · ${s.age}y`} · {s.gender}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT PANE: Clinical Workspace ── */}
        <div className="clinical-right-pane min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden bg-[#F7F9FB]">
          {!selectedStudent ? (
            /* Empty state */
            <div className="flex h-full flex-col items-center justify-center px-8 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#E5E7EB] bg-white">
                <Stethoscope className="h-8 w-8 text-[#D1D5DB]" />
              </div>
              <h3 className="text-lg font-semibold text-[#6B7280]">Select a student</h3>
              <p className="mt-1 max-w-sm text-sm text-[#9CA3AF]">Choose from the roster on the left to open the clinical workspace.</p>
            </div>
          ) : (
            <div className="max-w-full min-w-0 space-y-8 px-4 py-6 sm:px-8">
              {/* ── A. Student Context Header ── */}
              <div className="flex flex-col gap-4 border-b border-[#E5E7EB] pb-6 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] text-lg font-bold text-[#1D4ED8]">
                    {selectedStudent.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-2xl font-bold tracking-tight text-[#1F2937]">{selectedStudent.name}</h3>
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-[#6B7280]">
                      {selectedStudent.age != null && <span>{selectedStudent.age} yrs</span>}
                      {selectedStudent.gender && <span>{selectedStudent.gender === 'M' ? 'Male' : 'Female'}</span>}
                      {selectedStudent.student_class && (
                        <span>Class {selectedStudent.student_class}{selectedStudent.section && `-${selectedStudent.section}`}</span>
                      )}
                    </div>
                    {selectedStudent.father_name && (
                      <p className="mt-1 text-sm text-[#6B7280]">
                        <span className="font-medium text-[#9CA3AF]">Father </span>{selectedStudent.father_name}
                      </p>
                    )}
                    <div className="mt-3">
                      <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-[#9CA3AF]">Domain progress</p>
                      <DomainProgressBar examinedCategories={selectedStudent.examined_categories} />
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <button type="button" onClick={() => setShowFullRecord(true)}
                    className={`${cls.btnSecondary} inline-flex items-center gap-2 text-sm`}>
                    <FileText className="h-4 w-4" /><span>Full record</span>
                  </button>
                  <button type="button" onClick={() => { setSelectedStudent(null); setExamData({ status: 'N' }); doSearch(); searchRef.current?.focus(); }}
                    className={`${cls.btnGhost} inline-flex items-center gap-2 text-sm`}>
                    <X className="h-4 w-4" /><span>Done</span>
                  </button>
                </div>
              </div>

              {/* General Info Summary (read-only for specialists) */}
              <GeneralInfoSummary studentId={selectedStudent.student_id} eventId={campId} />

              {/* ── B. Specialist-specific form ── */}
              <div className="rounded-lg border border-[#E5E7EB] bg-white p-6">
                {specialistCategory === 'Eye_Specialist' && <EyeExamForm data={examData} onChange={handleExamChange} doctorInfo={user} studentInfo={selectedStudent} campName={campName} />}
                {specialistCategory === 'Dental' && <DentalExamForm data={examData} onChange={handleExamChange} doctorInfo={user} studentInfo={selectedStudent} campName={campName} />}
                {specialistCategory === 'ENT' && <ENTExamForm data={examData} onChange={handleExamChange} doctorInfo={user} studentInfo={selectedStudent} campName={campName} />}
                {specialistCategory === 'Skin_Specialist' && <SkinExamForm data={examData} onChange={handleExamChange} doctorInfo={user} studentInfo={selectedStudent} campName={campName} />}
                {specialistCategory === 'Community_Medicine' && <CommunityMedForm data={examData} onChange={handleExamChange} doctorInfo={user} studentInfo={selectedStudent} campName={campName} />}
                {specialistCategory === 'Other' && <CommunityMedForm data={examData} onChange={handleExamChange} doctorInfo={user} studentInfo={selectedStudent} campName={campName} />}
              </div>

              {/* ── E. Other specialists' records (read-only) ── */}
              <OtherRecordsPanel studentId={selectedStudent.student_id} eventId={campId} currentCategory={specialistCategory} />
            </div>
          )}
        </div>
      </div>

      {showAddModal && <AddStudentModal onClose={() => setShowAddModal(false)} onCreated={(s) => selectStudent(s)} userId={user.username} campId={campId} />}
      
      {showFullRecord && selectedStudent && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#1F2937]/40 p-4 backdrop-blur-sm" onClick={() => setShowFullRecord(false)}>
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-xl border border-[#E5E7EB] bg-[#F7F9FB] shadow-lg" onClick={e => e.stopPropagation()}>
            <div className="p-3 sm:p-4">
              <GeneralInfoForm
                student={selectedStudent as any}
                eventId={campId}
                user={{ username: user.username, role: user.role, name: user.name || user.username }}
                onClose={() => setShowFullRecord(false)}
                readOnly={true}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
