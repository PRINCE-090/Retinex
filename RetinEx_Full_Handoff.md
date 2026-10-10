# RetinEx — Full Project Status Handoff

**Purpose:** if the current session's context runs out, paste this entire
document into a new session so work can continue without re-explaining
the whole project.

---

## 1. What this project is

RetinEx — an AI-assisted diabetic retinopathy screening system, built for
Smart India Hackathon 2026. Three technical pieces:
- **MATLAB**: image quality assessment (blur/illumination/FOV),
  enhancement, optic disc/fovea localization
- **Python (PyTorch)**: the actual AI — EfficientNet-B0 classifier (DR
  grade + referable-DR probability), U-Net lesion segmentation (4
  channels), U-Net vessel segmentation, Grad-CAM explainability,
  temperature calibration
- **Node.js/Express/MongoDB backend + React frontend**: ties it together
  into a working clinical app

Repo location on the current working machine: `D:\Retinex\`

## 2. Model performance (for context, not currently changeable)

- Referable-DR (grade ≥2): sensitivity 85.9%, specificity 82.1%, AUC
  0.920 on official IDRiD test set — below the 90%/85% clinical target,
  openly documented, not hidden. Current checkpoint:
  `RetinEx-Model/runs/classifier_final/best.pt`
- Lesion segmentation: mean Dice 0.30 (Hard Exudates 0.52 reliable, the
  other 3 channels flagged `dice_unreliable: true`)
- Vessel segmentation: 0.74 Dice (strongest result)
- Calibration is currently a deliberate no-op (`temperature: 1.0`) —
  the old fitted temperature doesn't transfer to this retrained
  checkpoint; refitting properly is a known, deferred task

## 3. Backend — fully built and working

Key files: `backend/index.js`, `backend/models/{Result,Visit,Patient}.js`,
`backend/middleware/upload.js`

- **Auth**: `POST /api/auth/login` (JWT), seeded test user
  `doctor@retinex.com` / `RetinEx@2026`
- **Patient**: `POST /api/patients`, `GET /api/patients` — patient_id
  (UUID), name, age, user_id, created_at
- **Visit** (the real, current upload flow — two-eye capable):
  `POST /api/visits` — accepts `patient_id` + `image_od`/`image_os`
  (at least one required) → runs MATLAB quality check then the Python AI
  pipeline for each provided eye, SEQUENTIALLY (not parallel — MATLAB
  concurrent-session support unconfirmed) → saves one Visit doc with
  `od`/`os` sub-results (each independently nullable)
  `GET /api/visits/:visitId` — full visit detail
  `GET /api/visits` — list, joined with patient name/age, includes a
  computed `worst_grade` for severity sorting (Review Queue data source)
  `GET /api/visits/:visitId/assets/:eye/:assetType` — serves real PNG
  assets (gradcam_heatmap, gradcam_overlay, microaneurysms, haemorrhages,
  hard_exudates, soft_exudates, vessels — 7 types per eye)
- **Legacy single-image route** (`POST /api/images`,
  `GET /api/results/:imageId`) still exists and works, but is NO LONGER
  used by the frontend — superseded by Visit. Not deleted, just unused.
- **MATLAB invocation**: real, wired in (`USE_MOCK_MATLAB=false`),
  `MATLAB/code/runRetinExJSON.m` is the wrapper, contract:
  `{quality, reject_reason, image_path, optic_disc:{x,y,radius},
  fovea:{x,y,score}}`

### Known backend bugs already found and fixed (don't reintroduce)
- `prepareAIImage()` was a dead call in `processRetinalImage.m` — removed
- Python's output filename derives from image basename, which differs for
  MATLAB-enhanced images (`<id>_enhanced`) — backend globs for
  `*_result.json` with zero/multiple-match guards, doesn't assume exact
  filename
- `aiResult.image_id` must be force-set to `req.imageId` before saving —
  Python's returned `image_id` can carry the `_enhanced` suffix; saving it
  as-is silently corrupts the document's own lookup key (this was a real,
  serious bug, caught late — re-verify this pattern if touching save logic)
- Reject-only saves build a fresh literal object (never touch
  Python/MATLAB naming), so they're not at risk of the same bug

## 4. Frontend — recently consolidated to ONE real app

Location: `app/src/`

**Current state (as of this session):** the entire mock demo layer was
DELETED. There is now exactly one real path:
- `Landing.tsx` — ONE button, "Open Workstation" → `/login` if not
  authenticated, `/dashboard` if authenticated
- `Login.tsx` — real login, stores JWT via `lib/auth.ts`
- `Dashboard.tsx` — the single real screen:
  - Review Queue: real data from `GET /api/visits`, patient
    name/age/worst-severity/upload time, click a row → `/visits/:visitId`
  - Combined patient+upload form: name + age + OD/OS file inputs in ONE
    form. On submit: `POST /api/patients` then `POST /api/visits` as one
    action, one loading state covering both
- `/visits/:visitId` (component — check exact filename, likely
  `RealVisitViewer.tsx`) — shows real Grad-CAM overlay + correctly
  positioned optic-disc/fovea markers (uses `crop_region` math — the
  overlay is a resized center-crop of the original, NOT the full photo;
  marker positioning must correct for `crop_region.left/top/side`, this
  was a previously-fixed bug, don't regress it), OD/OS toggle (disabled
  side if that eye has no data, not hidden/broken), all 4 lesion masks
  with reliable/unreliable visual distinction, vessel mask,
  grade/referable/`known_performance` numbers

### Deleted this session (confirmed dead, do not try to restore blindly)
`Fundus.tsx` (procedural mock canvas renderer), `data/mockDb.ts`,
`api/client.ts`, `pages/RealDiagnosticViewer.tsx`, `lib/history.ts`,
`components/ui/Charts.tsx`, `pages/RealUpload.tsx`,
`pages/RealVisitUpload.tsx`, `pages/DiagnosticViewer.tsx` (old mock/real
split viewer — fully removed, route gone), `lib/report.ts`,
`components/ui/HoldButton.tsx`+`.css`, `components/ui/ConfidenceBar.tsx`,
`components/eye/EyeViewer.tsx`+`EyeModel.tsx`+`LesionPin.tsx`+
`lib/eyeGeometry.ts`+`lib/eyeTextures.ts` (3D lesion map, entirely removed)

### KNOWN GAPS — features that existed in the old mock UI and were
### NOT rebuilt for real data (this is the open work right now)
- **No clinical notes field** — existed in the old mock Finalization bar,
  deleted, never rebuilt against real Visit data
- **No "Agree/Override" AI-concordance button** — same, deleted with the
  mock Finalization bar, not rebuilt
- **No "Sign & finalize" action** — same
- **No report generation** (`lib/report.ts`'s `generateReport` was
  deleted) — same
- **No visible/working sign-out button** — `Header.tsx` never had real
  sign-out logic; it previously showed a role badge from `mockDb.ts`
  which was removed (fabricated data, correctly not replaced with fake
  data) — sign-out needs to be built from scratch using `lib/auth.ts`'s
  token-clearing function

These four+one items are real, deliberate scope cuts from the mock→real
consolidation, not oversights hidden by mistake — they need a decision:
rebuild against real data (would need backend support for clinical
notes/sign-off, which does NOT currently exist as a Visit field), or
consciously leave out for the demo.

## 5. Just-started work (this session)

A UI visual redesign was requested — the interface was functional but
visually generic/templated. A specific design system was specced
(clinical-instrument palette: `#F7F5F0` bg, `#0A0E14` ink,
`#1B4B43` teal accent, `#C2410C` amber alert-only accent; monospace for
data/numbers, grotesk sans for everything else; hairline borders over
card-shadows; one dominant element per screen) to be applied across
Login, Dashboard, and the Visit result view — presentation-only, no logic
changes. Status of this: PROBABLY IN PROGRESS OR JUST COMPLETED — check
the most recent Claude Code output in the active session for the actual
result/screenshots before doing anything else.

## 6. How to run everything

```
Terminal 1: cd backend && node index.js
Terminal 2: cd app && npm run dev
```
Backend: `http://localhost:3000` (health check: `GET /health`)
Frontend: `http://localhost:5173`
Test login: `doctor@retinex.com` / `RetinEx@2026`

## 7. Git state

Last known clean commit message: "Consolidate to single real app: Patient
concept, unified Open Workstation flow, full mock/dead-code removal" —
run `git log --oneline -10` in a new session to confirm current HEAD and
whether the UI redesign (section 5) has been committed yet.

## 8. Working style established throughout this project (for whoever
### picks this up)

- Every change goes through Claude Code with an explicit, scoped prompt
- Every claim gets verified with real evidence (real curl/Playwright
  tests, real file reads, real log checks) — not "should work"
- Before big changes: check `git status`, clean any test/scratch debris,
  confirm clean diff, THEN commit as a restore point
- When something is ambiguous or risky, Claude Code has been instructed
  to STOP and ask rather than guess — continue enforcing this
- Additive-first: prefer new files/routes alongside existing working
  code over modifying working code in place, when there's a choice
