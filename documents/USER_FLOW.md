# Primary User Flow

RetinEx has four portals — Technician, Doctor, Patient, Admin — reached
via role-specific logins from `/login/role-selection`. There is no shared
"single workstation" anymore; each staff member and patient signs in as
themselves.

## 1. Patient Arrival & Registration (Technician Portal)
- **Action**: The technician opens the Live Roster (`/technician`) and
  clicks **"Add New Patient"**.
- **Action**: Enters the patient's name, age, and phone number, then
  clicks **"Save & Add to Queue"**.
- **Result**: The patient instantly appears in the **Waiting for Scan**
  tab of the roster.
- *Backend note*: today `POST /api/patients` only accepts `name`/`age` —
  it does not store `phone`, which the OTP login step below depends on.
  See `API_ROUTES.md`.

## 2. Scan Acquisition (Technician Portal)
- **Action**: The technician clicks **Capture Scans** on a waiting
  patient, opening that patient's capture view
  (`/technician/patient/:patientId`).
- **Action**: Clicks the left-eye (OS) and right-eye (OD) dropzones to
  upload image files from disk (no camera/hardware sync).
- **Action**: Once both eyes are attached, selects the reviewing doctor
  and clicks **Upload**.
- **Result**: The patient moves from **Waiting for Scan** into the
  **AI Processing** tab.
- *Backend note*: `POST /api/visits` already accepts `image_od`/`image_os`
  and a `patient_id`, but has no concept of "assign to doctor" yet — every
  visit is only scoped to the uploading account, not routed to a chosen
  doctor's queue.

## 3. AI Processing (Background)
- **System**: The AI takes a few seconds to process both images (the
  demo pipeline is time-boxed to a fixed ~4s wait in the technician UI,
  distinct from — and currently faster than — the real MATLAB + model
  pipeline invoked by `POST /api/visits`).
- **Result**: Once processing completes, the patient automatically leaves
  the technician's pipeline and appears in the doctor's triage queue.
- **Notifications**: A real-looking alert appears in the notification bell
  (top right of every staff portal) when a case finishes processing.
  *Backend note*: notifications are currently local/simulated — there is
  no notifications endpoint or persisted store yet.

## 4. Clinical Review (Doctor Portal)
- **Action**: The doctor logs in and sees the patient in **Today's Triage
  Queue** (`/doctor`) with an AI classification (e.g. "Mild NPDR") and a
  **Referable** badge where applicable.
- **Action**: Clicks **Analyze**, opening the Review Screen
  (`/doctor/review/:visitId`).
- **Action**: Reviews the Grad-CAM / microaneurysm overlays for each eye,
  then fills in clinical notes, a prescription, and dietary
  recommendations. The **"Auto-fill Demo"** button generates this content
  instantly for demo purposes.
- **Action**: Chooses **"Agree with AI"** or **"Override Grade"**, then
  clicks **Finalize & Push to Patient**.
- *Backend note*: `PATCH /api/visits/:visitId/evaluation` already supports
  `agree`/`override` + `doctor_notes`. Prescription and dietary
  recommendation fields, and the "push to patient" notification step, are
  not yet part of that payload or the `Visit`/`Result` schema — see
  `DATABASE_SCHEMA.md`.

## 5. Patient App (Patient Portal)
- **Action**: The patient goes to `/login/patient` and enters their
  registered phone number. If the number exists, they receive an OTP and
  log in.
  *Backend note*: there is no phone-based/OTP auth endpoint yet — the only
  auth route today is `POST /api/auth/login` (email + password, for
  staff). This is the single biggest missing piece for the patient portal
  to go live. See `API_ROUTES.md`.
- **Result**: The Patient Home (`/patient`) shows a live tracker:
  **Registered → Scans Uploaded → Under Review → Report Ready**, driven by
  the same visit status the technician/doctor portals move the case
  through.
- **Action**: Once the doctor has pushed the final report, the patient
  opens the **Prescriptions** tab (`/patient/prescriptions`) to view
  medications and the doctor's notes, listen to them via text-to-speech,
  or share the report on WhatsApp.
  *Backend note*: none of this is backed by a real endpoint yet — there is
  no patient-facing "my visit status" or "my prescription" route; the
  patient portal currently reads entirely from local/mock state
  (`WorkflowContext`). WhatsApp share and text-to-speech are both
  client-side only (`window.speechSynthesis` / `wa.me` links) and need no
  backend, but the content they read from does.
