# Core Features

## 1. Patient Registration & Live Roster (Technician)
- Quick-add a patient (name, age, phone) directly from the roster.
- Roster is organized into three live pipeline stages: Waiting for Scan,
  AI Processing, Sent to Doctor.

## 2. Scan Capture & Upload (Technician)
- Left-eye (OS) / right-eye (OD) dropzones for uploading image files
  directly (JPEG/PNG/TIFF).
- Doctor assignment at upload time, so the case lands in the right
  doctor's triage queue.

## 3. AI Diagnostic Engine
- **Severity Classification**: 5 ICDR grades (No DR → Proliferative DR)
  per eye.
- **Explainable AI (XAI)**: Grad-CAM heatmaps/overlays and 4-channel
  lesion segmentation (microaneurysms, haemorrhages, hard exudates, soft
  exudates), each with an honest per-channel confidence flag
  (`dice_unreliable`) rather than presenting every overlay as equally
  certain.
- **Referable-DR flagging**: probability + threshold-based referable
  badge, shown alongside the model's actual sensitivity/specificity so
  doctors see the caveats, not just a yes/no.
- **Image quality gate**: adequate / borderline / reject verdict from the
  MATLAB pre-check, with the AI pipeline skipped entirely on reject.

## 4. Real-time Processing Feedback
- A notification bell across all staff portals surfaces processing
  completions and other clinic events as they happen.

## 5. Clinical Review & Reporting (Doctor)
- Priority-sorted triage queue (referable/high-severity cases surfaced
  first).
- Side-by-side Grad-CAM/microaneurysm review per eye.
- Clinical notes, prescription, and dietary recommendations captured per
  visit, with an "Auto-fill Demo" shortcut for fast walkthroughs.
- Agree-with-AI or Override-grade decision, then **Finalize & Push to
  Patient**, which locks the case and surfaces it in the patient's own
  tracker.

## 6. Patient Self-Service Portal
- Phone-number + OTP login — no password to remember.
- Live status tracker: Registered → Scans Uploaded → Under Review →
  Report Ready.
- Finalized report view: medications, doctor's notes, dietary advice.
- Accessibility: text-to-speech playback of the report in multiple
  languages, and one-tap WhatsApp sharing.

## 7. Admin Oversight
- Platform-wide, non-clinical metrics (patient/report/doctor/technician
  counts).
- Staff account approval queue for new doctor/technician signups.
- **AI Insights**: platform-wide doctor-AI agreement rate and scan
  volume, aggregated across every doctor — lives in the admin panel
  rather than the doctor portal specifically because it's a cross-doctor
  metric, not any individual doctor's own performance view.
- Explicitly walled off from patient medical data, scan images, and
  clinical notes.
