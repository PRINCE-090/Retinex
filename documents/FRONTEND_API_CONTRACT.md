# RetinEx Backend API Contract (Frontend Integration)

Everything in this document was captured from a real, running local backend
on 2026-09-19 — every JSON block below is an actual response, not a
hypothetical example. Build against this now; the **response shape is
final**, including the `image_quality` / `optic_disc` / `fovea` blocks,
even though those are currently produced by a mock (see the note at the
bottom).

## Base URL

```
http://localhost:3000
```

Start command: `node index.js` from `backend/` (see "Keeping the server up"
at the bottom).

## CORS

The backend allows cross-origin requests from these dev origins (configured
in `backend/index.js` via the `cors` package):

```
http://localhost:5173   (Vite default — confirmed this is what `npm run dev` in app/ actually binds to)
http://127.0.0.1:5173
http://localhost:5174   (fallback if 5173 is taken)
http://127.0.0.1:5174
http://localhost:4173   (`vite preview`)
http://127.0.0.1:4173
```

Auth is **Bearer-token based** (sent in the `Authorization` header), not
cookie-based, so `credentials: true` / `Access-Control-Allow-Credentials`
is **not needed** — standard `Access-Control-Allow-Origin` plus the `cors`
package's automatic reflection of `Access-Control-Allow-Headers` (which
covers `Authorization` and `Content-Type` on preflight) is sufficient.
Verified directly:

```
$ curl -i -X OPTIONS http://localhost:3000/api/images \
    -H "Origin: http://localhost:5173" \
    -H "Access-Control-Request-Method: POST" \
    -H "Access-Control-Request-Headers: Authorization, Content-Type"

HTTP/1.1 204 No Content
Access-Control-Allow-Origin: http://localhost:5173
Access-Control-Allow-Methods: GET,HEAD,PUT,PATCH,POST,DELETE
Access-Control-Allow-Headers: Authorization, Content-Type
```

If the frontend ever runs on a different port, add it to `ALLOWED_ORIGINS`
in `backend/index.js`.

## Authentication

### `POST /api/auth/login`

Request body:
```json
{
  "email": "doctor@retinex.com",
  "password": "RetinEx@2026"
}
```

Real response (`200`):
```json
{
    "success": true,
    "message": "Login successful",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2YWFlNjAxNzZiZDc1Y2ZmM2ViMzE0YTYiLCJlbWFpbCI6ImRvY3RvckByZXRpbmV4LmNvbSIsInJvbGUiOiJkb2N0b3IiLCJpYXQiOjE3ODk4MTk5NzUsImV4cCI6MTc4OTg0ODc3NX0.a2WEhM0AHp1afEckO7iIB_2_p16LevZBdXUpcfQOp8I",
    "user": {
        "id": "6aae60176bd75cff3eb314a6",
        "name": "RetinEx Doctor",
        "email": "doctor@retinex.com",
        "role": "doctor"
    }
}
```

Token expires in 8h (`expiresIn: "8h"` in `routes/auth.js`).

**Every subsequent authenticated request** must include:
```
Authorization: Bearer <token>
```

Missing/malformed header → `401`. Expired/invalid token → `401`.

## `POST /api/images` — upload + analyze

Request: `multipart/form-data`, one file field named **`image`**
(JPEG/PNG/TIFF, 25MB max). Requires the `Authorization` header.

```
POST /api/images
Authorization: Bearer <token>
Content-Type: multipart/form-data

image: <file>
```

Optional query param for local dev only — see the mock note at the bottom:
`?mock_quality=adequate|borderline|reject` forces which quality branch the
(currently mocked) MATLAB step returns, so all 3 downstream shapes can be
tested on demand.

### Case 1: quality = "adequate" (real captured response, `201`)

```json
{
    "success": true,
    "message": "Image uploaded and AI analysis completed successfully",
    "image_id": "ca56a6ba-b0da-4a48-896d-f24c197fe223",
    "original_filename": "IDRiD_060.jpg.jpeg",
    "stored_filename": "ca56a6ba-b0da-4a48-896d-f24c197fe223.jpeg",
    "size_bytes": 440805,
    "mime_type": "image/jpeg",
    "uploaded_at": "2026-09-19T12:13:08.400Z",
    "result": {
        "_id": "6aae7c54de8e5c0c6e63161b",
        "image_id": "ca56a6ba-b0da-4a48-896d-f24c197fe223",
        "__v": 0,
        "classification": {
            "grade": 0,
            "grade_name": "No DR",
            "grade_probabilities_raw": [0.560346782207489, 0.31920868158340454, 0.06912125647068024, 0.02814052440226078, 0.023182764649391174],
            "grade_probabilities_calibrated": [0.560346782207489, 0.31920868158340454, 0.06912125647068024, 0.02814052440226078, 0.023182764649391174],
            "calibration": {
                "temperature": 1,
                "fitted_on": null,
                "note": "Recalibration pending for the retrained classifier (runs/classifier_final/best.pt) -- the previous temperature (0.904) was fit on a different checkpoint's logits and does not transfer. grade_probabilities_calibrated is currently identical to grade_probabilities_raw until recalibration is complete."
            },
            "referable": {
                "probability": 0.17442624270915985,
                "threshold": 0.478,
                "threshold_source": "validation",
                "is_referable": false,
                "known_performance": {
                    "official_test_sensitivity": 0.859,
                    "official_test_specificity": 0.821,
                    "official_test_auc": 0.92,
                    "target_sensitivity": 0.9,
                    "target_specificity": 0.85,
                    "meets_target": false
                }
            }
        },
        "createdAt": "2026-09-19T12:13:08.338Z",
        "fovea": {
            "status": "implemented",
            "location": { "x": 1789.3, "y": 508.2, "score": 0.6423 }
        },
        "grad_cam": {
            "target_grade": 0,
            "heatmap_path": "ca56a6ba-b0da-4a48-896d-f24c197fe223/ca56a6ba-b0da-4a48-896d-f24c197fe223_gradcam_heatmap.png",
            "overlay_path": "ca56a6ba-b0da-4a48-896d-f24c197fe223/ca56a6ba-b0da-4a48-896d-f24c197fe223_gradcam_overlay.png",
            "crop_region": {
                "note": "CAM/heatmap only covers this square region of the ORIGINAL image.",
                "left": 720,
                "top": 0,
                "side": 2848,
                "original_width": 4288,
                "original_height": 2848
            },
            "lesion_overlap_validated": true
        },
        "image_quality": {
            "status": "implemented",
            "quality": "adequate",
            "reject_reason": null,
            "enhanced_image_path": null
        },
        "lesion_segmentation": {
            "channels": {
                "microaneurysms": { "mask_path": "ca56a6ba-b0da-4a48-896d-f24c197fe223/ca56a6ba-b0da-4a48-896d-f24c197fe223_lesion_MA.png", "probability_map_path": null, "val_dice": 0.27832716703414917, "dice_unreliable": true },
                "haemorrhages": { "mask_path": "ca56a6ba-b0da-4a48-896d-f24c197fe223/ca56a6ba-b0da-4a48-896d-f24c197fe223_lesion_HE.png", "probability_map_path": null, "val_dice": 0.25534090399742126, "dice_unreliable": true },
                "hard_exudates": { "mask_path": "ca56a6ba-b0da-4a48-896d-f24c197fe223/ca56a6ba-b0da-4a48-896d-f24c197fe223_lesion_EX.png", "probability_map_path": null, "val_dice": 0.5232571959495544, "dice_unreliable": false },
                "soft_exudates": { "mask_path": "ca56a6ba-b0da-4a48-896d-f24c197fe223/ca56a6ba-b0da-4a48-896d-f24c197fe223_lesion_SE.png", "probability_map_path": null, "val_dice": 0.15299277007579803, "dice_unreliable": true }
            },
            "model_img_size": 512
        },
        "neovascularization": { "status": "not_implemented", "detected": null },
        "optic_disc": {
            "status": "implemented",
            "location": { "x": 1131.7, "y": 514.8, "radius": 64 }
        },
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
        "processed_at": "2026-09-19T12:13:07.827Z",
        "schema_version": "1.0",
        "updatedAt": "2026-09-19T12:13:08.338Z",
        "user_id": "6aae60176bd75cff3eb314a6",
        "vessel_segmentation": {
            "status": "implemented",
            "mask_path": "ca56a6ba-b0da-4a48-896d-f24c197fe223/ca56a6ba-b0da-4a48-896d-f24c197fe223_vessel_mask.png"
        }
    }
}
```

Every top-level block (`pipeline_status`, `image_quality`, `classification`,
`grad_cam`, `lesion_segmentation`, `vessel_segmentation`, `optic_disc`,
`fovea`, `neovascularization`) is **independently nullable** — always check
for `null` before reading into a block, per case 2 below.

### Case 2: quality = "reject" (real captured response, `201`)

Triggered here via `?mock_quality=reject`; in production this happens
whenever the quality-check step decides the image is unusable. **The AI
pipeline is never run** in this case (no classification/segmentation cost
incurred) — this is a deliberate short-circuit, not an error.

```json
{
    "success": true,
    "message": "Image uploaded but rejected by quality check -- AI analysis skipped",
    "image_id": "de7bd2d0-0d2e-4639-b1e5-7d3f17cbe569",
    "original_filename": "IDRiD_055.jpg.jpeg",
    "stored_filename": "de7bd2d0-0d2e-4639-b1e5-7d3f17cbe569.jpeg",
    "size_bytes": 421378,
    "mime_type": "image/jpeg",
    "uploaded_at": "2026-09-19T12:13:14.405Z",
    "result": {
        "_id": "6aae7c5ade8e5c0c6e63161c",
        "image_id": "de7bd2d0-0d2e-4639-b1e5-7d3f17cbe569",
        "__v": 0,
        "classification": null,
        "createdAt": "2026-09-19T12:13:14.403Z",
        "fovea": null,
        "grad_cam": null,
        "image_quality": {
            "status": "implemented",
            "quality": "reject",
            "reject_reason": "Illumination across the retinal field is too uneven.",
            "enhanced_image_path": null
        },
        "lesion_segmentation": null,
        "neovascularization": null,
        "optic_disc": null,
        "pipeline_status": {
            "image_quality_assessment": "implemented",
            "classification": "not_implemented",
            "grad_cam": "not_implemented",
            "lesion_segmentation": "not_implemented",
            "vessel_segmentation": "not_implemented",
            "optic_disc_localization": "not_implemented",
            "fovea_localization": "not_implemented",
            "neovascularization_detection": "not_implemented"
        },
        "processed_at": "2026-09-19T12:13:14.403Z",
        "schema_version": "1.0",
        "updatedAt": "2026-09-19T12:13:14.403Z",
        "user_id": "6aae60176bd75cff3eb314a6",
        "vessel_segmentation": null
    }
}
```

The UI should treat this as a normal, successful upload response (`201`,
`success: true`) — just show the rejection reason (`result.image_quality.reject_reason`)
instead of a diagnosis, since there is no diagnosis to show.

### Case 3: quality = "borderline" (real captured, structure only)

Triggered via `?mock_quality=borderline`. Shape is identical to Case 1
(the AI pipeline still runs, on an enhanced copy of the image), except:
```json
"image_quality": {
    "status": "implemented",
    "quality": "borderline",
    "reject_reason": null,
    "enhanced_image_path": "/Users/ritvikverma/Desktop/Retinex/backend/uploads/enhanced/3639b51e-f02c-4a3a-ab3c-c42e22dd51a1.jpeg"
}
```
Note `enhanced_image_path` here is a **local server filesystem path**, not
a fetchable URL — it's informational only (for debugging/audit), not meant
to be loaded by the frontend. It is not exposed through the assets route
described below.

## `GET /api/results/:imageId`

Returns exactly the same `result` object embedded in the upload response —
confirmed by direct comparison: a separate `GET` call for the same
`image_id` used above returned byte-for-byte the same JSON as
`upload_response.result`. Requires `Authorization: Bearer <token>`. `404`
if no result exists for that `image_id` under the caller's account
(results are scoped per `user_id`).

## `GET /api/results/:imageId/assets/:assetType`

**This is the only correct way to fetch image assets.** The `*_path`
fields inside the JSON (`grad_cam.heatmap_path`, lesion `mask_path`s,
`vessel_segmentation.mask_path`) are **relative paths on the server's
filesystem** (e.g. `"<imageId>/<imageId>_gradcam_heatmap.png"`) — they are
**not URLs** and will not load if used directly as an `<img src>`. Always
build the URL from the `imageId` and a fixed `assetType` string instead;
the route resolves the stored path server-side and streams the file back.

Requires `Authorization: Bearer <token>` — confirmed a request without it
returns `401`, even with a valid `imageId`.

Valid `:assetType` values (from `backend/index.js`'s `assetMap`, only
these 7 are recognized — anything else returns `404`):

| assetType | Sourced from |
|---|---|
| `gradcam_heatmap` | `grad_cam.heatmap_path` |
| `gradcam_overlay` | `grad_cam.overlay_path` |
| `microaneurysms` | `lesion_segmentation.channels.microaneurysms.mask_path` |
| `haemorrhages` | `lesion_segmentation.channels.haemorrhages.mask_path` |
| `hard_exudates` | `lesion_segmentation.channels.hard_exudates.mask_path` |
| `soft_exudates` | `lesion_segmentation.channels.soft_exudates.mask_path` |
| `vessels` | `vessel_segmentation.mask_path` |

Example (React):
```js
const url = `http://localhost:3000/api/results/${imageId}/assets/gradcam_heatmap`;
const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
const blob = await res.blob();
const imgSrc = URL.createObjectURL(blob);
```

Verified live for 2 asset types against the real result above:
```
GET /api/results/ca56a6ba-.../assets/gradcam_heatmap  -> 200, image/png, 44749 bytes
GET /api/results/ca56a6ba-.../assets/hard_exudates    -> 200, image/png, 1184 bytes
```
If a block is `null` (e.g. `grad_cam` on a rejected image, or a channel
that has no `mask_path`), the corresponding asset request returns `404`
("Requested AI asset is not available") — check the JSON's `*_path` fields
aren't `null` before constructing the asset URL to avoid a needless 404.

## MATLAB is now real — shape is unchanged

Real MATLAB is wired in and verified end-to-end (`USE_MOCK_MATLAB=false`
in `backend/.env`); the `image_quality`, `optic_disc`, and `fovea` blocks
are produced by the actual `runRetinExJSON.m` wrapper, not
`MATLAB/mock/mockMatlabResult.js`. As predicted below, **the response
shape did not change** — only the actual numbers in `optic_disc.location`,
`fovea.location`, and which `quality` branch gets hit for a given real
image are now real instead of the old mock's fixed values. Safe to build
the full UI (including the reject-state screen) against this contract now.

## Keeping the server up for frontend development

```
cd backend
node index.js
```

This runs in the foreground; leave the terminal open, or run it detached,
e.g.:
```
cd backend
node index.js > /tmp/retinex-backend.log 2>&1 &
```
It stays up indefinitely (no watch/restart-on-crash — if you edit
`backend/` source, restart it manually) as long as MongoDB (`mongod`) is
also running locally. Confirmed reachable at `http://localhost:3000/health`
while this document was being written.
