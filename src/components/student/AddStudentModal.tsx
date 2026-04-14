import React, { useEffect, useRef, useState } from 'react';
import { UserPlus, Check, ChevronDown, ChevronRight, ClipboardList } from 'lucide-react';
import ModalFrame from '../ui/ModalFrame';
import { SYMPTOM_CHECKLIST } from '../../constants/symptoms';

const BLOOD_GROUPS = ['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const CLASSES = ['', 'Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
const SECTIONS = ['', 'A', 'B', 'C', 'D', 'E'];

export type AddStudentModalStudent = {
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
};

type Props = {
  onClose: () => void;
  /** Doctor passes created student to open exam; school only refreshes list */
  onCreated: (student?: AddStudentModalStudent) => void;
  userId: string;
  eventId: number;
  variant: 'school' | 'doctor';
};

function calcAge(dob: string): string {
  if (!dob) return '';
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return '';
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age >= 0 ? String(age) : '';
}

export default function AddStudentModal({ onClose, onCreated, userId, eventId, variant }: Props) {
  const [f, setF] = useState({
    name: '',
    age: '',
    dob: '',
    gender: '',
    student_class: '',
    section: '',
    blood_group: '',
    father_name: '',
    phone: '',
  });
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [showSymptoms, setShowSymptoms] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const upd = (k: string, v: string) => {
    setF(p => {
      const next = { ...p, [k]: v };
      if (k === 'dob' && v) {
        const a = calcAge(v);
        if (a) next.age = a;
      }
      return next;
    });
    setErrors(e => ({ ...e, [k]: '' }));
  };

  const toggleSymptom = (s: string) => {
    setSymptoms(prev => (prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]));
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!f.name.trim()) e.name = 'Name is required';
    if (!f.gender) e.gender = 'Sex is required';
    if (variant === 'doctor') {
      if (!f.student_class) e.student_class = 'Class is required';
      if (!f.dob) e.dob = 'Date of birth is required';
    }
    if (f.phone?.trim() && !/^\d{10}$/.test(f.phone.replace(/\D/g, ''))) e.phone = 'Valid 10-digit phone is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...f,
          age: f.age ? parseInt(f.age, 10) : null,
          user_id: userId,
          event_id: eventId,
          added_by: userId,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        alert(data.message || 'Could not create student');
        return;
      }
      const st = data.student as AddStudentModalStudent;
      if (variant === 'doctor' && symptoms.length > 0) {
        await fetch(`/api/students/${st.student_id}/general-info`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event_id: eventId, symptoms, filled_by: userId }),
        });
      }
      if (variant === 'doctor') {
        onCreated(st);
        onClose();
      } else {
        onCreated(undefined);
      }
    } catch {
      alert('Error creating student');
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    'w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white placeholder-slate-600 transition-colors focus:border-cyan-500/60 focus:outline-none focus:ring-1 focus:ring-cyan-500/40';
  const labelClass = 'mb-1 block text-[10px] font-medium uppercase tracking-wider text-slate-500';

  return (
    <ModalFrame
      onClose={onClose}
      size={variant === 'doctor' ? 'lg' : 'md'}
      title={variant === 'doctor' ? 'Register New Student' : 'Add New Student'}
      icon={<UserPlus className={`h-5 w-5 ${variant === 'doctor' ? 'text-cyan-400' : 'text-violet-400'}`} />}
    >
      <form onSubmit={handleSave} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className={labelClass}>Student Name *</label>
            <input
              ref={nameRef}
              value={f.name}
              onChange={e => upd('name', e.target.value)}
              required
              className={`${inputClass} ${errors.name ? 'border-red-500/50' : ''}`}
              placeholder="Full name"
            />
            {errors.name && <p className="mt-1 text-xs text-red-400">{errors.name}</p>}
          </div>

          <div>
            <label className={labelClass}>Sex *</label>
            <div className="mt-1 flex gap-2">
              {[
                { v: 'M', label: 'Male' },
                { v: 'F', label: 'Female' },
              ].map(opt => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => upd('gender', opt.v)}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-semibold transition-all ${
                    f.gender === opt.v
                      ? variant === 'doctor'
                        ? 'border-cyan-500/40 bg-cyan-500/15 text-cyan-300'
                        : 'border-violet-500/40 bg-violet-500/15 text-violet-300'
                      : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  {f.gender === opt.v && <Check className="h-3.5 w-3.5" />}
                  {opt.label}
                </button>
              ))}
            </div>
            {errors.gender && <p className="mt-1 text-xs text-red-400">{errors.gender}</p>}
          </div>

          <div>
            <label className={labelClass}>Date of Birth {variant === 'doctor' ? '*' : ''}</label>
            <input
              type="date"
              value={f.dob}
              onChange={e => upd('dob', e.target.value)}
              className={`${inputClass} ${errors.dob ? 'border-red-500/50' : ''}`}
            />
            {errors.dob && <p className="mt-1 text-xs text-red-400">{errors.dob}</p>}
            {f.age && <p className="mt-1 text-xs text-slate-500">Age: {f.age} y</p>}
          </div>

          <div>
            <label className={labelClass}>Class {variant === 'doctor' ? '*' : ''}</label>
            <select
              value={f.student_class}
              onChange={e => upd('student_class', e.target.value)}
              className={`${inputClass} ${errors.student_class ? 'border-red-500/50' : ''}`}
            >
              {CLASSES.map(o => (
                <option key={o} value={o}>
                  {o || '—'}
                </option>
              ))}
            </select>
            {errors.student_class && <p className="mt-1 text-xs text-red-400">{errors.student_class}</p>}
          </div>

          <div>
            <label className={labelClass}>Section</label>
            <select value={f.section} onChange={e => upd('section', e.target.value)} className={inputClass}>
              {SECTIONS.map(o => (
                <option key={o} value={o}>
                  {o || '—'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Blood Group</label>
            <select value={f.blood_group} onChange={e => upd('blood_group', e.target.value)} className={inputClass}>
              {BLOOD_GROUPS.map(o => (
                <option key={o} value={o}>
                  {o || '—'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Father&apos;s Name</label>
            <input
              value={f.father_name}
              onChange={e => upd('father_name', e.target.value)}
              className={inputClass}
              placeholder="Optional"
            />
          </div>

          <div>
            <label className={labelClass}>Phone</label>
            <input
              value={f.phone}
              onChange={e => upd('phone', e.target.value)}
              type="tel"
              className={`${inputClass} ${errors.phone ? 'border-red-500/50' : ''}`}
              placeholder="Optional"
            />
            {errors.phone && <p className="mt-1 text-xs text-red-400">{errors.phone}</p>}
          </div>
        </div>

        {variant === 'doctor' && (
          <div className="overflow-hidden rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setShowSymptoms(!showSymptoms)}
              className="flex w-full items-center justify-between px-3 py-2.5 text-left transition-colors hover:bg-slate-800/50"
            >
              <div className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-amber-400" />
                <span className="text-sm font-medium text-slate-200">Observed symptoms</span>
                {symptoms.length > 0 && (
                  <span className="rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
                    {symptoms.length}
                  </span>
                )}
              </div>
              {showSymptoms ? (
                <ChevronDown className="h-4 w-4 text-slate-500" />
              ) : (
                <ChevronRight className="h-4 w-4 text-slate-500" />
              )}
            </button>
            {showSymptoms && (
              <div className="max-h-52 space-y-1 overflow-y-auto border-t border-slate-800 px-3 pb-3 pt-2">
                <p className="mb-2 text-[10px] text-slate-500">Check all that apply:</p>
                {SYMPTOM_CHECKLIST.map(symptom => {
                  const active = symptoms.includes(symptom);
                  return (
                    <button
                      key={symptom}
                      type="button"
                      onClick={() => toggleSymptom(symptom)}
                      className={`flex w-full items-start gap-2 rounded-lg border px-2.5 py-1.5 text-left text-xs transition-all ${
                        active
                          ? 'border-amber-500/35 bg-amber-500/10 text-amber-200'
                          : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border-2 ${
                          active ? 'border-amber-500 bg-amber-500' : 'border-slate-600'
                        }`}
                      >
                        {active && <Check className="h-2.5 w-2.5 text-white" />}
                      </span>
                      <span className="leading-snug">{symptom}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className={`w-full rounded-lg py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity disabled:opacity-50 ${
            variant === 'doctor'
              ? 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500'
              : 'bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500'
          }`}
        >
          {saving ? 'Saving…' : variant === 'doctor' ? 'Register & continue' : 'Add student'}
        </button>
      </form>
    </ModalFrame>
  );
}
