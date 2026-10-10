# RetinEx — Frontend, UI/UX & Reporting Lead: Complete Starting Plan

**Written by:** AI/DL & Explainability Lead
**Purpose:** Everything you need to start building today, reflecting where the
project actually stands right now — not the original handoff, which is now
partially outdated by real progress since.

---

## 1. Project context (quick recap)

RetinEx is an AI-assisted diabetic retinopathy screening system (SIH 2026).
Five roles: AI/DL (classifier, segmentation, Grad-CAM, calibration — me),
Image Processing/CV (MATLAB: quality assessment, enhancement, optic disc/fovea
localization), MATLAB/Simulink (deployment simulation, separate from the CV
work), Backend (API/DB/auth), and **you** (dashboard, overlays, reports,
doctor review interface).

**Your job:** turn the AI/CV pipeline's output into something a doctor can look
at, trust, and validate in under 30 seconds (the problem statement's explicit
target).

**Recommended stack (unless you have a strong reason otherwise):** React —
fastest to a working demo UI, and the reasoning below assumes it, though
nothing here is React-specific in substance.

---

## 2. Current real status of every other piece (as of now)

This matters because it tells you what's real data vs. what you'll be building
against placeholders for a while longer.

| Component | Status |
|---|---|
| DR classifier (grade + referable probability) | **Real, working.** 87.5% sensitivity / 76.9% specificity on official test set — below the 90%/85% clinical target, openly documented, not hidden. |
| Calibration | **Real, working.** Temperature-scaled confidence. |
| Grad-CAM | **Real, working.** Heatmap + overlay images generated per image. |
| Lesion segmentation (4 channels) | **Real, working, uneven quality.** Hard Exudates reliable; Microaneurysms/Haemorrhages/Soft Exudates flagged unreliable. |
| Vessel segmentation | **Real, working.** 0.74 validation Dice — your best segmentation result of any kind. |
| Unified AI pipeline | **Real, working.** One script produces one complete JSON result per image, verified on multiple real images. |
| Image Quality Assessment (MATLAB) | **Real, working.** Blur, illumination, FOV checks + adequate/borderline/reject decision + enhancement, tested on real images with actual numbers. |
| Optic disc / fovea localization (MATLAB) | **Real, working.** Real pixel coordinates on real test images. |
| MATLAB→Python integration | **Decided, not yet wired up.** MATLAB will hand off an image file + JSON (quality decision, reject reason, disc/fovea coordinates) — not a pre-processed tensor. |
| Backend | **Partially built.** Upload endpoint and a mocked/real result endpoint exist; auth and the full MATLAB/Python integration are still in progress. |
| Demo machine setup | **Decided:** everything (MATLAB, Backend, Python) will run on one machine for the actual demo. You don't need to worry about this — you'll just call Backend's API regardless of what's behind it. |

**What this means for you:** the schema below is not speculative — most of it reflects real, already-produced data. You can ask Backend for a real example response today, not a hypothetical one.

---

## 3. The contract: the shared JSON schema

This is what Backend's API returns, and what you build your entire UI against.
Do not build against the model or MATLAB output directly — always go through
this shape.

```json
{
  "schema_version": "1.0",
  "image_id": "IDRiD_055",
  "processed_at": "2026-09-17T18:10:37.345106+00:00",

  "pipeline_status": {
    "image_quality_assessment": "implemented",
    "classification": "implemented",
    "grad_cam": "implemented",
    "lesion_segmentation": "implemented_low_confidence",
    "vessel_segmentation": "implemented",
    "optic_disc_localization": "implemented",
    "fovea_localization": "implemented",
    "neovascularization_detection": "not_implemented"
  },

  "image_quality": {
    "status": "implemented",
    "quality": "adequate",
    "reject_reason": null,
    "enhanced_image_path": null,
    "source_image_path": "output/IDRiD_055.jpg"
  },

  "classification": {
    "grade": 1,
    "grade_name": "Mild NPDR",
    "grade_probabilities_raw": [0.29, 0.39, 0.22, 0.07, 0.04],
    "grade_probabilities_calibrated": [0.29, 0.40, 0.21, 0.06, 0.03],
    "calibration": {
      "temperature": 0.904,
      "fitted_on": "validation",
      "note": "Validation ECE improved (0.1073->0.0934); held-out test ECE slightly worsened (0.0751->0.0802)."
    },
    "referable": {
      "probability": 0.359,
      "threshold": 0.48,
      "threshold_source": "validation",
      "is_referable": false,
      "known_performance": {
        "official_test_sensitivity": 0.875,
        "official_test_specificity": 0.769,
        "official_test_auc": 0.915,
        "target_sensitivity": 0.90,
        "target_specificity": 0.85,
        "meets_target": false
      }
    }
  },

  "grad_cam": {
    "target_grade": 1,
    "heatmap_path": "runs/pipeline_test/IDRiD_055_gradcam_heatmap.png",
    "overlay_path": "runs/pipeline_test/IDRiD_055_gradcam_overlay.png",
    "crop_region": {
      "note": "CAM/heatmap only covers this square region of the ORIGINAL image.",
      "left": 720, "top": 0, "side": 2848,
      "original_width": 4288, "original_height": 2848
    },
    "lesion_overlap_validated": true
  },

  "lesion_segmentation": {
    "model_img_size": 512,
    "channels": {
      "microaneurysms": {
        "mask_path": "runs/pipeline_test/IDRiD_055_lesion_MA.png",
        "val_dice": 0.278, "dice_unreliable": true
      },
      "haemorrhages": {
        "mask_path": "runs/pipeline_test/IDRiD_055_lesion_HE.png",
        "val_dice": 0.255, "dice_unreliable": true
      },
      "hard_exudates": {
        "mask_path": "runs/pipeline_test/IDRiD_055_lesion_EX.png",
        "val_dice": 0.523, "dice_unreliable": false
      },
      "soft_exudates": {
        "mask_path": "runs/pipeline_test/IDRiD_055_lesion_SE.png",
        "val_dice": 0.153, "dice_unreliable": true
      }
    }
  },

  "vessel_segmentation": {
    "status": "implemented",
    "mask_path": "runs/pipeline_test/IDRiD_055_vessel_mask.png"
  },

  "optic_disc": {
    "status": "implemented",
    "location": { "x": 1131.7, "y": 514.8, "radius": 64 }
  },
  "fovea": {
    "status": "implemented",
    "location": { "x": 668, "y": 523, "score": 0.9784 }
  },
  "neovascularization": { "status": "not_implemented", "detected": null }
}
```

**Note on paths:** all file paths in this schema are forward-slash/POSIX
format regardless of the OS that generated them — don't write path-splitting
logic that assumes backslashes.

**Grade scale:** 0 = No DR, 1 = Mild NPDR, 2 = Moderate NPDR, 3 = Severe NPDR,
4 = Proliferative DR.

---

## 4. Two things you must get right — not optional polish

### A. Grad-CAM overlay alignment

If you render the heatmap over the ORIGINAL full-resolution image (not the
pre-cropped square the model actually saw), you must use `crop_region` to
place it correctly:

```json
"crop_region": { "left": 720, "top": 0, "side": 2848,
                  "original_width": 4288, "original_height": 2848 }
```

The heatmap only covers a `side × side` square starting at pixel
`(left, top)` of the original image — scale it to `side × side` and place it
at that exact offset. Do **not** stretch it to cover the full
`original_width × original_height` rectangle. This exact bug was found and
fixed once already on the AI side (an earlier CAM/lesion-mask comparison was
stretching the CAM over the wrong region) — avoid reintroducing it here.

### B. Show uncertainty, don't hide it

Several pieces of AI output are genuinely not reliable enough to present as
confident findings. This is a design requirement, not a caveat to bury in a
tooltip:

- `classification.referable.known_performance.meets_target` is `false` right
  now — show the model's actual sensitivity/specificity (87.5%/76.9%)
  somewhere visible near the referable-DR result, not just a bare
  "referable: yes/no."
- `lesion_segmentation.channels.*.dice_unreliable` — when `true` (currently
  Microaneurysms, Haemorrhages, Soft Exudates), that lesion's overlay should
  visually read as lower-confidence (muted color, a caption flag) — not as
  certain as Hard Exudates, which is the one reliable channel.
- Any `pipeline_status` field reading `not_implemented` (currently just
  neovascularization) should render as a clearly disabled/greyed-out panel,
  not blank space that looks broken.

---

## 5. Real assets to build against today

Ask me (or check with Backend) for:
- A real, complete example `_result.json` (several already exist — e.g. for
  IDRiD_055, IDRiD_060, IDRiD_070) — build against genuine data, not a
  hand-typed mock.
- Real generated PNGs: Grad-CAM heatmaps/overlays, all 4 lesion masks, and a
  vessel mask — these exist and can be sent directly so you're not guessing
  at image dimensions or format.

---

## 6. What Backend already has, so you know what to actually call

- `POST /api/images` — image upload (returns an `image_id`)
- `GET /api/results/:imageId` — returns the full schema above for that image
  (currently backed by a mock generator that seeds a DB record on first
  request; will be backed by the real pipeline once MATLAB/Python
  integration is wired up — **the response shape does not change either way**)
- Auth is not built yet — don't block your UI work on it; build the
  doctor-review views assuming a logged-in user for now.

---

## 7. Suggested build order

1. **Render the real example JSON** — grade, referable probability, and the
   sensitivity/specificity caveat from Section 4B. Get something real-looking
   on screen before touching any images.
2. **Fundus image + Grad-CAM overlay**, implementing the `crop_region`-aware
   alignment from Section 4A — this is the part most likely to go subtly
   wrong, so get it right and verify it visually early.
3. **Lesion segmentation overlays**, with the `dice_unreliable` visual
   distinction (Hard Exudates confident, MA/HE/SE lower-confidence).
4. **Vessel mask overlay** — same pattern, no uncertainty flag needed here
   since vessel segmentation doesn't carry a `dice_unreliable` field (0.74
   Dice, your most reliable segmentation output).
5. **Optic disc + fovea markers** — plot `optic_disc.location` as a circle
   (`x`, `y`, `radius`) and `fovea.location` as a point (`x`, `y`), both in
   original-image coordinates — same coordinate space as `crop_region`, so
   reuse whatever alignment logic you built in step 2.
6. **Image-quality states** — adequate (pass through), borderline (show
   enhanced image + note it was enhanced), reject (show `reject_reason`,
   prompt recapture) — all three states are real and testable now.
7. **"Not yet available" panel** for neovascularization — the only field
   still genuinely unimplemented.
8. **Doctor review interface + automated report layout** — the actual
   under-30-seconds validation view, pulling together everything above.

---

## 8. One thing not your problem

The cross-machine deployment question (MATLAB/Backend/Python on separate
laptops) has been resolved — the team is running everything on a single
machine for the demo. This has zero effect on your work: you only ever talk
to Backend's API, and that contract doesn't change regardless of what's
running behind it.
