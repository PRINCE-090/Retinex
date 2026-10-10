# Frontend UI Pages

Four role-scoped portals, each behind its own layout and login. Route
paths below are exactly as registered in `app/src/App.tsx`.

## Public / Auth
- **Landing (`/`)** — marketing intro, links into role selection.
- **Role Selection (`/login/role-selection`)** — choose Patient / Doctor /
  Technician / Admin, routes to that role's login.
- **Patient Login (`/login/patient`)** — phone number entry → OTP.
  *Backend: not wired, see `USER_FLOW.md`.*
- **Doctor Login (`/login/doctor`)**, **Technician Login
  (`/login/technician`)**, **Admin Login (`/login/admin`)** — email +
  password. *Backend: only `POST /api/auth/login` exists today, and only
  one `User.role` value is realistically issued (`doctor`) — technician
  and admin accounts have no real auth path yet.*

## Technician Portal (`/technician`, `TechnicianLayout`)
- **Live Roster (`/technician`, `TechnicianDashboard`)** — "Add New
  Patient" drawer; three tabs — Waiting for Scan, AI Processing, Sent to
  Doctor.
- **Capture Scans (`/technician/patient/:patientId`,
  `TechnicianPatientView`)** — OD/OS upload dropzones, doctor assignment,
  Upload action.
- **History (`/technician/history`, `TechnicianHistory`)** — past patients
  this technician has processed.

## Doctor Portal (`/doctor`, `DoctorLayout`)
- **Today's Triage Queue (`/doctor`, `DoctorDashboard`)** — patients
  awaiting review, sorted by AI-flagged priority, with grade + Referable
  badge.
- **Review Screen (`/doctor/review/:visitId`, `DoctorReviewScreen`)** —
  Grad-CAM/microaneurysm overlays per eye, clinical notes, prescription,
  dietary recommendations, Auto-fill Demo, Agree/Override, Finalize &
  Push to Patient.
- **Patient Database (`/doctor/patients`, `DoctorDatabase`)** — every
  patient this doctor has seen, searchable/sortable.
- **Templates (`/doctor/templates`, `DoctorTemplates`)** — reusable note
  / prescription templates.

## Patient Portal (`/patient`, `PatientLayout`)
- **Home (`/patient`, `PatientHome`)** — live status tracker (Registered →
  Scans Uploaded → Under Review → Report Ready), language selector,
  text-to-speech status readout.
- **Scans (`/patient/scans`, `PatientScans`)** — the patient's own fundus
  images and AI overlays once available.
- **Prescriptions (`/patient/prescriptions`, `PatientPrescriptions`)** —
  medications, doctor's notes, dietary recommendations, text-to-speech
  playback, WhatsApp share.

## Admin Portal (`/admin`, `AdminLayout`)
- **Platform Overview (`/admin`, `AdminDashboard`)** — staff counts,
  pending doctor/technician account approvals, platform-wide (non-
  clinical) metrics. Explicitly excludes patient medical data. *Backend:
  entirely mock data today (`AdminDashboard.tsx`); no admin endpoints
  exist yet.*
- **AI Insights (`/admin/insights`, `AdminInsights`)** — platform-wide
  doctor-AI agreement rate and scan volume, aggregated across every
  doctor rather than scoped to one. Lives here rather than in the doctor
  portal specifically because it's a cross-doctor, platform-level metric
  — the same privacy boundary as the rest of the admin panel (aggregate
  counts only, no patient identity or clinical content). *Backend:
  entirely mock data today; needs a platform-wide aggregate endpoint, not
  the doctor-scoped `GET /api/visits`.*

## Legacy / demo-only pages (not part of the current role flow)
`Dashboard.tsx`, `Login.tsx`, and `RealVisitViewer.tsx` at the top level
of `src/pages/` predate the four-portal structure and are not routed in
the current `App.tsx`. Kept for reference against `FRONTEND_API_CONTRACT.md`
(they're the pages that were actually exercised against the real
backend); not part of the UI to revamp.
