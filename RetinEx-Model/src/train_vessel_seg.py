"""
Trains a U-Net on DRIVE for vessel segmentation.
Run: python src/train_vessel_seg.py --data-dir data --epochs 60 --out-dir runs/vessel_unet
"""
import os
import argparse
import torch
from torch.utils.data import DataLoader, Subset, random_split

from unet import UNet, BCEDiceLoss
from vessel_dataset import DriveVesselDataset


def dice_score(pred_logits, target, eps=1e-6):
    pred = (torch.sigmoid(pred_logits) > 0.5).float()
    pred = pred.view(pred.size(0), -1)
    target = target.view(target.size(0), -1)
    intersection = (pred * target).sum(dim=1)
    union = pred.sum(dim=1) + target.sum(dim=1)
    return ((2 * intersection + eps) / (union + eps)).mean().item()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data-dir", default="data")
    ap.add_argument("--epochs", type=int, default=60)
    ap.add_argument("--batch-size", type=int, default=4)
    ap.add_argument("--lr", type=float, default=1e-3)
    ap.add_argument("--img-size", type=int, default=384)
    ap.add_argument("--out-dir", default="runs/vessel_unet")
    args = ap.parse_args()

    os.makedirs(args.out_dir, exist_ok=True)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")

    # BUG FIX: previously this created ONE DriveVesselDataset, used random_split
    # to get two Subsets of it, then set val_set.dataset.augment = False. Since
    # train_set.dataset and val_set.dataset are the SAME underlying object,
    # that line also turned augmentation off for the training subset.
    #
    # Fix: create two separate DriveVesselDataset instances -- one with
    # augment=True, one with augment=False -- then apply the SAME split indices
    # to both, so train and val see the same 16/4 image split but each subset
    # is backed by a dataset object with its own independent .augment flag.
    train_dataset_full = DriveVesselDataset(args.data_dir, split="training",
                                             img_size=args.img_size, augment=True)
    val_dataset_full = DriveVesselDataset(args.data_dir, split="training",
                                           img_size=args.img_size, augment=False)

    # DRIVE has only 20 training images — hold out 4 for validation, rest for train.
    n_val = 4
    n_train = len(train_dataset_full) - n_val
    # random_split just needs to give us index assignments; we throw away the
    # Subsets it builds on train_dataset_full and instead use .indices to build
    # our own Subsets, one per dataset instance.
    train_indices_subset, val_indices_subset = random_split(
        train_dataset_full, [n_train, n_val], generator=torch.Generator().manual_seed(42)
    )
    train_set = Subset(train_dataset_full, train_indices_subset.indices)
    val_set = Subset(val_dataset_full, val_indices_subset.indices)

    train_loader = DataLoader(train_set, batch_size=args.batch_size, shuffle=True, num_workers=2)
    val_loader = DataLoader(val_set, batch_size=args.batch_size, shuffle=False, num_workers=2)

    model = UNet(in_channels=3, out_channels=1, base_ch=32).to(device)
    criterion = BCEDiceLoss(bce_weight=0.5)
    optimizer = torch.optim.Adam(model.parameters(), lr=args.lr)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=args.epochs)

    best_dice = 0.0
    for epoch in range(1, args.epochs + 1):
        model.train()
        train_loss = 0.0
        for imgs, masks in train_loader:
            imgs, masks = imgs.to(device), masks.to(device)
            optimizer.zero_grad()
            logits = model(imgs)
            loss = criterion(logits, masks)
            loss.backward()
            optimizer.step()
            train_loss += loss.item() * imgs.size(0)
        train_loss /= len(train_set)
        scheduler.step()

        model.eval()
        val_dice = 0.0
        with torch.no_grad():
            for imgs, masks in val_loader:
                imgs, masks = imgs.to(device), masks.to(device)
                logits = model(imgs)
                val_dice += dice_score(logits, masks) * imgs.size(0)
        val_dice /= len(val_set)

        print(f"Epoch {epoch:3d}/{args.epochs} | train_loss {train_loss:.4f} | val_dice {val_dice:.4f}")

        if val_dice > best_dice:
            best_dice = val_dice
            torch.save({"model_state": model.state_dict(), "val_dice": val_dice},
                       os.path.join(args.out_dir, "best.pt"))
            print(f"  -> saved new best (dice={val_dice:.4f})")

    print(f"Training done. Best val dice: {best_dice:.4f}")
    print(f"Checkpoint: {os.path.join(args.out_dir, 'best.pt')}")


if __name__ == "__main__":
    main()
