# Product Requirements Document (PRD)

## 1. Objective
Deliver a secure, role-based clinic workflow that takes a patient from
walk-in registration to a doctor-signed diabetic retinopathy (DR) report,
with AI-assisted triage speeding up review and the patient able to follow
their own case end to end.

## 2. Target Audience / Roles
- **Technicians**: register patients and capture/upload fundus images at
  the point of care.
- **Ophthalmologists / Doctors**: review AI-flagged cases, confirm or
  override the grade, and issue the clinical report.
- **Patients**: track their own case status and receive their finalized
  report without a clinic visit.
- **Admins**: manage staff accounts and monitor platform-level activity,
  with no access to clinical data.

## 3. Problem Statement
Diabetic Retinopathy is a leading cause of preventable blindness. Manual
screening is slow and specialist-bottlenecked, and patients are often left
without visibility into where their case stands between capture and
diagnosis. RetinEx addresses both: AI triage speeds up the doctor's
review, and a patient portal closes the visibility gap.

## 4. Key Functional Requirements
- **Patient registration**: technician-entered name, age, and phone
  number, instantly queued for scanning.
- **Scan capture**: per-eye (OD/OS) image upload with doctor assignment.
- **AI analysis**: severity grading, referable-DR flagging, Grad-CAM and
  lesion/vessel segmentation overlays, image-quality gating.
- **Clinical review**: doctor-facing queue sorted by AI priority, per-eye
  overlay review, notes/prescription/dietary-recommendation capture,
  agree/override decision, and finalize-and-push-to-patient.
- **Patient tracking & reporting**: phone/OTP login, live status tracker,
  finalized report view with text-to-speech and WhatsApp sharing.
- **Admin oversight**: staff account approval and platform-level
  (non-clinical) metrics.
- **Notifications**: real-time alerts to staff as cases move through the
  pipeline.

## 5. Non-Functional Requirements
- **Performance**: AI inference should complete fast enough that a
  technician can hand off a case and move to the next patient without a
  meaningful wait (demo target: a few seconds per visit).
- **Compliance**: patient data handling should be built with HIPAA/GDPR-
  style principles in mind (least-privilege role access — the admin wall
  in particular — and phone numbers/OTPs treated as sensitive).
- **Reliability**: a case's status must never be ambiguous between the
  technician, doctor, and patient views — all three read the same
  underlying visit state.

## 6. Known Gaps (see `API_ROUTES.md` / `DATABASE_SCHEMA.md`)
The backend currently only supports the doctor-facing slice of this flow
(single-role JWT auth, patient name/age, two-eye visit upload and
finalize). Phone/OTP patient auth, technician/admin roles, doctor
assignment, notifications, and prescription/dietary-recommendation
storage are not yet implemented — the frontend for all of these exists
and currently runs on local/mock state pending that backend work.
