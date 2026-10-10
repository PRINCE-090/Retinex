# REST API Routes

Auth is **Bearer-token based** (`Authorization: Bearer <token>`). Base URL:
`http://localhost:3000`. Tokens carry a `role`; routes below list who may
call them.

Roles: `doctor` (and legacy `reviewer`), `technician`, `admin` (staff,
email + password) and `patient` (phone number). Create the staff accounts
and a demo patient with `node backend/seedUser.js` (safe to re-run).

## Implemented (`backend/index.js`, `backend/routes/auth.js`)

### Auth
- `POST /api/auth/login` — email + password → JWT (8h) + user
  `{ id, name, email, role }`. Staff only.
- `POST /api/auth/patient/login` — `{ phone }` → patient-scoped JWT.
  **Demo stand-in: no OTP is verified.** Replace with request-otp /
  verify-otp before real use.
- `PATCH /api/auth/me` — `{ name?, email? }` (staff) — used by Settings.
- `POST /api/auth/change-password` — `{ currentPassword, newPassword }`
  (staff, min 8 chars) — used by Settings.

### Patients (clinic-wide, staff)
- `POST /api/patients` — technician / doctor / admin. `{ name, age, phone,
  gender?, diabetic_history? }`. `phone` must be a unique 10-digit number
  (it is how the patient signs in).
- `GET /api/patients` — every patient in the clinic (staff).
- `GET /api/patients/me` — the signed-in patient's own record.
- `GET /api/doctors` — `[{ id, name }]` for the "assign to doctor" picker.

### Two-eye visits
- `POST /api/visits` — technician / doctor. Multipart: **both** `image_od` and
  `image_os` (400 if either is missing), `patient_id`, optional `assigned_doctor_id`.
  Responds **`202`** as soon as the visit is accepted; the MATLAB + AI
  pipeline then runs in the background (one job at a time). The outcome is
  recorded on the visit as `processing.status`:
  `processing` → `complete` | `failed` (with a user-safe
  `processing.error`; the raw error stays in the server log). A server
  restart marks in-flight visits `failed`.
- `GET /api/visits` — role-scoped summaries (patient name/age/phone,
  per-eye quality/grade/referable, `worst_grade`, `processing_*`,
  `clinical_evaluation`):
  - technician / admin: every visit (including in-flight and failed)
  - doctor: visits assigned to them or unassigned, once analysis completed
  - patient: their own visits; AI grades are hidden until the report is
    finalized
- `GET /api/visits/:visitId` — full visit with both eyes' result objects.
  Staff: any visit. Patient: own visit, **only after it is finalized**
  (403 before).
- `PATCH /api/visits/:visitId/evaluation` — doctor / admin. `{ decision:
  'agree'|'override', override_grade?, doctor_notes?, prescription?, diet? }`
  → finalizes (409 if already finalized); signed with the doctor's name; synced onto each eye's
  `Result`.
- `GET /api/visits/:visitId/assets/:eye/:assetType` — `eye` is `od`/`os`;
  `assetType` is `original`, `enhanced`, `gradcam_heatmap`,
  `gradcam_overlay`, `microaneurysms`, `haemorrhages`, `hard_exudates`,
  `soft_exudates` or `vessels`. Same access rules as the visit itself.

### Single-image upload (legacy path, staff only)
- `POST /api/images`, `GET /api/results/:imageId`,
  `GET /api/results/:imageId/assets/:assetType` — unchanged behaviour, now
  restricted to staff roles.

### Health
- `GET /health`

## Not yet implemented

- **Patient OTP login** — see above; the current login trusts the phone
  number alone.
- **Notifications** — no endpoint or persisted store; the bell in the staff
  portals shows demo content.
- **Admin endpoints** — staff counts, approvals and analytics on the admin
  dashboards are still mock data.
- **Server-side session revocation** ("sign out of other devices") —
  tokens are stateless JWTs.
- **Patient preferences / consent / deletion requests** — stored in the
  browser only (`retinex_patient_prefs_*`); the clinic cannot see them.
- **Report generation** — remains client-side (jsPDF), embedding the fundus
  photos and Grad-CAM heatmaps fetched from the asset routes.
