# Project Roadmap

## Phase 1: MVP & Core AI Model (Months 1-3) — mostly done
- Collect and sanitize a dataset of 50,000+ labeled retinal fundus images (e.g., Kaggle APTOS 2019 dataset). ✅
- Train, validate, and test the CNN model. Real, working: 87.5% sensitivity / 76.9% specificity on the official test set — below the 90%/85% target, documented openly rather than hidden (see `FRONTEND_API_CONTRACT.md`).
- Develop the core REST APIs for image upload and inference. ✅ (`POST /api/images`, `POST /api/visits`, `GET /api/results/:imageId`, `GET /api/visits*` — see `API_ROUTES.md`)
- Build a basic React dashboard for single-image uploads and result viewing. ✅ (superseded by the four-portal UI below)

## Phase 1.5: Four-portal workflow (current focus)
- Frontend: technician/doctor/patient/admin portals built out (routing,
  layouts, pages) around the workflow in `USER_FLOW.md`, on a
  glassmorphism design system (`DESIGN_SYSTEM.md`).
- Backend: still only supports the doctor-facing slice of this
  (single-role auth, name/age patients, two-eye visit upload + finalize).
  Next up, in rough priority order (see `API_ROUTES.md` for detail):
  1. Patient `phone` field + phone/OTP login.
  2. Technician and Admin roles/auth.
  3. Doctor assignment on visit upload, and a queue scoped to it.
  4. Visit status field for the patient's live tracker.
  5. Prescription / dietary-recommendation fields on `clinical_evaluation`.
  6. Notifications (persisted, not just simulated in the frontend).
  7. Admin endpoints (staff approval, platform metrics).

## Phase 2: Clinical Workflow Integration (Months 4-6)
- Patient Management and longitudinal tracking — partially done (`Patient`,
  `Visit` models exist; longitudinal history views are frontend-only so far).
- RBAC (Role-Based Access Control) authentication — in progress, see Phase 1.5.
- Report generation module (PDF export) — not started; the patient
  portal's WhatsApp share / text-to-speech cover a different need
  (accessibility/reach) and don't replace this.
- Pilot testing with 2-3 partner clinics to gather UX feedback on the workflow.

## Phase 3: Explainability and Performance (Months 7-9)
- Integrate Grad-CAM/Saliency maps to visually explain AI decisions to doctors.
- Optimize the inference engine using TensorRT for faster cloud processing.
- Add DICOM file format support and basic PACS integration capability.

## Phase 4: Compliance & Scale (Months 10-12)
- Undergo third-party HIPAA and GDPR compliance audits.
- Begin the FDA Software as a Medical Device (SaMD) 510(k) clearance application process.
- Implement multi-tenant architecture for scaling to enterprise hospital networks.
