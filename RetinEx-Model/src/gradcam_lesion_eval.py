import os
import cv2
import numpy as np
import torch
import matplotlib.pyplot as plt
from PIL import Image

from gradcam import (
    GradCAM,
    load_and_preprocess,
    overlay_heatmap,
    GRADE_NAMES,
)
from model import DRClassifier


# ============================================================
# CONFIG
# ============================================================

CHECKPOINT = r"D:\SIH\Model\src\runs\classifier\best.pt"

IMAGE_PATH = (
    r"D:\SIH\Model\Dataset\archive\B. Disease Grading"
    r"\B. Disease Grading\1. Original Images\b. Testing Set\IDRiD_055.jpg"
)

MASK_ROOT = (
    r"D:\SIH\Model\Dataset\archive\A. Segmentation"
    r"\A. Segmentation\2. All Segmentation Groundtruths"
    r"\b. Testing Set"
)

OUTPUT_DIR = r"D:\SIH\Model\src\runs\gradcam_lesion_eval"

IMAGE_ID = "IDRiD_55"

# Grad-CAM pixels above this value are considered
# "high attention".
CAM_THRESHOLD = 0.5


# ============================================================
# DEVICE
# ============================================================

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print("Using device:", device)


# ============================================================
# LOAD CHECKPOINT + MODEL
# ============================================================

print("Loading model...")

checkpoint = torch.load(
    CHECKPOINT,
    map_location=device,
    weights_only=False,
)

# Read backbone from checkpoint metadata
backbone_name = checkpoint.get(
    "backbone",
    "efficientnet_b0"
)

print("Checkpoint backbone:", backbone_name)

# Build the exact architecture used during training
model = DRClassifier(
    backbone_name=backbone_name,
    num_grades=5,
    pretrained=False,
)

# Extract actual model weights
if "model_state" in checkpoint:
    state_dict = checkpoint["model_state"]
elif "model_state_dict" in checkpoint:
    state_dict = checkpoint["model_state_dict"]
elif "state_dict" in checkpoint:
    state_dict = checkpoint["state_dict"]
else:
    state_dict = checkpoint

# Load weights
model.load_state_dict(state_dict)

model.to(device)
model.eval()

print("Model loaded successfully.")


# ============================================================
# LOAD IMAGE
# ============================================================

print("Loading image...")

tensor, image = load_and_preprocess(IMAGE_PATH, 380)

tensor = tensor.to(device)

# Make sure Grad-CAM receives gradients
tensor.requires_grad_(True)


# ============================================================
# GENERATE GRAD-CAM
# ============================================================

print("Generating Grad-CAM...")

cam = GradCAM(
    model,
    model.gradcam_target_layer,
)

with torch.enable_grad():
    output = model(tensor)

    # Your model returns:
    # grade logits + referable logit
    if isinstance(output, tuple):
        grade_logits = output[0]
        referable_logit = output[1]
    elif isinstance(output, dict):
        grade_logits = output["grade_logits"]
        referable_logit = output["referable_logit"]
    else:
        raise RuntimeError(
            "Unexpected model output format."
        )

    predicted_grade = int(
        torch.argmax(grade_logits, dim=1).item()
    )

    grade_probabilities = torch.softmax(
        grade_logits,
        dim=1,
    )

    grade_confidence = float(
        grade_probabilities[0, predicted_grade].item()
    )

    referable_probability = float(
        torch.sigmoid(referable_logit).item()
    )

    # Generate CAM for predicted grade.
    # generate() returns a 4-tuple: (cam, class_idx, confidence, referable_prob).
    # We already have predicted_grade/grade_confidence/referable_probability from
    # the manual forward pass above, so only the cam array itself is new here.
    heatmap, _cam_class_idx, _cam_confidence, _cam_referable_prob = cam.generate(
        tensor,
        predicted_grade,
    )

print("Predicted grade:", predicted_grade)
print("Grade:", GRADE_NAMES[predicted_grade])
print("Grade confidence:", f"{grade_confidence:.2%}")
print(
    "Referable probability:",
    f"{referable_probability:.2%}",
)


# ============================================================
# LOAD LESION MASKS
# ============================================================

LESIONS = {
    "Microaneurysms": (
        "1. Microaneurysms",
        f"{IMAGE_ID}_MA.tif",
    ),
    "Haemorrhages": (
        "2. Haemorrhages",
        f"{IMAGE_ID}_HE.tif",
    ),
    "Hard Exudates": (
        "3. Hard Exudates",
        f"{IMAGE_ID}_EX.tif",
    ),
    "Soft Exudates": (
        "4. Soft Exudates",
        f"{IMAGE_ID}_SE.tif",
    ),
}


def load_mask(folder, filename):
    path = os.path.join(
        MASK_ROOT,
        folder,
        filename,
    )

    if not os.path.exists(path):
        return None

    mask = np.array(
        Image.open(path)
    )

    # Binary mask
    mask = (mask > 0).astype(np.uint8)

    return mask


# ============================================================
# COMPUTE THE SAME CENTER-CROP USED FOR THE CLASSIFIER INPUT
# ============================================================
# load_and_preprocess() (gradcam.py) does: side = min(w, h),
# left = (w - side) // 2, top = (h - side) // 2, then crops to
# a square and resizes that square to img_size x img_size.
# The CAM is therefore only meaningful within that square region
# of the ORIGINAL image -- not the full rectangle. Previously this
# script resized the CAM up to the full original width/height,
# which stretches it over image area the model never saw.
#
# Fix: keep the CAM at the square-crop's resolution, and crop the
# lesion masks (which are full-resolution rectangles) down to that
# same square using identical left/top/side, before resizing masks
# with nearest-neighbor to match the CAM. This way both sides of
# the comparison refer to the same physical region of the image.

original_rgb = np.array(
    Image.open(IMAGE_PATH).convert("RGB")
)

original_h, original_w = original_rgb.shape[:2]

crop_side = min(original_w, original_h)
crop_left = (original_w - crop_side) // 2
crop_top = (original_h - crop_side) // 2

# The square region of the original image that the model actually saw.
cropped_rgb = original_rgb[
    crop_top:crop_top + crop_side,
    crop_left:crop_left + crop_side,
]

cam_normalized = heatmap.astype(np.float32)

# Resize CAM (native size = model's internal feature-map resolution)
# up to the square crop's resolution -- NOT the full rectangle.
cam_resized = cv2.resize(
    cam_normalized,
    (crop_side, crop_side),
    interpolation=cv2.INTER_LINEAR,
)

cam_binary = (
    cam_resized >= CAM_THRESHOLD
).astype(np.uint8)


# ============================================================
# EVALUATE OVERLAP
# ============================================================

def calculate_metrics(cam_mask, lesion_mask):

    cam_bool = cam_mask.astype(bool)
    lesion_bool = lesion_mask.astype(bool)

    intersection = np.logical_and(
        cam_bool,
        lesion_bool,
    ).sum()

    union = np.logical_or(
        cam_bool,
        lesion_bool,
    ).sum()

    lesion_pixels = lesion_bool.sum()
    cam_pixels = cam_bool.sum()

    if union > 0:
        iou = intersection / union
    else:
        iou = 0.0

    if lesion_pixels > 0:
        lesion_coverage = (
            intersection / lesion_pixels
        )
    else:
        lesion_coverage = 0.0

    if cam_pixels > 0:
        precision = (
            intersection / cam_pixels
        )
    else:
        precision = 0.0

    return {
        "intersection": int(intersection),
        "lesion_pixels": int(lesion_pixels),
        "cam_pixels": int(cam_pixels),
        "IoU": float(iou),
        "lesion_coverage": float(
            lesion_coverage
        ),
        "precision": float(precision),
    }


# ============================================================
# CREATE OUTPUT DIRECTORY
# ============================================================

os.makedirs(
    OUTPUT_DIR,
    exist_ok=True,
)


# ============================================================
# VISUALIZE
# ============================================================

fig, axes = plt.subplots(
    2,
    4,
    figsize=(22, 10),
)

axes = axes.flatten()

# ------------------------------------------------------------
# Original
# ------------------------------------------------------------

axes[0].imshow(cropped_rgb)
axes[0].set_title("Original (model's square crop)")
axes[0].axis("off")


# ------------------------------------------------------------
# Grad-CAM
# ------------------------------------------------------------

axes[1].imshow(cam_resized, cmap="jet")
axes[1].set_title(
    f"Grad-CAM\n"
    f"Predicted: {GRADE_NAMES[predicted_grade]}"
)
axes[1].axis("off")


# ------------------------------------------------------------
# High-attention region
# ------------------------------------------------------------

axes[2].imshow(cropped_rgb)
axes[2].imshow(
    cam_resized,
    cmap="jet",
    alpha=0.45,
)
axes[2].set_title(
    f"Grad-CAM Overlay\n"
    f"Threshold = {CAM_THRESHOLD}"
)
axes[2].axis("off")


# ============================================================
# LESION RESULTS
# ============================================================

results = {}

plot_index = 3

for lesion_name, (folder, filename) in LESIONS.items():

    mask = load_mask(
        folder,
        filename,
    )

    if mask is None:
        print(
            f"{lesion_name}: mask not found"
        )
        continue

    # Crop the full-resolution mask to the SAME square region the classifier
    # actually saw (identical left/top/side as the image crop), before
    # resizing. Cropping first, then resizing, keeps mask and CAM aligned to
    # the same physical region -- resizing the full rectangle directly (the
    # old behavior) would stretch mask content from outside the square crop
    # into the comparison, which the model never had a chance to attend to.
    mask_cropped = mask[
        crop_top:crop_top + crop_side,
        crop_left:crop_left + crop_side,
    ]

    if mask_cropped.shape != (crop_side, crop_side):
        mask_cropped = cv2.resize(
            mask_cropped,
            (crop_side, crop_side),
            interpolation=cv2.INTER_NEAREST,
        )

    metrics = calculate_metrics(
        cam_binary,
        mask_cropped,
    )

    results[lesion_name] = metrics

    print()
    print("=" * 50)
    print(lesion_name)
    print("=" * 50)
    print(
        "Lesion pixels:",
        metrics["lesion_pixels"],
    )
    print(
        "High-CAM pixels:",
        metrics["cam_pixels"],
    )
    print(
        "Intersection:",
        metrics["intersection"],
    )
    print(
        "IoU:",
        f"{metrics['IoU']:.4f}",
    )
    print(
        "Lesion coverage:",
        f"{metrics['lesion_coverage']:.2%}",
    )
    print(
        "CAM precision:",
        f"{metrics['precision']:.2%}",
    )

    # --------------------------------------------------------
    # Plot lesion mask / CAM comparison
    # --------------------------------------------------------

    if plot_index < len(axes):

        axes[plot_index].imshow(
            cropped_rgb
        )

        # Show lesion mask
        axes[plot_index].imshow(
            mask_cropped,
            cmap="gray",
            alpha=0.45,
        )

        # Show Grad-CAM
        axes[plot_index].imshow(
            cam_resized,
            cmap="jet",
            alpha=0.35,
        )

        axes[plot_index].set_title(
            f"{lesion_name}\n"
            f"Coverage: "
            f"{metrics['lesion_coverage']:.1%}"
        )

        axes[plot_index].axis("off")

        plot_index += 1


# ============================================================
# FINAL FIGURE
# ============================================================

# Hide any axes left unused (e.g. a lesion mask was missing for this image).
for unused_ax in axes[plot_index:]:
    unused_ax.axis("off")

fig.suptitle(
    f"{IMAGE_ID} — Grad-CAM vs Lesion Ground Truth\n"
    f"Grade: {GRADE_NAMES[predicted_grade]} | "
    f"Confidence: {grade_confidence:.1%} | "
    f"Referable: {referable_probability:.1%}",
    fontsize=16,
)

plt.tight_layout()

output_path = os.path.join(
    OUTPUT_DIR,
    f"{IMAGE_ID}_lesion_comparison.png",
)

plt.savefig(
    output_path,
    dpi=150,
    bbox_inches="tight",
)

plt.close()

print()
print("=" * 60)
print("DONE")
print("=" * 60)
print("Saved visualization:")
print(output_path)