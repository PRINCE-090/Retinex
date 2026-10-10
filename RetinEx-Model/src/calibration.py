"""
Temperature scaling (Guo et al. 2017) for the DR classifier's grade head, plus
Expected Calibration Error (ECE) before/after — so "confidence: 87%" reported
in the patient report (report section 5.5) is close to the model's true accuracy
at that confidence level, not a raw, typically overconfident softmax number.

Temperature is fit on the VALIDATION split (never the test split), matching
train_classifier.py. Run this after training, before evaluate.py.

Run (from the src/ folder, or with src/ on PYTHONPATH):
  python calibration.py --checkpoint runs/classifier/best.pt --data-dir "D:\\SIH\\Model"
"""
import os
import argparse
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import DataLoader
import matplotlib.pyplot as plt

from model import DRClassifier
from idrid_dataset import IDRiDGradingDataset


def collect_logits(model, loader, device):
    model.eval()
    all_logits, all_labels = [], []
    with torch.no_grad():
        for imgs, grades, _ in loader:
            imgs = imgs.to(device)
            grade_logits, _ = model(imgs)
            all_logits.append(grade_logits.cpu())
            all_labels.append(grades)
    return torch.cat(all_logits), torch.cat(all_labels)


def expected_calibration_error(probs, labels, n_bins=10):
    confidences, predictions = probs.max(dim=1)
    accuracies = predictions.eq(labels)
    ece = torch.zeros(1)
    bin_boundaries = torch.linspace(0, 1, n_bins + 1)
    for lo, hi in zip(bin_boundaries[:-1], bin_boundaries[1:]):
        in_bin = (confidences > lo) & (confidences <= hi)
        prop_in_bin = in_bin.float().mean()
        if prop_in_bin.item() > 0:
            acc_in_bin = accuracies[in_bin].float().mean()
            conf_in_bin = confidences[in_bin].mean()
            ece += torch.abs(conf_in_bin - acc_in_bin) * prop_in_bin
    return ece.item()


def fit_temperature(logits, labels, max_iter=200, lr=0.01):
    """Fit a positive scalar temperature T using validation NLL."""
    log_temperature = nn.Parameter(torch.log(torch.tensor([1.5])))

    optimizer = torch.optim.LBFGS(
        [log_temperature],
        lr=lr,
        max_iter=max_iter
    )

    nll_criterion = nn.CrossEntropyLoss()

    def closure():
        optimizer.zero_grad()

        temperature = torch.exp(log_temperature)
        loss = nll_criterion(logits / temperature, labels)

        loss.backward()
        return loss

    optimizer.step(closure)

    temperature = torch.exp(log_temperature).item()
    return temperature


def reliability_diagram(probs, labels, out_path, n_bins=10, title="Reliability Diagram"):
    confidences, predictions = probs.max(dim=1)
    accuracies = predictions.eq(labels).float()

    bin_boundaries = np.linspace(0, 1, n_bins + 1)
    bin_accs, bin_confs, bin_counts = [], [], []
    for lo, hi in zip(bin_boundaries[:-1], bin_boundaries[1:]):
        mask = (confidences.numpy() > lo) & (confidences.numpy() <= hi)
        if mask.sum() > 0:
            bin_accs.append(accuracies.numpy()[mask].mean())
            bin_confs.append(confidences.numpy()[mask].mean())
            bin_counts.append(mask.sum())
        else:
            bin_accs.append(0)
            bin_confs.append((lo + hi) / 2)
            bin_counts.append(0)

    plt.figure(figsize=(5, 5))
    plt.bar(bin_boundaries[:-1], bin_accs, width=1 / n_bins, align="edge",
            edgecolor="black", alpha=0.7, label="Accuracy")
    plt.plot([0, 1], [0, 1], "--", color="red", label="Perfect calibration")
    plt.xlabel("Confidence")
    plt.ylabel("Accuracy")
    plt.title(title)
    plt.legend()
    plt.tight_layout()
    plt.savefig(out_path, dpi=150)
    plt.close()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--checkpoint", required=True)
    ap.add_argument("--data-dir", default="data/idrid")
    ap.add_argument("--img-size", type=int, default=380)
    ap.add_argument("--out-dir", default="runs/calibration")
    args = ap.parse_args()

    os.makedirs(args.out_dir, exist_ok=True)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    ckpt = torch.load(args.checkpoint, map_location=device, weights_only=False)
    model = DRClassifier(backbone_name=ckpt["backbone"], num_grades=5, pretrained=False)
    model.load_state_dict(ckpt["model_state"])
    model.to(device)

    # Temperature is fit on the VALIDATION split only, matching train_classifier.py.
    # This keeps the official test split completely untouched by calibration —
    # evaluate.py is the only script allowed to load split="test".
    val_set = IDRiDGradingDataset(args.data_dir, split="val",
                                   img_size=args.img_size, augment=False)
    val_loader = DataLoader(val_set, batch_size=16, shuffle=False, num_workers=4)

    logits, labels = collect_logits(model, val_loader, device)

    raw_probs = F.softmax(logits, dim=1)
    raw_ece = expected_calibration_error(raw_probs, labels)
    print(f"VALIDATION ECE before calibration: {raw_ece:.4f}")
    reliability_diagram(raw_probs, labels, os.path.join(args.out_dir, "reliability_before.png"),
                         title="Before Temperature Scaling (Validation)")

    T = fit_temperature(logits, labels)
    print(f"Fitted temperature: {T:.3f}")

    calibrated_probs = F.softmax(logits / T, dim=1)
    calibrated_ece = expected_calibration_error(calibrated_probs, labels)
    print(f"VALIDATION ECE after calibration: {calibrated_ece:.4f}")
    reliability_diagram(calibrated_probs, labels, os.path.join(args.out_dir, "reliability_after.png"),
                         title="After Temperature Scaling (Validation)")

    torch.save({"temperature": T}, os.path.join(args.out_dir, "temperature.pt"))
    print(f"Saved temperature to {args.out_dir}/temperature.pt")
    print("At inference: probs = softmax(model(x) / T)")
    print("NOTE: T was fit on validation data. To see calibration's effect on the "
          "held-out test set, apply this T inside evaluate.py — do not refit it there.")


if __name__ == "__main__":
    main()
