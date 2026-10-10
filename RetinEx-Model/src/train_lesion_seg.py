"""
Trains a multi-channel U-Net for IDRiD lesion segmentation:
  channel 0: Microaneurysms (MA)
  channel 1: Haemorrhages   (HE)
  channel 2: Hard Exudates  (EX)
  channel 3: Soft Exudates  (SE)

Uses the SEGMENTATION training set (54 images total, NOT the 413-image
disease-grading set), split once at the image level into train/val (see
idrid_lesion_dataset.split_image_ids). Mask availability differs per lesion
type (MA=54, HE=53, EX=54, SE=26 images) -- masked_bce_dice_loss (unet.py)
excludes missing masks from the loss rather than treating them as confirmed
background.

Run (from the src/ folder):
  python train_lesion_seg.py --data-dir "D:\\SIH\\Model" --epochs 60 \
      --batch-size 4 --img-size 512 --out-dir runs\\lesion_unet
"""
import os
import argparse
import numpy as np
import torch
from torch.utils.data import DataLoader

from unet import UNet, masked_bce_dice_loss, masked_dice_score_per_channel
from idrid_lesion_dataset import IDRiDLesionDataset, LESION_CHANNELS, split_image_ids


def evaluate_epoch(model, loader, device, extra_thresholds=(0.5, 0.3, 0.1)):
    """Runs on the VALIDATION loader. Returns:
      - per-channel mean dice at threshold 0.5 (list of length 4, None for a
        channel with zero available masks in this split)
      - a dict {threshold: dice} of MA-only dice at each of extra_thresholds,
        a diagnostic to see how much MA's soft probabilities have shifted
        and at what operating point, since MA is the sparsest/hardest channel.
    """
    model.eval()
    # Accumulate per-channel weighted sums so we average correctly across
    # variable-size batches, same skip-missing rule as training.
    channel_dice_sum = [0.0] * len(LESION_CHANNELS)
    channel_dice_count = [0.0] * len(LESION_CHANNELS)

    ma_idx = LESION_CHANNELS.index("MA")
    ma_dice_sum = {t: 0.0 for t in extra_thresholds}
    ma_dice_count = {t: 0.0 for t in extra_thresholds}

    with torch.no_grad():
        for imgs, masks, availability in loader:
            imgs = imgs.to(device)
            masks = masks.to(device)
            availability = availability.to(device)

            logits = model(imgs)
            batch_dice = masked_dice_score_per_channel(logits, masks, availability)
            # batch_dice is a list of per-channel means over THIS batch only;
            # to combine across batches correctly we need counts, not just
            # means, so recompute the weighted contribution here.
            n_avail_per_channel = availability.sum(dim=0).cpu().numpy()  # (C,)
            for c in range(len(LESION_CHANNELS)):
                if batch_dice[c] is not None and n_avail_per_channel[c] > 0:
                    channel_dice_sum[c] += batch_dice[c] * n_avail_per_channel[c]
                    channel_dice_count[c] += n_avail_per_channel[c]

            n_avail_ma = n_avail_per_channel[ma_idx]
            if n_avail_ma > 0:
                for t in extra_thresholds:
                    batch_dice_t = masked_dice_score_per_channel(
                        logits, masks, availability, threshold=t
                    )
                    if batch_dice_t[ma_idx] is not None:
                        ma_dice_sum[t] += batch_dice_t[ma_idx] * n_avail_ma
                        ma_dice_count[t] += n_avail_ma

    results = []
    for c in range(len(LESION_CHANNELS)):
        if channel_dice_count[c] == 0:
            results.append(None)
        else:
            results.append(channel_dice_sum[c] / channel_dice_count[c])

    ma_multi_threshold = {
        t: (ma_dice_sum[t] / ma_dice_count[t] if ma_dice_count[t] > 0 else None)
        for t in extra_thresholds
    }
    return results, ma_multi_threshold


def format_dice_list(dice_list):
    parts = []
    for name, val in zip(LESION_CHANNELS, dice_list):
        parts.append(f"{name}={'n/a' if val is None else f'{val:.4f}'}")
    return " ".join(parts)


def format_ma_multi_threshold(ma_multi_threshold):
    parts = []
    for t, val in ma_multi_threshold.items():
        parts.append(f"t={t}:{'n/a' if val is None else f'{val:.4f}'}")
    return " ".join(parts)


def mean_available_dice(dice_list):
    """Mean over channels that have a value, for a single scalar to track
    'best' checkpoints by. Channels with no available val masks (shouldn't
    happen with a reasonable split, but possible for SE with only 26 images)
    are excluded rather than counted as 0."""
    available = [v for v in dice_list if v is not None]
    if not available:
        return 0.0
    return float(np.mean(available))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data-dir", default="data")
    ap.add_argument("--epochs", type=int, default=60)
    ap.add_argument("--batch-size", type=int, default=4)
    ap.add_argument("--lr", type=float, default=1e-3)
    ap.add_argument("--img-size", type=int, default=512)
    ap.add_argument("--val-fraction", type=float, default=0.2)
    ap.add_argument("--out-dir", default="runs/lesion_unet")
    ap.add_argument("--ma-channel-weight", type=float, default=3.0,
                     help="Multiplier applied to MA's BCE+Dice contribution to the "
                          "final loss (channel_weight in masked_bce_dice_loss). "
                          "Other channels stay at 1.0.")
    ap.add_argument("--ma-pos-weight-cap", type=float, default=40.0,
                     help="Per-channel max_weight ceiling for MA's BCE pos_weight "
                          "(compute_pos_weights). HE/EX/SE stay capped at 15.0.")
    args = ap.parse_args()

    os.makedirs(args.out_dir, exist_ok=True)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")

    # Discover all segmentation-training image IDs, then split ONCE at the
    # image level (not per lesion type) -- see idrid_lesion_dataset.py.
    all_ids = IDRiDLesionDataset.discover_all_image_ids(args.data_dir)
    print(f"Found {len(all_ids)} segmentation training images.")
    train_ids, val_ids = split_image_ids(all_ids, val_fraction=args.val_fraction)
    print(f"Train: {len(train_ids)} images | Val: {len(val_ids)} images")
    print("NOTE: this split is small and not stratified by lesion-mask "
          "availability (see idrid_lesion_dataset.split_image_ids docstring). "
          "Treat per-lesion val dice, especially for Soft Exudates, with caution.")

    # Per-channel BCE pos_weight, computed from TRAIN masks only (never val/test),
    # to counteract severe foreground/background imbalance for small lesions like
    # MA and HE -- see IDRiDLesionDataset.compute_pos_weights for why this matters.
    pos_weight_caps = {"MA": args.ma_pos_weight_cap, "HE": 15.0, "EX": 15.0, "SE": 15.0}
    pos_weights = IDRiDLesionDataset.compute_pos_weights(
        args.data_dir, train_ids, max_weight=pos_weight_caps
    )
    print("Per-channel BCE pos_weight (sqrt-dampened neg/pos ratio, per-channel cap "
          + ", ".join(f"{name}={pos_weight_caps[name]:.1f}" for name in LESION_CHANNELS) + "): "
          + ", ".join(f"{name}={w:.2f}" for name, w in zip(LESION_CHANNELS, pos_weights.tolist())))

    # Per-channel loss weight multiplier -- boosts MA's contribution to the
    # SUMMED loss (not just its internal BCE pixel weighting), since Dice
    # currently treats all 4 channels equally when combined into the final
    # scalar loss and MA's gradient signal otherwise gets diluted by HE/EX/SE.
    channel_weights = torch.tensor(
        [args.ma_channel_weight if name == "MA" else 1.0 for name in LESION_CHANNELS],
        dtype=torch.float32,
    )
    print("Per-channel loss weight multiplier: "
          + ", ".join(f"{name}={w:.2f}" for name, w in zip(LESION_CHANNELS, channel_weights.tolist())))

    train_set = IDRiDLesionDataset(args.data_dir, train_ids,
                                    img_size=args.img_size, augment=True)
    val_set = IDRiDLesionDataset(args.data_dir, val_ids,
                                  img_size=args.img_size, augment=False)

    train_loader = DataLoader(train_set, batch_size=args.batch_size, shuffle=True, num_workers=2)
    val_loader = DataLoader(val_set, batch_size=args.batch_size, shuffle=False, num_workers=2)

    # Report how many train/val images actually have each lesion's mask,
    # since this varies a lot per channel (MA/HE/EX ~all, SE ~half).
    from idrid_lesion_dataset import LESION_FOLDER_NAMES, DEFAULT_MASK_ROOT
    mask_root = os.path.join(args.data_dir, DEFAULT_MASK_ROOT)
    for split_name, ids in (("Train", train_ids), ("Val", val_ids)):
        counts = {name: 0 for name in LESION_CHANNELS}
        for image_id in ids:
            for name in LESION_CHANNELS:
                mask_path = os.path.join(
                    mask_root, LESION_FOLDER_NAMES[name], f"{image_id}_{name}.tif"
                )
                if os.path.exists(mask_path):
                    counts[name] += 1
        print(f"{split_name} mask availability: "
              + ", ".join(f"{k}={v}" for k, v in counts.items()))

    model = UNet(in_channels=3, out_channels=len(LESION_CHANNELS), base_ch=32).to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=args.lr)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=args.epochs)

    best_mean_dice = 0.0
    for epoch in range(1, args.epochs + 1):
        model.train()
        train_loss = 0.0
        n_samples = 0
        for imgs, masks, availability in train_loader:
            imgs = imgs.to(device)
            masks = masks.to(device)
            availability = availability.to(device)

            optimizer.zero_grad()
            logits = model(imgs)
            loss = masked_bce_dice_loss(logits, masks, availability, pos_weight=pos_weights,
                                         channel_weight=channel_weights)
            loss.backward()
            optimizer.step()
            train_loss += loss.item() * imgs.size(0)
            n_samples += imgs.size(0)
        train_loss /= max(n_samples, 1)
        scheduler.step()

        val_dice_per_channel, ma_multi_threshold = evaluate_epoch(model, val_loader, device)
        mean_dice = mean_available_dice(val_dice_per_channel)

        print(
            f"Epoch {epoch:3d}/{args.epochs} | train_loss {train_loss:.4f} | "
            f"val_dice [{format_dice_list(val_dice_per_channel)}] | "
            f"mean {mean_dice:.4f} | "
            f"MA@thresholds [{format_ma_multi_threshold(ma_multi_threshold)}]"
        )

        if mean_dice > best_mean_dice:
            best_mean_dice = mean_dice
            torch.save({
                "model_state": model.state_dict(),
                "lesion_channels": LESION_CHANNELS,
                "img_size": args.img_size,
                "val_dice_per_channel": dict(zip(LESION_CHANNELS, val_dice_per_channel)),
                "val_mean_dice": mean_dice,
                "epoch": epoch,
            }, os.path.join(args.out_dir, "best.pt"))
            print(f"  -> saved new best (mean_dice={mean_dice:.4f})")

    print(f"Training done. Best VALIDATION mean dice (available channels): {best_mean_dice:.4f}")
    print(f"Checkpoint: {os.path.join(args.out_dir, 'best.pt')}")
    print("NOTE: this val set has only "
          f"{len(val_ids)} images total, and Soft Exudates masks are sparse "
          "even within that. Do not treat per-lesion dice, especially SE, as "
          "a precise or final number.")


if __name__ == "__main__":
    main()
