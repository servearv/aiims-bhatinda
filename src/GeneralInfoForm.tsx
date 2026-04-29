import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Save, Check, ChevronDown, ChevronRight, X, AlertTriangle,
  User, Heart, Stethoscope, ClipboardList, Loader2
} from 'lucide-react';

// ── Types ──
type UserType = { username: string; role: string; name: string };

interface StudentData {
  student_id: number;
  name: string;
  age: number;
  dob: string;
  gender: string;
  student_class: string;
  section: string;
  blood_group: string;
  father_name: string;
  father_occupation: string;
  mother_name: string;
  mother_occupation: string;
  phone: string;
  address: string;
  pincode: string;
  registration_number?: string;
}

interface GeneralInfoData {
  height: string;
  weight: string;
  bmi: string;
  symptoms: string[];
}

// ── Constants ──
const BLOOD_GROUPS = ['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const CLASSES = ['', 'Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
const SECTIONS = ['', 'A', 'B', 'C', 'D', 'E'];
const GENDERS = [
  { value: 'M', label: 'Male' },
  { value: 'F', label: 'Female' },
  { value: 'O', label: 'Other' },
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

// ── Helpers ──
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

function calcBMI(h: string, w: string): string {
  const hm = parseFloat(h) / 100;
  const wk = parseFloat(w);
  if (!hm || !wk || hm <= 0) return '';
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

// ── Reusable Components ──
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

function FormField({ label, children, required }: {
  label: string; children: React.ReactNode; required?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls = "w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white text-sm focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all placeholder-slate-600";
const selectCls = inputCls;

// ══════════════════════════════════════
// ██ GENERAL INFO FORM (Main Export)
// ══════════════════════════════════════
export default function GeneralInfoForm({ student, eventId, user, onClose, readOnly = false }: {
  student: StudentData;
  eventId: number;
  user: UserType;
  onClose: () => void;
  readOnly?: boolean;
}) {
  // Demographics state
  const [demo, setDemo] = useState({
    name: student.name || '',
    dob: student.dob || '',
    age: student.age ? String(student.age) : '',
    gender: student.gender || '',
    student_class: student.student_class || '',
    section: student.section || '',
    blood_group: student.blood_group || '',
    father_name: student.father_name || '',
    father_occupation: student.father_occupation || '',
    mother_name: student.mother_name || '',
    mother_occupation: student.mother_occupation || '',
    phone: student.phone || '',
    address: student.address || '',
    pincode: student.pincode || '',
    registration_number: student.registration_number || '',
  });

  // Vitals + symptoms state
  const [vitals, setVitals] = useState<GeneralInfoData>({
    height: '', weight: '', bmi: '', symptoms: [],
  });

  // Autosave state
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const demoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const vitalsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Load existing general info
  useEffect(() => {
    fetch(`/api/students/${student.student_id}/general-info?event_id=${eventId}`)
      .then(r => r.json())
      .then(data => {
        setVitals({
          height: data.height || '',
          weight: data.weight || '',
          bmi: data.bmi || '',
          symptoms: data.symptoms || [],
        });
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [student.student_id, eventId]);

  // Autosave demographics
  const saveDemographics = useCallback(async (data: typeof demo) => {
    if (readOnly) return;
    setSaveStatus('saving');
    try {
      const res = await fetch(`/api/students/${student.student_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, user_id: user.username }),
      });
      const result = await res.json();
      setSaveStatus(result.success ? 'saved' : 'error');
      if (result.success) setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('error');
    }
  }, [student.student_id, user.username, readOnly]);

  // Autosave vitals + symptoms
  const saveVitals = useCallback(async (data: GeneralInfoData) => {
    if (readOnly) return;
    setSaveStatus('saving');
    try {
      const res = await fetch(`/api/students/${student.student_id}/general-info`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: eventId,
          ...data,
          filled_by: user.username,
        }),
      });
      const result = await res.json();
      setSaveStatus(result.success ? 'saved' : 'error');
      if (result.success) setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('error');
    }
  }, [student.student_id, eventId, user.username, readOnly]);

  // Debounced updaters
  const updateDemo = (key: string, value: string) => {
    const next = { ...demo, [key]: value };
    // Auto-calc age from DOB
    if (key === 'dob' && value) {
      const age = calcAge(value);
      if (age !== null) next.age = String(age);
    }
    setDemo(next);
    if (readOnly) return;
    if (demoTimerRef.current) clearTimeout(demoTimerRef.current);
    demoTimerRef.current = setTimeout(() => saveDemographics(next), 1500);
  };

  const updateVitals = (key: string, value: any) => {
    const next = { ...vitals, [key]: value };
    // Auto-calc BMI
    if (key === 'height' || key === 'weight') {
      const h = key === 'height' ? value : next.height;
      const w = key === 'weight' ? value : next.weight;
      next.bmi = calcBMI(h, w);
    }
    setVitals(next);
    if (readOnly) return;
    if (vitalsTimerRef.current) clearTimeout(vitalsTimerRef.current);
    vitalsTimerRef.current = setTimeout(() => saveVitals(next), 1500);
  };

  const toggleSymptom = (symptom: string) => {
    const current = vitals.symptoms;
    const next = current.includes(symptom)
      ? current.filter(s => s !== symptom)
      : [...current, symptom];
    updateVitals('symptoms', next);
  };

  const bmi = vitals.bmi || calcBMI(vitals.height, vitals.weight);
  const bmiCat = bmiCategory(bmi);

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
        <span className="ml-2 text-slate-400">Loading...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      {/* Header with autosave indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center text-violet-400 font-bold text-lg">
            {student.name.charAt(0)}
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">{student.name}</h3>
            <p className="text-xs text-slate-400">
              General Information {readOnly && <span className="text-amber-400 font-bold ml-1">(Read Only)</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          {/* Autosave Status */}
          {!readOnly && (
            <div className="flex items-center space-x-1.5">
              {saveStatus === 'saving' && (
                <span className="text-xs text-amber-400 flex items-center space-x-1">
                  <Loader2 className="w-3 h-3 animate-spin" /><span>Saving...</span>
                </span>
              )}
              {saveStatus === 'saved' && (
                <span className="text-xs text-emerald-400 flex items-center space-x-1">
                  <Check className="w-3 h-3" /><span>Saved</span>
                </span>
              )}
              {saveStatus === 'error' && (
                <span className="text-xs text-red-400 flex items-center space-x-1">
                  <AlertTriangle className="w-3 h-3" /><span>Error</span>
                </span>
              )}
            </div>
          )}
          <button onClick={onClose}
            className="bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-xl text-sm font-medium transition-colors border border-slate-700 text-white flex items-center space-x-2">
            <X className="w-4 h-4" /><span>Close</span>
          </button>
        </div>
      </div>

      {/* Section 1: Student Demographics */}
      <SectionCard title="Student Demographics" icon={<User className="w-4 h-4 text-violet-400" />}>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className="col-span-2 md:col-span-1">
            <FormField label="Student Name" required>
              <input value={demo.name} onChange={e => updateDemo('name', e.target.value)}
                readOnly={readOnly} className={inputCls} placeholder="Full name" />
            </FormField>
          </div>
          <FormField label="Date of Birth" required>
            <input type="date" value={demo.dob} onChange={e => updateDemo('dob', e.target.value)}
              readOnly={readOnly} className={inputCls} />
          </FormField>
          <FormField label="Age (Auto)">
            <input value={demo.age} readOnly className={`${inputCls} bg-slate-900 cursor-not-allowed`}
              placeholder="Auto-calculated" />
          </FormField>
          <FormField label="Gender" required>
            <div className="flex space-x-2">
              {GENDERS.map(g => (
                <button key={g.value} type="button"
                  onClick={() => !readOnly && updateDemo('gender', g.value)}
                  disabled={readOnly}
                  className={`flex-1 py-2.5 rounded-xl font-bold text-xs transition-all border flex items-center justify-center space-x-1 ${
                    demo.gender === g.value
                      ? 'bg-violet-500/20 text-violet-400 border-violet-500/30'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-600'
                  } ${readOnly ? 'cursor-not-allowed opacity-70' : ''}`}>
                  {demo.gender === g.value && <Check className="w-3 h-3" />}
                  <span>{g.label}</span>
                </button>
              ))}
            </div>
          </FormField>
          <FormField label="Class">
            <select value={demo.student_class} onChange={e => updateDemo('student_class', e.target.value)}
              disabled={readOnly} className={selectCls}>
              {CLASSES.map(o => <option key={o} value={o}>{o || '— Select —'}</option>)}
            </select>
          </FormField>
          <FormField label="Section">
            <select value={demo.section} onChange={e => updateDemo('section', e.target.value)}
              disabled={readOnly} className={selectCls}>
              {SECTIONS.map(o => <option key={o} value={o}>{o || '— Select —'}</option>)}
            </select>
          </FormField>
          <FormField label="Blood Group">
            <select value={demo.blood_group} onChange={e => updateDemo('blood_group', e.target.value)}
              disabled={readOnly} className={selectCls}>
              {BLOOD_GROUPS.map(o => <option key={o} value={o}>{o || '— Select —'}</option>)}
            </select>
          </FormField>
          <FormField label="Registration Number">
            <input value={demo.registration_number} onChange={e => updateDemo('registration_number', e.target.value)}
              readOnly={readOnly} className={inputCls} placeholder="School Reg. No" />
          </FormField>
        </div>
      </SectionCard>

      {/* Section 2: Contact & Family */}
      <SectionCard title="Contact & Family Details" icon={<Heart className="w-4 h-4 text-pink-400" />}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label="Father's Name">
            <input value={demo.father_name} onChange={e => updateDemo('father_name', e.target.value)}
              readOnly={readOnly} className={inputCls} placeholder="Father's name" />
          </FormField>
          <FormField label="Father's Occupation">
            <input value={demo.father_occupation} onChange={e => updateDemo('father_occupation', e.target.value)}
              readOnly={readOnly} className={inputCls} placeholder="Occupation" />
          </FormField>
          <FormField label="Mother's Name">
            <input value={demo.mother_name} onChange={e => updateDemo('mother_name', e.target.value)}
              readOnly={readOnly} className={inputCls} placeholder="Mother's name" />
          </FormField>
          <FormField label="Mother's Occupation">
            <input value={demo.mother_occupation} onChange={e => updateDemo('mother_occupation', e.target.value)}
              readOnly={readOnly} className={inputCls} placeholder="Occupation" />
          </FormField>
          <FormField label="Address">
            <input value={demo.address} onChange={e => updateDemo('address', e.target.value)}
              readOnly={readOnly} className={inputCls} placeholder="Full address" />
          </FormField>
          <FormField label="Pin Code">
            <input value={demo.pincode} onChange={e => updateDemo('pincode', e.target.value)}
              readOnly={readOnly} className={inputCls} placeholder="e.g. 151001" />
          </FormField>
          <FormField label="Mobile Number">
            <input value={demo.phone} onChange={e => updateDemo('phone', e.target.value)}
              readOnly={readOnly} type="tel" className={inputCls} placeholder="e.g. 9876543210" />
          </FormField>
        </div>
      </SectionCard>

      {/* Section 3: Vitals & Measurements */}
      <SectionCard title="Vitals & Measurements" icon={<Stethoscope className="w-4 h-4 text-emerald-400" />}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <FormField label="Height (cm)">
            <input value={vitals.height} onChange={e => updateVitals('height', e.target.value)}
              readOnly={readOnly} type="number" className={inputCls} placeholder="e.g. 140" />
          </FormField>
          <FormField label="Weight (kg)">
            <input value={vitals.weight} onChange={e => updateVitals('weight', e.target.value)}
              readOnly={readOnly} type="number" className={inputCls} placeholder="e.g. 35" />
          </FormField>
          <FormField label="BMI (Auto)">
            <div className={`bg-slate-950 border rounded-xl px-3 py-2.5 text-sm font-bold ${
              bmiCat === 'Normal' ? 'border-emerald-500/30 text-emerald-400' :
              bmi ? 'border-amber-500/30 text-amber-400' :
              'border-slate-800 text-slate-500'
            }`}>
              {bmi || '--'}
              {bmiCat && <span className="text-xs font-normal ml-1">({bmiCat})</span>}
            </div>
          </FormField>
        </div>
      </SectionCard>

      {/* Section 4: Symptoms Checklist */}
      <SectionCard title="Symptoms Checklist" icon={<ClipboardList className="w-4 h-4 text-amber-400" />}>
        <p className="text-xs text-slate-500 mb-3">Check all symptoms observed in the child:</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {SYMPTOM_CHECKLIST.map(symptom => {
            const active = vitals.symptoms.includes(symptom);
            return (
              <button key={symptom} type="button"
                onClick={() => !readOnly && toggleSymptom(symptom)}
                disabled={readOnly}
                className={`flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm text-left transition-all border ${
                  active
                    ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-600'
                } ${readOnly ? 'cursor-not-allowed' : ''}`}>
                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                  active ? 'bg-amber-500 border-amber-500' : 'border-slate-600'
                }`}>
                  {active && <Check className="w-3 h-3 text-white" />}
                </div>
                <span className="text-xs leading-snug">{symptom}</span>
              </button>
            );
          })}
        </div>
        {vitals.symptoms.length > 0 && (
          <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
            <p className="text-xs text-amber-400 font-bold mb-1">
              <AlertTriangle className="w-3 h-3 inline mr-1" />
              {vitals.symptoms.length} symptom{vitals.symptoms.length > 1 ? 's' : ''} flagged
            </p>
            <p className="text-xs text-amber-300/70">
              These will be shown as alerts to examining doctors.
            </p>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

// ══════════════════════════════════════
// ██ READ-ONLY GENERAL INFO SUMMARY
// ══════════════════════════════════════
export function GeneralInfoSummary({ studentId, eventId, className = '' }: {
  studentId: number; eventId: number; className?: string;
}) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/students/${studentId}/all-records?event_id=${eventId}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [studentId, eventId]);

  if (loading) return <div className="py-2 text-sm text-[#9CA3AF]">Loading info…</div>;
  if (!data?.student) return null;

  const s = data.student;
  const gi = data.general_info || {};
  const symptoms: string[] = gi.symptoms || [];
  const bmi = gi.bmi || '';
  const bmiCat = bmiCategory(bmi);

  return (
    <div className={`space-y-4 border-b border-[#E5E7EB] pb-6 ${className}`}>
      <h4 className="flex items-center text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
        <User className="mr-1.5 h-3.5 w-3.5" /> General info & vitals <span className="ml-1.5 font-normal normal-case text-[#9CA3AF]">(read-only)</span>
      </h4>

      {/* Combined Demographics & Vitals */}
      <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 md:grid-cols-7">
        <InfoChip label="Reg No" value={s.registration_number || '—'} />
        <InfoChip label="Blood" value={s.blood_group || '—'} />
        <InfoChip label="Father" value={s.father_name || '—'} />
        <InfoChip label="Phone" value={s.phone || '—'} />
        
        {(gi.height || gi.weight) && (
          <>
            <InfoChip label="Height" value={gi.height ? `${gi.height} cm` : '—'} />
            <InfoChip label="Weight" value={gi.weight ? `${gi.weight} kg` : '—'} />
            <InfoChip label="BMI" value={bmi ? `${bmi} (${bmiCat})` : '—'} highlight={bmiCat && bmiCat !== 'Normal'} />
          </>
        )}
      </div>

      {/* Symptoms alerts */}
      {symptoms.length > 0 && (
        <div className="rounded-lg border border-[#FDE68A] bg-[#FFFBEB] p-3">
          <p className="mb-1.5 text-xs font-semibold text-[#92400E]">
            <AlertTriangle className="w-3 h-3 inline mr-1" />
            Teacher Alerts ({symptoms.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {symptoms.map(s => (
              <span key={s} className="rounded border border-[#FDE68A] bg-white px-2 py-0.5 text-[11px] font-medium text-[#92400E]">
                {s}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function InfoChip({ label, value, highlight }: {
  label: string; value: string; highlight?: boolean;
}) {
  return (
    <div className={`flex flex-col min-w-0 overflow-hidden rounded-lg border px-2.5 py-2 ${
      highlight ? 'border-[#FDE68A] bg-[#FFFBEB]' : 'border-[#E5E7EB] bg-[#F9FAFB]'
    }`}>
      <p className="text-[10px] font-medium uppercase tracking-wide text-[#9CA3AF] truncate" title={label}>{label}</p>
      <p className={`mt-0.5 text-sm font-semibold truncate ${highlight ? 'text-[#B45309]' : 'text-[#1F2937]'}`} title={value}>{value}</p>
    </div>
  );
}
