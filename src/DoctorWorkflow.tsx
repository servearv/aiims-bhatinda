import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search, Plus, ChevronDown, ChevronRight, X, Save,
  ArrowRight, AlertTriangle, Eye, Ear, Stethoscope,
  Activity, Check, UserPlus, Calendar, HeartPulse, Scan,
  Users, CheckCircle
} from 'lucide-react';

// ── Types ──
type User = { username: string; role: string; name: string; specialization?: string };

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
  is_examined?: number;
  examined_categories?: string; // comma-separated categories like "Dental,ENT"
}

interface ExamData {
  // Vitals
  height: string; weight: string; bp: string; pulse: string; anaemia: string;
  // Eye
  rightEyeVision: string; leftEyeVision: string; generalEye: string;
  // ENT
  ear: string; nose: string; throat: string;
  // Dental
  dental: string;
  // Skin
  skin: string;
  // Systemic
  locomotor: string; abdomen: string; respiratory: string;
  cardiovascular: string; cns: string;
  // Symptoms
  symptoms: string[];
  // Assessment
  assessment: string; referralDepts: string[];
  // Remarks
  remarks: string;
}

const DEFAULT_EXAM: ExamData = {
  height: '', weight: '', bp: '', pulse: '', anaemia: 'NAD',
  rightEyeVision: '6/6', leftEyeVision: '6/6', generalEye: 'Normal',
  ear: 'NAD', nose: 'NAD', throat: 'NAD',
  dental: 'NAD',
  skin: 'NAD',
  locomotor: 'NAD', abdomen: 'NAD', respiratory: 'NAD',
  cardiovascular: 'NAD', cns: 'NAD',
  symptoms: [],
  assessment: 'N', referralDepts: [],
  remarks: '',
};

const VISION_OPTIONS = ['6/6', '6/9', '6/12', '6/18', '6/24', '6/36', '6/60', 'Other'];
const EYE_GENERAL = ['Normal', 'Redness', 'Watering', 'Other'];
const EAR_OPTIONS = ['NAD', 'Wax', 'Pain', 'Discharge', 'Other'];
const NOSE_OPTIONS = ['NAD', 'DNS', 'Blocked', 'Other'];
const THROAT_OPTIONS = ['NAD', 'Infection', 'Hypertrophy', 'Other'];
const DENTAL_OPTIONS = ['NAD', 'Cavities', 'Missing', 'Rotten', 'Other'];
const SKIN_OPTIONS = ['NAD', 'Rash', 'Fungal', 'Eczema', 'Scabies', 'Lesion', 'Other'];
const SYSTEMIC = ['NAD', 'Needs Observation', 'Abnormal', 'Other'];
const ANAEMIA_OPTIONS = ['NAD', 'Mild', 'Severe', 'Other'];
const SYMPTOM_LIST = [
  'Headache', 'Cannot see board', 'Ear pain', 'Bad breath',
  'Nail biting', 'Breathlessness', 'Frequent urination',
  'Diarrhoea', 'Vomiting', 'Speech issues', 'Fainting', 'Other'
];
const REFERRAL_DEPTS = ['Eye', 'ENT', 'Dental', 'General Medicine', 'Dermatology'];
const REMARK_CHIPS = ['Vit D', 'Calcium', 'Albendazole', 'Eye checkup', 'Iron-Folic Acid', 'Deworming'];
const BLOOD_GROUPS = ['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const CLASSES = ['', 'Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
const SECTIONS = ['', 'A', 'B', 'C', 'D', 'E'];

// Specialist domain progress bar categories
const DOMAIN_TAGS = [
  { key: 'Community_Medicine', short: 'CM', color: 'bg-rose-500' },
  { key: 'Dental', short: 'D', color: 'bg-sky-500' },
  { key: 'ENT', short: 'ENT', color: 'bg-amber-500' },
  { key: 'Eye_Specialist', short: 'EYE', color: 'bg-emerald-500' },
  { key: 'Skin_Specialist', short: 'SKIN', color: 'bg-violet-500' },
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

// ── Helpers ──
function calcBMI(h: string, w: string): string {
  const hm = parseFloat(h) / 100;
  const wk = parseFloat(w);
  if (!hm || !wk || hm <= 0) return '--';
  return (wk / (hm * hm)).toFixed(1);
}

function bmiCategory(bmi: string): string {
  const v = parseFloat(bmi);
  if (isNaN(v)) return '';
  if (v < 14) return 'Severely Underweight';
  if (v < 18.5) return 'Underweight';
  if (v <= 25) return 'Normal';
  if (v <= 30) return 'Overweight';
  return 'Obese';
}

// ── Reusable UI ──
function FormSelect({ label, value, onChange, options, id }: {
  label: string; value: string; onChange: (v: string) => void; options: string[]; id: string;
}) {
  const [customValue, setCustomValue] = useState('');
  const isOther = value === 'Other' || (value && !options.includes(value) && value !== '');
  const showCustom = options.includes('Other') && isOther;

  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">{label}</label>
      <select id={id} value={isOther && value !== 'Other' ? 'Other' : value} onChange={e => {
        if (e.target.value === 'Other') {
          onChange('Other');
        } else {
          onChange(e.target.value);
          setCustomValue('');
        }
      }}
        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white text-sm focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all">
        {options.map(o => <option key={o} value={o}>{o || '—'}</option>)}
      </select>
      {showCustom && (
        <input type="text" placeholder="Specify..." value={value === 'Other' ? customValue : value}
          onChange={e => { setCustomValue(e.target.value); onChange(e.target.value || 'Other'); }}
          className="w-full mt-1.5 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-sm focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 placeholder-slate-600" />
      )}
    </div>
  );
}

function FormInput({ label, value, onChange, type = 'text', placeholder = '', id, required = false }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; id: string; required?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">{label}</label>
      <input id={id} type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} required={required}
        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white text-sm focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all placeholder-slate-600" />
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
        <div className="flex items-center space-x-3">
          {icon}
          <span className="font-semibold text-white text-sm">{title}</span>
        </div>
        {open ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
      </button>
      {open && <div className="px-5 pb-5 border-t border-slate-800/50 pt-4">{children}</div>}
    </div>
  );
}

// ── Add Student Modal ──
function AddStudentModal({ onClose, onCreated, userId, campId }: {
  onClose: () => void; onCreated: (s: Student) => void; userId: string; campId: number;
}) {
  const [f, setF] = useState({ name: '', age: '', dob: '', gender: '', student_class: '', section: '', blood_group: '', father_name: '', phone: '' });
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
    if (!f.name.trim()) e.name = 'Name is required';
    if (!f.student_class) e.student_class = 'Class is required';
    if (!f.dob) e.dob = 'Date of birth is required';
    if (!f.gender) e.gender = 'Sex is required';
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
        body: JSON.stringify({ ...f, age: f.age ? parseInt(f.age) : null, user_id: userId, event_id: campId }),
      });
      const data = await res.json();
      if (data.success) { onCreated(data.student); onClose(); }
    } catch (err) { alert('Error creating student'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-lg p-6 shadow-2xl relative" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        <h3 className="text-xl font-bold text-white mb-5 flex items-center"><UserPlus className="w-5 h-5 mr-2 text-cyan-400" /> Add New Student</h3>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">Student Name *</label>
              <input ref={nameRef} value={f.name} onChange={e => upd('name', e.target.value)} required
                className={`w-full bg-slate-950 border rounded-xl px-4 py-3 text-white text-lg focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 placeholder-slate-600 ${errors.name ? 'border-red-500/50' : 'border-slate-800'}`} placeholder="Full name" />
              {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name}</p>}
            </div>
            <FormInput label="Age" value={f.age} onChange={v => upd('age', v)} type="number" id="add-age" placeholder="e.g. 12" />
            <div>
              <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">Sex *</label>
              <div className="flex space-x-3 mt-1">
                {[{ v: 'M', label: 'Male' }, { v: 'F', label: 'Female' }].map(opt => (
                  <button key={opt.v} type="button" onClick={() => upd('gender', opt.v)}
                    className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all border flex items-center justify-center space-x-2 ${
                      f.gender === opt.v ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-600'
                    }`}>
                    {f.gender === opt.v && <Check className="w-3.5 h-3.5" />}
                    <span>{opt.label}</span>
                  </button>
                ))}
              </div>
              {errors.gender && <p className="text-red-400 text-xs mt-1">{errors.gender}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">Class *</label>
              <select value={f.student_class} onChange={e => upd('student_class', e.target.value)}
                className={`w-full bg-slate-950 border rounded-xl px-3 py-2.5 text-white text-sm focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all ${errors.student_class ? 'border-red-500/50' : 'border-slate-800'}`}>
                {CLASSES.map(o => <option key={o} value={o}>{o || '— Select —'}</option>)}
              </select>
              {errors.student_class && <p className="text-red-400 text-xs mt-1">{errors.student_class}</p>}
            </div>
            <FormSelect label="Section" value={f.section} onChange={v => upd('section', v)} options={SECTIONS} id="add-section" />
            <FormSelect label="Blood Group" value={f.blood_group} onChange={v => upd('blood_group', v)} options={BLOOD_GROUPS} id="add-bg" />
            <FormInput label="Father's Name" value={f.father_name} onChange={v => upd('father_name', v)} id="add-father" placeholder="Optional" />
            <FormInput label="Phone" value={f.phone} onChange={v => upd('phone', v)} id="add-phone" placeholder="Optional" type="tel" />
            <div>
              <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">Date of Birth *</label>
              <input type="date" value={f.dob} onChange={e => upd('dob', e.target.value)}
                className={`w-full bg-slate-950 border rounded-xl px-3 py-2.5 text-white text-sm focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all ${errors.dob ? 'border-red-500/50' : 'border-slate-800'}`} />
              {errors.dob && <p className="text-red-400 text-xs mt-1">{errors.dob}</p>}
            </div>
          </div>
          <button type="submit" disabled={saving}
            className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold py-3.5 rounded-xl shadow-lg transition-all disabled:opacity-50 mt-2">
            {saving ? 'Saving...' : 'Save & Continue →'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════
// ██ ACTIVE CAMPS DIRECTORY (replaces old CampSelectionScreen)
// ════════════════════════════════════════════════
function ActiveCampsDirectory({ user, onVolunteer }: {
  user: User;
  onVolunteer: (campId: number, campName: string) => void;
}) {
  const [camps, setCamps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/events/active')
      .then(r => r.json())
      .then(data => { setCamps(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const formatDate = (d: string) => {
    if (!d) return '';
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return d;
    return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${String(dt.getFullYear()).slice(-2)}`;
  };

  const handleVolunteer = async (camp: any) => {
    setJoining(camp.event_id);
    try {
      await fetch(`/api/events/${camp.event_id}/volunteer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user.username, category: user.role }),
      });
      onVolunteer(camp.event_id, camp.school_name);
    } catch {
      alert('Failed to join camp');
    } finally {
      setJoining(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-3xl mx-auto">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white tracking-tight">Active Camps 🏥</h2>
        <p className="text-slate-400 text-sm mt-1">Volunteer for a camp to start screening students.</p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading camps...</div>
      ) : camps.length === 0 ? (
        <div className="bg-slate-900/80 backdrop-blur-xl p-12 rounded-2xl border border-slate-800 text-center">
          <Calendar className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">No active camps available.</p>
          <p className="text-slate-500 text-sm mt-1">Check back when camps are scheduled.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {camps.map((camp: any) => (
            <div key={camp.event_id}
              className="w-full text-left bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-slate-800 hover:border-cyan-500/40 transition-all p-5 shadow-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                    <Calendar className="w-6 h-6 text-cyan-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold text-lg">{camp.school_name}</h3>
                    <p className="text-sm text-slate-400 mt-0.5">
                      {formatDate(camp.start_date)}{camp.end_date ? ` → ${formatDate(camp.end_date)}` : ''}
                      {camp.operational_hours ? ` · ${camp.operational_hours}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="text-right mr-2">
                    <span className="text-xs text-slate-500 block">
                      <Users className="w-3.5 h-3.5 inline mr-1" />{camp.volunteer_count ?? 0} volunteers
                    </span>
                    <span className="text-xs text-slate-500 block mt-0.5">
                      <Activity className="w-3.5 h-3.5 inline mr-1" />{camp.screened_count ?? 0}/{camp.student_count ?? 0} screened
                    </span>
                  </div>
                  <span className={`px-3 py-1 rounded-lg text-xs font-bold border ${
                    camp.tag === 'Ongoing' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                    'bg-blue-500/20 text-blue-400 border-blue-500/30'
                  }`}>{camp.tag === 'Ongoing' ? 'Live' : camp.tag}</span>
                  <button
                    onClick={() => handleVolunteer(camp)}
                    disabled={joining === camp.event_id}
                    className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center space-x-2 shadow-lg disabled:opacity-50"
                  >
                    <ArrowRight className="w-4 h-4" />
                    <span>{joining === camp.event_id ? 'Joining...' : 'Volunteer for Camp'}</span>
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
// ██ SPECIALIST DOMAIN PROGRESS BAR
// ════════════════════════════════════════════════
function DomainProgressBar({ examinedCategories }: { examinedCategories?: string }) {
  const done = new Set((examinedCategories || '').split(',').filter(Boolean));
  return (
    <div className="flex items-center space-x-1">
      {DOMAIN_TAGS.map(d => {
        const isDone = done.has(d.key) || done.has('FullExam');
        return (
          <div key={d.key} className={`flex items-center space-x-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold border ${
            isDone
              ? `${d.color}/20 border-current text-white`
              : 'bg-slate-800 border-slate-700 text-slate-500'
          }`}>
            {isDone && <CheckCircle className="w-2.5 h-2.5" />}
            <span>{d.short}</span>
          </div>
        );
      })}
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
// ██ CLINICAL WORKFLOW (scoped per specialist)
// ════════════════════════════════════════════════
function ClinicalWorkflow({ user, campId, campName, onBack }: {
  user: User; campId: number; campName: string; onBack: () => void;
}) {
  const specialistCategory = user.role;

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [filterClass, setFilterClass] = useState('');
  const [filterSection, setFilterSection] = useState('');
  const [filterExamined, setFilterExamined] = useState('');
  const [exam, setExam] = useState<ExamData>({ ...DEFAULT_EXAM });
  const [saving, setSaving] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [alerts, setAlerts] = useState<string[]>([]);
  const [todayCount, setTodayCount] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);

  // Online/offline
  useEffect(() => {
    const on = () => { setOnline(true); syncOfflineQueue(); };
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  // Smart automation
  useEffect(() => {
    const a: string[] = [];
    const bmi = calcBMI(exam.height, exam.weight);
    const bmiV = parseFloat(bmi);
    if (!isNaN(bmiV) && (bmiV < 14 || bmiV > 30)) a.push('BMI abnormal → Consider Observation');
    if (exam.rightEyeVision !== '6/6' && exam.rightEyeVision !== '6/9') a.push('Right eye vision reduced → Eye referral suggested');
    if (exam.leftEyeVision !== '6/6' && exam.leftEyeVision !== '6/9') a.push('Left eye vision reduced → Eye referral suggested');
    if (exam.dental === 'Cavities' || exam.dental === 'Rotten') a.push('Dental issue → Dental referral suggested');
    if (exam.anaemia === 'Severe') a.push('Severe anaemia → Immediate intervention needed');
    if (exam.skin !== 'NAD' && exam.skin !== '') a.push('Skin condition detected → Dermatology review');
    const abnormals = [exam.locomotor, exam.abdomen, exam.respiratory, exam.cardiovascular, exam.cns]
      .filter(v => v !== 'NAD').length;
    if (abnormals >= 2) a.push('Multiple systemic abnormalities → Referral recommended');
    setAlerts(a);
  }, [exam]);

  const updateExam = useCallback((k: keyof ExamData, v: any) => {
    setExam(p => ({ ...p, [k]: v }));
  }, []);

  // Search
  const doSearch = useCallback(async (q?: string) => {
    const query = q ?? searchQuery;
    const params = new URLSearchParams();
    if (query) params.set('query', query);
    if (filterClass) params.set('class', filterClass);
    if (filterSection) params.set('section', filterSection);
    if (filterExamined) params.set('examined', filterExamined);
    params.set('event_id', String(campId));
    const res = await fetch(`/api/students/search?${params}`);
    setSearchResults(await res.json());
  }, [searchQuery, filterClass, filterSection, filterExamined, campId]);

  useEffect(() => { doSearch(); }, [filterClass, filterSection, filterExamined]);

  const selectStudent = (s: Student) => {
    setSelectedStudent(s);
    setSearchResults([]);
    setSearchQuery('');
    setExam({ ...DEFAULT_EXAM });
    setAlerts([]);
  };

  const handleStudentCreated = (s: Student) => { selectStudent(s); };

  // Leave camp on back
  const handleBack = async () => {
    try {
      await fetch(`/api/events/${campId}/volunteer`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user.username }),
      });
    } catch {}
    onBack();
  };

  // Save exam (per specialist category)
  const saveExam = async () => {
    if (!selectedStudent) return;
    setSaving(true);
    const payload = {
      student_id: selectedStudent.student_id,
      event_id: campId,
      doctor_id: user.username,
      specialist_category: specialistCategory,
      exam_data: { ...exam, bmi: calcBMI(exam.height, exam.weight) },
    };
    try {
      if (online) {
        await fetch('/api/health-records/exam', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        });
      } else {
        await queueOffline(payload);
      }
      setTodayCount(c => c + 1);
      setSelectedStudent(null);
      setExam({ ...DEFAULT_EXAM });
      setAlerts([]);
      doSearch();
      setTimeout(() => searchRef.current?.focus(), 100);
    } catch {
      await queueOffline(payload);
    } finally {
      setSaving(false);
    }
  };

  const bmi = calcBMI(exam.height, exam.weight);
  const bmiCat = bmiCategory(bmi);

  // Which sections to show based on specialist category
  const showVitals = ['Community_Medicine', 'Other'].includes(specialistCategory);
  const showVitalsReadonly = !showVitals; // other specialists see vitals read-only
  const showEye = ['Eye_Specialist', 'Other'].includes(specialistCategory);
  const showENT = ['ENT', 'Other'].includes(specialistCategory);
  const showDental = ['Dental', 'Other'].includes(specialistCategory);
  const showSkin = ['Skin_Specialist', 'Other'].includes(specialistCategory);
  const showSystemic = ['Community_Medicine', 'Other'].includes(specialistCategory);
  const showSymptoms = ['Community_Medicine', 'Other'].includes(specialistCategory);

  return (
    <div className="space-y-4 animate-in fade-in duration-500 max-w-5xl mx-auto">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-3">
            <button onClick={handleBack} className="text-slate-400 hover:text-cyan-400 transition-colors text-sm flex items-center space-x-1">
              <ChevronRight className="w-4 h-4 rotate-180" /><span>Leave Camp</span>
            </button>
            <h2 className="text-2xl font-bold text-white tracking-tight">Clinical Screening 🩺</h2>
          </div>
          <p className="text-slate-400 text-sm mt-0.5">
            {campName}
            <span className={`ml-2 px-2 py-0.5 rounded text-xs font-bold border ${
              specialistCategory === 'Community_Medicine' ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' :
              specialistCategory === 'Dental' ? 'bg-sky-500/20 text-sky-400 border-sky-500/30' :
              specialistCategory === 'ENT' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
              specialistCategory === 'Eye_Specialist' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
              specialistCategory === 'Skin_Specialist' ? 'bg-violet-500/20 text-violet-400 border-violet-500/30' :
              'bg-slate-500/20 text-slate-400 border-slate-500/30'
            }`}>
              {specialistCategory.replace(/_/g, ' ')}
            </span>
          </p>
        </div>
        <div className="flex items-center space-x-3">
          {!online && (
            <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 px-3 py-1.5 rounded-xl text-xs font-bold">Offline</span>
          )}
          <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-sm">
            <span className="text-slate-400">Today: </span>
            <span className="text-cyan-400 font-bold">{todayCount}</span>
            <span className="text-slate-500"> examined</span>
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
              className="w-full pl-11 pr-4 py-3.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 outline-none transition-all text-base" />
          </div>
          <button onClick={() => setShowAddModal(true)}
            className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white px-5 py-3.5 rounded-xl font-bold transition-all flex items-center space-x-2 shadow-lg whitespace-nowrap">
            <Plus className="w-5 h-5" />
            <span>Add Student</span>
          </button>
        </div>
        {/* Filter chips */}
        <div className="flex items-center space-x-2 mt-3 flex-wrap gap-y-2">
          <span className="text-xs text-slate-500 font-medium">Filters:</span>
          <select value={filterClass} onChange={e => setFilterClass(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:ring-1 focus:ring-cyan-500">
            <option value="">All Classes</option>
            {CLASSES.filter(Boolean).map(c => <option key={c} value={c}>Class {c}</option>)}
          </select>
          <select value={filterSection} onChange={e => setFilterSection(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:ring-1 focus:ring-cyan-500">
            <option value="">All Sections</option>
            {SECTIONS.filter(Boolean).map(s => <option key={s} value={s}>Section {s}</option>)}
          </select>
          <select value={filterExamined} onChange={e => setFilterExamined(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:ring-1 focus:ring-cyan-500">
            <option value="">All Status</option>
            <option value="0">Not Examined</option>
            <option value="1">Examined</option>
          </select>
          {(filterClass || filterSection || filterExamined) && (
            <button onClick={() => { setFilterClass(''); setFilterSection(''); setFilterExamined(''); }}
              className="text-xs text-red-400 hover:text-red-300 underline">Clear</button>
          )}
        </div>

        {/* Results dropdown */}
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
                      {s.student_class && `Class ${s.student_class}`}{s.section && `-${s.section}`}
                      {s.age && ` • ${s.age}y`} • {s.gender}
                    </span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <DomainProgressBar examinedCategories={s.examined_categories} />
                  <span className="text-xs text-slate-500 group-hover:text-cyan-400 transition-colors">Select →</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Selected Student Header */}
      {selectedStudent && (
        <>
          <div className="sticky top-0 z-30 bg-gradient-to-r from-cyan-900/30 to-blue-900/30 backdrop-blur-xl p-4 rounded-2xl border border-cyan-500/20 flex items-center justify-between shadow-lg">
            <div className="flex items-center space-x-4">
              <div className="w-11 h-11 rounded-xl bg-cyan-500/20 flex items-center justify-center text-cyan-400 font-bold text-lg">
                {selectedStudent.name.charAt(0)}
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">{selectedStudent.name}</h3>
                <div className="flex items-center space-x-2 text-xs text-slate-400 mt-0.5">
                  {selectedStudent.age && <span className="bg-slate-800 px-2 py-0.5 rounded">{selectedStudent.age}y / {selectedStudent.gender}</span>}
                  {selectedStudent.student_class && <span className="bg-slate-800 px-2 py-0.5 rounded">Class {selectedStudent.student_class}{selectedStudent.section && `-${selectedStudent.section}`}</span>}
                  {selectedStudent.blood_group && <span className="bg-red-500/10 text-red-300 px-2 py-0.5 rounded border border-red-500/20">{selectedStudent.blood_group}</span>}
                  <DomainProgressBar examinedCategories={selectedStudent.examined_categories} />
                </div>
              </div>
            </div>
            <button onClick={() => { setSelectedStudent(null); setExam({ ...DEFAULT_EXAM }); setAlerts([]); searchRef.current?.focus(); }}
              className="bg-slate-800 hover:bg-slate-700 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors border border-slate-700 text-white flex items-center space-x-2">
              <X className="w-4 h-4" /><span>Cancel</span>
            </button>
          </div>

          {/* Smart Alerts */}
          {alerts.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-2xl space-y-1.5">
              <div className="flex items-center space-x-2 text-amber-400 font-semibold text-sm">
                <AlertTriangle className="w-4 h-4" /><span>Smart Suggestions</span>
              </div>
              {alerts.map((a, i) => <p key={i} className="text-amber-300/80 text-xs pl-6">• {a}</p>)}
            </div>
          )}

          {/* Section: Vitals (Community Med + Other editable, others read-only) */}
          {(showVitals || showVitalsReadonly) && (
            <SectionCard title="Vitals" icon={<Stethoscope className="w-4 h-4 text-emerald-400" />} defaultOpen={showVitals}>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <FormInput label="Height (cm)" value={exam.height} onChange={v => updateExam('height', v)} type="number" id="vitals-height" placeholder="e.g. 140" />
                <FormInput label="Weight (kg)" value={exam.weight} onChange={v => updateExam('weight', v)} type="number" id="vitals-weight" placeholder="e.g. 35" />
                <div>
                  <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">BMI</label>
                  <div className={`bg-slate-950 border rounded-xl px-3 py-2.5 text-sm font-bold ${bmiCat === 'Normal' ? 'border-emerald-500/30 text-emerald-400' : bmi !== '--' ? 'border-amber-500/30 text-amber-400' : 'border-slate-800 text-slate-500'}`}>
                    {bmi} {bmiCat && <span className="text-xs font-normal ml-1">({bmiCat})</span>}
                  </div>
                </div>
                <FormInput label="Blood Pressure" value={exam.bp} onChange={v => updateExam('bp', v)} id="vitals-bp" placeholder="120/80" />
                <FormInput label="Pulse Rate" value={exam.pulse} onChange={v => updateExam('pulse', v)} type="number" id="vitals-pulse" placeholder="Optional" />
                <FormSelect label="Anaemia" value={exam.anaemia} onChange={v => updateExam('anaemia', v)} options={ANAEMIA_OPTIONS} id="vitals-anaemia" />
              </div>
            </SectionCard>
          )}

          {/* Eye Section */}
          {showEye && (
            <SectionCard title="Eye Examination" icon={<Eye className="w-4 h-4 text-emerald-400" />}>
              <div className="grid grid-cols-3 gap-3">
                <FormSelect label="Right Eye" value={exam.rightEyeVision} onChange={v => updateExam('rightEyeVision', v)} options={VISION_OPTIONS} id="eye-right" />
                <FormSelect label="Left Eye" value={exam.leftEyeVision} onChange={v => updateExam('leftEyeVision', v)} options={VISION_OPTIONS} id="eye-left" />
                <FormSelect label="General" value={exam.generalEye} onChange={v => updateExam('generalEye', v)} options={EYE_GENERAL} id="eye-gen" />
              </div>
            </SectionCard>
          )}

          {/* ENT Section */}
          {showENT && (
            <SectionCard title="ENT Examination" icon={<Ear className="w-4 h-4 text-amber-400" />}>
              <div className="grid grid-cols-3 gap-3">
                <FormSelect label="Ear" value={exam.ear} onChange={v => updateExam('ear', v)} options={EAR_OPTIONS} id="ent-ear" />
                <FormSelect label="Nose" value={exam.nose} onChange={v => updateExam('nose', v)} options={NOSE_OPTIONS} id="ent-nose" />
                <FormSelect label="Throat" value={exam.throat} onChange={v => updateExam('throat', v)} options={THROAT_OPTIONS} id="ent-throat" />
              </div>
            </SectionCard>
          )}

          {/* Dental Section */}
          {showDental && (
            <SectionCard title="Dental Examination" icon={<span className="text-base">🦷</span>}>
              <div className="grid grid-cols-3 gap-3">
                <FormSelect label="Teeth & Gums" value={exam.dental} onChange={v => updateExam('dental', v)} options={DENTAL_OPTIONS} id="dental" />
              </div>
            </SectionCard>
          )}

          {/* Skin Section */}
          {showSkin && (
            <SectionCard title="Skin Examination" icon={<Scan className="w-4 h-4 text-violet-400" />}>
              <div className="grid grid-cols-3 gap-3">
                <FormSelect label="Skin Condition" value={exam.skin} onChange={v => updateExam('skin', v)} options={SKIN_OPTIONS} id="skin" />
              </div>
            </SectionCard>
          )}

          {/* Systemic Section */}
          {showSystemic && (
            <SectionCard title="Systemic Examination" icon={<HeartPulse className="w-4 h-4 text-rose-400" />}>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                <FormSelect label="Locomotor" value={exam.locomotor} onChange={v => updateExam('locomotor', v)} options={SYSTEMIC} id="sys-loc" />
                <FormSelect label="Abdomen" value={exam.abdomen} onChange={v => updateExam('abdomen', v)} options={SYSTEMIC} id="sys-abd" />
                <FormSelect label="Respiratory" value={exam.respiratory} onChange={v => updateExam('respiratory', v)} options={SYSTEMIC} id="sys-resp" />
                <FormSelect label="Cardiovascular" value={exam.cardiovascular} onChange={v => updateExam('cardiovascular', v)} options={SYSTEMIC} id="sys-cvs" />
                <FormSelect label="CNS" value={exam.cns} onChange={v => updateExam('cns', v)} options={SYSTEMIC} id="sys-cns" />
              </div>
            </SectionCard>
          )}

          {/* Symptoms */}
          {showSymptoms && (
            <SectionCard title="Symptoms Checklist" icon={<AlertTriangle className="w-4 h-4 text-amber-400" />}>
              <div className="flex flex-wrap gap-2">
                {SYMPTOM_LIST.map(s => {
                  const active = exam.symptoms.includes(s);
                  return (
                    <button key={s} type="button" onClick={() => {
                      updateExam('symptoms', active ? exam.symptoms.filter(x => x !== s) : [...exam.symptoms, s]);
                    }}
                      className={`px-3 py-2 rounded-xl text-sm font-medium transition-all border ${
                        active ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-[0_0_8px_rgba(245,158,11,0.15)]' : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-600'
                      }`}>
                      {active && <Check className="w-3 h-3 inline mr-1" />}{s}
                    </button>
                  );
                })}
              </div>
            </SectionCard>
          )}

          {/* Final Assessment (all specialists) */}
          <SectionCard title="Final Assessment" icon={<Stethoscope className="w-4 h-4 text-indigo-400" />}>
            <div className="flex space-x-3 mb-4">
              {[{ v: 'N', label: 'Normal', color: 'emerald' }, { v: 'O', label: 'Observation', color: 'amber' }, { v: 'R', label: 'Referred', color: 'red' }].map(opt => (
                <button key={opt.v} type="button" onClick={() => updateExam('assessment', opt.v)}
                  className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all border ${
                    exam.assessment === opt.v
                      ? opt.color === 'emerald' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                      : opt.color === 'amber' ? 'bg-amber-500/20 text-amber-400 border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
                      : 'bg-red-500/20 text-red-400 border-red-500/40 shadow-[0_0_12px_rgba(239,68,68,0.2)]'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-600'
                  }`}>
                  {opt.v} — {opt.label}
                </button>
              ))}
            </div>
            {exam.assessment === 'R' && (
              <div>
                <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Referral Department(s)</label>
                <div className="flex flex-wrap gap-2">
                  {REFERRAL_DEPTS.map(d => {
                    const active = exam.referralDepts.includes(d);
                    return (
                      <button key={d} type="button" onClick={() => {
                        updateExam('referralDepts', active ? exam.referralDepts.filter(x => x !== d) : [...exam.referralDepts, d]);
                      }}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
                          active ? 'bg-red-500/20 text-red-300 border-red-500/40' : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-600'
                        }`}>
                        {active && <Check className="w-3 h-3 inline mr-1" />}{d}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </SectionCard>

          {/* Doctor Remarks (all specialists) */}
          <SectionCard title="Specialist Remarks" icon={<Stethoscope className="w-4 h-4 text-purple-400" />}>
            <div className="flex flex-wrap gap-2 mb-3">
              {REMARK_CHIPS.map(chip => (
                <button key={chip} type="button" onClick={() => {
                  const cur = exam.remarks;
                  if (!cur.includes(chip)) updateExam('remarks', cur ? `${cur}, ${chip}` : chip);
                }}
                  className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 hover:border-cyan-500/40 hover:text-cyan-300 transition-all">
                  + {chip}
                </button>
              ))}
            </div>
            <textarea value={exam.remarks} onChange={e => updateExam('remarks', e.target.value)} rows={2} placeholder="Additional remarks..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white text-sm focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 resize-none" />
          </SectionCard>

          {/* Save Button */}
          <button onClick={saveExam} disabled={saving}
            className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold py-4 rounded-2xl shadow-[0_0_25px_rgba(16,185,129,0.3)] transition-all disabled:opacity-50 text-lg flex items-center justify-center space-x-3">
            <Save className="w-5 h-5" />
            <span>{saving ? 'Saving...' : 'Save'}</span>
          </button>
        </>
      )}

      {/* Add Student Modal */}
      {showAddModal && <AddStudentModal onClose={() => setShowAddModal(false)} onCreated={handleStudentCreated} userId={user.username} campId={campId} />}
    </div>
  );
}
