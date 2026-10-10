# RetinEx — AI-Assisted Diabetic Retinopathy Screening Platform

## Overview
RetinEx is a clinic screening platform that takes a patient from walk-in
registration to a doctor-reviewed diabetic retinopathy (DR) report in
minutes, with the patient able to follow their own case in real time.

The system is built around four roles, each with its own portal:

- **Technician** — registers walk-in patients, captures/uploads left-eye
  (OS) and right-eye (OD) fundus images, and hands the case to a doctor.
- **Doctor** — reviews the AI's grade and overlays, writes the clinical
  note/prescription, and finalizes the report.
- **Patient** — logs in with their phone number to track their case status
  and, once finalized, view/listen to/share their report.
- **Admin** — manages staff accounts and views platform-level (non-clinical)
  metrics.

See `USER_FLOW.md` for the step-by-step journey through all four portals
and `UI_PAGES.md` for the full page/route map.

## Architecture
- **Frontend**: React + Vite + TypeScript (`app/`), React Router with one
  layout per role (`src/layouts/*Layout.tsx`), Tailwind CSS with a
  glassmorphism design system (`src/index.css`, `documents/DESIGN_SYSTEM.md`).
- **Backend**: Node.js/Express (`backend/`) with MongoDB (Mongoose) and
  JWT bearer-token auth. Currently implements upload, AI-pipeline
  orchestration, and doctor-facing patient/visit CRUD — **not yet** the
  technician/patient/admin-specific endpoints the new workflow needs (role
  expansion, phone/OTP login, notifications, prescriptions, doctor
  assignment, admin staff management). See `API_ROUTES.md` for exactly
  what exists vs. what's still needed, and look for `// BACKEND:` comments
  in the frontend source for where each gap lives in the code.
- **Image Quality / Localization**: MATLAB (`MATLAB/code/runRetinExJSON.m`)
  — real, wired in, produces the quality verdict (adequate/borderline/
  reject) plus optic disc and fovea coordinates.
- **AI Inference**: Python pipeline (`RetinEx-Model/`) — DR severity
  classification, Grad-CAM, lesion segmentation (4 channels), vessel
  segmentation. Real and working; see `FRONTEND_API_CONTRACT.md` for the
  exact response shape captured from a live run.
- **Database**: MongoDB — `User`, `Patient`, `Visit` (embeds one `Result`
  per eye), `Result`. See `DATABASE_SCHEMA.md`.

## Current build status (as of 2026-09-27)
- Frontend: all four role portals and their pages exist and are wired
  together via routing; most of the technician/doctor/patient/admin
  screens run on local/mock state rather than real API calls.
- Backend: single-role JWT auth, image upload + AI pipeline orchestration,
  patient create/list, and two-eye visit upload/review/finalize are real
  and working end-to-end. Everything role-specific beyond "doctor" is not
  yet implemented on the backend.

## Setup Instructions
1. Clone the repository.
2. Ensure you have Node.js, Python 3.9+, MongoDB, and MATLAB (or set
   `USE_MOCK_MATLAB=true`) installed.
3. `cd app && npm install`, `cd backend && npm install`.
4. Configure `backend/.env` (Mongo URI, `JWT_SECRET`, MATLAB/AI paths —
   see `backend/index.js` for the full list of env vars it reads).
5. Start the backend: `cd backend && node index.js` (listens on
   `http://localhost:3000`, see `/health`).
6. Start the frontend: `cd app && npm run dev` (Vite, `http://localhost:5173`).
