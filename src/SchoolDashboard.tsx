import React, { useState, useEffect, useRef } from 'react';
import Papa from 'papaparse';
import {
  Calendar, Users, Plus, X, Check, ChevronRight, ArrowRight,
  Upload, Download, FileText, Activity, UserPlus, Search,
  ChevronDown, AlertTriangle, BarChart3, ClipboardList, Printer, History, Loader2
} from 'lucide-react';
import GeneralInfoForm from './GeneralInfoForm';

// Socket.IO client (optional)
let io: any = null;
try { io = require('socket.io-client'); } catch {}

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
  school_id?: number;
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
  assessment?: string;
  registration_number?: string;
  event_id?: number;
}

interface EventStats {
  total_students: number;
  screened: number;
  normal: number;
  observation: number;
  referred: number;
  absent: number;
  dept_breakdown?: Record<string, { N: number; O: number; R: number }>;
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

/** Normalize dates: Handles DD/MM/YYYY and MM/DD/YYYY smartly */
function normalizeDateStr(raw: string): string {
  if (!raw) return raw;
  raw = raw.trim();
  for (const sep of ['-', '/']) {
    const parts = raw.split(sep);
    if (parts.length === 3) {
      const [a, b, c] = parts;
      if (a.length <= 2 && b.length <= 2 && c.length === 4) {
        const numA = parseInt(a, 10);
        const numB = parseInt(b, 10);
        // If middle part > 12, it MUST be the day -> MM/DD/YYYY format
        if (numB > 12) {
          return `${c}-${a.padStart(2, '0')}-${b.padStart(2, '0')}`;
        }
        // Otherwise assume DD/MM/YYYY format as standard
        return `${c}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`;
      }
    }
  }
  return raw;
}

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

  const computeTag = (event: EventData): string => {
    if (event.tag === 'Cancelled') return 'Cancelled';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (event.start_date) {
      const start = new Date(event.start_date);
      start.setHours(0, 0, 0, 0);
      if (today < start) return 'Upcoming';
    }
    if (event.end_date) {
      const end = new Date(event.end_date);
      end.setHours(0, 0, 0, 0);
      if (today > end) return 'Completed';
    }
    return 'Ongoing';
  };

  const tagStyle = (tag: string) => {
    switch (tag) {
      case 'Ongoing': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'Upcoming': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'Completed': return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
      case 'Cancelled': return 'bg-red-500/20 text-red-400 border-red-500/30';
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
                  <span className={`px-3 py-1 rounded-lg text-xs font-bold border ${tagStyle(computeTag(event))}`}>{computeTag(event)}</span>
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

      {activeView === 'roster' && <RosterManagement user={user} eventId={event.event_id} event={event} />}
      {activeView === 'progress' && <ProgressTracking eventId={event.event_id} />}
    </div>
  );
}

// ════════════════════════════════════════
// ██ PRINTABLE DOCUMENT HELPERS
// ════════════════════════════════════════
function buildDocumentBody(d: any, doctorInfo: any, studentInfo: any, campName: string, isReferral: boolean, specialty: string, today: string): string {
  const studentName = studentInfo?.name || '—';
  const studentAge = studentInfo?.age || '—';
  const studentGender = studentInfo?.gender === 'M' ? 'Male' : studentInfo?.gender === 'F' ? 'Female' : '—';
  const studentClass = studentInfo?.student_class || '—';
  const studentSection = studentInfo?.section ? `-${studentInfo.section}` : '';
  const fatherName = studentInfo?.father_name || '—';
  const phone = studentInfo?.phone || '';
  const doctorName = doctorInfo?.name || doctorInfo?.username || '—';
  const docSpecialty = specialty || (doctorInfo?.role || '').replace(/_/g, ' ');

  let html = `<div style="font-family:serif;color:#000;background:#fff;padding:40px;max-width:210mm;margin:0 auto;">`;
  html += `<div style="text-align:center;border-bottom:2px solid #000;padding-bottom:12px;margin-bottom:20px;">`;
  html += `<h1 style="font-size:20px;font-weight:bold;margin:0;">AIIMS BATHINDA — SCHOOL HEALTH CAMP</h1>`;
  if (campName) html += `<p style="font-size:12px;margin:4px 0 0;color:#555;">${campName}</p>`;
  html += `</div>`;
  html += `<div style="display:flex;justify-content:space-between;margin-bottom:16px;">`;
  html += `<div><span style="display:inline-block;padding:4px 14px;border:2px solid #000;font-weight:bold;font-size:14px;text-transform:uppercase;border-radius:4px;">${isReferral ? 'REFERRAL SHEET' : 'PRESCRIPTION'}</span>`;
  html += `<span style="margin-left:12px;font-size:13px;color:#555;">Department: ${docSpecialty}</span></div>`;
  html += `<div style="font-size:13px;">Date: ${today}</div></div>`;
  html += `<table style="width:100%;font-size:13px;margin-bottom:16px;border-collapse:collapse;"><tbody>`;
  html += `<tr><td style="padding:3px 0;font-weight:bold;width:120px;">Student Name:</td><td>${studentName}</td><td style="font-weight:bold;width:60px;">Age:</td><td style="width:50px;">${studentAge}</td><td style="font-weight:bold;width:60px;">Sex:</td><td style="width:50px;">${studentGender}</td></tr>`;
  html += `<tr><td style="padding:3px 0;font-weight:bold;">Class:</td><td>${studentClass}${studentSection}</td><td style="font-weight:bold;">Father:</td><td colspan="3">${fatherName}</td></tr>`;
  const regNo = studentInfo?.registration_number || '—';
  html += `<tr><td style="padding:3px 0;font-weight:bold;">Reg No:</td><td>${regNo}</td><td style="font-weight:bold;">Contact:</td><td colspan="3">${phone || '—'}</td></tr>`;
  html += `</tbody></table>`;
  html += `<div style="border-top:1px solid #ccc;padding-top:12px;margin-bottom:12px;"><h3 style="font-size:14px;font-weight:bold;margin:0 0 6px;">Clinical Findings</h3>`;
  html += `<p style="font-size:13px;white-space:pre-wrap;">${d.clinicalFindings || '—'}</p></div>`;

  if (!isReferral) {
    html += `<div style="border-top:1px solid #ccc;padding-top:12px;margin-bottom:12px;">`;
    html += `<h3 style="font-size:14px;font-weight:bold;margin:0 0 6px;">Diagnosis</h3><p style="font-size:13px;">${d.diagnosis || '—'}</p>`;
    html += `<h3 style="font-size:14px;font-weight:bold;margin:12px 0 6px;">Prescription (Rx)</h3>`;
    if ((d.medicines || []).length > 0) {
      html += `<table style="width:100%;font-size:13px;border-collapse:collapse;"><thead><tr style="border-bottom:1px solid #999;">`;
      html += `<th style="text-align:left;padding:4px;font-weight:bold;">#</th><th style="text-align:left;padding:4px;font-weight:bold;">Medicine</th><th style="text-align:left;padding:4px;font-weight:bold;">Dosage</th><th style="text-align:left;padding:4px;font-weight:bold;">Freq</th><th style="text-align:left;padding:4px;font-weight:bold;">Duration</th></tr></thead><tbody>`;
      (d.medicines || []).forEach((m: any, i: number) => {
        html += `<tr style="border-bottom:1px solid #eee;"><td style="padding:4px;">${i + 1}.</td><td style="padding:4px;">${m.name || '—'}</td><td style="padding:4px;">${m.dosage || '—'}</td><td style="padding:4px;">${m.frequency || '—'}</td><td style="padding:4px;">${m.duration || '—'}</td></tr>`;
      });
      html += `</tbody></table>`;
    } else {
      html += `<p style="font-size:13px;color:#999;">No medicines prescribed.</p>`;
    }
    if (d.advice) html += `<div style="margin-top:12px;"><h3 style="font-size:14px;font-weight:bold;margin:0 0 6px;">Advice</h3><p style="font-size:13px;white-space:pre-wrap;">${d.advice}</p></div>`;
    html += `</div>`;
  } else {
    html += `<div style="border-top:1px solid #ccc;padding-top:12px;margin-bottom:12px;">`;
    html += `<h3 style="font-size:14px;font-weight:bold;margin:0 0 6px;">Reason for Referral</h3>`;
    html += `<p style="font-size:13px;white-space:pre-wrap;">${d.referralReason || '—'}</p>`;
    html += `<div style="display:flex;gap:40px;margin-top:10px;">`;
    html += `<div><span style="font-weight:bold;font-size:13px;">Recommended Dept/Hospital: </span><span style="font-size:13px;">${d.referralDept || '—'}</span></div>`;
    html += `<div><span style="font-weight:bold;font-size:13px;">Urgency: </span><span style="font-size:13px;">${d.urgency || 'Routine'}</span></div></div></div>`;
  }

  html += `<div style="border-top:2px solid #000;padding-top:16px;margin-top:30px;display:flex;justify-content:space-between;">`;
  html += `<div style="font-size:13px;"><p style="font-weight:bold;">${doctorName}</p><p style="color:#555;">${docSpecialty}</p></div>`;
  html += `<div style="text-align:right;font-size:13px;"><p style="margin-top:30px;border-top:1px solid #000;padding-top:4px;">Signature</p></div></div></div>`;
  return html;
}

function buildPrintableHTML(d: any, doctorInfo: any, studentInfo: any, campName: string, isReferral: boolean, specialty: string, today: string): string {
  return `<html><head><title>Print Document</title><style>body{margin:0;padding:0;font-family:serif;}@page{size:A4;margin:15mm;}</style></head><body>${buildDocumentBody(d, doctorInfo, studentInfo, campName, isReferral, specialty, today)}</body></html>`;
}

// ════════════════════════════════════════
// ██ OPTION A: ROSTER MANAGEMENT
// ════════════════════════════════════════
function RosterManagement({ user, eventId, event }: { user: User; eventId: number; event: EventData }) {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCSVUpload, setShowCSVUpload] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [genderFilter, setGenderFilter] = useState('');
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [viewingDocsStudent, setViewingDocsStudent] = useState<Student | null>(null);
  const [studentDocs, setStudentDocs] = useState<any[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [bulkPrinting, setBulkPrinting] = useState(false);
  const [viewingHistoryStudent, setViewingHistoryStudent] = useState<Student | null>(null);
  const bulkPrintRef = useRef<HTMLDivElement>(null);

  const CLASSES = ['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
  const SECTIONS = ['A', 'B', 'C', 'D', 'E'];

  const fetchStudents = () => {
    setLoading(true);
    const params = new URLSearchParams({ event_id: String(eventId) });
    if (searchQuery) params.set('query', searchQuery);
    if (statusFilter) params.set('assessment', statusFilter);
    if (classFilter) params.set('class', classFilter);
    if (sectionFilter) params.set('section', sectionFilter);
    if (genderFilter) params.set('gender', genderFilter);
    fetch(`/api/students/search?${params}`)
      .then(r => r.json())
      .then(data => { setStudents(data); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchStudents(); }, [eventId, searchQuery, statusFilter, classFilter, sectionFilter, genderFilter]);

  // Real-time Socket.IO listener for live roster updates
  useEffect(() => {
    if (!io) return;
    try {
      const socket = io.connect(window.location.origin, { transports: ['websocket', 'polling'] });
      const refresh = (data: any) => {
        if (!data.event_id || data.event_id === eventId) fetchStudents();
      };
      socket.on('student_created', refresh);
      socket.on('students_bulk_created', refresh);
      socket.on('exam_saved', refresh);
      return () => { socket.disconnect(); };
    } catch {}
  }, [eventId]);

  const toggleAbsent = async (studentId: number, currentStatus: string) => {
    const newStatus = currentStatus === 'Absent' ? 'Pending Examination' : 'Absent';
    await fetch(`/api/students/${studentId}/status`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    fetchStudents();
  };

  const totalStudents = students.length;
  const examinedStudents = students.filter(s => s.is_examined).length;
  const progressPct = totalStudents > 0 ? Math.round((examinedStudents / totalStudents) * 100) : 0;

  // Count examined students for bulk print badge
  const examinedStudentsList = students.filter(s => s.is_examined);
  const docCount = examinedStudentsList.length;

  // View docs for a single student
  const handleViewDocs = async (student: Student) => {
    setViewingDocsStudent(student);
    setLoadingDocs(true);
    try {
      const res = await fetch(`/api/students/${student.student_id}/all-records?event_id=${eventId}`);
      const data = await res.json();
      const docs = (data.records || []).filter((r: any) => {
        const parsed = r.parsed_data || {};
        return parsed.status === 'O' || parsed.status === 'R';
      });
      setStudentDocs(docs);
    } catch { setStudentDocs([]); }
    finally { setLoadingDocs(false); }
  };

  // Print a single document
  const handlePrintDoc = (record: any) => {
    const d = record.parsed_data || {};
    const isReferral = d.status === 'R';
    const specialty = (record.category || '').replace(/_/g, ' ');
    const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const s = viewingDocsStudent;
    const html = buildPrintableHTML(d, { name: record.doctor_id, role: record.category }, s, '', isReferral, specialty, today);
    const pw = window.open('', '_blank');
    if (!pw) return;
    pw.document.write(html);
    pw.document.close();
    pw.focus();
    setTimeout(() => { pw.print(); pw.close(); }, 300);
  };

  // Bulk print all docs
  const handleBulkPrint = async () => {
    setBulkPrinting(true);
    try {
      const allDocs: { student: Student; record: any }[] = [];
      for (const s of examinedStudentsList) {
        const res = await fetch(`/api/students/${s.student_id}/all-records?event_id=${eventId}`);
        const data = await res.json();
        const docs = data.records || [];
        for (const doc of docs) {
          allDocs.push({ student: data.student || s, record: doc });
        }
      }
      if (allDocs.length === 0) { setBulkPrinting(false); return; }
      const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
      let fullHTML = '<html><head><title>Print All Documents</title><style>body{margin:0;padding:0;font-family:serif;}@page{size:A4;margin:15mm;}.page-break{page-break-after:always;}</style></head><body>';
      allDocs.forEach((item, idx) => {
        const d = item.record.parsed_data || {};
        const isReferral = d.status === 'R';
        const specialty = (item.record.category || '').replace(/_/g, ' ');
        fullHTML += buildDocumentBody(d, { name: item.record.doctor_id, role: item.record.category }, item.student, '', isReferral, specialty, today);
        if (idx < allDocs.length - 1) fullHTML += '<div class="page-break"></div>';
      });
      fullHTML += '</body></html>';
      const pw = window.open('', '_blank');
      if (!pw) { setBulkPrinting(false); return; }
      pw.document.write(fullHTML);
      pw.document.close();
      pw.focus();
      setTimeout(() => { pw.print(); pw.close(); setBulkPrinting(false); }, 300);
    } catch { setBulkPrinting(false); }
  };

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

  const mainContent = (
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

      {/* Search + Filters + Actions */}
      <div className="bg-slate-900/80 backdrop-blur-xl p-4 rounded-2xl border border-slate-800 space-y-3">
        <div className="flex flex-col md:flex-row space-y-3 md:space-y-0 md:space-x-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-violet-500 w-4 h-4" />
            <input type="text" placeholder="Search students..."
              value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 outline-none transition-all text-sm" />
          </div>
          <div className="flex space-x-3">
            <button onClick={() => setShowAddModal(true)}
              className="flex-1 md:flex-none bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-400 hover:to-purple-500 text-white px-5 py-3 rounded-xl font-bold transition-all flex items-center justify-center space-x-2 shadow-lg whitespace-nowrap text-sm">
              <Plus className="w-4 h-4" /><span>Add Student</span>
            </button>
            <button onClick={() => setShowCSVUpload(true)}
              className="flex-1 md:flex-none bg-slate-800 hover:bg-slate-700 text-violet-400 border border-slate-700 hover:border-violet-500/30 px-5 py-3 rounded-xl font-bold transition-all flex items-center justify-center space-x-2 whitespace-nowrap text-sm">
              <Upload className="w-4 h-4" /><span>CSV Upload</span>
            </button>
            {docCount > 0 && (
              <button onClick={handleBulkPrint} disabled={bulkPrinting}
                className="flex-1 md:flex-none bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30 px-5 py-3 rounded-xl font-bold transition-all flex items-center justify-center space-x-2 whitespace-nowrap text-sm disabled:opacity-50">
                <Printer className="w-4 h-4" /><span>{bulkPrinting ? 'Loading...' : `Print Prescriptions (${docCount})`}</span>
              </button>
            )}
          </div>
        </div>
        {/* Filter Row */}
        <div className="flex items-center flex-wrap gap-2">
          <span className="text-xs text-slate-500 font-medium">Filters:</span>
          <select value={classFilter} onChange={e => setClassFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300">
            <option value="">All Classes</option>
            {CLASSES.map(c => <option key={c} value={c}>Class {c}</option>)}
          </select>
          <select value={sectionFilter} onChange={e => setSectionFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300">
            <option value="">All Sections</option>
            {SECTIONS.map(s => <option key={s} value={s}>Section {s}</option>)}
          </select>
          <select value={genderFilter} onChange={e => setGenderFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300">
            <option value="">All Sex</option>
            <option value="M">Male</option>
            <option value="F">Female</option>
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300">
            <option value="">All Statuses</option>
            <option value="N">Normal</option>
            <option value="O">Observation</option>
            <option value="R">Referral</option>
          </select>
          {(classFilter || sectionFilter || genderFilter || statusFilter) && (
            <button onClick={() => { setClassFilter(''); setSectionFilter(''); setGenderFilter(''); setStatusFilter(''); }}
              className="text-xs text-red-400 underline">Clear</button>
          )}
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
                  <th className="px-5 py-3 font-medium text-xs uppercase tracking-wider">Reg No</th>
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
                  let statusStyle = 'bg-amber-500/20 text-amber-400 border-amber-500/30';
                  let statusLabel = s.status || 'Pending Examination';
                  
                  if (s.is_examined) {
                    if (s.assessment === 'N') { statusLabel = 'Normal'; statusStyle = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'; }
                    else if (s.assessment === 'O') { statusLabel = 'Observation'; statusStyle = 'bg-amber-500/20 text-amber-400 border-amber-500/30'; }
                    else if (s.assessment === 'R') { statusLabel = 'Referred'; statusStyle = 'bg-red-500/20 text-red-400 border-red-500/30'; }
                    else { statusLabel = 'Examined'; statusStyle = 'bg-blue-500/20 text-blue-400 border-blue-500/30'; }
                  } else if (s.status === 'Absent') {
                    statusStyle = 'bg-slate-500/20 text-slate-400 border-slate-500/30';
                  }

                  return (
                    <tr key={s.student_id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-5 py-3 text-slate-400 text-xs font-mono">{s.registration_number || '—'}</td>
                      <td className="px-5 py-3 text-white font-medium">{s.name}</td>
                      <td className="px-5 py-3 text-slate-300">{s.student_class || '—'}{s.section ? `-${s.section}` : ''}</td>
                      <td className="px-5 py-3 text-slate-300">{s.gender === 'M' ? 'Male' : s.gender === 'F' ? 'Female' : '—'}</td>
                      <td className="px-5 py-3 text-slate-300">{s.age || '—'}</td>
                      <td className="px-5 py-3 text-slate-300">{s.phone || '—'}</td>
                      <td className="px-5 py-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${statusStyle}`}>{statusLabel}</span>
                      </td>
                      <td className="px-5 py-3 flex space-x-2">
                        <button onClick={() => setEditingStudent(s)}
                          className="bg-violet-500/20 hover:bg-violet-500/30 text-violet-400 border border-violet-500/30 px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5">
                          <ClipboardList className="w-3 h-3" /><span className="hidden sm:inline">Fill Info</span>
                        </button>
                        {(s.assessment === 'O' || s.assessment === 'R') && (
                          <button onClick={() => handleViewDocs(s)}
                            className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30 px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5">
                            <FileText className="w-3 h-3" /><span className="hidden sm:inline">View Docs</span>
                          </button>
                        )}
                        {!s.is_examined && (
                          <button onClick={() => toggleAbsent(s.student_id, s.status)}
                            className="bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap">
                            {s.status === 'Absent' ? 'Present' : 'Absent'}
                          </button>
                        )}
                        {s.registration_number && (
                          <button onClick={() => setViewingHistoryStudent(s)}
                            className="bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-400 border border-indigo-500/30 px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5"
                            title="View previous camp evaluations">
                            <History className="w-3 h-3" /><span className="hidden sm:inline">History</span>
                          </button>
                        )}
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

      {/* Document Viewer Modal */}
      {viewingDocsStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setViewingDocsStudent(null)}>
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-2xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <button onClick={() => setViewingDocsStudent(null)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            <h3 className="text-lg font-bold text-white mb-4 flex items-center">
              <FileText className="w-5 h-5 mr-2 text-amber-400" />
              {viewingDocsStudent.name} — Documents
            </h3>
            {loadingDocs ? (
              <div className="text-center py-8 text-slate-400">Loading documents...</div>
            ) : studentDocs.length === 0 ? (
              <div className="text-center py-8 text-slate-500">No prescriptions or referrals found.</div>
            ) : (
              <div className="space-y-3">
                {studentDocs.map((rec: any, i: number) => {
                  const d = rec.parsed_data || {};
                  const isReferral = d.status === 'R';
                  const specialty = (rec.category || '').replace(/_/g, ' ');
                  return (
                    <div key={i} className={`rounded-2xl p-4 border ${isReferral ? 'bg-red-500/5 border-red-500/20' : 'bg-amber-500/5 border-amber-500/20'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <span className={`text-xs font-bold uppercase ${isReferral ? 'text-red-400' : 'text-amber-400'}`}>
                            {isReferral ? '🏥 Referral' : '📝 Prescription'}
                          </span>
                          <span className="text-xs text-slate-500">— {specialty}</span>
                        </div>
                        <button onClick={() => handlePrintDoc(rec)}
                          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                            isReferral ? 'bg-red-500/20 hover:bg-red-500/30 text-red-400 border-red-500/30' : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border-amber-500/30'
                          }`}>
                          <Printer className="w-3 h-3" /><span>Print</span>
                        </button>
                      </div>
                      <div className="space-y-1 text-xs text-slate-300">
                        <p><span className="text-slate-500">Doctor:</span> {rec.doctor_id}</p>
                        {d.clinicalFindings && <p><span className="text-slate-500">Findings:</span> {d.clinicalFindings}</p>}
                        {d.diagnosis && <p><span className="text-slate-500">Dx:</span> {d.diagnosis}</p>}
                        {(d.medicines || []).length > 0 && (
                          <div>
                            <span className="text-slate-500">Rx:</span>
                            {d.medicines.map((m: any, j: number) => (
                              <span key={j} className="ml-1">{m.name} {m.dosage} {m.frequency} {m.duration}{j < d.medicines.length - 1 ? ',' : ''}</span>
                            ))}
                          </div>
                        )}
                        {d.advice && <p><span className="text-slate-500">Advice:</span> {d.advice}</p>}
                        {d.referralReason && <p><span className="text-slate-500">Reason:</span> {d.referralReason}</p>}
                        {d.referralDept && <p><span className="text-slate-500">Refer to:</span> {d.referralDept}</p>}
                        {d.urgency && <p><span className="text-slate-500">Urgency:</span> {d.urgency}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  // Previous records modal for school view
  const historyModalContent = viewingHistoryStudent && (
    <SchoolPreviousRecordsModal
      student={viewingHistoryStudent}
      schoolId={event.school_id ?? null}
      onClose={() => setViewingHistoryStudent(null)}
    />
  );

  return (
    <>
      {mainContent}
      {historyModalContent}
    </>
  );
}

// ════════════════════════════════════════
// ██ PREVIOUS RECORDS MODAL (cross-camp history)
// ════════════════════════════════════════
function SchoolPreviousRecordsModal({ student, schoolId, onClose }: {
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
          Previous Camp Evaluations
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
                          {d.advice && <p className="text-[11px] text-slate-400 mt-0.5"><span className="text-slate-600">Advice:</span> {d.advice}</p>}
                          {d.referralDept && <p className="text-[11px] text-slate-400 mt-0.5"><span className="text-slate-600">Refer to:</span> {d.referralDept}</p>}
                          {d.urgency && <p className="text-[11px] text-slate-400 mt-0.5"><span className="text-slate-600">Urgency:</span> {d.urgency}</p>}
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

// ════════════════════════════════════════
// ██ ADD STUDENT MODAL (reused from DoctorWorkflow)
// ════════════════════════════════════════
function AddStudentModal({ onClose, onCreated, userId, eventId }: {
  onClose: () => void; onCreated: () => void; userId: string; eventId: number;
}) {
  const [f, setF] = useState({ name: '', age: '', dob: '', gender: '', student_class: '', section: '', blood_group: '', father_name: '', phone: '', registration_number: '' });
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

            <div>
              <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">Registration Number</label>
              <input value={f.registration_number} onChange={e => upd('registration_number', e.target.value)} placeholder="School reg. number"
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
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [result, setResult] = useState<{ inserted: any[]; errors: any[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = () => {
    window.open('/api/students/csv-template', '_blank');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase().replace(/^\uFEFF/, ''),
      complete: (results) => {
        if (results.data.length > 0) {
          const firstRow = results.data[0] as Record<string, any>;
          // Check if at least one expected column exists
          if (firstRow.name === undefined && firstRow.gender === undefined && firstRow.dob === undefined) {
             const detected = results.meta?.fields?.join(', ') || 'None';
             setUploadError(`Invalid columns detected. Expected 'name', 'dob', etc. \n\nFound: [${detected}]. \n\nIf you see gibberish, you uploaded an Excel (.xlsx) file instead of CSV. If columns are joined with semicolons, save the CSV properly.`);
             setParsedRows([]);
             return;
          }
        }

        const rows: ParsedRow[] = results.data.map((row: any) => {
          const errors: string[] = [];
          if (!row.name?.trim()) errors.push('Name is required');
          if (row.gender && !['M', 'F', 'm', 'f'].includes(row.gender.trim())) errors.push('Gender must be M or F');
          if (row.dob) {
            const normalized = normalizeDateStr(row.dob);
            row.dob = normalized;  // update the row so the backend gets yyyy-mm-dd
            const d = new Date(normalized);
            if (isNaN(d.getTime())) errors.push('Invalid DOB format (use DD-MM-YYYY or YYYY-MM-DD)');
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

          {uploadError && (
            <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-xl mt-4">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-red-300 font-medium whitespace-pre-wrap">{uploadError}</div>
              </div>
            </div>
          )}

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
                      <th className="px-3 py-2 font-medium">Reg No</th>
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
                        <td className="px-3 py-2 text-slate-300">{row.data.registration_number || '—'}</td>
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
  const [classFilter, setClassFilter] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [genderFilter, setGenderFilter] = useState('');

  const CLASSES_PT = ['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
  const SECTIONS_PT = ['A', 'B', 'C', 'D', 'E'];

  useEffect(() => {
    const params = new URLSearchParams();
    if (classFilter) params.set('student_class', classFilter);
    if (sectionFilter) params.set('section', sectionFilter);
    if (genderFilter) params.set('gender', genderFilter);
    const qs = params.toString();
    fetch(`/api/events/${eventId}/stats${qs ? '?' + qs : ''}`)
      .then(r => r.json())
      .then(setStats)
      .catch(e => {
        console.error("Error fetching stats:", e);
        setStats({ total_students: 0, screened: 0, normal: 0, observation: 0, referred: 0, absent: 0, records: [], staff: [] });
      });
  }, [eventId, classFilter, sectionFilter, genderFilter]);

  if (!stats) return <div className="text-center py-8 text-slate-400">Loading statistics...</div>;

  type DeptCounts = { N: number; O: number; R: number };
  const deptEntries = Object.entries(stats.dept_breakdown || {}).sort((a, b) => a[0].localeCompare(b[0])) as [string, DeptCounts][];
  const formatDept = (d: string) => d.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-slate-900/80 backdrop-blur-xl p-4 rounded-2xl border border-slate-800">
        <div className="flex items-center flex-wrap gap-2">
          <span className="text-xs text-slate-500 font-medium">Filters:</span>
          <select value={classFilter} onChange={e => setClassFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300">
            <option value="">All Classes</option>
            {CLASSES_PT.map(c => <option key={c} value={c}>Class {c}</option>)}
          </select>
          <select value={sectionFilter} onChange={e => setSectionFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300">
            <option value="">All Sections</option>
            {SECTIONS_PT.map(s => <option key={s} value={s}>Section {s}</option>)}
          </select>
          <select value={genderFilter} onChange={e => setGenderFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300">
            <option value="">All Sex</option>
            <option value="M">Male</option>
            <option value="F">Female</option>
          </select>
          {(classFilter || sectionFilter || genderFilter) && (
            <button onClick={() => { setClassFilter(''); setSectionFilter(''); setGenderFilter(''); }}
              className="text-xs text-red-400 underline">Clear</button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <StatCard label="Total Students" value={stats.total_students} color="text-violet-400" />
        <StatCard label="Screened" value={stats.screened} color="text-blue-400" />
        <StatCard label="Normal" value={stats.normal} color="text-emerald-400" />
        <StatCard label="Observation" value={stats.observation} color="text-amber-400" />
        <StatCard label="Referred" value={stats.referred} color="text-red-400" />
        <StatCard label="Absent" value={stats.absent} color="text-slate-400" />
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

      {/* Department Breakdown Table */}
      {deptEntries.length > 0 && (
        <div className="bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-800">
            <h3 className="text-sm font-bold text-white">Department Breakdown</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-slate-500 border-b border-slate-800 bg-slate-950/50">
                <tr>
                  <th className="px-5 py-3 font-medium text-xs uppercase tracking-wider">Department</th>
                  <th className="px-5 py-3 font-medium text-xs uppercase tracking-wider text-center">Normal</th>
                  <th className="px-5 py-3 font-medium text-xs uppercase tracking-wider text-center">Observation</th>
                  <th className="px-5 py-3 font-medium text-xs uppercase tracking-wider text-center">Referred</th>
                  <th className="px-5 py-3 font-medium text-xs uppercase tracking-wider text-center">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {deptEntries.map(([dept, counts]) => (
                  <tr key={dept} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-5 py-3 text-white font-medium">{formatDept(dept)}</td>
                    <td className="px-5 py-3 text-center">
                      <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-full text-xs font-bold">{counts.N}</span>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2.5 py-0.5 rounded-full text-xs font-bold">{counts.O}</span>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className="bg-red-500/20 text-red-400 border border-red-500/30 px-2.5 py-0.5 rounded-full text-xs font-bold">{counts.R}</span>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className="text-slate-300 text-xs font-bold">{counts.N + counts.O + counts.R}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
