"""
Loads a trained lesion-segmentation U-Net checkpoint and inspects its
predictions on a few VALIDATION images (the same split used during training).

For each image, saves a figure with one row per lesion channel (MA, HE, EX,
SE), each row showing: original image | ground truth | predicted probability
heatmap | predicted mask thresholded at 0.5.

Also prints, per image per channel, numeric diagnostics:
  - whether that channel's mask is even available for this image
  - GT positive pixel count
  - predicted probability min/mean/max
  - predicted positive pixel count at several thresholds (0.5, 0.3, 0.1, 0.05)

This is diagnostic-only: it does not retrain or change anything. The goal is
to see WHY MA dice is ~0 before deciding what (if anything) to fix.

Run (from the src/ folder):
  python inspect_lesion_predictions.py --checkpoint runs\\lesion_unet\\best.pt ^
      --data-dir "D:\\SIH\\Model" --num-images 4 --out-dir runs\\lesion_inspect
"""
import os
import argparse
import numpy as np
import torch
import matplotlib.pyplot as plt

from unet import UNet
from idrid_lesion_dataset import IDRiDLesionDataset, LESION_CHANNELS, split_image_ids

THRESHOLDS = [0.5, 0.3, 0.1, 0.05]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--checkpoint", required=True)
    ap.add_argument("--data-dir", required=True)
    ap.add_argument("--val-fraction", type=float, default=0.2,
                     help="MUST match the value used for the training run that "
                          "produced --checkpoint, or you will inspect the wrong "
                          "images (some may have been seen during training).")
    ap.add_argument("--num-images", type=int, default=4)
    ap.add_argument("--out-dir", default="runs/lesion_inspect")
    args = ap.parse_args()

    os.makedirs(args.out_dir, exist_ok=True)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")

    ckpt = torch.load(args.checkpoint, map_location=device, weights_only=False)
    img_size = ckpt.get("img_size", 512)
    print(f"Checkpoint img_size: {img_size}")
    if "val_dice_per_channel" in ckpt:
        print(f"Checkpoint-reported val dice per channel: {ckpt['val_dice_per_channel']}")

    model = UNet(in_channels=3, out_channels=len(LESION_CHANNELS), base_ch=32).to(device)
    model.load_state_dict(ckpt["model_state"])
    model.eval()

    # Rebuild the SAME train/val split used during training (same seed=42
    # inside split_image_ids). --val-fraction must match the training run.
    all_ids = IDRiDLesionDataset.discover_all_image_ids(args.data_dir)
    _, val_ids = split_image_ids(all_ids, val_fraction=args.val_fraction)
    print(f"Validation set ({len(val_ids)} images): {val_ids}")

    n_to_show = min(args.num_images, len(val_ids))
    val_ids_subset = val_ids[:n_to_show]

    val_set = IDRiDLesionDataset(args.data_dir, val_ids_subset,
                                  img_size=img_size, augment=False)

    for i, image_id in enumerate(val_ids_subset):
        img_t, mask_t, availability_t = val_set[i]

        with torch.no_grad():
            logits = model(img_t.unsqueeze(0).to(device))
            probs = torch.sigmoid(logits)[0].cpu().numpy()  # (C, H, W)

        # Undo ImageNet normalization just for display.
        mean = np.array([0.485, 0.456, 0.406]).reshape(3, 1, 1)
        std = np.array([0.229, 0.224, 0.225]).reshape(3, 1, 1)
        img_display = (img_t.numpy() * std + mean).clip(0, 1).transpose(1, 2, 0)

        mask_np = mask_t.numpy()          # (C, H, W)
        availability_np = availability_t.numpy()  # (C,)

        print()
        print("=" * 60)
        print(f"{image_id}")
        print("=" * 60)

        fig, axes = plt.subplots(len(LESION_CHANNELS), 4, figsize=(16, 4 * len(LESION_CHANNELS)))

        for c, channel in enumerate(LESION_CHANNELS):
            gt = mask_np[c]
            pred_prob = probs[c]
            available = bool(availability_np[c])

            gt_pos = int(gt.sum()) if available else None
            prob_min, prob_mean, prob_max = pred_prob.min(), pred_prob.mean(), pred_prob.max()
            pred_counts = {t: int((pred_prob >= t).sum()) for t in THRESHOLDS}

            avail_str = "available" if available else "NO GT (skipped in training/metrics)"
            print(f"  [{channel}] mask: {avail_str}"
                  + (f", GT positive pixels={gt_pos}" if available else ""))
            print(f"    pred prob: min={prob_min:.4f} mean={prob_mean:.4f} max={prob_max:.4f}")
            print(f"    pred positive pixel count @ threshold: "
                  + ", ".join(f"{t}={pred_counts[t]}" for t in THRESHOLDS))

            axes[c, 0].imshow(img_display)
            axes[c, 0].set_title(f"{image_id} — original" if c == 0 else "")
            axes[c, 0].axis("off")

            axes[c, 1].imshow(gt, cmap="gray", vmin=0, vmax=1)
            axes[c, 1].set_title(f"{channel} — ground truth" + ("" if available else " (missing!)"))
            axes[c, 1].axis("off")

            im = axes[c, 2].imshow(pred_prob, cmap="jet", vmin=0, vmax=1)
            axes[c, 2].set_title(f"{channel} — predicted probability")
            axes[c, 2].axis("off")

            axes[c, 3].imshow(pred_prob >= 0.5, cmap="gray", vmin=0, vmax=1)
            axes[c, 3].set_title(f"{channel} — predicted mask @0.5")
            axes[c, 3].axis("off")

        plt.tight_layout()
        out_path = os.path.join(args.out_dir, f"{image_id}_inspection.png")
        plt.savefig(out_path, dpi=130, bbox_inches="tight")
        plt.close()
        print(f"  Saved: {out_path}")

    print()
    print("Done. Open the saved PNGs and look especially at the MA row:")
    print("  - If the MA probability heatmap is uniformly near 0 everywhere,")
    print("    the model has essentially given up on that channel.")
    print("  - If it shows faint warm spots roughly where GT dots are, but")
    print("    below 0.5, thresholding (not the model) is the immediate issue.")
    print("  - If warm spots appear in the WRONG places, that's a localization")
    print("    problem, not a threshold problem.")


if __name__ == "__main__":
    main()
