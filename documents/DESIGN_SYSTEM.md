# Design System: RetinEx Glassmorphism

## Status
This supersedes the flat, shadow-card system currently sitting in
`app/src/index.css` (`.glass-card`/`.clinical-card`/`.panel` are literally
commented "converted to solid white rounded cards" — a leftover from an
earlier "clinical-instrument minimalism" pass, see the note in
`DESIGN.md`). It also supersedes the old light-glass values described in
that same CSS file's header comment, which were never actually shipped.

The system documented here is not aspirational — it's the pattern already
live and consistent across all four role portals
(`src/layouts/*Layout.tsx`, `src/pages/{admin,doctor,patient,technician}/*`):
a **dark glassmorphism** aesthetic, translucent frosted panels floating
over a deep gradient backdrop. The UI revamp's job is to bring the pages
that don't yet follow it (the shared `index.css` utility classes, and the
older Landing/Dashboard/legacy pages) up to this same standard, not invent
a new one.

## 1. Aesthetic Philosophy
Deep, saturated gradient backgrounds per role, with frosted glass panels
(`backdrop-blur` + low-opacity white fills + hairline white borders)
floating on top. Color communicates role and state at a glance; content
density and hairline structure keep it legible as a clinical tool, not
just decorative chrome.

## 2. Per-role Background Gradients
Each portal's shell (`<Layout>` root) uses its own gradient — this is the
primary way a user knows which portal they're in:
- **Technician**: `from-slate-900 via-indigo-950 to-slate-900` (indigo/violet)
- **Doctor**: `from-slate-900 via-teal-950 to-slate-900` (teal/emerald)
- **Patient**: `from-sky-800 via-blue-700 to-sky-900` (sky/blue — warmer,
  more approachable than the staff portals)
- **Admin**: `from-gray-950 via-slate-900 to-gray-950` (near-neutral,
  violet accent only)

## 3. Glass Surfaces
- **Panel fill**: `bg-white/5` (content cards) to `bg-slate-900/60` /
  `bg-sky-900/50` (sidebars/headers — tinted toward the role gradient).
- **Blur**: `backdrop-blur-xl` standard; `backdrop-blur-2xl` for elevated
  overlays (notification dropdowns, modals).
- **Border**: `border border-white/10` (`border-white/15`–`/20` on the
  patient portal and hover states) — hairline, never a heavy stroke.
- **Radius**: `rounded-xl`/`rounded-2xl` throughout — soft, not sharp.
- **Hover**: raise fill/border opacity (`hover:bg-white/10
  hover:border-white/20`) rather than adding shadow.

## 4. Accent Colors (status & role, on top of the glass)
- **Technician**: violet → indigo gradient for primary actions
  (`from-violet-500 to-indigo-600`).
- **Doctor**: emerald → teal gradient (`from-emerald-500 to-teal-600`).
- **Admin**: violet accents on a near-neutral shell.
- **Severity / status pills** (consistent across portals):
  - amber = waiting/pending
  - blue = processing/in-progress
  - emerald = done/healthy/approved
  - rose/red = rejected/high-severity/critical
  - violet = informational/AI-related

## 5. Typography
- **Headings**: bold, tight tracking, white (`text-white font-bold
  tracking-tight`).
- **Body / secondary**: muted slate (`text-slate-400`) or role-tinted
  (`text-sky-200/80` on the patient portal) for de-emphasized copy on the
  dark background.
- Font stack: Inter (body/UI) + Space Grotesk (headings) + JetBrains Mono
  (numeric/diagnostic readouts — grades, confidence scores, MRNs,
  timestamps) — already declared in `index.css`; keep using it.

## 6. Applying this consistently
When touching a page during the revamp:
1. Match its role's gradient shell and accent color from Section 2/4.
2. Replace any solid white / flat-shadow card (`bg-white`, `shadow-*` on
   a white background — the leftover "clinical-instrument" style) with a
   glass panel per Section 3.
3. Reuse `index.css`'s shared classes (`.glass-card`, `.btn-primary`,
   etc.) once they're restored to match this system, instead of
   redeclaring the same Tailwind utility string on every page.
4. Keep severity/status colors (Section 4) semantic and consistent with
   `types.ts`'s `SEVERITY_HEX`/`SEVERITY_TOKEN` — don't introduce a second
   color mapping for the same grades.
