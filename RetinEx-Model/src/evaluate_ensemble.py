"""
Full evaluation report for an ENSEMBLE of DR classifier checkpoints (e.g. one
each of resnet50/efficientnet_b0/densenet121): per-class metrics, confusion
matrix, and referable-DR (grade>=2) sensitivity/specificity/ROC-AUC on the
official held-out test set, using simple mean-probability ensembling.

Threshold handling stays leakage-safe, same discipline as evaluate.py:
each checkpoint's own val_referable_threshold (picked on THAT model's own
validation predictions) is NOT reused directly, since the ensembled
probability distribution differs from any single model's. Instead this
script re-runs the ensemble on the VALIDATION split, calls
find_validation_threshold (train_classifier.py) on the ensembled validation
probabilities to pick a new ensemble-specific threshold targeting
sensitivity >= 0.90, and only then applies that threshold, unchanged, to
the ensembled test-set probabilities.

Run:
  python src/evaluate_ensemble.py \
      --checkpoint runs/classifier_resnet50/best.pt runs/classifier_effnet/best.pt runs/classifier_densenet/best.pt \
      --val-checkpoint runs/classifier_resnet50/best.pt runs/classifier_effnet/best.pt runs/classifier_densenet/best.pt \
      --data-dir data/idrid
"""
import os
import argparse
import numpy as np
import torch
from torch.utils.data import DataLoader
from sklearn.metrics import (
    classification_report, confusion_matrix, roc_curve, roc_auc_score,
)
import torch.nn.functional as F
import matplotlib.pyplot as plt
import seaborn as sns

from model import DRClassifier
from idrid_dataset import IDRiDGradingDataset
from train_classifier import find_validation_threshold, sensitivity_specificity_at_threshold

GRADE_NAMES = ["0: No DR", "1: Mild", "2: Moderate", "3: Severe", "4: PDR"]


def load_models(checkpoint_paths, device):
    """Loads one DRClassifier per checkpoint, each with its own backbone read
    from that checkpoint's metadata (same pattern as evaluate.py). Returns
    (models, backbone_names) in the same order as checkpoint_paths."""
    models, backbones = [], []
    for path in checkpoint_paths:
        ckpt = torch.load(path, map_location=device, weights_only=False)
        model = DRClassifier(
            backbone_name=ckpt["backbone"],
            num_grades=5,
            pretrained=False,
        )
        model.load_state_dict(ckpt["model_state"])
        model.to(device)
        model.eval()
        models.append(model)
        backbones.append(ckpt["backbone"])
    return models, backbones


def collect_ensemble_predictions(models, loader, device):
    """Runs every model in the ensemble over loader and mean-ensembles their
    POST-SIGMOID / POST-SOFTMAX probabilities (never raw logits, since
    different backbones can sit at different score scales).

    Returns: grade_true, grade_pred (argmax of averaged softmax),
    ref_true, ref_prob (averaged sigmoid).
    """
    grade_true, ref_true = [], []
    ref_prob_sum = None
    grade_prob_sum = None
    n_seen = 0

    with torch.no_grad():
        for imgs, grades, referable in loader:
            imgs = imgs.to(device)

            batch_grade_prob_sum = None
            batch_ref_prob_sum = None
            for model in models:
                grade_logits, ref_logit = model(imgs)
                grade_prob = F.softmax(grade_logits, dim=1).cpu()
                ref_prob = torch.sigmoid(ref_logit).cpu()

                batch_grade_prob_sum = grade_prob if batch_grade_prob_sum is None \
                    else batch_grade_prob_sum + grade_prob
                batch_ref_prob_sum = ref_prob if batch_ref_prob_sum is None \
                    else batch_ref_prob_sum + ref_prob

            batch_grade_prob_mean = batch_grade_prob_sum / len(models)
            batch_ref_prob_mean = batch_ref_prob_sum / len(models)

            grade_true.extend(grades.numpy())
            ref_true.extend(referable.numpy())

            grade_prob_sum = batch_grade_prob_mean if grade_prob_sum is None \
                else torch.cat([grade_prob_sum, batch_grade_prob_mean], dim=0)
            ref_prob_sum = batch_ref_prob_mean if ref_prob_sum is None \
                else torch.cat([ref_prob_sum, batch_ref_prob_mean], dim=0)
            n_seen += imgs.size(0)

    grade_probs = grade_prob_sum  # (N, 5), already mean-ensembled per batch
    ref_prob = ref_prob_sum.numpy().reshape(-1)  # (N,)
    grade_pred = grade_probs.argmax(dim=1).numpy()

    return (
        np.array(grade_true),
        grade_pred,
        np.array(ref_true),
        ref_prob,
    )


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--checkpoint", nargs="+", required=True,
                     help="Checkpoint paths to ensemble for TEST-set predictions.")
    ap.add_argument("--val-checkpoint", nargs="+", required=True,
                     help="Same checkpoints (order need not match --checkpoint), used to "
                          "re-derive an ensemble-specific referable-DR threshold on the "
                          "VALIDATION split, since each checkpoint's own "
                          "val_referable_threshold was fit for that single model only and "
                          "is not valid for the ensembled probability distribution.")
    ap.add_argument("--data-dir", default="data/idrid")
    ap.add_argument("--img-size", type=int, default=380)
    ap.add_argument("--target-sensitivity", type=float, default=0.90,
                     help="target referable-DR sensitivity used to pick the ensemble's "
                          "validation operating threshold")
    ap.add_argument("--out-dir", default="runs/eval_ensemble")
    args = ap.parse_args()

    os.makedirs(args.out_dir, exist_ok=True)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    models, backbones = load_models(args.checkpoint, device)
    val_models, val_backbones = load_models(args.val_checkpoint, device)

    print("=" * 60)
    print("ENSEMBLE — checkpoints included")
    print("=" * 60)
    for path, backbone in zip(args.checkpoint, backbones):
        print(f"  TEST : {path}  (backbone={backbone})")
    for path, backbone in zip(args.val_checkpoint, val_backbones):
        print(f"  VAL  : {path}  (backbone={backbone})")

    # --- Step 1: re-derive the ensemble's own referable-DR threshold on the
    # VALIDATION split. This is the ONLY place any threshold is chosen --
    # never on test labels, same discipline as evaluate.py. ---
    val_set = IDRiDGradingDataset(args.data_dir, split="val",
                                   img_size=args.img_size, augment=False)
    val_loader = DataLoader(val_set, batch_size=16, shuffle=False, num_workers=4)

    _, _, val_ref_true, val_ref_prob = collect_ensemble_predictions(val_models, val_loader, device)

    ens_threshold, ens_val_sens, ens_val_spec = find_validation_threshold(
        val_ref_true, val_ref_prob, target_sens=args.target_sensitivity
    )
    print("\n" + "=" * 60)
    print("ENSEMBLE-SPECIFIC THRESHOLD — selected on VALIDATION only")
    print("=" * 60)
    print(f"Ensemble referable-DR threshold: {ens_threshold:.2f}")
    print(f"  (on validation, this threshold gave sensitivity {ens_val_sens:.3f}, "
          f"specificity {ens_val_spec:.3f})")

    # --- Step 2: apply that threshold, UNCHANGED, to the ensembled TEST set. ---
    test_set = IDRiDGradingDataset(args.data_dir, split="test",
                                    img_size=args.img_size, augment=False)
    test_loader = DataLoader(test_set, batch_size=16, shuffle=False, num_workers=4)

    grade_true, grade_pred, ref_true, ref_prob = collect_ensemble_predictions(
        models, test_loader, device
    )

    print("\n" + "=" * 60)
    print("ENSEMBLE — 5-CLASS DR SEVERITY REPORT (OFFICIAL TEST SET)")
    print("=" * 60)
    print(classification_report(grade_true, grade_pred, target_names=GRADE_NAMES,
                                 zero_division=0))

    cm = confusion_matrix(grade_true, grade_pred, labels=list(range(5)))
    plt.figure(figsize=(6, 5))
    sns.heatmap(cm, annot=True, fmt="d", cmap="Blues",
                xticklabels=GRADE_NAMES, yticklabels=GRADE_NAMES)
    plt.xlabel("Predicted")
    plt.ylabel("True")
    plt.title("DR Severity Confusion Matrix (Ensemble)")
    plt.tight_layout()
    plt.savefig(os.path.join(args.out_dir, "confusion_matrix.png"), dpi=150)
    plt.close()
    print(f"Confusion matrix saved to {args.out_dir}/confusion_matrix.png")

    print("\n" + "=" * 60)
    print("ENSEMBLE — REFERABLE DR (grade >= 2) — binary screening metrics")
    print("=" * 60)
    auc = roc_auc_score(ref_true, ref_prob)
    sens_50, spec_50 = sensitivity_specificity_at_threshold(ref_true, ref_prob, 0.5)
    print(f"ROC-AUC: {auc:.3f}")
    print(f"At threshold 0.5  -> sensitivity {sens_50:.3f}, specificity {spec_50:.3f}")

    # Apply the VALIDATION-derived ensemble threshold unchanged. This is the
    # final, reportable operating point -- it was never fit or adjusted using
    # these test labels.
    test_sens, test_spec = sensitivity_specificity_at_threshold(ref_true, ref_prob, ens_threshold)
    print(f"At VALIDATION-derived ENSEMBLE threshold {ens_threshold:.2f} (applied unchanged to test):")
    print(f"  -> sensitivity {test_sens:.3f}, specificity {test_spec:.3f}")
    if test_spec < 0.85:
        print("  NOTE: specificity target (>85%) not met at this threshold on the test set -- "
              "this is a model-quality gap to address, not a threshold-tuning problem. The "
              "threshold itself must not be adjusted using these test results.")

    fpr, tpr, thresholds = roc_curve(ref_true, ref_prob)
    plt.figure(figsize=(5, 5))
    plt.plot(fpr, tpr, label=f"AUC = {auc:.3f}")
    plt.plot([0, 1], [0, 1], "--", color="gray")
    plt.scatter([1 - test_spec], [test_sens], color="red", zorder=5,
                label=f"val-derived ensemble threshold ({ens_threshold:.2f})")
    plt.xlabel("1 - Specificity (FPR)")
    plt.ylabel("Sensitivity (TPR)")
    plt.title("Referable DR ROC Curve — Ensemble (Test Set)")
    plt.legend()
    plt.tight_layout()
    plt.savefig(os.path.join(args.out_dir, "roc_curve.png"), dpi=150)
    plt.close()
    print(f"ROC curve saved to {args.out_dir}/roc_curve.png")


if __name__ == "__main__":
    main()
