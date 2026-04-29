import React, { useState, useEffect } from 'react';
import { History, X, Loader2, AlertTriangle, ClipboardList, Calendar, Eye, Ear, Scan, Activity, Stethoscope } from 'lucide-react';

export interface SharedStudent {
  registration_number?: string;
  name: string;
  event_id?: number;
  [key: string]: any;
}

export function RecordField({ label, value, className = '' }: { label: string; value?: string; className?: string }) {
  if (!value) return null;
  return (
    <div className={className}>
      <span className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">{label}</span>
      <p className="text-sm text-gray-700 mt-0.5 leading-snug">{value}</p>
    </div>
  );
}

export function RecordPill({ label, color }: { label: string; color: string }) {
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${color}`}>{label}</span>;
}

export function StatusBadge({ status }: { status: string }) {
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

export function RemarksBlock({ data }: { data: any }) {
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

export function EyeRecordCard({ d }: { d: any }) {
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

export function DentalRecordCard({ d }: { d: any }) {
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

export function ENTRecordCard({ d }: { d: any }) {
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

export function SkinRecordCard({ d }: { d: any }) {
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

export function CommunityMedRecordCard({ d }: { d: any }) {
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
          <span className={`text-xs font-bold px-2 py-0.5 rounded-md border ${d.anaemia === 'No' ? 'text-green-700 bg-green-50 border-green-200'
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
                <span className={`font-bold px-2 py-0.5 rounded border ${s.val === 'NAD' ? 'text-green-700 bg-green-50 border-green-200' : 'text-red-700 bg-red-50 border-red-200'
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
export function GenericRecordCard({ d }: { d: any }) {
  const entries = Object.entries(d).filter(([k]) => !['status', 'assessment', 'clinicalFindings', 'diagnosis', 'remarks', 'medicines', 'advice', 'referralReason', 'referralDept', 'urgency'].includes(k));
  if (entries.length === 0) return null;
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {entries.map(([k, v]) => {
          if (v === null || v === undefined || v === '') return null;
          let display: string;
          if (Array.isArray(v)) display = v.map(i => typeof i === 'object' ? Object.entries(i).map(([a, b]) => `${a}: ${b}`).join(', ') : String(i)).join(' | ');
          else if (typeof v === 'object') display = Object.entries(v).map(([a, b]) => `${a}: ${b}`).join(', ');
          else display = String(v);
          return <div key={k}><RecordField label={k.replace(/_/g, ' ')} value={display} /></div>;
        })}
      </div>
      <RemarksBlock data={d} />
    </div>
  );
}

export function SpecialistRecordBody({ category, d }: { category: string; d: any }) {
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
export const SPECIALIST_META: Record<string, { icon: React.ReactNode; label: string }> = {
  Eye_Specialist: { icon: <Eye className="h-4 w-4 text-[#6B7280]" />, label: 'Ophthalmology' },
  Dental: { icon: <span className="text-sm">🦷</span>, label: 'Dental' },
  ENT: { icon: <Ear className="h-4 w-4 text-[#6B7280]" />, label: 'ENT' },
  Skin_Specialist: { icon: <Scan className="h-4 w-4 text-[#6B7280]" />, label: 'Dermatology' },
  Community_Medicine: { icon: <Stethoscope className="h-4 w-4 text-[#6B7280]" />, label: 'Community Medicine' },
};

export function OtherRecordsPanel({ studentId, eventId, currentCategory }: {
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
            .catch(() => { });
        }
      });
      return () => { socket.disconnect(); };
    } catch { }
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

// ── Previous Evaluations Modal (cross-camp) ──
export function StudentHistoryModal({ student, schoolId, onClose }: {
  student: SharedStudent; schoolId: number | null; onClose: () => void;
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
  const statusColor = (s: string) => s === 'N' ? 'text-emerald-600 bg-emerald-50 border-emerald-200' : s === 'R' ? 'text-red-600 bg-red-50 border-red-200' : 'text-amber-600 bg-amber-50 border-amber-200';

  // Group records by event_id
  const recordsByEvent: Record<number, any[]> = {};
  for (const r of records) {
    const eid = r.event_id;
    if (!recordsByEvent[eid]) recordsByEvent[eid] = [];
    recordsByEvent[eid].push(r);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-2xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"><X className="w-5 h-5" /></button>
        <h3 className="text-lg font-bold text-gray-900 mb-1 flex items-center">
          <History className="w-5 h-5 mr-2 text-indigo-600" />
          Previous Evaluations
        </h3>
        <p className="text-xs text-gray-500 mb-4">
          {student.name} · Reg: {student.registration_number || '—'}
        </p>

        {loading ? (
          <div className="text-center py-12 text-gray-400 flex items-center justify-center space-x-2">
            <Loader2 className="w-5 h-5 animate-spin" /><span>Loading records...</span>
          </div>
        ) : !student.registration_number ? (
          <div className="text-center py-12">
            <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No registration number assigned.</p>
            <p className="text-gray-400 text-xs mt-1">A registration number is needed to track students across camps.</p>
          </div>
        ) : records.length === 0 ? (
          <div className="text-center py-12">
            <ClipboardList className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No previous evaluations found.</p>
            <p className="text-gray-400 text-xs mt-1">This is the first examination for this student.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {events.map(evt => {
              const evtRecords = recordsByEvent[evt.event_id] || [];
              if (evtRecords.length === 0) return null;
              return (
                <div key={evt.event_id} className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-4 py-3 bg-indigo-50 border-b border-gray-200 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-4 h-4 text-indigo-600" />
                      <span className="text-sm font-bold text-gray-900">{evt.school_name}</span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {formatDate(evt.start_date)}{evt.end_date ? ` → ${formatDate(evt.end_date)}` : ''}
                    </span>
                  </div>
                  {evt.general_info && (evt.general_info.height || evt.general_info.weight) && (
                    <div className="px-4 py-2 border-b border-gray-100 flex items-center space-x-4 text-xs text-gray-500">
                      {evt.general_info.height && <span>Height: <b className="text-gray-700">{evt.general_info.height} cm</b></span>}
                      {evt.general_info.weight && <span>Weight: <b className="text-gray-700">{evt.general_info.weight} kg</b></span>}
                      {evt.general_info.bmi && <span>BMI: <b className="text-gray-700">{evt.general_info.bmi}</b></span>}
                    </div>
                  )}
                  <div className="p-3 space-y-2">
                    {evtRecords.map((r: any, i: number) => {
                      const d = r.parsed_data || {};
                      return (
                        <div key={i} className="bg-white rounded-lg px-3 py-2 border border-gray-100">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-indigo-600">{catLabel(r.category)}</span>
                            <div className="flex items-center space-x-2">
                              {d.status && (
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${statusColor(d.status)}`}>
                                  {statusLabel(d.status)}
                                </span>
                              )}
                              <span className="text-[10px] text-gray-400">{r.doctor_id}</span>
                            </div>
                          </div>
                          <SpecialistRecordBody category={r.category} d={d} />
                          {d.clinicalFindings && <p className="text-[11px] text-gray-500 mt-1"><span className="text-gray-400 font-medium">Findings:</span> {d.clinicalFindings}</p>}
                          {d.diagnosis && <p className="text-[11px] text-gray-500 mt-0.5"><span className="text-gray-400 font-medium">Dx:</span> {d.diagnosis}</p>}
                          {d.referralReason && <p className="text-[11px] text-gray-500 mt-0.5"><span className="text-gray-400 font-medium">Referral:</span> {d.referralReason}</p>}
                          {(d.medicines || []).length > 0 && (
                            <div className="text-[11px] text-gray-500 mt-0.5">
                              <span className="text-gray-400 font-medium">Rx:</span>
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
