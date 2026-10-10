// BACKEND: every export in this file is hardcoded demo data standing in
// for the admin endpoints described in documents/API_ROUTES.md's "Admin
// endpoints" gap. Kept in one module so every admin page (Overview,
// Staff, Insights, Activity) reads consistent numbers instead of each
// page hardcoding its own -- once real endpoints exist, this file is
// what gets replaced with fetch calls.

export type StaffStatus = 'active' | 'pending' | 'suspended'
export type StaffRole = 'Doctor' | 'Technician'

export interface StaffMember {
  id: string
  name: string
  role: StaffRole
  email: string
  status: StaffStatus
  patientsHandled: number
  joinedAt: string
  lastActive: string
}

export const STAFF: StaffMember[] = [
  { id: 'U-101', name: 'Dr. Ananya Singh', role: 'Doctor', email: 'ananya@hospital.com', status: 'pending', patientsHandled: 0, joinedAt: '2026-09-25', lastActive: '—' },
  { id: 'U-102', name: 'Raj Mehta', role: 'Technician', email: 'raj.mehta@clinic.com', status: 'pending', patientsHandled: 0, joinedAt: '2026-09-26', lastActive: '—' },
  { id: 'U-001', name: 'Dr. R. Sharma', role: 'Doctor', email: 'doctor@retinex.com', status: 'active', patientsHandled: 312, joinedAt: '2026-02-14', lastActive: '2 mins ago' },
  { id: 'U-002', name: 'Dr. Kavita Patel', role: 'Doctor', email: 'kpatel@retinex.com', status: 'active', patientsHandled: 274, joinedAt: '2026-03-02', lastActive: '18 mins ago' },
  { id: 'U-003', name: 'Dr. Arjun Nair', role: 'Doctor', email: 'anair@retinex.com', status: 'active', patientsHandled: 198, joinedAt: '2026-04-19', lastActive: '1 hour ago' },
  { id: 'U-004', name: 'Dr. Meera Iyer', role: 'Doctor', email: 'miyer@retinex.com', status: 'suspended', patientsHandled: 87, joinedAt: '2026-01-08', lastActive: '14 days ago' },
  { id: 'U-201', name: 'Priya Devi', role: 'Technician', email: 'priya.devi@clinic.com', status: 'active', patientsHandled: 421, joinedAt: '2026-02-20', lastActive: '5 mins ago' },
  { id: 'U-202', name: 'Suresh Rao', role: 'Technician', email: 'suresh.rao@clinic.com', status: 'active', patientsHandled: 356, joinedAt: '2026-03-11', lastActive: '32 mins ago' },
  { id: 'U-203', name: 'Neha Joshi', role: 'Technician', email: 'neha.joshi@clinic.com', status: 'active', patientsHandled: 289, joinedAt: '2026-05-06', lastActive: '3 hours ago' },
]

export const PENDING_STAFF = STAFF.filter((s) => s.status === 'pending')
export const ACTIVE_DOCTORS = STAFF.filter((s) => s.role === 'Doctor' && s.status === 'active')
export const ACTIVE_TECHNICIANS = STAFF.filter((s) => s.role === 'Technician' && s.status === 'active')

export interface DoctorAgreement {
  name: string
  agreementRate: number
  casesReviewed: number
}

export const DOCTOR_AGREEMENT: DoctorAgreement[] = [
  { name: 'Dr. R. Sharma', agreementRate: 96, casesReviewed: 312 },
  { name: 'Dr. Kavita Patel', agreementRate: 93, casesReviewed: 274 },
  { name: 'Dr. Arjun Nair', agreementRate: 91, casesReviewed: 198 },
  { name: 'Dr. Meera Iyer', agreementRate: 89, casesReviewed: 87 },
]

// Grade order fixed 0 -> 4 (No DR -> Proliferative DR); never reordered
// or recolored per-view, per the platform's severity convention
// (types.ts SEVERITY_LABEL / SEVERITY_TOKEN).
export interface SeverityBucket {
  grade: number
  label: string
  count: number
  colorClass: string
}

export const SEVERITY_DISTRIBUTION: SeverityBucket[] = [
  { grade: 0, label: 'No DR', count: 412, colorClass: 'bg-emerald-500' },
  { grade: 1, label: 'Mild NPDR', count: 216, colorClass: 'bg-lime-500' },
  { grade: 2, label: 'Moderate NPDR', count: 148, colorClass: 'bg-amber-500' },
  { grade: 3, label: 'Severe NPDR', count: 51, colorClass: 'bg-orange-500' },
  { grade: 4, label: 'Proliferative DR', count: 15, colorClass: 'bg-rose-600' },
]

export interface WeeklyVolume {
  week: string
  scans: number
}

// Last 8 weeks, oldest first -- same shape as types.ts's DashboardStats.weekly_volume.
export const WEEKLY_VOLUME: WeeklyVolume[] = [
  { week: 'Aug 3', scans: 61 },
  { week: 'Aug 10', scans: 74 },
  { week: 'Aug 17', scans: 68 },
  { week: 'Aug 24', scans: 89 },
  { week: 'Aug 31', scans: 96 },
  { week: 'Sep 7', scans: 103 },
  { week: 'Sep 14', scans: 118 },
  { week: 'Sep 21', scans: 127 },
]

export type ActivityKind = 'registration' | 'upload' | 'finalized' | 'approval' | 'rejection' | 'alert'

export interface ActivityEntry {
  id: string
  kind: ActivityKind
  message: string
  actor: string
  timestamp: string
}

export const ACTIVITY_LOG: ActivityEntry[] = [
  { id: 'A-9001', kind: 'finalized', message: 'Finalized report for Ramesh Kumar (PT-1001) — Moderate NPDR', actor: 'Dr. R. Sharma', timestamp: '2 mins ago' },
  { id: 'A-9000', kind: 'upload', message: 'Uploaded OD/OS scans for Priya Devi (PT-9013)', actor: 'Priya Devi (Technician)', timestamp: '6 mins ago' },
  { id: 'A-8999', kind: 'alert', message: 'High referable probability flagged for Ramesh Kumar — priority review requested', actor: 'System', timestamp: '11 mins ago' },
  { id: 'A-8998', kind: 'registration', message: 'Registered new patient Kamla Devi (PT-1042)', actor: 'Suresh Rao (Technician)', timestamp: '24 mins ago' },
  { id: 'A-8997', kind: 'finalized', message: 'Finalized report for Om Prakash (PT-1038) — No DR', actor: 'Dr. Kavita Patel', timestamp: '41 mins ago' },
  { id: 'A-8996', kind: 'rejection', message: 'Image quality check rejected scan for Anil Verma (PT-1039) — illumination too uneven', actor: 'System', timestamp: '52 mins ago' },
  { id: 'A-8995', kind: 'approval', message: 'Approved staff account for Neha Joshi (Technician)', actor: 'Admin', timestamp: '2 hours ago' },
  { id: 'A-8994', kind: 'upload', message: 'Uploaded OD/OS scans for Anil Verma (PT-1039)', actor: 'Priya Devi (Technician)', timestamp: '2 hours ago' },
  { id: 'A-8993', kind: 'finalized', message: 'Finalized report for Sunita Rao (PT-1031) — Severe NPDR (overridden by doctor)', actor: 'Dr. Arjun Nair', timestamp: '3 hours ago' },
  { id: 'A-8992', kind: 'registration', message: 'Registered new patient Om Prakash (PT-1038)', actor: 'Neha Joshi (Technician)', timestamp: '4 hours ago' },
]

export interface SystemComponent {
  name: string
  status: 'operational' | 'degraded' | 'down'
  detail: string
}

// BACKEND: real values would come from GET /health (already implemented,
// see API_ROUTES.md) plus equivalent checks for MATLAB and the AI
// pipeline, which don't have a status endpoint yet.
export const SYSTEM_STATUS: SystemComponent[] = [
  { name: 'Backend API', status: 'operational', detail: 'GET /health responding' },
  { name: 'AI Inference Pipeline', status: 'operational', detail: 'Classifier + Grad-CAM + segmentation' },
  { name: 'MATLAB Quality Check', status: 'operational', detail: 'runRetinExJSON.m' },
  { name: 'Database', status: 'operational', detail: 'MongoDB connected' },
]

export const PLATFORM_KPIS = {
  totalPatients: 1248,
  reportsGenerated: 892,
  scansToday: 47,
  activeDoctors: ACTIVE_DOCTORS.length,
  activeTechnicians: ACTIVE_TECHNICIANS.length,
  referableThisWeek: 23,
}
