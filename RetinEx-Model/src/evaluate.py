"""
Full evaluation report for the DR classifier: per-class metrics, confusion matrix,
and — the numbers your problem statement actually grades — referable-DR (grade>=2)
sensitivity/specificity/ROC-AUC on the official held-out test set.

The referable-DR decision threshold is NOT chosen here. It was already selected
on the VALIDATION split inside train_classifier.py and saved into the checkpoint
(best.pt) as 'val_referable_threshold'. This script loads that threshold and
applies it unchanged to test predictions. ROC-AUC is threshold-free, so it is
still computed directly on the test set.

Run:
  python src/evaluate.py --checkpoint runs/classifier/best.pt --data-dir data/idrid
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

GRADE_NAMES = ["0: No DR", "1: Mild", "2: Moderate", "3: Severe", "4: PDR"]


def collect_predictions(model, loader, device):
    model.eval()
    grade_true, grade_pred = [], []
    grade_logits_all = []
    ref_true, ref_prob = [], []

    with torch.no_grad():
        for imgs, grades, referable in loader:
            imgs = imgs.to(device)

            grade_logits, ref_logit = model(imgs)

            grade_logits_all.append(grade_logits.cpu())

            grade_pred.extend(
                grade_logits.argmax(dim=1).cpu().numpy()
            )
            grade_true.extend(grades.numpy())

            ref_prob.extend(
                torch.sigmoid(ref_logit).cpu().numpy()
            )
            ref_true.extend(referable.numpy())

    return (
        np.array(grade_true),
        np.array(grade_pred),
        np.array(ref_true),
        np.array(ref_prob),
        torch.cat(grade_logits_all)
    )


def sensitivity_specificity_at_threshold(y_true, y_prob, threshold):
    y_pred = (y_prob >= threshold).astype(int)
    tp = np.sum((y_pred == 1) & (y_true == 1))
    fn = np.sum((y_pred == 0) & (y_true == 1))
    tn = np.sum((y_pred == 0) & (y_true == 0))
    fp = np.sum((y_pred == 1) & (y_true == 0))
    sensitivity = tp / (tp + fn + 1e-8)
    specificity = tn / (tn + fp + 1e-8)
    return sensitivity, specificity

def expected_calibration_error(probs, labels, n_bins=10):
    confidences, predictions = probs.max(dim=1)
    accuracies = predictions.eq(labels)

    ece = 0.0
    bin_boundaries = torch.linspace(0, 1, n_bins + 1)

    for lo, hi in zip(bin_boundaries[:-1], bin_boundaries[1:]):
        in_bin = (confidences > lo) & (confidences <= hi)

        if in_bin.any():
            accuracy = accuracies[in_bin].float().mean()
            confidence = confidences[in_bin].mean()
            proportion = in_bin.float().mean()

            ece += torch.abs(confidence - accuracy) * proportion

    return ece.item()

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--checkpoint", required=True)
    ap.add_argument("--data-dir", default="data/idrid")
    ap.add_argument("--img-size", type=int, default=380)
    ap.add_argument("--out-dir", default="runs/eval")
    args = ap.parse_args()

    os.makedirs(args.out_dir, exist_ok=True)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    ckpt = torch.load(
    args.checkpoint,
    map_location=device,
    weights_only=False
    )
    model = DRClassifier(
    backbone_name=ckpt["backbone"],
    num_grades=5,
    pretrained=False
    )
    model.load_state_dict(ckpt["model_state"])
    model.to(device)


    temperature_path = os.path.join(
    os.path.dirname(args.out_dir),
    "calibration",
    "temperature.pt"
    )

    if not os.path.exists(temperature_path):
        raise FileNotFoundError(
            f"Temperature file not found: {temperature_path}"
        )

    temperature_data = torch.load(
        temperature_path,
        map_location="cpu",
        weights_only=False
    )

    temperature = float(temperature_data["temperature"])

    print(f"Using calibrated temperature: {temperature:.3f}")

    # The referable-DR decision threshold is fixed on VALIDATION data inside
    # train_classifier.py and saved into the checkpoint. It must be applied here
    # UNCHANGED — this script never sweeps or selects a threshold using test
    # labels. If you see a KeyError here, the checkpoint predates this fix and
    # needs to be retrained (or you're pointing at the wrong file).
    if "val_referable_threshold" not in ckpt:
        raise KeyError(
            "Checkpoint has no 'val_referable_threshold'. This checkpoint was "
            "likely saved before threshold selection was moved to validation data. "
            "Re-run train_classifier.py to produce a checkpoint with this key."
        )
    val_threshold = ckpt["val_referable_threshold"]
    print(f"Using referable-DR threshold from VALIDATION: {val_threshold:.2f}")
    if "val_referable_sensitivity_at_threshold" in ckpt:
        print(
            f"  (on validation, this threshold gave sensitivity "
            f"{ckpt['val_referable_sensitivity_at_threshold']:.3f}, "
            f"specificity {ckpt['val_referable_specificity_at_threshold']:.3f})"
        )

    test_set = IDRiDGradingDataset(args.data_dir, split="test",
                                    img_size=args.img_size, augment=False)
    test_loader = DataLoader(test_set, batch_size=16, shuffle=False, num_workers=4)

    (
    grade_true,
    grade_pred,
    ref_true,
    ref_prob,
    grade_logits
    ) = collect_predictions(model, test_loader, device)

    raw_grade_probs = F.softmax(grade_logits, dim=1)
    calibrated_grade_probs = F.softmax(
        grade_logits / temperature,
        dim=1
    )

    raw_ece = expected_calibration_error(
        raw_grade_probs,
        torch.tensor(grade_true)
    )

    calibrated_ece = expected_calibration_error(
        calibrated_grade_probs,
        torch.tensor(grade_true)
    )

    print("\n" + "=" * 60)
    print("CALIBRATION — OFFICIAL TEST SET")
    print("=" * 60)
    print(f"Temperature: {temperature:.3f}")
    print(f"ECE before calibration: {raw_ece:.4f}")
    print(f"ECE after calibration:  {calibrated_ece:.4f}")

    print("=" * 60)
    print("5-CLASS DR SEVERITY REPORT")
    print("=" * 60)
    print(classification_report(grade_true, grade_pred, target_names=GRADE_NAMES,
                                 zero_division=0))

    cm = confusion_matrix(grade_true, grade_pred, labels=list(range(5)))
    plt.figure(figsize=(6, 5))
    sns.heatmap(cm, annot=True, fmt="d", cmap="Blues",
                xticklabels=GRADE_NAMES, yticklabels=GRADE_NAMES)
    plt.xlabel("Predicted")
    plt.ylabel("True")
    plt.title("DR Severity Confusion Matrix")
    plt.tight_layout()
    plt.savefig(os.path.join(args.out_dir, "confusion_matrix.png"), dpi=150)
    plt.close()
    print(f"Confusion matrix saved to {args.out_dir}/confusion_matrix.png")

    print("\n" + "=" * 60)
    print("REFERABLE DR (grade >= 2) — binary screening metrics")
    print("=" * 60)
    auc = roc_auc_score(ref_true, ref_prob)
    sens_50, spec_50 = sensitivity_specificity_at_threshold(ref_true, ref_prob, 0.5)
    print(f"ROC-AUC: {auc:.3f}")
    print(f"At threshold 0.5  -> sensitivity {sens_50:.3f}, specificity {spec_50:.3f}")

    # Apply the VALIDATION-derived threshold unchanged. This is the final,
    # reportable operating point -- it was never fit or adjusted using these
    # test labels.
    test_sens, test_spec = sensitivity_specificity_at_threshold(ref_true, ref_prob, val_threshold)
    print(f"At VALIDATION-derived threshold {val_threshold:.2f} (applied unchanged to test):")
    print(f"  -> sensitivity {test_sens:.3f}, specificity {test_spec:.3f}")
    if test_spec < 0.85:
        print("  NOTE: specificity target (>85%) not met at this threshold on the test set — "
              "this is a model-quality gap to address (more data, better augmentation, "
              "longer fine-tuning), not a threshold-tuning problem. The threshold itself "
              "must not be adjusted using these test results.")

    fpr, tpr, thresholds = roc_curve(ref_true, ref_prob)
    plt.figure(figsize=(5, 5))
    plt.plot(fpr, tpr, label=f"AUC = {auc:.3f}")
    plt.plot([0, 1], [0, 1], "--", color="gray")
    plt.scatter([1 - test_spec], [test_sens], color="red", zorder=5,
                label=f"val-derived threshold ({val_threshold:.2f})")
    plt.xlabel("1 - Specificity (FPR)")
    plt.ylabel("Sensitivity (TPR)")
    plt.title("Referable DR ROC Curve (Test Set)")
    plt.legend()
    plt.tight_layout()
    plt.savefig(os.path.join(args.out_dir, "roc_curve.png"), dpi=150)
    plt.close()
    print(f"ROC curve saved to {args.out_dir}/roc_curve.png")


if __name__ == "__main__":
    main()
