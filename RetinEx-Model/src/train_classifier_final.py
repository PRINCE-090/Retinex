"""
Final DR classifier training run, adapted from train_classifier.py.

Purpose: the k-fold experiment (train_classifier_kfold.py) found that
per-split threshold selection was HIGH variance (std dev 0.096 across 5
folds, individual fold thresholds ranging 0.32-0.57) while the model's own
discriminative ability was consistently strong regardless of split (mean
validation referable-DR ROC-AUC 0.974, std dev only 0.014). That means a
threshold picked from any single ~83-image validation split is unreliable,
but the model itself doesn't need that split to be good.

This script acts on that finding directly: it trains one final model on ALL
413 training images (no held-out validation split, so nothing is wasted on
carving out a split whose only prior purpose was picking an unreliable
threshold), and uses a FIXED threshold taken from the k-fold mean instead of
deriving one from any single split. Training on all 413 images should also
modestly help the model itself, on top of fixing the threshold instability.

CRITICAL -- leakage safety, same as every other script in this project: the
official 103-image IDRiD test set (split="test") is NEVER loaded anywhere in
this file. This script only ever sees the 413-image training CSV, loaded
with split="train" and no further split. evaluate.py remains the ONLY
script that loads the test set, and should be run separately, once,
afterward, for final numbers -- it needs no changes, since the checkpoint
saved here uses the same 'val_referable_threshold' key it already expects.

Run (from the src/ folder, or with src/ on PYTHONPATH):
  python train_classifier_final.py --data-dir "D:\\SIH\\Model" \\
      --backbone efficientnet_b0 --epochs 40 --batch-size 16 \\
      --out-dir runs/classifier_final
"""
import os
import argparse
import torch
import torch.nn as nn
from torch.utils.data import DataLoader

from model import DRClassifier
from idrid_dataset import IDRiDGradingDataset
from train_classifier import compute_class_weights

NUM_CLASSES = 5

# Hardcoded from the actual train_classifier_kfold.py run this script's fixed
# threshold is derived from, for traceability -- NOT recomputed here, since
# this script trains on all 413 images and has no held-out split to compute
# them from.
KFOLD_FOLD_THRESHOLDS = [0.57, 0.42, 0.32, 0.57, 0.51]
KFOLD_MEAN_AUC = 0.974
KFOLD_THRESHOLD_STD = 0.096


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
    ap.add_argument("--fixed-threshold", type=float, default=0.478,
                     help="fixed referable-DR decision threshold, derived from the "
                          "k-fold mean rather than selected on any single validation split")
    ap.add_argument("--out-dir", default="runs/classifier_final")
    args = ap.parse_args()

    os.makedirs(args.out_dir, exist_ok=True)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")

    # IMPORTANT: split="train" loads the FULL 413-image training CSV,
    # completely unfiltered -- no "val"/"trainval_train" carve-out. There is
    # no held-out split in this script by design: the referable-DR threshold
    # comes from args.fixed_threshold (the k-fold mean), not from validation
    # data. The official IDRiD test set (split="test") is NEVER loaded here.
    train_set = IDRiDGradingDataset(args.data_dir, split="train",
                                     img_size=args.img_size, augment=True)
    train_loader = DataLoader(train_set, batch_size=args.batch_size, shuffle=True, num_workers=4)

    print(f"Train set size: {len(train_set)}")
    print(f"Train class counts:\n{train_set.class_counts()}")

    class_weights = compute_class_weights(train_set.class_counts(), NUM_CLASSES).to(device)
    print(f"Class weights (inverse-frequency, mean-normalized): {class_weights.tolist()}")

    model = DRClassifier(backbone_name=args.backbone, num_grades=NUM_CLASSES,
                          pretrained=True).to(device)
    model.freeze_backbone()

    grade_criterion = nn.CrossEntropyLoss(weight=class_weights)
    ref_criterion = nn.BCEWithLogitsLoss()

    optimizer = torch.optim.Adam(
        [p for p in model.parameters() if p.requires_grad], lr=args.lr
    )

    last_path = os.path.join(args.out_dir, "last.pt")
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
        # No validation split exists in this script, so there is no per-epoch
        # validation metric to print or select a "best" checkpoint by -- this
        # is expected. Every epoch's state is saved to a rolling last.pt so a
        # crash mid-training doesn't lose everything.
        print(f"Epoch {epoch:3d}/{args.epochs} | loss {train_loss:.4f}")
        torch.save({
            "model_state": model.state_dict(),
            "backbone": args.backbone,
            "epoch": epoch,
        }, last_path)

    best_path = os.path.join(args.out_dir, "best.pt")
    torch.save({
        "model_state": model.state_dict(),
        "backbone": args.backbone,
        "epochs_trained": args.epochs,
        # Named to match the key evaluate.py already reads, so evaluate.py
        # works on this checkpoint completely unchanged.
        "val_referable_threshold": args.fixed_threshold,
        "threshold_source": "kfold_mean",
        "kfold_fold_thresholds": KFOLD_FOLD_THRESHOLDS,
        "kfold_mean_auc": KFOLD_MEAN_AUC,
        "kfold_threshold_std": KFOLD_THRESHOLD_STD,
    }, best_path)

    print(f"\nTraining done. Trained on all {len(train_set)} training images for {args.epochs} epochs.")
    print(f"Rolling checkpoint (every epoch): {last_path}")
    print(f"Final checkpoint: {best_path}")
    print(f"Fixed referable-DR threshold (source: kfold_mean): {args.fixed_threshold}")
    print("NOTE: this script never loaded the official IDRiD test set. Run "
          "evaluate.py separately, once, on this checkpoint for final numbers.")


if __name__ == "__main__":
    main()
