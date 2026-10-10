"""
End-to-end inference pipeline for a single fundus image: DR grading (with
temperature-calibrated confidence), Grad-CAM explanation, lesion segmentation
(MA/HE/EX/SE), and vessel segmentation.

Model construction and checkpoint-loading are NOT reimplemented here -- they
are imported from the scripts that already define them:
  - classifier:   model.py's DRClassifier, loaded the way evaluate.py does it
  - lesion U-Net:  unet.py's UNet, constructed the way train_lesion_seg.py does it
  - vessel U-Net:  unet.py's UNet, constructed the way train_vessel_seg.py does it
  - Grad-CAM:      gradcam.py's GradCAM class, targeting model.gradcam_target_layer

Run:
  python src/run_inference_pipeline.py --image path/to/fundus.jpg \\
      --checkpoints-dir runs/ --out-dir runs/inference
"""
import os
import json
import argparse
import functools
from datetime import datetime, timezone

import numpy as np
from PIL import Image
import torch
import torch.nn.functional as F

from model import DRClassifier
from unet import UNet
from gradcam import GradCAM, load_and_preprocess, overlay_heatmap, GRADE_NAMES
from idrid_lesion_dataset import LESION_CHANNELS

CLASSIFIER_IMG_SIZE = 380
VESSEL_IMG_SIZE = 384
LESION_IMG_SIZE_DEFAULT = 512


class ModelBundle:
    """Everything loaded once at startup, reused across run_pipeline calls."""

    def __init__(self, device, classifier, gradcam_engine, temperature,
                 val_referable_threshold, lesion_unet, lesion_img_size,
                 lesion_val_dice_per_channel, vessel_unet,
                 calibration_pending=False):
        self.device = device
        self.classifier = classifier
        self.gradcam_engine = gradcam_engine
        self.temperature = temperature
        self.val_referable_threshold = val_referable_threshold
        self.lesion_unet = lesion_unet
        self.lesion_img_size = lesion_img_size
        self.lesion_val_dice_per_channel = lesion_val_dice_per_channel
        self.vessel_unet = vessel_unet
        self.calibration_pending = calibration_pending


@functools.lru_cache(maxsize=None)
def load_models(checkpoints_dir):
    """Loads all four models once and caches the bundle per checkpoints_dir,
    so repeated run_pipeline() calls don't reload weights from disk."""
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    # --- Classifier (same loading as evaluate.py) ---
    classifier_ckpt = torch.load(
        os.path.join(checkpoints_dir, "classifier_final", "best.pt"),
        map_location=device,
        weights_only=False,
    )
    classifier = DRClassifier(
        backbone_name=classifier_ckpt["backbone"],
        num_grades=5,
        pretrained=False,
    )
    classifier.load_state_dict(classifier_ckpt["model_state"])
    classifier.to(device).eval()

    if "val_referable_threshold" not in classifier_ckpt:
        raise KeyError(
            "Checkpoint has no 'val_referable_threshold'. Re-run train_classifier.py "
            "to produce a checkpoint with this key."
        )
    val_referable_threshold = classifier_ckpt["val_referable_threshold"]

    # --- Grad-CAM engine against the classifier (same setup as gradcam.py) ---
    gradcam_engine = GradCAM(classifier, classifier.gradcam_target_layer)

    # --- Calibration temperature ---
    # NOT loaded for this checkpoint: temperature.pt (0.904) was fit on the
    # OLD classifier/best.pt checkpoint's validation logits and does not
    # transfer to classifier_final/best.pt -- applying it produces WORSE
    # calibration than no calibration at all (ECE 0.0965 uncalibrated vs.
    # 0.1180 "calibrated" on the official test set). Recalibration for this
    # checkpoint is being handled separately, later. Until then, temperature
    # is fixed at 1.0 (a no-op), so grade_probabilities_calibrated is
    # numerically identical to grade_probabilities_raw.
    temperature = 1.0
    calibration_pending = True

    # --- Lesion U-Net (same construction as train_lesion_seg.py) ---
    lesion_ckpt = torch.load(
        os.path.join(checkpoints_dir, "lesion_unet_v2", "best.pt"),
        map_location=device,
        weights_only=False,
    )
    lesion_unet = UNet(in_channels=3, out_channels=len(LESION_CHANNELS), base_ch=32)
    lesion_unet.load_state_dict(lesion_ckpt["model_state"])
    lesion_unet.to(device).eval()
    lesion_img_size = lesion_ckpt.get("img_size", LESION_IMG_SIZE_DEFAULT)
    lesion_val_dice_per_channel = lesion_ckpt.get("val_dice_per_channel", {})

    # --- Vessel U-Net (same construction as train_vessel_seg.py) ---
    vessel_ckpt = torch.load(
        os.path.join(checkpoints_dir, "vessel_unet", "best.pt"),
        map_location=device,
        weights_only=False,
    )
    vessel_unet = UNet(in_channels=3, out_channels=1, base_ch=32)
    vessel_unet.load_state_dict(vessel_ckpt["model_state"])
    vessel_unet.to(device).eval()

    return ModelBundle(
        device=device,
        classifier=classifier,
        gradcam_engine=gradcam_engine,
        temperature=temperature,
        val_referable_threshold=val_referable_threshold,
        lesion_unet=lesion_unet,
        lesion_img_size=lesion_img_size,
        lesion_val_dice_per_channel=lesion_val_dice_per_channel,
        vessel_unet=vessel_unet,
        calibration_pending=calibration_pending,
    )


def _load_square_normalized(image_path, img_size):
    """Center-crop-to-square-then-resize + /255 scaling + ImageNet mean/std
    normalization, matching idrid_lesion_dataset.py / vessel_dataset.py
    preprocessing."""
    img = Image.open(image_path).convert("RGB")
    w, h = img.size
    side = min(w, h)
    left, top = (w - side) // 2, (h - side) // 2
    img_cropped = img.crop((left, top, left + side, top + side)).resize(
        (img_size, img_size), Image.BILINEAR
    )
    arr = np.array(img_cropped).astype(np.float32) / 255.0
    tensor = torch.from_numpy(arr).permute(2, 0, 1).float()
    mean = torch.tensor([0.485, 0.456, 0.406]).view(3, 1, 1)
    std = torch.tensor([0.229, 0.224, 0.225]).view(3, 1, 1)
    tensor = (tensor - mean) / std
    tensor = tensor.unsqueeze(0)
    return tensor, img_cropped


# Fixed, reported facts from prior evaluation runs (evaluate.py / calibration.py /
# gradcam_lesion_eval_batch.py) -- not recomputed per-image.
CALIBRATION_NOTE = (
    "Recalibration pending for the retrained classifier "
    "(runs/classifier_final/best.pt) -- the previous temperature "
    "(0.904) was fit on a different checkpoint's logits and does not "
    "transfer. grade_probabilities_calibrated is currently identical "
    "to grade_probabilities_raw until recalibration is complete."
)
REFERABLE_KNOWN_PERFORMANCE = {
    "official_test_sensitivity": 0.859,
    "official_test_specificity": 0.821,
    "official_test_auc": 0.920,
    "target_sensitivity": 0.90,
    "target_specificity": 0.85,
    "meets_target": False,
}
LESION_DICE_UNRELIABLE = {
    "MA": True,
    "HE": True,
    "EX": False,
    "SE": True,
}
LESION_SCHEMA_NAMES = {
    "MA": "microaneurysms",
    "HE": "haemorrhages",
    "EX": "hard_exudates",
    "SE": "soft_exudates",
}


def run_pipeline(image_path, checkpoints_dir, out_dir):
    bundle = load_models(checkpoints_dir)
    device = bundle.device
    os.makedirs(out_dir, exist_ok=True)
    base = os.path.splitext(os.path.basename(image_path))[0]

    pipeline_status = {
        "image_quality_assessment": "not_implemented",
        "classification": "implemented",
        "grad_cam": "implemented",
        "lesion_segmentation": "implemented_low_confidence",
        "vessel_segmentation": "implemented",
        "optic_disc_localization": "not_implemented",
        "fovea_localization": "not_implemented",
        "neovascularization_detection": "not_implemented",
    }

    # --- Classification + calibrated confidence ---
    grade_pred = None
    classification_block = None
    try:
        cls_input, _ = load_and_preprocess(image_path, CLASSIFIER_IMG_SIZE)
        cls_input = cls_input.to(device)
        with torch.no_grad():
            grade_logits, ref_logit = bundle.classifier(cls_input)
        grade_pred = int(grade_logits.argmax(dim=1).item())
        raw_probs = F.softmax(grade_logits, dim=1)[0].cpu().numpy()
        calibrated_probs = F.softmax(grade_logits / bundle.temperature, dim=1)[0].cpu().numpy()
        referable_prob = float(torch.sigmoid(ref_logit).item())
        referable_pred = bool(referable_prob >= bundle.val_referable_threshold)

        classification_block = {
            "grade": grade_pred,
            "grade_name": GRADE_NAMES[grade_pred],
            "grade_probabilities_raw": raw_probs.tolist(),
            "grade_probabilities_calibrated": calibrated_probs.tolist(),
            "calibration": {
                "temperature": 1.0,
                "fitted_on": None,
                "note": CALIBRATION_NOTE,
            },
            "referable": {
                "probability": referable_prob,
                "threshold": bundle.val_referable_threshold,
                "threshold_source": "validation",
                "is_referable": referable_pred,
                "known_performance": REFERABLE_KNOWN_PERFORMANCE,
            },
        }
    except Exception as e:
        pipeline_status["classification"] = "error"
        grade_pred = None
        print(f"[classification] failed: {e}")

    if classification_block is None:
        classification_block = {
            "grade": None,
            "grade_name": None,
            "grade_probabilities_raw": None,
            "grade_probabilities_calibrated": None,
            "calibration": None,
            "referable": None,
        }

    # --- Grad-CAM (needs its own forward/backward pass with grad enabled) ---
    grad_cam_block = None
    try:
        if grade_pred is None:
            raise RuntimeError("classification stage failed; cannot target a grade for Grad-CAM")

        cam_input, cropped_img = load_and_preprocess(image_path, CLASSIFIER_IMG_SIZE)
        cam_input = cam_input.to(device)
        cam_input.requires_grad_(True)
        cam, cam_class_idx, cam_confidence, _ = bundle.gradcam_engine.generate(
            cam_input, class_idx=grade_pred
        )
        overlay, heatmap = overlay_heatmap(cam, cropped_img)
        gradcam_overlay_path = os.path.join(out_dir, f"{base}_gradcam_overlay.png")
        gradcam_heatmap_path = os.path.join(out_dir, f"{base}_gradcam_heatmap.png")
        overlay.save(gradcam_overlay_path)
        heatmap.save(gradcam_heatmap_path)

        original_img = Image.open(image_path)
        original_w, original_h = original_img.size
        crop_side = min(original_w, original_h)
        crop_left = (original_w - crop_side) // 2
        crop_top = (original_h - crop_side) // 2

        grad_cam_block = {
            "target_grade": grade_pred,
            "heatmap_path": gradcam_heatmap_path.replace(os.sep, "/"),
            "overlay_path": gradcam_overlay_path.replace(os.sep, "/"),
            "crop_region": {
                "note": "CAM/heatmap only covers this square region of the ORIGINAL image.",
                "left": crop_left,
                "top": crop_top,
                "side": crop_side,
                "original_width": original_w,
                "original_height": original_h,
            },
            # Measured via gradcam_lesion_eval_batch.py on the full 27-image subset.
            "lesion_overlap_validated": True,
        }
    except Exception as e:
        pipeline_status["grad_cam"] = "error"
        print(f"[grad_cam] failed: {e}")

    if grad_cam_block is None:
        grad_cam_block = {
            "target_grade": None,
            "heatmap_path": None,
            "overlay_path": None,
            "crop_region": None,
            "lesion_overlap_validated": None,
        }

    # --- Lesion segmentation ---
    lesion_segmentation_block = None
    try:
        lesion_input, lesion_img = _load_square_normalized(image_path, bundle.lesion_img_size)
        lesion_input = lesion_input.to(device)
        with torch.no_grad():
            lesion_logits = bundle.lesion_unet(lesion_input)
        lesion_masks = (torch.sigmoid(lesion_logits) > 0.5)[0].cpu().numpy()

        channels = {}
        for ch_idx, channel in enumerate(LESION_CHANNELS):
            mask_img = Image.fromarray((lesion_masks[ch_idx] * 255).astype(np.uint8))
            mask_path = os.path.join(out_dir, f"{base}_lesion_{channel}.png")
            mask_img.save(mask_path)
            channels[LESION_SCHEMA_NAMES[channel]] = {
                "mask_path": mask_path.replace(os.sep, "/"),
                "val_dice": (
                    float(bundle.lesion_val_dice_per_channel[channel])
                    if channel in bundle.lesion_val_dice_per_channel else None
                ),
                "dice_unreliable": LESION_DICE_UNRELIABLE[channel],
            }

        lesion_segmentation_block = {
            "model_img_size": bundle.lesion_img_size,
            "channels": channels,
        }
    except Exception as e:
        pipeline_status["lesion_segmentation"] = "error"
        print(f"[lesion_segmentation] failed: {e}")

    if lesion_segmentation_block is None:
        lesion_segmentation_block = {
            "model_img_size": None,
            "channels": {},
        }

    # --- Vessel segmentation ---
    vessel_segmentation_block = None
    try:
        vessel_input, vessel_img = _load_square_normalized(image_path, VESSEL_IMG_SIZE)
        vessel_input = vessel_input.to(device)
        with torch.no_grad():
            vessel_logits = bundle.vessel_unet(vessel_input)
        vessel_mask = (torch.sigmoid(vessel_logits) > 0.5)[0, 0].cpu().numpy()
        vessel_mask_path = os.path.join(out_dir, f"{base}_vessel_mask.png")
        Image.fromarray((vessel_mask * 255).astype(np.uint8)).save(vessel_mask_path)

        vessel_segmentation_block = {
            "status": "implemented",
            "mask_path": vessel_mask_path.replace(os.sep, "/"),
        }
    except Exception as e:
        pipeline_status["vessel_segmentation"] = "error"
        print(f"[vessel_segmentation] failed: {e}")

    if vessel_segmentation_block is None:
        vessel_segmentation_block = {
            "status": "error",
            "mask_path": None,
        }

    result = {
        "schema_version": "1.0",
        "image_id": base,
        "processed_at": datetime.now(timezone.utc).isoformat(),

        "pipeline_status": pipeline_status,

        "image_quality": {
            "status": "not_implemented",
            "quality": None,
            "reject_reason": None,
            "enhanced_image_path": None,
        },

        "classification": classification_block,
        "grad_cam": grad_cam_block,
        "lesion_segmentation": lesion_segmentation_block,
        "vessel_segmentation": vessel_segmentation_block,

        "optic_disc": {"status": "not_implemented", "location": None},
        "fovea": {"status": "not_implemented", "location": None},
        "neovascularization": {"status": "not_implemented", "detected": None},
    }

    json_path = os.path.join(out_dir, f"{base}_result.json")
    with open(json_path, "w") as f:
        json.dump(result, f, indent=2)

    return result


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--image", required=True)
    ap.add_argument("--checkpoints-dir", default="runs/")
    ap.add_argument("--out-dir", default="runs/inference")
    args = ap.parse_args()

    result = run_pipeline(args.image, args.checkpoints_dir, args.out_dir)

    classification = result["classification"]
    if classification["grade"] is not None:
        print(f"Predicted grade: {classification['grade']} ({classification['grade_name']})")
        print(f"Calibrated grade probabilities: "
              + ", ".join(f"{p:.3f}" for p in classification["grade_probabilities_calibrated"]))
        referable = classification["referable"]
        print(f"Referable DR probability: {referable['probability']:.1%} "
              f"(threshold {referable['threshold']:.2f}) -> "
              f"{'REFERABLE' if referable['is_referable'] else 'not referable'}")
    else:
        print("Classification: failed (see [classification] error above)")

    grad_cam = result["grad_cam"]
    print(f"Grad-CAM overlay: {grad_cam['overlay_path']}")
    print(f"Grad-CAM heatmap: {grad_cam['heatmap_path']}")

    lesion_channels = result["lesion_segmentation"]["channels"]
    if lesion_channels:
        print("Lesion masks: " + ", ".join(
            f"{name}={info['mask_path']}" for name, info in lesion_channels.items()
        ))
    else:
        print("Lesion masks: failed (see [lesion_segmentation] error above)")

    print(f"Vessel mask: {result['vessel_segmentation']['mask_path']}")

    base = os.path.splitext(os.path.basename(args.image))[0]
    json_path = os.path.join(args.out_dir, f"{base}_result.json")
    print(f"Full result JSON: {json_path}")


if __name__ == "__main__":
    main()
