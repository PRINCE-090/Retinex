"""
K-fold cross-validation training for the DR severity classifier (+ referable-DR
head), adapted from train_classifier.py.

Problem this addresses: the single 80/20 train/val split used by
train_classifier.py (~83 validation images) produces a referable-DR threshold
that looks excellent on validation (AUC 0.97-0.98 across backbones) but
degrades sharply on the official test set (AUC ~0.91-0.92), with
sensitivity/specificity both falling short of target there. This gap suggests
the single validation split is too small/noisy to select a threshold that
generalizes. K-fold cross-validation addresses this directly by deriving the
threshold from many validation splits instead of one, and reporting the
spread (mean +/- std dev) across folds as a diagnostic:
  - LOW std dev  -> the single-split threshold was probably fine; the
                     val->test gap likely has a different cause (e.g. the
                     official test set's own distribution/label noise).
  - HIGH std dev -> the single-split threshold was likely unstable, and a
                     more robust threshold (e.g. the fold mean) should be
                     preferred.

CRITICAL -- leakage safety, same discipline as the rest of this project: the
OFFICIAL 103-image IDRiD test set is NEVER loaded anywhere in this script.
Only the 413-image training CSV ("train" split of IDRiDGradingDataset) is
ever split, into n_folds stratified folds by grade -- this script does not
use the "val"/"trainval_train" splits either, since those are just one more
single 80/20 split.

Run (from the src/ folder, or with src/ on PYTHONPATH):
  python train_classifier_kfold.py --data-dir "D:\\SIH\\Model" \\
      --backbone efficientnet_b0 --n-folds 5 --epochs 40 --batch-size 16 \\
      --out-dir runs/classifier_kfold
"""
import os
import argparse
import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, Subset
from sklearn.metrics import roc_auc_score

from model import DRClassifier
from idrid_dataset import IDRiDGradingDataset
from train_classifier import compute_class_weights, evaluate_epoch, find_validation_threshold

NUM_CLASSES = 5


def stratified_kfold_indices(grades, n_folds, seed=42):
    """Per-class shuffle-then-round-robin assignment into n_folds folds, so
    every fold contains every grade (including rare ones like grade 1) in
    roughly equal proportion. This is the same per-class stratification idea
    as IDRiDGradingDataset._stratified_split, generalized from a single
    train/val split to n_folds folds.

    Returns a list of n_folds arrays of positions into `grades`."""
    rng = np.random.RandomState(seed)
    folds = [[] for _ in range(n_folds)]
    for g in np.unique(grades):
        idx = np.where(grades == g)[0]
        rng.shuffle(idx)
        if len(idx) < n_folds:
            print(
                f"WARNING: grade {g} has only {len(idx)} example(s), fewer than "
                f"n_folds={n_folds} -- {n_folds - len(idx)} fold(s) will have zero "
                f"examples of this grade."
            )
        for i, pos in enumerate(idx):
            folds[i % n_folds].append(pos)
    return [np.array(sorted(f)) for f in folds]


def train_one_fold(fold_idx, train_idx, val_idx, full_train_aug, full_train_noaug,
                    df, device, args, fold_out_dir):
    """Trains a fresh model on `train_idx` (with augmentation) and validates on
    `val_idx` (no augmentation), same architecture/schedule as
    train_classifier.py's main(). Saves the fold's best checkpoint (by
    validation referable-DR ROC-AUC) to fold_out_dir/best.pt and returns a
    summary dict with that fold's best AUC and corresponding threshold."""
    os.makedirs(fold_out_dir, exist_ok=True)

    train_subset = Subset(full_train_aug, train_idx)
    val_subset = Subset(full_train_noaug, val_idx)
    train_loader = DataLoader(train_subset, batch_size=args.batch_size, shuffle=True, num_workers=4)
    val_loader = DataLoader(val_subset, batch_size=args.batch_size, shuffle=False, num_workers=4)

    train_class_counts = df.iloc[train_idx]["grade"].value_counts().sort_index()
    val_class_counts = df.iloc[val_idx]["grade"].value_counts().sort_index()
    print(f"\n===== Fold {fold_idx} =====")
    print(f"Train set size: {len(train_subset)} | Val set size: {len(val_subset)}")
    print(f"Train class counts:\n{train_class_counts}")
    print(f"Val class counts:\n{val_class_counts}")

    class_weights = compute_class_weights(train_class_counts, NUM_CLASSES).to(device)

    model = DRClassifier(backbone_name=args.backbone, num_grades=NUM_CLASSES,
                          pretrained=True).to(device)
    model.freeze_backbone()

    grade_criterion = nn.CrossEntropyLoss(weight=class_weights)
    ref_criterion = nn.BCEWithLogitsLoss()

    optimizer = torch.optim.Adam(
        [p for p in model.parameters() if p.requires_grad], lr=args.lr
    )

    best_auc = 0.0
    best_thresh, best_thresh_sens, best_thresh_spec = 0.5, 0.0, 0.0
    for epoch in range(1, args.epochs + 1):
        if epoch == args.unfreeze_at:
            print(f"Fold {fold_idx} | Epoch {epoch}: unfreezing backbone for full fine-tuning")
            model.unfreeze_backbone()
            optimizer = torch.optim.Adam(model.parameters(), lr=args.lr / 10)

        model.train()
        running_loss = 0.0
        for imgs, grades, referable in train_loader:
            imgs = imgs.to(device)
            grades = grades.to(device)
            referable = referable.float().to(device)

            optimizer.zero_grad()
            grade_logits, ref_logit = model(imgs)
            loss = (
                grade_criterion(grade_logits, grades)
                + args.referable_weight * ref_criterion(ref_logit, referable)
            )
            loss.backward()
            optimizer.step()
            running_loss += loss.item() * imgs.size(0)

        train_loss = running_loss / len(train_subset)
        grade_acc, sensitivity, specificity, ref_true, ref_prob = evaluate_epoch(
            model, val_loader, device, NUM_CLASSES
        )
        if len(np.unique(ref_true)) < 2:
            auc = float("nan")
        else:
            auc = roc_auc_score(ref_true, ref_prob)

        print(
            f"Fold {fold_idx} | Epoch {epoch:3d}/{args.epochs} | loss {train_loss:.4f} | "
            f"val_grade_acc {grade_acc:.3f} | val_referable_sens {sensitivity:.3f} | "
            f"val_referable_spec {specificity:.3f} | val_referable_auc {auc:.3f}"
        )

        if not np.isnan(auc) and auc > best_auc:
            best_auc = auc
            best_thresh, best_thresh_sens, best_thresh_spec = find_validation_threshold(
                ref_true, ref_prob, target_sens=args.target_sensitivity
            )
            torch.save({
                "model_state": model.state_dict(),
                "backbone": args.backbone,
                "fold": fold_idx,
                "epoch": epoch,
                "val_referable_auc": auc,
                "val_referable_sensitivity_at_0.5": sensitivity,
                "val_referable_specificity_at_0.5": specificity,
                "val_grade_acc": grade_acc,
                "val_referable_threshold": best_thresh,
                "val_referable_sensitivity_at_threshold": best_thresh_sens,
                "val_referable_specificity_at_threshold": best_thresh_spec,
                "threshold_target_sensitivity": args.target_sensitivity,
            }, os.path.join(fold_out_dir, "best.pt"))
            print(
                f"  -> fold {fold_idx} saved new best (val_referable_auc={auc:.3f}); "
                f"val threshold={best_thresh:.2f} -> sens={best_thresh_sens:.3f}, spec={best_thresh_spec:.3f}"
            )

    print(f"Fold {fold_idx} done. Best VALIDATION referable-DR ROC-AUC: {best_auc:.3f}")
    return {
        "fold": fold_idx,
        "val_auc": best_auc,
        "val_threshold": best_thresh,
        "val_threshold_sensitivity": best_thresh_sens,
        "val_threshold_specificity": best_thresh_spec,
        "checkpoint": os.path.join(fold_out_dir, "best.pt"),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data-dir", default="data/idrid")
    ap.add_argument("--backbone", default="efficientnet_b0",
                     choices=["resnet50", "efficientnet_b0", "densenet121"])
    ap.add_argument("--n-folds", type=int, default=5)
    ap.add_argument("--epochs", type=int, default=40)
    ap.add_argument("--batch-size", type=int, default=16)
    ap.add_argument("--lr", type=float, default=1e-4)
    ap.add_argument("--img-size", type=int, default=380)
    ap.add_argument("--unfreeze-at", type=int, default=5,
                     help="epoch at which to unfreeze the backbone for full fine-tuning")
    ap.add_argument("--referable-weight", type=float, default=0.5,
                     help="loss weight for the binary referable-DR head vs the 5-class head")
    ap.add_argument("--target-sensitivity", type=float, default=0.90,
                     help="target referable-DR sensitivity used to pick each fold's validation operating threshold")
    ap.add_argument("--out-dir", default="runs/classifier_kfold")
    args = ap.parse_args()

    os.makedirs(args.out_dir, exist_ok=True)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")

    # IMPORTANT: split="train" here loads the FULL 413-image training CSV,
    # unfiltered -- no "val"/"trainval_train" carve-out. It is split into
    # n_folds stratified folds below. The official IDRiD test set (split="test")
    # is NEVER loaded anywhere in this script.
    full_train_aug = IDRiDGradingDataset(args.data_dir, split="train",
                                          img_size=args.img_size, augment=True)
    full_train_noaug = IDRiDGradingDataset(args.data_dir, split="train",
                                            img_size=args.img_size, augment=False)
    df = full_train_noaug.df
    grades = df["grade"].values
    print(f"Full training set size: {len(df)}")
    print(f"Full training class counts:\n{df['grade'].value_counts().sort_index()}")

    folds = stratified_kfold_indices(grades, args.n_folds, seed=42)

    fold_summaries = []
    for fold_idx in range(args.n_folds):
        val_idx = folds[fold_idx]
        train_idx = np.concatenate([folds[j] for j in range(args.n_folds) if j != fold_idx])
        fold_out_dir = os.path.join(args.out_dir, f"fold_{fold_idx}")
        summary = train_one_fold(
            fold_idx, train_idx, val_idx, full_train_aug, full_train_noaug,
            df, device, args, fold_out_dir,
        )
        fold_summaries.append(summary)

    thresholds = np.array([s["val_threshold"] for s in fold_summaries])
    aucs = np.array([s["val_auc"] for s in fold_summaries])
    mean_thresh = float(thresholds.mean())
    std_thresh = float(thresholds.std())

    print("\n===== K-fold summary =====")
    for s in fold_summaries:
        print(
            f"Fold {s['fold']}: val_auc={s['val_auc']:.3f} | "
            f"val_threshold={s['val_threshold']:.2f} "
            f"(sens={s['val_threshold_sensitivity']:.3f}, spec={s['val_threshold_specificity']:.3f}) | "
            f"checkpoint={s['checkpoint']}"
        )

    print(f"\nMean val AUC:        {aucs.mean():.3f} (std {aucs.std():.3f})")
    print(f"Mean val threshold:  {mean_thresh:.3f} +/- {std_thresh:.3f} (std dev)")

    HIGH_VARIANCE_CUTOFF = 0.05
    if std_thresh > HIGH_VARIANCE_CUTOFF:
        verdict = "HIGH variance -- single-split threshold was likely unstable"
    else:
        verdict = "LOW variance -- single-split threshold was likely fine"
    print(f"\nVerdict: threshold = {mean_thresh:.3f} +/- {std_thresh:.3f} -> {verdict}")
    print(f"All {args.n_folds} fold checkpoints saved under: {args.out_dir}/fold_<i>/best.pt")
    print("These can be ensembled (see evaluate_ensemble.py) or used to pick a "
          "single fold's config for a final retrain-on-full-data run.")
    print("NOTE: none of the numbers above touch the official IDRiD test set -- "
          "run evaluate.py / evaluate_ensemble.py separately, once, for final numbers.")


if __name__ == "__main__":
    main()
