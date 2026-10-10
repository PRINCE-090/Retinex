# Design System: RetinEx Clinical Diagnostic Instrument

> **Superseded.** This "no glassmorphism" clinical-instrument direction
> was the design language for the earlier single-workstation prototype.
> The current four-portal build (technician/doctor/patient/admin) has
> already standardized on a dark glassmorphism system instead — see
> `documents/DESIGN_SYSTEM.md`, which documents the pattern actually in
> use across `src/layouts/*Layout.tsx` and `src/pages/**`. Kept here for
> historical reference only; do not build new UI against this file.

## 1. Aesthetic Philosophy: Clinical-Instrument Minimalism (historical)
RetinEx is an AI-assisted diabetic retinopathy screening workstation engineered for clinical trustworthiness and diagnostic precision. It reflects the visual discipline of calibrated laboratory devices, surgical patient monitors, and verified clinical diagnostic systems.

Strict aesthetic guardrails:
- No glassmorphism, no frosted glass, no backdrop filters.
- No card drop shadows, no bubbly rounded corners.
- No gradient washes, no glowing neon matrices.
- Separation via crisp 1px hairline borders in muted stone gray (#D8D4CA).
- Real medical information density: structured, scannable, calm.

## 2. Color System
- Surface Canvas: #F7F5F0 (Warm Instrument-White)
- Panel / Form Surface: #FFFFFF (Pure Clinical White)
- Primary Ink: #0A0E14 (Near-black deep ink)
- Secondary Ink / Muted Stone: #8A8578 (Lab metadata, labels, unit markers)
- Hairline Border: #D8D4CA (Neutral stone hairline 1px)
- Primary Accent: #1B4B43 (Deep clinical teal, used sparingly for active states, key actions)
- Alert / Critical Accent: #C2410C (Burnt amber, strictly reserved for Referable DR / Grade 3-4 alerts)
- Normal / Benign Accent: #2E6F40 (Clinical pine for Grade 0 None)
- Intermediate Alert: #B45309 (Muted amber for Grade 2 Moderate)

## 3. Typography & Dual-Type Family Discipline
- Monospace Instrument Readout: JetBrains Mono or IBM Plex Mono for ALL numbers, diagnostic grade numbers (e.g. GRADE 3, 0.874), patient MRN IDs (RX-2026-0842), confidence intervals, sensitivities, timestamps (2026-09-20 00:44:12).
- Grotesk Sans-Serif: Inter or standard grotesk for field labels, instructions, navigation, clinical notes, buttons.
- Hierarchy: One dominant finding per screen. The diagnostic grade is the most prominent element.
- No ALL-CAPS section titles with wide tracking. Plain title case or sentence case only.

## 4. Components & Layout Rules
- Buttons: Minimal radius (2px-4px max). Solid #1B4B43 with white text, or clean hairline bordered white buttons.
- Data Tables: Dense rows with 1px hairline bottom borders, monospace numeric columns, right-aligned numbers.
- Medical Viewer: Left canvas with calibrated retinal fundus viewport, optic disc & fovea markers, OD/OS toggle. Right panel with huge monospace grade indicator, referable probability bar, honest model sensitivity/specificity metrics, lesion checklist (high vs low confidence), and microvascular thumbnail.
- Clinical Review Panel: Notes input, Agree/Override radio toggle, and Sign & Finalize action that locks into read-only signed state.
