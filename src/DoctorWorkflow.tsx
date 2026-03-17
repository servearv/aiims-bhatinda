import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search, Plus, ChevronDown, ChevronRight, X, Save,
  ArrowRight, AlertTriangle, Eye, Ear, Stethoscope,
  Activity, Wifi, WifiOff, Check, UserPlus
} from 'lucide-react';

// ── Types ──
type User = { username: string; role: string; name: string };

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
  locomotor: 'NAD', abdomen: 'NAD', respiratory: 'NAD',
  cardiovascular: 'NAD', cns: 'NAD',
  symptoms: [],
  assessment: 'N', referralDepts: [],
  remarks: '',
};

const VISION_OPTIONS = ['6/6', '6/9', '6/12', '6/18', '6/24', '6/36', '6/60'];
const EYE_GENERAL = ['Normal', 'Redness', 'Watering'];
const EAR_OPTIONS = ['NAD', 'Wax', 'Pain', 'Discharge'];
const NOSE_OPTIONS = ['NAD', 'DNS', 'Blocked'];
const THROAT_OPTIONS = ['NAD', 'Infection', 'Hypertrophy'];
const DENTAL_OPTIONS = ['NAD', 'Cavities', 'Missing', 'Rotten'];
const SYSTEMIC = ['NAD', 'Needs Observation', 'Abnormal'];
const ANAEMIA_OPTIONS = ['NAD', 'Mild', 'Severe'];
const SYMPTOM_LIST = [
  'Headache', 'Cannot see board', 'Ear pain', 'Bad breath',
  'Nail biting', 'Breathlessness', 'Frequent urination',
  'Diarrhoea', 'Vomiting', 'Speech issues', 'Fainting', 'Other'
];
const REFERRAL_DEPTS = ['Eye', 'ENT', 'Dental', 'General Medicine'];
const REMARK_CHIPS = ['Vit D', 'Calcium', 'Albendazole', 'Eye checkup', 'Iron-Folic Acid', 'Deworming'];
const BLOOD_GROUPS = ['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const CLASSES = ['', 'Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
const SECTIONS = ['', 'A', 'B', 'C', 'D', 'E'];

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
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">{label}</label>
      <select id={id} value={value} onChange={e => onChange(e.target.value)}
        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white text-sm focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all">
        {options.map(o => <option key={o} value={o}>{o || '—'}</option>)}
      </select>
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
function AddStudentModal({ onClose, onCreated, userId }: {
  onClose: () => void; onCreated: (s: Student) => void; userId: string;
}) {
  const [f, setF] = useState({ name: '', age: '', dob: '', gender: 'M', student_class: '', section: '', blood_group: '', father_name: '', phone: '' });
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => { nameRef.current?.focus(); }, []);

  const upd = (k: string, v: string) => setF(p => ({ ...p, [k]: v }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/students', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...f, age: f.age ? parseInt(f.age) : null, user_id: userId }),
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
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-lg focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 placeholder-slate-600" placeholder="Full name" />
            </div>
            <FormInput label="Age" value={f.age} onChange={v => upd('age', v)} type="number" id="add-age" placeholder="e.g. 12" />
            <FormSelect label="Sex *" value={f.gender} onChange={v => upd('gender', v)} options={['M', 'F']} id="add-gender" />
            <FormSelect label="Class *" value={f.student_class} onChange={v => upd('student_class', v)} options={CLASSES} id="add-class" />
            <FormSelect label="Section" value={f.section} onChange={v => upd('section', v)} options={SECTIONS} id="add-section" />
            <FormSelect label="Blood Group" value={f.blood_group} onChange={v => upd('blood_group', v)} options={BLOOD_GROUPS} id="add-bg" />
            <FormInput label="Father's Name" value={f.father_name} onChange={v => upd('father_name', v)} id="add-father" placeholder="Optional" />
            <FormInput label="Phone" value={f.phone} onChange={v => upd('phone', v)} id="add-phone" placeholder="Optional" type="tel" />
            <FormInput label="Date of Birth" value={f.dob} onChange={v => upd('dob', v)} id="add-dob" type="date" />
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
// ██ MAIN DOCTOR WORKFLOW
// ════════════════════════════════════════════════
export default function DoctorWorkflow({ user }: { user: User }) {
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
    const res = await fetch(`/api/students/search?${params}`);
    setSearchResults(await res.json());
  }, [searchQuery, filterClass, filterSection, filterExamined]);

  useEffect(() => { doSearch(); }, [filterClass, filterSection, filterExamined]);

  const selectStudent = (s: Student) => {
    setSelectedStudent(s);
    setSearchResults([]);
    setSearchQuery('');
    setExam({ ...DEFAULT_EXAM });
    setAlerts([]);
  };

  const handleStudentCreated = (s: Student) => {
    selectStudent(s);
  };

  // Save exam
  const saveExam = async () => {
    if (!selectedStudent) return;
    setSaving(true);
    const payload = {
      student_id: selectedStudent.student_id,
      camp_id: 1,
      doctor_id: user.username,
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
      setTimeout(() => searchRef.current?.focus(), 100);
    } catch {
      await queueOffline(payload);
    } finally {
      setSaving(false);
    }
  };

  const bmi = calcBMI(exam.height, exam.weight);
  const bmiCat = bmiCategory(bmi);

  // ── RENDER ──
  return (
    <div className="space-y-4 animate-in fade-in duration-500 max-w-5xl mx-auto">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Clinical Screening 🩺</h2>
          <p className="text-slate-400 text-sm mt-0.5">Fast medical examination workflow</p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-sm">
            <span className="text-slate-400">Today: </span>
            <span className="text-cyan-400 font-bold">{todayCount}</span>
            <span className="text-slate-500"> examined</span>
          </div>
          <div className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-medium ${online ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
            {online ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            <span>{online ? 'Online' : 'Offline'}</span>
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
                <span className="text-xs text-slate-500 group-hover:text-cyan-400 transition-colors">Select →</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Selected Student Header (sticky) */}
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
                </div>
              </div>
            </div>
            <button onClick={() => { setSelectedStudent(null); setExam({ ...DEFAULT_EXAM }); setAlerts([]); searchRef.current?.focus(); }}
              className="bg-slate-800 hover:bg-slate-700 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors border border-slate-700 text-white flex items-center space-x-2">
              <ArrowRight className="w-4 h-4" /><span>Next Student</span>
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

          {/* Section 1: Basic Info */}
          <SectionCard title="Basic Information" icon={<Activity className="w-4 h-4 text-cyan-400" />} defaultOpen={false}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div><span className="text-slate-500 text-xs">Name</span><p className="text-white font-medium">{selectedStudent.name}</p></div>
              <div><span className="text-slate-500 text-xs">Age / Sex</span><p className="text-white font-medium">{selectedStudent.age || '-'} / {selectedStudent.gender}</p></div>
              <div><span className="text-slate-500 text-xs">Class</span><p className="text-white font-medium">{selectedStudent.student_class || '-'}{selectedStudent.section && ` - ${selectedStudent.section}`}</p></div>
              <div><span className="text-slate-500 text-xs">Blood Group</span><p className="text-white font-medium">{selectedStudent.blood_group || '-'}</p></div>
              {selectedStudent.father_name && <div><span className="text-slate-500 text-xs">Father</span><p className="text-white font-medium">{selectedStudent.father_name}</p></div>}
              {selectedStudent.phone && <div><span className="text-slate-500 text-xs">Phone</span><p className="text-white font-medium">{selectedStudent.phone}</p></div>}
            </div>
          </SectionCard>

          {/* Section 2: Vitals */}
          <SectionCard title="Vitals" icon={<Stethoscope className="w-4 h-4 text-emerald-400" />}>
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

          {/* Section 3: Clinical Examination */}
          <SectionCard title="Clinical Examination" icon={<Eye className="w-4 h-4 text-blue-400" />}>
            {/* Eye */}
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 mt-1">👁️ Eye</h4>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <FormSelect label="Right Eye" value={exam.rightEyeVision} onChange={v => updateExam('rightEyeVision', v)} options={VISION_OPTIONS} id="eye-right" />
              <FormSelect label="Left Eye" value={exam.leftEyeVision} onChange={v => updateExam('leftEyeVision', v)} options={VISION_OPTIONS} id="eye-left" />
              <FormSelect label="General" value={exam.generalEye} onChange={v => updateExam('generalEye', v)} options={EYE_GENERAL} id="eye-gen" />
            </div>
            {/* ENT */}
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">👂 ENT</h4>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <FormSelect label="Ear" value={exam.ear} onChange={v => updateExam('ear', v)} options={EAR_OPTIONS} id="ent-ear" />
              <FormSelect label="Nose" value={exam.nose} onChange={v => updateExam('nose', v)} options={NOSE_OPTIONS} id="ent-nose" />
              <FormSelect label="Throat" value={exam.throat} onChange={v => updateExam('throat', v)} options={THROAT_OPTIONS} id="ent-throat" />
            </div>
            {/* Dental */}
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">🦷 Dental</h4>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <FormSelect label="Teeth & Gums" value={exam.dental} onChange={v => updateExam('dental', v)} options={DENTAL_OPTIONS} id="dental" />
            </div>
            {/* Systemic */}
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">🫀 Systemic Examination</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              <FormSelect label="Locomotor" value={exam.locomotor} onChange={v => updateExam('locomotor', v)} options={SYSTEMIC} id="sys-loc" />
              <FormSelect label="Abdomen" value={exam.abdomen} onChange={v => updateExam('abdomen', v)} options={SYSTEMIC} id="sys-abd" />
              <FormSelect label="Respiratory" value={exam.respiratory} onChange={v => updateExam('respiratory', v)} options={SYSTEMIC} id="sys-resp" />
              <FormSelect label="Cardiovascular" value={exam.cardiovascular} onChange={v => updateExam('cardiovascular', v)} options={SYSTEMIC} id="sys-cvs" />
              <FormSelect label="CNS" value={exam.cns} onChange={v => updateExam('cns', v)} options={SYSTEMIC} id="sys-cns" />
            </div>
          </SectionCard>

          {/* Section 4: Symptoms */}
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

          {/* Section 5: Final Assessment */}
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

          {/* Doctor Remarks */}
          <SectionCard title="Doctor Remarks" icon={<Stethoscope className="w-4 h-4 text-purple-400" />}>
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

          {/* Save & Next */}
          <button onClick={saveExam} disabled={saving}
            className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold py-4 rounded-2xl shadow-[0_0_25px_rgba(16,185,129,0.3)] transition-all disabled:opacity-50 text-lg flex items-center justify-center space-x-3">
            <Save className="w-5 h-5" />
            <span>{saving ? 'Saving...' : 'Save & Next Student'}</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </>
      )}

      {/* Add Student Modal */}
      {showAddModal && <AddStudentModal onClose={() => setShowAddModal(false)} onCreated={handleStudentCreated} userId={user.username} />}
    </div>
  );
}
