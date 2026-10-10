"""
Batch Grad-CAM vs IDRiD lesion ground-truth evaluation.

Runs the same crop-aligned comparison as gradcam_lesion_eval.py across
multiple official IDRiD test images, and reports per-lesion aggregate
IoU / coverage / precision.

IMPORTANT — aggregation rule: for each lesion type, an image is included in
that lesion's average ONLY if its mask file exists. Missing masks (common
for Soft Exudates) are skipped entirely, not counted as "0 lesion pixels" --
a missing annotation means "not verified," not "confirmed absent," and
treating it as zero would bias coverage/IoU downward for reasons that have
nothing to do with the model.

This is a SANITY-CHECK batch run over a small fixed subset of images
(default 12), not the full 103-image official test set. Do not treat these
aggregates as final, reportable numbers -- they're here to check whether the
per-image pattern from IDRiD_55 holds up or was a one-off.

Grad-CAM overlap with lesion masks is a localization/explanation signal, not
a validated lesion-detection score. High overlap does not prove clinical
correctness; low overlap does not automatically mean the classifier is
useless (see gradcam_lesion_eval.py header notes).

Run:
  python gradcam_lesion_eval_batch.py
"""
import os
import glob
import cv2
import numpy as np
import torch
import matplotlib.pyplot as plt
from PIL import Image

from gradcam import GradCAM, load_and_preprocess, GRADE_NAMES
from model import DRClassifier


# ============================================================
# CONFIG
# ============================================================

CHECKPOINT = r"D:\SIH\Model\src\runs\classifier\best.pt"

IMAGE_DIR = (
    r"D:\SIH\Model\Dataset\archive\B. Disease Grading"
    r"\B. Disease Grading\1. Original Images\b. Testing Set"
)

MASK_ROOT = (
    r"D:\SIH\Model\Dataset\archive\A. Segmentation"
    r"\A. Segmentation\2. All Segmentation Groundtruths"
    r"\b. Testing Set"
)

OUTPUT_DIR = r"D:\SIH\Model\src\runs\gradcam_lesion_eval_batch"

IMG_SIZE = 380
CAM_THRESHOLD = 0.5

# Sanity-check subset size. Set to None to run every test image that has
# at least one lesion mask available.
MAX_IMAGES = None

LESIONS = {
    "Microaneurysms": ("1. Microaneurysms", "_MA.tif"),
    "Haemorrhages": ("2. Haemorrhages", "_HE.tif"),
    "Hard Exudates": ("3. Hard Exudates", "_EX.tif"),
    "Soft Exudates": ("4. Soft Exudates", "_SE.tif"),
}


# ============================================================
# HELPERS
# ============================================================

def to_mask_id(image_id):
    """Disease-grading images are named IDRiD_055.jpg (zero-padded), but
    segmentation masks are named IDRiD_55_MA.tif (no leading zero). Convert
    the padded image_id to the unpadded form the mask filenames use."""
    prefix, number = image_id.rsplit("_", 1)
    return f"{prefix}_{int(number)}"


def load_mask(image_id, folder, suffix):
    mask_id = to_mask_id(image_id)
    path = os.path.join(MASK_ROOT, folder, f"{mask_id}{suffix}")
    if not os.path.exists(path):
        return None
    # Force single-channel grayscale: some IDRiD mask TIFFs are saved as RGBA
    # even though the actual content is binary, which previously produced an
    # (H, W, 4) array and crashed downstream boolean ops expecting (H, W).
    mask = np.array(Image.open(path).convert("L"))
    return (mask > 0).astype(np.uint8)


def calculate_metrics(cam_mask, lesion_mask):
    cam_bool = cam_mask.astype(bool)
    lesion_bool = lesion_mask.astype(bool)

    intersection = np.logical_and(cam_bool, lesion_bool).sum()
    union = np.logical_or(cam_bool, lesion_bool).sum()
    lesion_pixels = lesion_bool.sum()
    cam_pixels = cam_bool.sum()

    iou = intersection / union if union > 0 else 0.0
    coverage = intersection / lesion_pixels if lesion_pixels > 0 else 0.0
    precision = intersection / cam_pixels if cam_pixels > 0 else 0.0

    return {
        "intersection": int(intersection),
        "lesion_pixels": int(lesion_pixels),
        "cam_pixels": int(cam_pixels),
        "IoU": float(iou),
        "lesion_coverage": float(coverage),
        "precision": float(precision),
    }


def get_image_ids(image_dir):
    paths = sorted(glob.glob(os.path.join(image_dir, "*.jpg")))
    return [os.path.splitext(os.path.basename(p))[0] for p in paths]


def has_any_mask(image_id):
    mask_id = to_mask_id(image_id)
    for folder, suffix in LESIONS.values():
        if os.path.exists(os.path.join(MASK_ROOT, folder, f"{mask_id}{suffix}")):
            return True
    return False


# ============================================================
# MAIN
# ============================================================

def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print("Using device:", device)

    print("Loading model...")
    checkpoint = torch.load(CHECKPOINT, map_location=device, weights_only=False)
    backbone_name = checkpoint.get("backbone", "efficientnet_b0")
    print("Checkpoint backbone:", backbone_name)

    model = DRClassifier(backbone_name=backbone_name, num_grades=5, pretrained=False)
    state_dict = checkpoint.get("model_state", checkpoint)
    model.load_state_dict(state_dict)
    model.to(device)
    model.eval()

    cam_engine = GradCAM(model, model.gradcam_target_layer)

    all_ids = get_image_ids(IMAGE_DIR)
    ids_with_masks = [i for i in all_ids if has_any_mask(i)]
    print(f"Found {len(all_ids)} test images, {len(ids_with_masks)} with at least one lesion mask.")

    if MAX_IMAGES is not None:
        ids_to_run = ids_with_masks[:MAX_IMAGES]
    else:
        ids_to_run = ids_with_masks
    print(f"Running on {len(ids_to_run)} images (MAX_IMAGES={MAX_IMAGES}).")

    # Per-lesion accumulators. Each entry only gets a value appended when
    # that image's mask for that lesion actually exists (skip-missing rule).
    aggregate = {name: {"IoU": [], "lesion_coverage": [], "precision": []}
                 for name in LESIONS}
    per_image_log = []

    for idx, image_id in enumerate(ids_to_run, start=1):
        image_path = os.path.join(IMAGE_DIR, f"{image_id}.jpg")

        try:
            tensor, _cropped_preview = load_and_preprocess(image_path, IMG_SIZE)
            tensor = tensor.to(device)
            tensor.requires_grad_(True)

            with torch.enable_grad():
                grade_logits, ref_logit = model(tensor)
                predicted_grade = int(grade_logits.argmax(dim=1).item())
                grade_conf = float(
                    torch.softmax(grade_logits, dim=1)[0, predicted_grade].item()
                )
                referable_prob = float(torch.sigmoid(ref_logit).item())

                heatmap, _, _, _ = cam_engine.generate(tensor, predicted_grade)

            # Same crop-alignment fix as gradcam_lesion_eval.py: compare the
            # CAM against lesion masks cropped to the SAME square region the
            # classifier actually saw, not the full rectangular image.
            original_rgb = np.array(Image.open(image_path).convert("RGB"))
            original_h, original_w = original_rgb.shape[:2]
            crop_side = min(original_w, original_h)
            crop_left = (original_w - crop_side) // 2
            crop_top = (original_h - crop_side) // 2
            cropped_rgb = original_rgb[
                crop_top:crop_top + crop_side, crop_left:crop_left + crop_side
            ]

            cam_resized = cv2.resize(
                heatmap.astype(np.float32), (crop_side, crop_side),
                interpolation=cv2.INTER_LINEAR,
            )
            cam_binary = (cam_resized >= CAM_THRESHOLD).astype(np.uint8)

            image_metrics = {}
            for lesion_name, (folder, suffix) in LESIONS.items():
                mask = load_mask(image_id, folder, suffix)
                if mask is None:
                    continue  # skip-missing: not included in this lesion's average

                mask_cropped = mask[
                    crop_top:crop_top + crop_side, crop_left:crop_left + crop_side
                ]
                if mask_cropped.shape != (crop_side, crop_side):
                    mask_cropped = cv2.resize(
                        mask_cropped, (crop_side, crop_side),
                        interpolation=cv2.INTER_NEAREST,
                    )

                metrics = calculate_metrics(cam_binary, mask_cropped)
                image_metrics[lesion_name] = metrics
                aggregate[lesion_name]["IoU"].append(metrics["IoU"])
                aggregate[lesion_name]["lesion_coverage"].append(metrics["lesion_coverage"])
                aggregate[lesion_name]["precision"].append(metrics["precision"])

            per_image_log.append({
                "image_id": image_id,
                "predicted_grade": predicted_grade,
                "grade_confidence": grade_conf,
                "referable_probability": referable_prob,
                "lesions_evaluated": list(image_metrics.keys()),
            })

            # Lightweight per-image visualization (original crop + CAM overlay only --
            # full 7-panel figures for every image would be a lot of files; use
            # gradcam_lesion_eval.py on a specific image_id for the detailed view).
            fig, axes = plt.subplots(1, 2, figsize=(10, 5))
            axes[0].imshow(cropped_rgb)
            axes[0].set_title(f"{image_id} (crop)")
            axes[0].axis("off")
            axes[1].imshow(cropped_rgb)
            axes[1].imshow(cam_resized, cmap="jet", alpha=0.45)
            axes[1].set_title(
                f"Grade {predicted_grade} ({GRADE_NAMES[predicted_grade]})\n"
                f"Conf {grade_conf:.1%} | Referable {referable_prob:.1%}"
            )
            axes[1].axis("off")
            plt.tight_layout()
            plt.savefig(
                os.path.join(OUTPUT_DIR, f"{image_id}_overlay.png"),
                dpi=120, bbox_inches="tight",
            )
            plt.close()

            lesion_summary = ", ".join(
                f"{name}={image_metrics[name]['IoU']:.3f}" for name in image_metrics
            )
            print(f"[{idx}/{len(ids_to_run)}] {image_id}: grade={predicted_grade} "
                  f"IoU({lesion_summary})")

        except Exception as e:
            print(f"[{idx}/{len(ids_to_run)}] {image_id} FAILED: {e}")

    # ============================================================
    # AGGREGATE REPORT
    # ============================================================
    print()
    print("=" * 60)
    print(f"AGGREGATE RESULTS OVER {len(ids_to_run)}-IMAGE SANITY-CHECK SUBSET")
    print("(skip-missing: each lesion's average uses only images with that mask)")
    print("=" * 60)

    for lesion_name in LESIONS:
        vals = aggregate[lesion_name]
        n = len(vals["IoU"])
        if n == 0:
            print(f"{lesion_name}: no masks found in this subset — skipped entirely")
            continue
        mean_iou = np.mean(vals["IoU"])
        mean_cov = np.mean(vals["lesion_coverage"])
        mean_prec = np.mean(vals["precision"])
        print(
            f"{lesion_name} (n={n} images with mask): "
            f"mean IoU={mean_iou:.4f}, mean coverage={mean_cov:.2%}, "
            f"mean precision={mean_prec:.2%}"
        )

    print()
    print("NOTE: this is a small sanity-check subset, not the full 103-image test set.")
    print("Do not treat these aggregates as final numbers. Re-run with MAX_IMAGES=None")
    print("for the complete official test set once this subset looks correct.")
    print(f"Per-image overlays saved to: {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
