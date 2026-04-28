import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search, Plus, ChevronDown, ChevronRight, X, Save,
  ArrowRight, AlertTriangle, Eye, Ear, Stethoscope,
  Activity, Check, UserPlus, Calendar, HeartPulse, Scan,
  Users, CheckCircle, Loader2, ClipboardList, Printer, Trash2, PlusCircle, FileText, History
} from 'lucide-react';
import { GeneralInfoSummary } from './GeneralInfoForm';

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
  registration_number?: string;
  event_id?: number;
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

// ── Reusable UI ──
function FormSelect({ label, value, onChange, options, id, disabled }: {
  label: string; value: string; onChange: (v: string) => void; options: string[]; id: string; disabled?: boolean;
}) {
  const [customValue, setCustomValue] = useState('');
  const isOther = value === 'Other' || (value && !options.includes(value) && value !== '');
  const showCustom = options.includes('Other') && isOther;
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">{label}</label>
      <select id={id} value={isOther && value !== 'Other' ? 'Other' : value} disabled={disabled} onChange={e => {
        if (e.target.value === 'Other') onChange('Other'); else { onChange(e.target.value); setCustomValue(''); }
      }} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white text-sm focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all disabled:opacity-60">
        {options.map(o => <option key={o} value={o}>{o || '—'}</option>)}
      </select>
      {showCustom && !disabled && (
        <input type="text" placeholder="Specify..." value={value === 'Other' ? customValue : value}
          onChange={e => { setCustomValue(e.target.value); onChange(e.target.value || 'Other'); }}
          className="w-full mt-1.5 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-sm focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 placeholder-slate-600" />
      )}
    </div>
  );
}

function FormInput({ label, value, onChange, type = 'text', placeholder = '', id, disabled }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; id: string; disabled?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">{label}</label>
      <input id={id} type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} disabled={disabled}
        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white text-sm focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all placeholder-slate-600 disabled:opacity-60" />
    </div>
  );
}

function SectionCard({ title, icon, children, defaultOpen = true }: {
  title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
      <button type="button" onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-800/50 transition-colors">
        <div className="flex items-center space-x-3">{icon}<span className="font-semibold text-white text-sm">{title}</span></div>
        {open ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
      </button>
      {open && <div className="px-5 pb-5 border-t border-slate-800/50 pt-4">{children}</div>}
    </div>
  );
}

function DomainProgressBar({ examinedCategories }: { examinedCategories?: string }) {
  const done = new Set((examinedCategories || '').split(',').filter(Boolean));
  return (
    <div className="flex items-center space-x-1">
      {DOMAIN_TAGS.map(d => {
        const isDone = done.has(d.key) || done.has('FullExam');
        return (
          <div key={d.key} className={`flex items-center space-x-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold border ${
            isDone ? `${d.color}/20 border-current text-white` : 'bg-slate-800 border-slate-700 text-slate-500'
          }`}>
            {isDone && <CheckCircle className="w-2.5 h-2.5" />}
            <span>{d.short}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Add Student Modal ──
function AddStudentModal({ onClose, onCreated, userId, campId }: {
  onClose: () => void; onCreated: (s: Student) => void; userId: string; campId: number;
}) {
  const [f, setF] = useState({ name: '', age: '', dob: '', gender: '', student_class: '', section: '', blood_group: '', father_name: '', phone: '', registration_number: '' });
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-2xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        <h3 className="text-xl font-bold text-white mb-5 flex items-center"><UserPlus className="w-5 h-5 mr-2 text-cyan-400" /> Register New Student</h3>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">Student Name *</label>
              <input ref={nameRef} value={f.name} onChange={e => upd('name', e.target.value)} required
                className={`w-full bg-slate-950 border rounded-xl px-4 py-3 text-white text-lg focus:ring-2 focus:ring-cyan-500/50 ${errors.name ? 'border-red-500/50' : 'border-slate-800'}`} placeholder="Full name" />
              {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name}</p>}
            </div>
            <FormInput label="Age" value={f.age} onChange={() => {}} type="number" id="add-age" placeholder="Auto from DOB" disabled />
            <div>
              <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">Sex *</label>
              <div className="flex space-x-3 mt-1">
                {[{ v: 'M', label: 'Male' }, { v: 'F', label: 'Female' }].map(opt => (
                  <button key={opt.v} type="button" onClick={() => upd('gender', opt.v)}
                    className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all border flex items-center justify-center space-x-2 ${
                      f.gender === opt.v ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' : 'bg-slate-950 text-slate-400 border-slate-800'
                    }`}>
                    {f.gender === opt.v && <Check className="w-3.5 h-3.5" />}<span>{opt.label}</span>
                  </button>
                ))}
              </div>
              {errors.gender && <p className="text-red-400 text-xs mt-1">{errors.gender}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">Class *</label>
              <select value={f.student_class} onChange={e => upd('student_class', e.target.value)}
                className={`w-full bg-slate-950 border rounded-xl px-3 py-2.5 text-white text-sm ${errors.student_class ? 'border-red-500/50' : 'border-slate-800'}`}>
                {CLASSES.map(o => <option key={o} value={o}>{o || '— Select —'}</option>)}
              </select>
            </div>
            <FormSelect label="Section" value={f.section} onChange={v => upd('section', v)} options={SECTIONS} id="add-section" />
            <FormSelect label="Blood Group" value={f.blood_group} onChange={v => upd('blood_group', v)} options={BLOOD_GROUPS} id="add-bg" />
            <FormInput label="Father's Name" value={f.father_name} onChange={v => upd('father_name', v)} id="add-father" placeholder="Optional" />
            <FormInput label="Registration Number" value={f.registration_number} onChange={v => upd('registration_number', v)} id="add-reg" placeholder="School reg. number" />
            <FormInput label="Contact Number" value={f.phone} onChange={v => upd('phone', v)} id="add-phone" placeholder="Optional" type="tel" />
            <div>
              <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">Date of Birth *</label>
              <input type="date" value={f.dob} onChange={e => upd('dob', e.target.value)}
                className={`w-full bg-slate-950 border rounded-xl px-3 py-2.5 text-white text-sm ${errors.dob ? 'border-red-500/50' : 'border-slate-800'}`} />
              {errors.dob && <p className="text-red-400 text-xs mt-1">{errors.dob}</p>}
            </div>
          </div>

          {/* Symptoms Checklist */}
          <div className="border border-slate-800 rounded-2xl overflow-hidden">
            <button type="button" onClick={() => setShowSymptoms(!showSymptoms)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-800/50 transition-colors">
              <div className="flex items-center space-x-2">
                <ClipboardList className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-semibold text-white">Observed Symptoms</span>
                {symptoms.length > 0 && (
                  <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded text-xs font-bold">{symptoms.length}</span>
                )}
              </div>
              {showSymptoms ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
            </button>
            {showSymptoms && (
              <div className="px-4 pb-4 border-t border-slate-800/50 pt-3">
                <p className="text-xs text-slate-500 mb-2">Check all symptoms observed in the child:</p>
                <div className="grid grid-cols-1 gap-1.5 max-h-60 overflow-y-auto">
                  {SYMPTOM_CHECKLIST.map(symptom => {
                    const active = symptoms.includes(symptom);
                    return (
                      <button key={symptom} type="button" onClick={() => toggleSymptom(symptom)}
                        className={`flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs text-left transition-all border ${
                          active ? 'bg-amber-500/15 text-amber-300 border-amber-500/30' : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-600'
                        }`}>
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                          active ? 'bg-amber-500 border-amber-500' : 'border-slate-600'
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
            className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold py-3.5 rounded-xl shadow-lg disabled:opacity-50 mt-2">
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
function ActiveCampsDirectory({ user, onVolunteer }: { user: User; onVolunteer: (campId: number, campName: string, schoolId?: number) => void; }) {
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
      onVolunteer(camp.event_id, camp.school_name, camp.school_id);
    } catch { alert('Failed to join camp'); } finally { setJoining(null); }
  };
  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-3xl mx-auto">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white tracking-tight">Screening Camps 🏥</h2>
        <p className="text-slate-400 text-sm mt-1">Select a camp to begin clinical screening.</p>
      </div>
      {loading ? <div className="text-center py-12 text-slate-400">Loading camps...</div>
      : camps.length === 0 ? (
        <div className="bg-slate-900/80 backdrop-blur-xl p-12 rounded-2xl border border-slate-800 text-center">
          <Calendar className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">No active camps available.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {camps.map((camp: any) => (
            <div key={camp.event_id} className="w-full text-left bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-slate-800 hover:border-cyan-500/40 transition-all p-5 shadow-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center"><Calendar className="w-6 h-6 text-cyan-400" /></div>
                  <div>
                    <h3 className="text-white font-semibold text-lg">{camp.school_name}</h3>
                    <p className="text-sm text-slate-400 mt-0.5">{formatDate(camp.start_date)}{camp.end_date ? ` → ${formatDate(camp.end_date)}` : ''}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="text-right mr-2">
                    <span className="text-xs text-slate-500 block"><Users className="w-3.5 h-3.5 inline mr-1" />{camp.volunteer_count ?? 0} medical staff</span>
                    <span className="text-xs text-slate-500 block mt-0.5"><Activity className="w-3.5 h-3.5 inline mr-1" />{camp.screened_count ?? 0}/{camp.student_count ?? 0} screened</span>
                  </div>
                  <span className={`px-3 py-1 rounded-lg text-xs font-bold border ${(camp.computed_status || camp.tag) === 'Ongoing' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : (camp.computed_status || camp.tag) === 'Completed' ? 'bg-slate-500/20 text-slate-400 border-slate-500/30' : 'bg-blue-500/20 text-blue-400 border-blue-500/30'}`}>{(camp.computed_status || camp.tag) === 'Ongoing' ? 'Live' : (camp.computed_status || camp.tag)}</span>
                  <button onClick={() => handleVolunteer(camp)} disabled={joining === camp.event_id}
                    className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm flex items-center space-x-2 shadow-lg disabled:opacity-50">
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
  const statusIsNormal = data.status === 'N';
  return (
    <SectionCard title="Ophthalmology Examination" icon={<Eye className="w-4 h-4 text-emerald-400" />}>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <FormSelect label="Vision - Right Eye" value={data.rightEye || '6/6'} onChange={v => u('rightEye', v)}
          options={['6/6', '6/9', '6/12', '6/18', '6/24', '6/36', '6/60', 'Other']} id="eye-r" disabled={disabled} />
        <FormSelect label="Vision - Left Eye" value={data.leftEye || '6/6'} onChange={v => u('leftEye', v)}
          options={['6/6', '6/9', '6/12', '6/18', '6/24', '6/36', '6/60', 'Other']} id="eye-l" disabled={disabled} />
        <div>
          <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">Spectacles / Lenses</label>
          <div className="flex space-x-2">
            {['Yes', 'No'].map(o => (
              <button key={o} type="button" onClick={() => !disabled && u('accessories', o)} disabled={disabled}
                className={`flex-1 py-2.5 rounded-xl font-bold text-xs border ${data.accessories === o ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' : 'bg-slate-950 text-slate-400 border-slate-800'}`}>
                {o}
              </button>
            ))}
          </div>
        </div>
      </div>
      <StatusAndRemarks data={data} onChange={onChange} disabled={disabled} doctorInfo={doctorInfo} studentInfo={studentInfo} campName={campName} />
    </SectionCard>
  );
}

// --- Dental Form ---
function DentalExamForm({ data, onChange, disabled, doctorInfo, studentInfo, campName }: { data: any; onChange: (d: any) => void; disabled?: boolean; doctorInfo?: any; studentInfo?: any; campName?: string }) {
  const u = (k: string, v: any) => onChange({ ...data, [k]: v });
  return (
    <SectionCard title="Dental Examination" icon={<span className="text-base">🦷</span>}>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="col-span-2">
          <FormInput label="Teeth & Gums Examination" value={data.teethGums || ''} onChange={v => u('teethGums', v)}
            id="dental-exam" placeholder='e.g. "Caries CBA ABE"' disabled={disabled} />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">Dental Implants</label>
          <div className="flex space-x-2">
            {['Yes', 'No'].map(o => (
              <button key={o} type="button" onClick={() => !disabled && u('implants', o)} disabled={disabled}
                className={`flex-1 py-2.5 rounded-xl font-bold text-xs border ${data.implants === o ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' : 'bg-slate-950 text-slate-400 border-slate-800'}`}>{o}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">Braces</label>
          <div className="flex space-x-2">
            {['Yes', 'No'].map(o => (
              <button key={o} type="button" onClick={() => !disabled && u('braces', o)} disabled={disabled}
                className={`flex-1 py-2.5 rounded-xl font-bold text-xs border ${data.braces === o ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' : 'bg-slate-950 text-slate-400 border-slate-800'}`}>{o}</button>
            ))}
          </div>
        </div>
      </div>
      <StatusAndRemarks data={data} onChange={onChange} disabled={disabled} doctorInfo={doctorInfo} studentInfo={studentInfo} campName={campName} />
    </SectionCard>
  );
}

// --- ENT Form ---
function ENTExamForm({ data, onChange, disabled, doctorInfo, studentInfo, campName }: { data: any; onChange: (d: any) => void; disabled?: boolean; doctorInfo?: any; studentInfo?: any; campName?: string }) {
  const u = (k: string, v: any) => onChange({ ...data, [k]: v });
  return (
    <SectionCard title="ENT Examination" icon={<Ear className="w-4 h-4 text-amber-400" />}>
      <div className="grid grid-cols-3 gap-3">
        <FormInput label="Ear Examination" value={data.ear || ''} onChange={v => u('ear', v)} id="ent-ear" placeholder='e.g. "B/L EAC Wax"' disabled={disabled} />
        <FormInput label="Nose Examination" value={data.nose || ''} onChange={v => u('nose', v)} id="ent-nose" placeholder="NAD or specify" disabled={disabled} />
        <FormInput label="Throat Examination" value={data.throat || ''} onChange={v => u('throat', v)} id="ent-throat" placeholder="NAD or specify" disabled={disabled} />
      </div>
      <StatusAndRemarks data={data} onChange={onChange} disabled={disabled} doctorInfo={doctorInfo} studentInfo={studentInfo} campName={campName} />
    </SectionCard>
  );
}

// --- Skin Form ---
function SkinExamForm({ data, onChange, disabled, doctorInfo, studentInfo, campName }: { data: any; onChange: (d: any) => void; disabled?: boolean; doctorInfo?: any; studentInfo?: any; campName?: string }) {
  const u = (k: string, v: any) => onChange({ ...data, [k]: v });
  return (
    <SectionCard title="Dermatology Examination" icon={<Scan className="w-4 h-4 text-violet-400" />}>
      <div className="grid grid-cols-1 gap-3">
        <FormInput label="Skin, Nails & Hair Examination" value={data.skinExam || ''} onChange={v => u('skinExam', v)}
          id="skin-exam" placeholder='e.g. "Seborrheic dermatitis / crusting on scalp"' disabled={disabled} />
      </div>
      <StatusAndRemarks data={data} onChange={onChange} disabled={disabled} doctorInfo={doctorInfo} studentInfo={studentInfo} campName={campName} />
    </SectionCard>
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
      <SectionCard title="Past History & Immunisation" icon={<HeartPulse className="w-4 h-4 text-rose-400" />}>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Past History</label>
            <div className="flex flex-wrap gap-2">
              {PAST_HISTORY.map(h => {
                const active = (data.pastHistory || []).includes(h);
                return (
                  <button key={h} type="button" onClick={() => !disabled && toggleList('pastHistory', h)} disabled={disabled}
                    className={`px-3 py-2 rounded-xl text-sm font-medium border ${active ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' : 'bg-slate-950 text-slate-400 border-slate-800'}`}>
                    {active && <Check className="w-3 h-3 inline mr-1" />}{h}
                  </button>
                );
              })}
            </div>
            <FormInput label="Other Past History" value={data.pastHistoryOther || ''} onChange={v => u('pastHistoryOther', v)} id="cm-ph-other" placeholder="Specify if any" disabled={disabled} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Immunisation Status</label>
            <div className="space-y-2">
              {VACCINATIONS.map(v => {
                const val = (data.vaccinationStatus || {})[v] || 'unknown';
                return (
                  <div key={v} className="flex items-center space-x-2">
                    <span className="text-sm text-slate-300 w-28 flex-shrink-0">{v}</span>
                    <div className="flex space-x-1.5">
                      {[
                        { key: 'given', label: 'Given', color: 'emerald' },
                        { key: 'not_given', label: 'Not Given', color: 'red' },
                        { key: 'unknown', label: 'Unknown', color: 'slate' },
                      ].map(opt => (
                        <button key={opt.key} type="button" disabled={disabled}
                          onClick={() => !disabled && u('vaccinationStatus', { ...(data.vaccinationStatus || {}), [v]: opt.key })}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                            val === opt.key
                              ? opt.color === 'emerald' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                              : opt.color === 'red' ? 'bg-red-500/20 text-red-400 border-red-500/40'
                              : 'bg-slate-700/40 text-slate-300 border-slate-600'
                              : 'bg-slate-950 text-slate-500 border-slate-800 hover:border-slate-600'
                          }`}>
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
      </SectionCard>

      <SectionCard title="Present Complaint & Medication" icon={<Stethoscope className="w-4 h-4 text-blue-400" />}>
        <div className="grid grid-cols-2 gap-3">
          <FormInput label="Present Complaint" value={data.presentComplaint || ''} onChange={v => u('presentComplaint', v)} id="cm-complaint" placeholder='e.g. "White crusting on scalp"' disabled={disabled} />
          <FormInput label="Current Medication" value={data.currentMedication || ''} onChange={v => u('currentMedication', v)} id="cm-med" placeholder='e.g. "Medicated shampoo"' disabled={disabled} />
        </div>
        <div className="mt-3">
          <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">General Appearance: Anaemia</label>
          <div className="flex space-x-2">
            {['No', 'Yes', 'Clinical Pallor'].map(o => (
              <button key={o} type="button" onClick={() => !disabled && u('anaemia', o)} disabled={disabled}
                className={`flex-1 py-2.5 rounded-xl font-bold text-xs border ${data.anaemia === o ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' : 'bg-slate-950 text-slate-400 border-slate-800'}`}>{o}</button>
            ))}
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Systemic Examination" icon={<HeartPulse className="w-4 h-4 text-rose-400" />}>
        <div className="space-y-3">
          {SYSTEMS.map(sys => (
            <div key={sys.key}>
              <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">{sys.label}</label>
              <div className="flex space-x-2">
                {['NAD', 'Abnormal'].map(o => (
                  <button key={o} type="button" onClick={() => !disabled && u(sys.key, o)} disabled={disabled}
                    className={`px-4 py-2 rounded-xl font-bold text-xs border ${data[sys.key] === o ? (o === 'NAD' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30') : 'bg-slate-950 text-slate-400 border-slate-800'}`}>{o}</button>
                ))}
                {data[sys.key] === 'Abnormal' && (
                  <input value={data[`${sys.key}Detail`] || ''} onChange={e => u(`${sys.key}Detail`, e.target.value)} disabled={disabled}
                    placeholder="Specify..." className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-sm" />
                )}
              </div>
            </div>
          ))}
          <FormInput label="Other Findings" value={data.otherFindings || ''} onChange={v => u('otherFindings', v)} id="cm-other" placeholder="Additional findings" disabled={disabled} />
        </div>
      </SectionCard>

      <SectionCard title="Final Assessment" icon={<Stethoscope className="w-4 h-4 text-indigo-400" />}>
        <StatusAndRemarks data={data} onChange={onChange} disabled={disabled} doctorInfo={doctorInfo} studentInfo={studentInfo} campName={campName} />
      </SectionCard>
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
          <tr><td style={{ padding: '3px 0', fontWeight: 'bold' }}>Reg No:</td><td>{studentInfo?.registration_number || '—'}</td><td style={{ fontWeight: 'bold' }}>Contact:</td><td colSpan={3}>{studentInfo?.phone || '—'}</td></tr>
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
    <div className="mt-4 space-y-3">
      <div>
        <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Status</label>
        <div className="flex space-x-3">
          {[{ v: 'N', label: 'Normal', color: 'emerald' }, { v: 'O', label: 'Observation', color: 'amber' }, { v: 'R', label: 'Referred for Treatment', color: 'red' }].map(opt => (
            <button key={opt.v} type="button" onClick={() => !disabled && u('status', opt.v)} disabled={disabled}
              className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all border ${
                data.status === opt.v
                  ? opt.color === 'emerald' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                  : opt.color === 'amber' ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                  : 'bg-red-500/20 text-red-400 border-red-500/40'
                  : 'bg-slate-950 text-slate-400 border-slate-800'
              }`}>
              {opt.v} — {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Normal — show nothing extra */}
      {statusIsNormal && (
        <p className="text-xs text-slate-600 italic">No prescription or referral needed for Normal status.</p>
      )}

      {/* Observation — Prescription form */}
      {isObservation && !disabled && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4 space-y-3 animate-in fade-in duration-300">
          <div className="flex items-center space-x-2 mb-1">
            <FileText className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-bold text-amber-400 uppercase tracking-wider">Prescription</span>
          </div>
          {/* Auto-filled info */}
          <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
            <div><span className="text-slate-600">Doctor:</span> {doctorInfo?.name || doctorInfo?.username || '—'} ({(doctorInfo?.role || '').replace(/_/g, ' ')})</div>
            <div><span className="text-slate-600">Date:</span> {new Date().toLocaleDateString('en-IN')}</div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">Clinical Findings</label>
            <textarea value={data.clinicalFindings || ''} onChange={e => u('clinicalFindings', e.target.value)}
              rows={2} placeholder="Summarize clinical findings..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white text-sm resize-none focus:ring-2 focus:ring-amber-500/50" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">Diagnosis</label>
            <input value={data.diagnosis || ''} onChange={e => u('diagnosis', e.target.value)}
              placeholder="e.g. Myopia, Dental Caries"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white text-sm focus:ring-2 focus:ring-amber-500/50" />
          </div>
          {/* Medicines Repeater */}
          <div>
            <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">Medicines (Rx)</label>
            <div className="space-y-2">
              {(data.medicines || []).map((med: any, idx: number) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <input value={med.name} onChange={e => updateMedicine(idx, 'name', e.target.value)}
                    placeholder="Medicine name" className="col-span-4 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-white text-xs" />
                  <input value={med.dosage} onChange={e => updateMedicine(idx, 'dosage', e.target.value)}
                    placeholder="Dosage" className="col-span-2 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-white text-xs" />
                  <select value={med.frequency} onChange={e => updateMedicine(idx, 'frequency', e.target.value)}
                    className="col-span-2 bg-slate-950 border border-slate-800 rounded-lg px-2 py-2 text-white text-xs">
                    {FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                  <input value={med.duration} onChange={e => updateMedicine(idx, 'duration', e.target.value)}
                    placeholder="Duration" className="col-span-3 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-white text-xs" />
                  <button type="button" onClick={() => removeMedicine(idx)} className="col-span-1 text-red-400 hover:text-red-300 flex justify-center">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <button type="button" onClick={addMedicine}
              className="mt-2 flex items-center space-x-1.5 text-xs text-amber-400 hover:text-amber-300 font-medium">
              <PlusCircle className="w-3.5 h-3.5" /><span>Add Medicine</span>
            </button>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">General Advice</label>
            <textarea value={data.advice || ''} onChange={e => u('advice', e.target.value)}
              rows={2} placeholder="Follow-up advice, precautions..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white text-sm resize-none focus:ring-2 focus:ring-amber-500/50" />
          </div>
          <div className="flex justify-end">
            <button type="button" onClick={handlePrint}
              className="flex items-center space-x-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30 px-4 py-2 rounded-xl text-sm font-bold transition-all">
              <Printer className="w-4 h-4" /><span>Print Prescription</span>
            </button>
          </div>
        </div>
      )}

      {/* Referred — Referral form */}
      {isReferred && !disabled && (
        <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-4 space-y-3 animate-in fade-in duration-300">
          <div className="flex items-center space-x-2 mb-1">
            <FileText className="w-4 h-4 text-red-400" />
            <span className="text-sm font-bold text-red-400 uppercase tracking-wider">Referral Sheet</span>
          </div>
          {/* Auto-filled info */}
          <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
            <div><span className="text-slate-600">Referring Doctor:</span> {doctorInfo?.name || doctorInfo?.username || '—'} ({(doctorInfo?.role || '').replace(/_/g, ' ')})</div>
            <div><span className="text-slate-600">Date:</span> {new Date().toLocaleDateString('en-IN')}</div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">Clinical Findings</label>
            <textarea value={data.clinicalFindings || ''} onChange={e => u('clinicalFindings', e.target.value)}
              rows={2} placeholder="Summarize clinical findings..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white text-sm resize-none focus:ring-2 focus:ring-red-500/50" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">Reason for Referral</label>
            <textarea value={data.referralReason || ''} onChange={e => u('referralReason', e.target.value)}
              rows={2} placeholder="Why is this student being referred?"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white text-sm resize-none focus:ring-2 focus:ring-red-500/50" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">Recommended Dept / Hospital</label>
            <input value={data.referralDept || ''} onChange={e => u('referralDept', e.target.value)}
              placeholder="e.g. Ophthalmology, Civil Hospital Bathinda"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white text-sm focus:ring-2 focus:ring-red-500/50" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Urgency</label>
            <div className="flex space-x-3">
              {['Routine', 'Priority', 'Urgent'].map(urg => (
                <button key={urg} type="button" onClick={() => u('urgency', urg)}
                  className={`flex-1 py-2.5 rounded-xl font-bold text-xs border transition-all ${
                    data.urgency === urg
                      ? urg === 'Routine' ? 'bg-blue-500/20 text-blue-400 border-blue-500/40'
                      : urg === 'Priority' ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                      : 'bg-red-500/20 text-red-400 border-red-500/40'
                      : 'bg-slate-950 text-slate-400 border-slate-800'
                  }`}>
                  {urg}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end">
            <button type="button" onClick={handlePrint}
              className="flex items-center space-x-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 px-4 py-2 rounded-xl text-sm font-bold transition-all">
              <Printer className="w-4 h-4" /><span>Print Referral Sheet</span>
            </button>
          </div>
        </div>
      )}

      {/* Read-only view when disabled and not Normal */}
      {(isObservation || isReferred) && disabled && (
        <div className="bg-slate-800/30 border border-slate-700 rounded-2xl p-4 space-y-2">
          <span className={`text-xs font-bold uppercase ${isObservation ? 'text-amber-400' : 'text-red-400'}`}>
            {isObservation ? '📝 Prescription' : '🏥 Referral Sheet'}
          </span>
          {data.clinicalFindings && <p className="text-xs text-slate-300"><span className="text-slate-500">Findings:</span> {data.clinicalFindings}</p>}
          {data.diagnosis && <p className="text-xs text-slate-300"><span className="text-slate-500">Dx:</span> {data.diagnosis}</p>}
          {(data.medicines || []).length > 0 && (
            <div className="text-xs text-slate-300">
              <span className="text-slate-500">Rx:</span>
              {data.medicines.map((m: any, i: number) => (
                <span key={i} className="ml-1">{m.name} {m.dosage} {m.frequency} {m.duration}{i < data.medicines.length - 1 ? ',' : ''}</span>
              ))}
            </div>
          )}
          {data.referralReason && <p className="text-xs text-slate-300"><span className="text-slate-500">Reason:</span> {data.referralReason}</p>}
          {data.referralDept && <p className="text-xs text-slate-300"><span className="text-slate-500">Refer to:</span> {data.referralDept}</p>}
          {data.urgency && <p className="text-xs text-slate-300"><span className="text-slate-500">Urgency:</span> {data.urgency}</p>}
          {data.advice && <p className="text-xs text-slate-300"><span className="text-slate-500">Advice:</span> {data.advice}</p>}
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
// Per-specialist renderers so each card shows data in a structured, readable layout.

function RecordField({ label, value, className = '' }: { label: string; value?: string; className?: string }) {
  if (!value) return null;
  return (
    <div className={className}>
      <span className="text-[10px] text-slate-600 uppercase tracking-wider">{label}</span>
      <p className="text-xs text-slate-300 mt-0.5">{value}</p>
    </div>
  );
}

function RecordPill({ label, color }: { label: string; color: string }) {
  return <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${color}`}>{label}</span>;
}

function EyeRecordCard({ d }: { d: any }) {
  return (
    <div className="grid grid-cols-3 gap-2 mt-1.5">
      <RecordField label="Vision RE" value={d.rightEye} />
      <RecordField label="Vision LE" value={d.leftEye} />
      <RecordField label="Spectacles" value={d.accessories} />
    </div>
  );
}

function DentalRecordCard({ d }: { d: any }) {
  return (
    <div className="mt-1.5 space-y-1">
      <RecordField label="Teeth & Gums" value={d.teethGums} />
      <div className="grid grid-cols-2 gap-2">
        <RecordField label="Implants" value={d.implants} />
        <RecordField label="Braces" value={d.braces} />
      </div>
    </div>
  );
}

function ENTRecordCard({ d }: { d: any }) {
  return (
    <div className="grid grid-cols-3 gap-2 mt-1.5">
      <RecordField label="Ear" value={d.ear} />
      <RecordField label="Nose" value={d.nose} />
      <RecordField label="Throat" value={d.throat} />
    </div>
  );
}

function SkinRecordCard({ d }: { d: any }) {
  return <div className="mt-1.5"><RecordField label="Skin / Nails / Hair" value={d.skinExam} /></div>;
}

function CommunityMedRecordCard({ d }: { d: any }) {
  const vaccStatus = d.vaccinationStatus || {};
  const vaccEntries = Object.entries(vaccStatus) as [string, string][];
  const vaccColor = (s: string) =>
    s === 'given' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' :
    s === 'not_given' ? 'text-red-400 bg-red-500/10 border-red-500/30' :
    'text-slate-400 bg-slate-800 border-slate-700';
  const vaccLabel = (s: string) => s === 'given' ? '✓' : s === 'not_given' ? '✗' : '?';
  const pastHistory = Array.isArray(d.pastHistory) ? d.pastHistory : [];
  const SYSTEMS = ['locomotor', 'abdomen', 'respiratory', 'cardiovascular', 'cns'];
  const sysEntries = SYSTEMS.filter(s => d[s]).map(s => ({ key: s, val: d[s], detail: d[`${s}Detail`] }));
  return (
    <div className="mt-1.5 space-y-2">
      {/* Vaccinations */}
      {vaccEntries.length > 0 && (
        <div>
          <span className="text-[10px] text-slate-600 uppercase tracking-wider">Immunisation</span>
          <div className="flex flex-wrap gap-1 mt-0.5">
            {vaccEntries.map(([name, status]) => (
              <span key={name} className={`text-[10px] font-medium px-1.5 py-0.5 rounded border inline-flex items-center space-x-1 ${vaccColor(status)}`}>
                <span>{vaccLabel(status)}</span><span>{name}</span>
              </span>
            ))}
          </div>
        </div>
      )}
      {/* Past History */}
      {pastHistory.length > 0 && (
        <div>
          <span className="text-[10px] text-slate-600 uppercase tracking-wider">Past History</span>
          <div className="flex flex-wrap gap-1 mt-0.5">
            {pastHistory.map((h: string) => <span key={h} className="text-[10px] text-rose-300 bg-rose-500/10 border border-rose-500/30 px-1.5 py-0.5 rounded">{h}</span>)}
          </div>
        </div>
      )}
      {d.pastHistoryOther && <RecordField label="Other History" value={d.pastHistoryOther} />}
      {/* Complaints & Meds */}
      <div className="grid grid-cols-2 gap-2">
        <RecordField label="Complaint" value={d.presentComplaint} />
        <RecordField label="Medication" value={d.currentMedication} />
      </div>
      <RecordField label="Anaemia" value={d.anaemia} />
      {/* Systemic Examination */}
      {sysEntries.length > 0 && (
        <div>
          <span className="text-[10px] text-slate-600 uppercase tracking-wider">Systems</span>
          <div className="flex flex-wrap gap-1 mt-0.5">
            {sysEntries.map(s => (
              <span key={s.key} className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${s.val === 'NAD' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' : 'text-red-400 bg-red-500/10 border-red-500/30'}`}>
                {s.key}{s.val === 'Abnormal' && s.detail ? `: ${s.detail}` : ` ${s.val}`}
              </span>
            ))}
          </div>
        </div>
      )}
      {d.otherFindings && <RecordField label="Other Findings" value={d.otherFindings} />}
    </div>
  );
}

/** Fallback for unrecognized specialty — show key-value pairs cleanly. */
function GenericRecordCard({ d }: { d: any }) {
  const entries = Object.entries(d).filter(([k]) => k !== 'status' && k !== 'assessment');
  if (entries.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-2 mt-1.5">
      {entries.map(([k, v]) => {
        if (v === null || v === undefined || v === '') return null;
        let display: string;
        if (Array.isArray(v)) display = v.map(i => typeof i === 'object' ? Object.entries(i).map(([a,b])=>`${a}: ${b}`).join(', ') : String(i)).join(' | ');
        else if (typeof v === 'object') display = Object.entries(v).map(([a,b])=>`${a}: ${b}`).join(', ');
        else display = String(v);
        return <div key={k}><RecordField label={k.replace(/_/g, ' ')} value={display} /></div>;
      })}
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

function OtherRecordsPanel({ studentId, eventId, currentCategory }: {
  studentId: number; eventId: number; currentCategory: string;
}) {
  const [records, setRecords] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (open && records.length === 0) {
      fetch(`/api/students/${studentId}/all-records?event_id=${eventId}`)
        .then(r => r.json())
        .then(d => setRecords(d.records || []))
        .catch(() => {});
    }
  }, [open, studentId, eventId]);
  const otherRecords = records.filter(r => r.category !== currentCategory);
  const catLabel = (c: string) => c.replace(/_/g, ' ');
  const statusLabel = (s: string) => s === 'N' ? 'Normal' : s === 'O' ? 'Observation' : s === 'R' ? 'Referred' : s;
  const statusColor = (s: string) => s === 'N' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' : s === 'R' ? 'text-red-400 bg-red-500/10 border-red-500/30' : 'text-amber-400 bg-amber-500/10 border-amber-500/30';
  return (
    <div className="bg-slate-900/60 rounded-2xl border border-slate-800">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-800/50 transition-colors">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Other Specialists' Records ({otherRecords.length})</span>
        {open ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
      </button>
      {open && (
        <div className="px-4 pb-3 border-t border-slate-800/50 pt-2 space-y-2">
          {otherRecords.length === 0 ? (
            <p className="text-xs text-slate-500 py-1">No other specialist records yet.</p>
          ) : otherRecords.map((r, i) => {
            const d = r.parsed_data || {};
            return (
              <div key={i} className="bg-slate-950/50 rounded-lg px-3 py-2 border border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-cyan-400">{catLabel(r.category)}</span>
                  <div className="flex items-center space-x-2">
                    {d.status && <RecordPill label={statusLabel(d.status)} color={statusColor(d.status)} />}
                    <span className="text-[10px] text-slate-600">{r.doctor_id}</span>
                  </div>
                </div>
                <SpecialistRecordBody category={r.category} d={d} />
                {d.remarks && <p className="text-[11px] text-slate-400 mt-1 italic border-t border-slate-800/50 pt-1">"{d.remarks}"</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Previous Evaluations Modal (cross-camp) ──
function PreviousEvaluationsModal({ student, schoolId, onClose }: {
  student: Student; schoolId: number | null; onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    if (!student.registration_number || !schoolId) {
      setLoading(false);
      return;
    }
    const params = new URLSearchParams({
      school_id: String(schoolId),
      registration_number: student.registration_number,
      current_event_id: String(student.event_id || ''),
    });
    fetch(`/api/students/previous-records?${params}`)
      .then(r => r.json())
      .then(data => {
        setRecords(data.records || []);
        setEvents(data.events || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [student, schoolId]);

  const formatDate = (d: string) => {
    if (!d) return ''; const dt = new Date(d); if (isNaN(dt.getTime())) return d;
    return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`;
  };

  const catLabel = (c: string) => c.replace(/_/g, ' ');
  const statusLabel = (s: string) => s === 'N' ? 'Normal' : s === 'O' ? 'Observation' : s === 'R' ? 'Referred' : s;
  const statusColor = (s: string) => s === 'N' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' : s === 'R' ? 'text-red-400 bg-red-500/10 border-red-500/30' : 'text-amber-400 bg-amber-500/10 border-amber-500/30';

  // Group records by event_id
  const recordsByEvent: Record<number, any[]> = {};
  for (const r of records) {
    const eid = r.event_id;
    if (!recordsByEvent[eid]) recordsByEvent[eid] = [];
    recordsByEvent[eid].push(r);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-2xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        <h3 className="text-lg font-bold text-white mb-1 flex items-center">
          <History className="w-5 h-5 mr-2 text-indigo-400" />
          Previous Evaluations
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          {student.name} · Reg: {student.registration_number || '—'}
        </p>

        {loading ? (
          <div className="text-center py-12 text-slate-400 flex items-center justify-center space-x-2">
            <Loader2 className="w-5 h-5 animate-spin" /><span>Loading records...</span>
          </div>
        ) : !student.registration_number ? (
          <div className="text-center py-12">
            <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">No registration number assigned.</p>
            <p className="text-slate-500 text-xs mt-1">A registration number is needed to track students across camps.</p>
          </div>
        ) : records.length === 0 ? (
          <div className="text-center py-12">
            <ClipboardList className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">No previous evaluations found.</p>
            <p className="text-slate-500 text-xs mt-1">This is the first examination for this student.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {events.map(evt => {
              const evtRecords = recordsByEvent[evt.event_id] || [];
              if (evtRecords.length === 0) return null;
              return (
                <div key={evt.event_id} className="bg-slate-950/50 rounded-2xl border border-slate-800 overflow-hidden">
                  <div className="px-4 py-3 bg-indigo-500/5 border-b border-slate-800 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-4 h-4 text-indigo-400" />
                      <span className="text-sm font-bold text-white">{evt.school_name}</span>
                    </div>
                    <span className="text-xs text-slate-500">
                      {formatDate(evt.start_date)}{evt.end_date ? ` → ${formatDate(evt.end_date)}` : ''}
                    </span>
                  </div>
                  {evt.general_info && (evt.general_info.height || evt.general_info.weight) && (
                    <div className="px-4 py-2 border-b border-slate-800/50 flex items-center space-x-4 text-xs text-slate-400">
                      {evt.general_info.height && <span>Height: <b className="text-slate-300">{evt.general_info.height} cm</b></span>}
                      {evt.general_info.weight && <span>Weight: <b className="text-slate-300">{evt.general_info.weight} kg</b></span>}
                      {evt.general_info.bmi && <span>BMI: <b className="text-slate-300">{evt.general_info.bmi}</b></span>}
                    </div>
                  )}
                  <div className="p-3 space-y-2">
                    {evtRecords.map((r: any, i: number) => {
                      const d = r.parsed_data || {};
                      return (
                        <div key={i} className="bg-slate-900/80 rounded-lg px-3 py-2 border border-slate-800">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-cyan-400">{catLabel(r.category)}</span>
                            <div className="flex items-center space-x-2">
                              {d.status && (
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${statusColor(d.status)}`}>
                                  {statusLabel(d.status)}
                                </span>
                              )}
                              <span className="text-[10px] text-slate-600">{r.doctor_id}</span>
                            </div>
                          </div>
                          <SpecialistRecordBody category={r.category} d={d} />
                          {d.clinicalFindings && <p className="text-[11px] text-slate-400 mt-1"><span className="text-slate-600">Findings:</span> {d.clinicalFindings}</p>}
                          {d.diagnosis && <p className="text-[11px] text-slate-400 mt-0.5"><span className="text-slate-600">Dx:</span> {d.diagnosis}</p>}
                          {d.referralReason && <p className="text-[11px] text-slate-400 mt-0.5"><span className="text-slate-600">Referral:</span> {d.referralReason}</p>}
                          {(d.medicines || []).length > 0 && (
                            <div className="text-[11px] text-slate-400 mt-0.5">
                              <span className="text-slate-600">Rx:</span>
                              {d.medicines.map((m: any, j: number) => (
                                <span key={j} className="ml-1">{m.name} {m.dosage} {m.frequency} {m.duration}{j < d.medicines.length - 1 ? ',' : ''}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════
// ██ MAIN DOCTOR WORKFLOW
// ════════════════════════════════════════════════
export default function DoctorWorkflow({ user }: { user: User }) {
  const [selectedCampId, setSelectedCampId] = useState<number | null>(null);
  const [selectedCampName, setSelectedCampName] = useState('');
  const [selectedCampSchoolId, setSelectedCampSchoolId] = useState<number | null>(null);
  if (!selectedCampId) {
    return <ActiveCampsDirectory user={user} onVolunteer={(id, name, schoolId) => { setSelectedCampId(id); setSelectedCampName(name); setSelectedCampSchoolId(schoolId ?? null); }} />;
  }
  return <ClinicalWorkflow user={user} campId={selectedCampId} campName={selectedCampName} campSchoolId={selectedCampSchoolId} onBack={() => { setSelectedCampId(null); setSelectedCampName(''); setSelectedCampSchoolId(null); }} />;
}

// ════════════════════════════════════════════════
// ██ CLINICAL WORKFLOW (scoped per specialist)
// ════════════════════════════════════════════════
function ClinicalWorkflow({ user, campId, campName, campSchoolId, onBack }: {
  user: User; campId: number; campName: string; campSchoolId: number | null; onBack: () => void;
}) {
  const specialistCategory = user.role;
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPrevEvals, setShowPrevEvals] = useState(false);
  const [filterClass, setFilterClass] = useState('');
  const [filterSection, setFilterSection] = useState('');
  const [filterGender, setFilterGender] = useState('');
  const [filterExamined, setFilterExamined] = useState('');
  const [examData, setExamData] = useState<any>({ status: 'N' });
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [online, setOnline] = useState(navigator.onLine);
  const [todayCount, setTodayCount] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Online/offline
  useEffect(() => {
    const on = () => { setOnline(true); syncOfflineQueue(); };
    const off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

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
    setSelectedStudent(s); setSearchResults([]); setSearchQuery('');
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
      // Store the student's event_id for later use
      s.event_id = campId;
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

  const specColor = specialistCategory === 'Community_Medicine' ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' :
    specialistCategory === 'Dental' ? 'bg-sky-500/20 text-sky-400 border-sky-500/30' :
    specialistCategory === 'ENT' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
    specialistCategory === 'Eye_Specialist' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
    specialistCategory === 'Skin_Specialist' ? 'bg-violet-500/20 text-violet-400 border-violet-500/30' :
    'bg-slate-500/20 text-slate-400 border-slate-500/30';

  return (
    <div className="space-y-4 animate-in fade-in duration-500 max-w-5xl mx-auto">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-3">
            <button onClick={handleBack} className="text-slate-400 hover:text-cyan-400 transition-colors text-sm flex items-center space-x-1">
              <ChevronRight className="w-4 h-4 rotate-180" /><span>Exit Camp</span>
            </button>
            <h2 className="text-2xl font-bold text-white tracking-tight">Clinical Examination 🩺</h2>
          </div>
          <p className="text-slate-400 text-sm mt-0.5">
            {campName}
            <span className={`ml-2 px-2 py-0.5 rounded text-xs font-bold border ${specColor}`}>{specialistCategory.replace(/_/g, ' ')}</span>
          </p>
        </div>
        <div className="flex items-center space-x-3">
          {/* Autosave status */}
          {saveStatus === 'saving' && <span className="text-xs text-amber-400 flex items-center space-x-1"><Loader2 className="w-3 h-3 animate-spin" /><span>Saving...</span></span>}
          {saveStatus === 'saved' && <span className="text-xs text-emerald-400 flex items-center space-x-1"><Check className="w-3 h-3" /><span>Saved</span></span>}
          {saveStatus === 'error' && <span className="text-xs text-red-400 flex items-center space-x-1"><AlertTriangle className="w-3 h-3" /><span>Error</span></span>}
          {!online && <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 px-3 py-1.5 rounded-xl text-xs font-bold">Offline</span>}
          <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-sm">
            <span className="text-slate-400">Today: </span><span className="text-cyan-400 font-bold">{todayCount}</span><span className="text-slate-500"> examined</span>
          </div>
        </div>
      </div>

      {/* Search + Add */}
      <div className="bg-slate-900/80 backdrop-blur-xl p-4 rounded-2xl border border-slate-800 shadow-xl">
        <div className="flex space-x-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-cyan-500 w-5 h-5" />
            <input ref={searchRef} type="text" placeholder="Search by name, class, section, phone..."
              value={searchQuery} onChange={e => { setSearchQuery(e.target.value); doSearch(e.target.value); }}
              onKeyDown={e => e.key === 'Enter' && doSearch()}
              className="w-full pl-11 pr-4 py-3.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:ring-2 focus:ring-cyan-500/50 outline-none text-base" />
          </div>
          <button onClick={() => setShowAddModal(true)}
            className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white px-5 py-3.5 rounded-xl font-bold flex items-center space-x-2 shadow-lg whitespace-nowrap">
            <Plus className="w-5 h-5" /><span>Add Student</span>
          </button>
        </div>
        {/* Filters */}
        <div className="flex items-center space-x-2 mt-3 flex-wrap gap-y-2">
          <span className="text-xs text-slate-500 font-medium">Filters:</span>
          <select value={filterClass} onChange={e => setFilterClass(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300">
            <option value="">All Classes</option>{CLASSES.filter(Boolean).map(c => <option key={c} value={c}>Class {c}</option>)}
          </select>
          <select value={filterSection} onChange={e => setFilterSection(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300">
            <option value="">All Sections</option>{SECTIONS.filter(Boolean).map(s => <option key={s} value={s}>Section {s}</option>)}
          </select>
          <select value={filterExamined} onChange={e => setFilterExamined(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300">
            <option value="">All Status</option><option value="0">Not Examined</option><option value="1">Examined</option>
          </select>
          <select value={filterGender} onChange={e => setFilterGender(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300">
            <option value="">All Sex</option><option value="M">Male</option><option value="F">Female</option>
          </select>
          {(filterClass || filterSection || filterExamined || filterGender) && (
            <button onClick={() => { setFilterClass(''); setFilterSection(''); setFilterExamined(''); setFilterGender(''); }} className="text-xs text-red-400 underline">Clear</button>
          )}
        </div>
        {/* Results — show when there are results and no student selected */}
        {searchResults.length > 0 && !selectedStudent && (
          <div className="mt-3 max-h-64 overflow-y-auto space-y-1.5 border-t border-slate-800 pt-3">
            {searchResults.map(s => (
              <button key={s.student_id} onClick={() => selectStudent(s)}
                className="w-full text-left px-4 py-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/50 transition-all flex justify-between items-center group">
                <div className="flex items-center space-x-3">
                  <div className={`w-2 h-2 rounded-full ${s.is_examined ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                  <div>
                    <span className="font-bold text-white">{s.name}</span>
                    <span className="text-slate-400 text-xs ml-2">
                      {s.registration_number && `Reg: ${s.registration_number} • `}
                      {s.student_class && `Class ${s.student_class}`}{s.section && `-${s.section}`}
                      {s.age && ` • ${s.age}y`} • {s.gender}
                    </span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <DomainProgressBar examinedCategories={s.examined_categories} />
                  <span className="text-xs text-slate-500 group-hover:text-cyan-400">Select →</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Selected Student: Forms */}
      {selectedStudent && (
        <>
          {/* Student header */}
          <div className="sticky top-0 z-30 bg-gradient-to-r from-cyan-900/30 to-blue-900/30 backdrop-blur-xl p-4 rounded-2xl border border-cyan-500/20 flex items-center justify-between shadow-lg">
            <div className="flex items-center space-x-4">
              <div className="w-11 h-11 rounded-xl bg-cyan-500/20 flex items-center justify-center text-cyan-400 font-bold text-lg">{selectedStudent.name.charAt(0)}</div>
              <div>
                <h3 className="text-lg font-bold text-white">{selectedStudent.name}</h3>
                <div className="flex items-center space-x-2 text-xs text-slate-400 mt-0.5">
                  {selectedStudent.age && <span className="bg-slate-800 px-2 py-0.5 rounded">{selectedStudent.age}y / {selectedStudent.gender}</span>}
                  {selectedStudent.student_class && <span className="bg-slate-800 px-2 py-0.5 rounded">Class {selectedStudent.student_class}{selectedStudent.section && `-${selectedStudent.section}`}</span>}
                  <DomainProgressBar examinedCategories={selectedStudent.examined_categories} />
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button onClick={() => { setSelectedStudent(null); setExamData({ status: 'N' }); setShowPrevEvals(false); doSearch(); searchRef.current?.focus(); }}
                className="bg-slate-800 hover:bg-slate-700 px-4 py-2.5 rounded-xl text-sm font-medium border border-slate-700 text-white flex items-center space-x-2">
                <X className="w-4 h-4" /><span>Done</span>
              </button>
              {/* Previous Evaluations button */}
              {selectedStudent.registration_number && (
                <button onClick={() => setShowPrevEvals(true)}
                  className="bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-400 border border-indigo-500/30 px-3 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center space-x-1.5"
                  title="View previous evaluations from other camps">
                  <History className="w-4 h-4" /><span className="hidden md:inline">History</span>
                </button>
              )}
            </div>
          </div>

          {/* General Info Summary (read-only for specialists) */}
          <GeneralInfoSummary studentId={selectedStudent.student_id} eventId={campId} />

          {/* Specialist-specific form */}
          {specialistCategory === 'Eye_Specialist' && <EyeExamForm data={examData} onChange={handleExamChange} doctorInfo={user} studentInfo={selectedStudent} campName={campName} />}
          {specialistCategory === 'Dental' && <DentalExamForm data={examData} onChange={handleExamChange} doctorInfo={user} studentInfo={selectedStudent} campName={campName} />}
          {specialistCategory === 'ENT' && <ENTExamForm data={examData} onChange={handleExamChange} doctorInfo={user} studentInfo={selectedStudent} campName={campName} />}
          {specialistCategory === 'Skin_Specialist' && <SkinExamForm data={examData} onChange={handleExamChange} doctorInfo={user} studentInfo={selectedStudent} campName={campName} />}
          {specialistCategory === 'Community_Medicine' && <CommunityMedForm data={examData} onChange={handleExamChange} doctorInfo={user} studentInfo={selectedStudent} campName={campName} />}
          {specialistCategory === 'Other' && <CommunityMedForm data={examData} onChange={handleExamChange} doctorInfo={user} studentInfo={selectedStudent} campName={campName} />}

          {/* Other specialists' records (read-only) */}
          <OtherRecordsPanel studentId={selectedStudent.student_id} eventId={campId} currentCategory={specialistCategory} />

          {/* Previous Evaluations Modal */}
          {showPrevEvals && (
            <PreviousEvaluationsModal
              student={selectedStudent}
              schoolId={campSchoolId}
              onClose={() => setShowPrevEvals(false)}
            />
          )}
        </>
      )}

      {showAddModal && <AddStudentModal onClose={() => setShowAddModal(false)} onCreated={(s) => selectStudent(s)} userId={user.username} campId={campId} />}
    </div>
  );
}
