# Database Schema

MongoDB via Mongoose. This reflects the actual schemas in
`backend/models/*.js` — not a hypothetical design.

## User (`backend/models/User.js`)
- `_id` (ObjectId)
- `name` (String)
- `email` (String, unique, lowercased)
- `password` (String, bcrypt hash)
- `role` (Enum: `doctor`, `reviewer` — **does not yet include**
  `technician`, `admin`, or a distinct patient role)
- `createdAt` / `updatedAt` (timestamps)

## Patient (`backend/models/Patient.js`)
- `patient_id` (String, UUID, unique — not a Mongo ObjectId)
- `user_id` (ObjectId → User) — the account that created this patient
- `name` (String)
- `age` (Number)
- `created_at` (Date)
- **Missing for the current workflow**: `phone` (technician collects it
  at registration; patient login needs it).

## Visit (`backend/models/Visit.js`)
Two-eye visit — the current unit of work for the technician→doctor flow.
- `visit_id` (String, UUID, unique)
- `patient_id` (String, matches `Patient.patient_id`; joined manually in
  route handlers, not a Mongoose `ref`)
- `user_id` (ObjectId → User) — the uploading account
- `created_at` (Date)
- `od` / `os` (each an embedded `Result` sub-schema, independently
  nullable — a visit can have only one eye captured)
- `clinical_evaluation`:
  - `status` (Enum: `pending`, `finalized`)
  - `decision` (Enum: `agree`, `override`, `null`)
  - `override_grade` (Number, 0–4, when overriding)
  - `doctor_notes` (String)
  - `finalized_at` (Date)
  - `finalized_by` (String — doctor's email/identifier)
- **Missing for the current workflow**:
  - `assigned_doctor_id` — which doctor this visit is routed to.
  - `status` (or an equivalent computed field) for the patient tracker's
    `registered / scans_uploaded / under_review / report_ready` stages.
  - Prescription fields (medications, dosage/instructions) and a dietary
    recommendations field on `clinical_evaluation`.

## Result (`backend/models/Result.js`)
The AI pipeline's output for one image, `schema_version: "1.0"`. Used
standalone (legacy `POST /api/images` path) and embedded twice per `Visit`
(as `od`/`os`).
- `schema_version`, `image_id` (unique), `user_id`, `processed_at`
- `pipeline_status` — per-stage `implemented` / `not_implemented` /
  `implemented_low_confidence` flags (quality, classification, Grad-CAM,
  lesion segmentation, vessel segmentation, optic disc/fovea
  localization, neovascularization).
- `image_quality` — `quality` (`adequate`/`borderline`/`reject`),
  `reject_reason`, `enhanced_image_path`.
- `classification` — `grade` (0–4), `grade_name`, raw + calibrated grade
  probabilities, `calibration` metadata, `referable` (probability,
  threshold, `is_referable`, `known_performance` sensitivity/specificity).
- `grad_cam` — heatmap/overlay paths, `crop_region` (for aligning the
  overlay onto the original image), `lesion_overlap_validated`.
- `lesion_segmentation` — `model_img_size`, and per-channel
  (microaneurysms, haemorrhages, hard exudates, soft exudates) mask path,
  `val_dice`, `dice_unreliable`.
- `vessel_segmentation` — mask path.
- `optic_disc` / `fovea` — pixel location (+ radius / detection score).
- `neovascularization` — currently always `not_implemented`.
- `clinical_evaluation` — same shape as `Visit.clinical_evaluation`,
  synced here when a visit finalizes so a `Result` read in isolation still
  reflects the doctor's decision.

All `*_path` fields are **server filesystem paths, not URLs** — always
fetch assets through `GET /api/results/:imageId/assets/:assetType` (or the
visit equivalent), never by using the path directly as an `<img src>`.

## Not yet modeled — needed for the full workflow
- **Notifications** — no collection; the notification bell is local/
  simulated on the frontend only.
- **OTP sessions** — no collection for issuing/verifying patient phone
  OTPs.
- **Admin staff-approval state** — `AdminDashboard.tsx`'s pending-approval
  list has no backing collection; today it's a hardcoded array.
