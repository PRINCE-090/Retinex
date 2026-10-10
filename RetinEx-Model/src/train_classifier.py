"""
Trains the DR severity classifier (+ referable-DR head) via transfer learning.

Trains on the "trainval_train" split and selects the best checkpoint using
the "val" split (both carved out of the IDRiD training CSV/images — see
idrid_dataset.py). The official IDRiD test split is never loaded here; run
evaluate.py separately, once, after training is finished, for final numbers.

Run (from the src/ folder, or with src/ on PYTHONPATH):
  python train_classifier.py --data-dir "D:\\SIH\\Model" --backbone efficientnet_b0 \
      --epochs 40 --batch-size 16 --out-dir runs/classifier
"""
import os
import argparse
import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader
from sklearn.metrics import recall_score, roc_auc_score

from model import DRClassifier
from idrid_dataset import IDRiDGradingDataset


def compute_class_weights(class_counts, num_classes):
    """Inverse-frequency weights, normalized to mean 1, for the weighted CE loss."""
    counts = np.array([class_counts.get(i, 1) for i in range(num_classes)], dtype=np.float32)
    weights = 1.0 / counts
    weights = weights / weights.mean()
    return torch.tensor(weights, dtype=torch.float32)


def evaluate_epoch(model, loader, device, num_classes):
    """Runs on the VALIDATION loader only (see main()). Returns grade accuracy,
    referable sensitivity/specificity at the default 0.5 cutoff (for per-epoch
    monitoring/printing), and the raw referable probabilities + labels (for
    ROC-AUC and threshold selection, computed by the caller)."""
    model.eval()
    all_grade_true, all_grade_pred = [], []
    all_ref_true, all_ref_prob = [], []
    with torch.no_grad():
        for imgs, grades, referable in loader:
            imgs = imgs.to(device)
            grade_logits, ref_logit = model(imgs)
            grade_pred = grade_logits.argmax(dim=1).cpu().numpy()
            ref_prob = torch.sigmoid(ref_logit).cpu().numpy()

            all_grade_true.extend(grades.numpy())
            all_grade_pred.extend(grade_pred)
            all_ref_true.extend(referable.numpy())
            all_ref_prob.extend(ref_prob)

    all_ref_true = np.array(all_ref_true)
    all_ref_prob = np.array(all_ref_prob)
    all_ref_pred_at_half = (all_ref_prob > 0.5).astype(int)

    grade_acc = np.mean(np.array(all_grade_true) == np.array(all_grade_pred))
    ref_sensitivity = recall_score(all_ref_true, all_ref_pred_at_half, pos_label=1, zero_division=0)
    ref_specificity = recall_score(all_ref_true, all_ref_pred_at_half, pos_label=0, zero_division=0)
    return grade_acc, ref_sensitivity, ref_specificity, all_ref_true, all_ref_prob


def sensitivity_specificity_at_threshold(y_true, y_prob, threshold):
    y_pred = (y_prob >= threshold).astype(int)
    tp = np.sum((y_pred == 1) & (y_true == 1))
    fn = np.sum((y_pred == 0) & (y_true == 1))
    tn = np.sum((y_pred == 0) & (y_true == 0))
    fp = np.sum((y_pred == 1) & (y_true == 0))
    sensitivity = tp / (tp + fn + 1e-8)
    specificity = tn / (tn + fp + 1e-8)
    return sensitivity, specificity


def find_validation_threshold(y_true, y_prob, target_sens=0.90):
    """Sweeps thresholds on VALIDATION referable probabilities only and returns
    the one with the highest specificity among thresholds meeting target_sens.
    This threshold is saved into the checkpoint and must be applied UNCHANGED
    to the official test set in evaluate.py — never re-swept on test labels."""
    best_thresh, best_spec, best_sens = 0.5, 0.0, 0.0
    for t in np.linspace(0.01, 0.99, 99):
        sens, spec = sensitivity_specificity_at_threshold(y_true, y_prob, t)
        if sens >= target_sens and spec > best_spec:
            best_thresh, best_spec, best_sens = t, spec, sens
    return best_thresh, best_sens, best_spec


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data-dir", default="data/idrid")
    ap.add_argument("--backbone", default="efficientnet_b0",
                     choices=["resnet50", "efficientnet_b0", "densenet121"])
    ap.add_argument("--epochs", type=int, default=40)
    ap.add_argument("--batch-size", type=int, default=16)
    ap.add_argument("--lr", type=float, default=1e-4)
    ap.add_argument("--img-size", type=int, default=380)
    ap.add_argument("--unfreeze-at", type=int, default=5,
                     help="epoch at which to unfreeze the backbone for full fine-tuning")
    ap.add_argument("--referable-weight", type=float, default=0.5,
                     help="loss weight for the binary referable-DR head vs the 5-class head")
    ap.add_argument("--target-sensitivity", type=float, default=0.90,
                     help="target referable-DR sensitivity used to pick the validation operating threshold")
    ap.add_argument("--out-dir", default="runs/classifier")
    args = ap.parse_args()

    os.makedirs(args.out_dir, exist_ok=True)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")

    # IMPORTANT: "trainval_train" and "val" are both carved out of the training
    # CSV/images only (see idrid_dataset.py). The official IDRiD test set is
    # NOT loaded anywhere in this script — it is reserved for evaluate.py,
    # run once, after training and threshold/calibration decisions are final.
    train_set = IDRiDGradingDataset(args.data_dir, split="trainval_train",
                                     img_size=args.img_size, augment=True)
    val_set = IDRiDGradingDataset(args.data_dir, split="val",
                                   img_size=args.img_size, augment=False)

    train_loader = DataLoader(train_set, batch_size=args.batch_size, shuffle=True, num_workers=4)
    val_loader = DataLoader(val_set, batch_size=args.batch_size, shuffle=False, num_workers=4)

    num_classes = 5
    print(f"Train set size: {len(train_set)} | Val set size: {len(val_set)}")
    print(f"Train class counts:\n{train_set.class_counts()}")
    print(f"Val class counts:\n{val_set.class_counts()}")

    class_weights = compute_class_weights(train_set.class_counts(), num_classes).to(device)
    print(f"Class weights (inverse-frequency, mean-normalized): {class_weights.tolist()}")

    model = DRClassifier(backbone_name=args.backbone, num_grades=num_classes,
                          pretrained=True).to(device)
    model.freeze_backbone()

    grade_criterion = nn.CrossEntropyLoss(weight=class_weights)
    ref_criterion = nn.BCEWithLogitsLoss()

    optimizer = torch.optim.Adam(
        [p for p in model.parameters() if p.requires_grad], lr=args.lr
    )

    best_auc = 0.0
    for epoch in range(1, args.epochs + 1):
        if epoch == args.unfreeze_at:
            print(f"Epoch {epoch}: unfreezing backbone for full fine-tuning")
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

        train_loss = running_loss / len(train_set)
        # Model selection happens on the VALIDATION set only. The official test
        # set is never loaded in this script, so it cannot leak into checkpoint
        # selection, the unfreeze schedule, or any hyperparameter here.
        grade_acc, sensitivity, specificity, ref_true, ref_prob = evaluate_epoch(
            model, val_loader, device, num_classes
        )
        # ROC-AUC needs both classes present in the batch of labels; guard against
        # a degenerate val set (shouldn't happen with the stratified split, but
        # cheap to check).
        if len(np.unique(ref_true)) < 2:
            auc = float("nan")
        else:
            auc = roc_auc_score(ref_true, ref_prob)

        print(
            f"Epoch {epoch:3d}/{args.epochs} | loss {train_loss:.4f} | "
            f"val_grade_acc {grade_acc:.3f} | val_referable_sens {sensitivity:.3f} | "
            f"val_referable_spec {specificity:.3f} | val_referable_auc {auc:.3f}"
        )

        # Model-select on validation referable-DR ROC-AUC rather than sensitivity
        # alone. Sensitivity-only selection can favor a checkpoint that predicts
        # almost everything as referable (high sensitivity, collapsed specificity).
        # ROC-AUC measures ranking quality across all thresholds, so it can't be
        # gamed that way. Sensitivity/specificity/accuracy are still tracked and
        # printed every epoch for visibility.
        if not np.isnan(auc) and auc > best_auc:
            best_auc = auc
            # Pick the validation operating threshold for the target sensitivity.
            # This threshold is fixed here and must be applied unchanged to the
            # official test set in evaluate.py -- never re-swept on test labels.
            val_thresh, val_thresh_sens, val_thresh_spec = find_validation_threshold(
                ref_true, ref_prob, target_sens=args.target_sensitivity
            )
            torch.save({
                "model_state": model.state_dict(),
                "backbone": args.backbone,
                "epoch": epoch,
                "val_referable_auc": auc,
                "val_referable_sensitivity_at_0.5": sensitivity,
                "val_referable_specificity_at_0.5": specificity,
                "val_grade_acc": grade_acc,
                "val_referable_threshold": val_thresh,
                "val_referable_sensitivity_at_threshold": val_thresh_sens,
                "val_referable_specificity_at_threshold": val_thresh_spec,
                "threshold_target_sensitivity": args.target_sensitivity,
            }, os.path.join(args.out_dir, "best.pt"))
            print(
                f"  -> saved new best (val_referable_auc={auc:.3f}); "
                f"val threshold={val_thresh:.2f} -> sens={val_thresh_sens:.3f}, spec={val_thresh_spec:.3f}"
            )

    print(f"Training done. Best VALIDATION referable-DR ROC-AUC: {best_auc:.3f}")
    print(f"Checkpoint: {os.path.join(args.out_dir, 'best.pt')}")
    print("NOTE: the saved 'val_referable_threshold' was chosen on validation data only.")
    print("evaluate.py must load and apply it unchanged to the official test set.")
    print("NOTE: the numbers above are on the validation split. Run evaluate.py "
          "on the held-out test split for the final, reportable metrics.")


if __name__ == "__main__":
    main()
