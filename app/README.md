# Retinex — DR Screening Workstation (Prototype)

Frontend-only prototype for the AI-assisted diabetic retinopathy screening
system described in the root `../*.md` docs. All data is synthetic and hard-coded
in `src/data/mockDb.ts`; the mock API layer in `src/api/client.ts` returns the
exact shapes from `../API_ROUTES.md`, so a real backend drops in by setting
`VITE_API_BASE` — no component changes.

No login/accounts — this is a single-workstation prototype, not a multi-user app.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # tsc -b + vite build
```

## Stack

React 19 + TypeScript + Vite · Tailwind CSS · react-router-dom ·
Three.js via @react-three/fiber + @react-three/drei · lucide-react.
`@/*` is aliased to `src/*`.

## Design direction (selected)

| Decision | Choice |
|---|---|
| UI direction | **Clinical Swiss** — navy `#0F3D6E`, white surfaces, 1px hairline borders, mono for MRNs/scan IDs |
| 3D eye | **Anatomical cutaway** — wedge-clipped eyeball, lesion pins colour-coded by type |
| Diagnostic viewer | **Synced triptych** — fundus ↔ 3D eye ↔ findings list share hover/selection state |
| Review queue | **Sortable data table** — every patient, with their latest scan status |
| Dashboard | Command-centre (upload, KPIs + weekly volume + severity mix + queue preview) |
| Nav | Collapsible left icon+label sidebar |
| Theme | Light only — no dark mode, no toggle (`DESIGN_SYSTEM.md`) |

## Structure

| Path | Purpose |
|---|---|
| `src/pages/Landing.tsx` | Marketing intro + "Open workstation" |
| `src/pages/Dashboard.tsx` | Upload-scan form, KPIs, weekly-volume + severity charts, queue preview, activity feed |
| `src/pages/Queue.tsx` | Every patient with their latest scan — sortable, filterable by status |
| `src/pages/DiagnosticViewer.tsx` | The core clinical view — triptych + sign/finalize/report bar |
| `src/components/eye/` | R3F scene — procedural cutaway eyeball + lesion pins |
| `src/components/Fundus.tsx` | Procedural fundus photo + lesion overlay + Grad-CAM toggle + zoom |
| `src/lib/retinaMap.ts` | Maps normalized fundus (x,y) → 3D point on the retinal cup |
| `src/lib/fundusCanvas.ts` | Deterministic procedural fundus/Grad-CAM renderer (no image assets) |
| `src/api/client.ts` | Mock API — one function per documented endpoint |

## Prototype notes

- **The 3D eye is procedural geometry**, not a `.glb` — a sphere with an
  anterior-temporal wedge removed by a Three.js clipping plane, an inner retinal
  cup, optic disc, fovea, lens, iris and cornea. Lesion positions come from
  `AIResult.lesions[]` (normalized fundus coords) and are projected onto the cup
  by `retinaMap.ts`. Swap in a real model by replacing `EyeModel.tsx` only.
- **Fundus + Grad-CAM images are generated at render time** from a seed
  (`fundusCanvas.ts`) — vasculature, optic disc, macula, saliency wash. The
  `fundus_url` / `gradcam_url` fields carry `procedural:<seed>` so a real
  object-store URL slots straight in.
- Triptych sync: `activeLesionId` / `hoveredLesionId` live in
  `DiagnosticViewer` and are threaded to both the fundus SVG overlay and the R3F
  pins — hover a finding row, its pin pulses and its fundus ring thickens.
- "Sign & finalize" writes a `ClinicalNote` via the mock API and locks the form.
  "Report" opens a print-ready window (browser "Save as PDF" produces the export).
- Deep link: `/scans/s-1042` (proliferative, both eyes).
