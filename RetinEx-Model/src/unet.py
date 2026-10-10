"""
Small U-Net for binary/multi-class segmentation.
Used for both DRIVE vessel segmentation and IDRiD lesion segmentation —
just change out_channels and the dataset/masks you feed it.
"""
import torch
import torch.nn as nn
import torch.nn.functional as F


def double_conv(in_ch, out_ch):
    return nn.Sequential(
        nn.Conv2d(in_ch, out_ch, 3, padding=1),
        nn.BatchNorm2d(out_ch),
        nn.ReLU(inplace=True),
        nn.Conv2d(out_ch, out_ch, 3, padding=1),
        nn.BatchNorm2d(out_ch),
        nn.ReLU(inplace=True),
    )


class UNet(nn.Module):
    """
    Standard U-Net (Ronneberger et al. 2015), depth 4, configurable width.
    out_channels=1 for binary segmentation (e.g. vessels, or one lesion type at a time).
    """

    def __init__(self, in_channels=3, out_channels=1, base_ch=32):
        super().__init__()
        self.down1 = double_conv(in_channels, base_ch)
        self.down2 = double_conv(base_ch, base_ch * 2)
        self.down3 = double_conv(base_ch * 2, base_ch * 4)
        self.down4 = double_conv(base_ch * 4, base_ch * 8)
        self.bottleneck = double_conv(base_ch * 8, base_ch * 16)

        self.pool = nn.MaxPool2d(2)

        self.up4 = nn.ConvTranspose2d(base_ch * 16, base_ch * 8, 2, stride=2)
        self.upconv4 = double_conv(base_ch * 16, base_ch * 8)
        self.up3 = nn.ConvTranspose2d(base_ch * 8, base_ch * 4, 2, stride=2)
        self.upconv3 = double_conv(base_ch * 8, base_ch * 4)
        self.up2 = nn.ConvTranspose2d(base_ch * 4, base_ch * 2, 2, stride=2)
        self.upconv2 = double_conv(base_ch * 4, base_ch * 2)
        self.up1 = nn.ConvTranspose2d(base_ch * 2, base_ch, 2, stride=2)
        self.upconv1 = double_conv(base_ch * 2, base_ch)

        self.out_conv = nn.Conv2d(base_ch, out_channels, 1)

    def forward(self, x):
        d1 = self.down1(x)
        d2 = self.down2(self.pool(d1))
        d3 = self.down3(self.pool(d2))
        d4 = self.down4(self.pool(d3))
        bn = self.bottleneck(self.pool(d4))

        u4 = self.up4(bn)
        u4 = self.upconv4(torch.cat([u4, d4], dim=1))
        u3 = self.up3(u4)
        u3 = self.upconv3(torch.cat([u3, d3], dim=1))
        u2 = self.up2(u3)
        u2 = self.upconv2(torch.cat([u2, d2], dim=1))
        u1 = self.up1(u2)
        u1 = self.upconv1(torch.cat([u1, d1], dim=1))

        return self.out_conv(u1)


def dice_loss(pred_logits, target, eps=1e-6):
    """Soft Dice loss — handles the severe foreground/background imbalance in
    vessel and lesion masks much better than plain BCE alone."""
    pred = torch.sigmoid(pred_logits)
    pred = pred.view(pred.size(0), -1)
    target = target.view(target.size(0), -1)
    intersection = (pred * target).sum(dim=1)
    union = pred.sum(dim=1) + target.sum(dim=1)
    dice = (2 * intersection + eps) / (union + eps)
    return 1 - dice.mean()


def masked_dice_score_per_channel(pred_logits, target, availability, eps=1e-6, threshold=0.5):
    """Hard (thresholded) Dice score per channel, for reporting during
    validation -- NOT used as a training loss (see masked_bce_dice_loss for
    that). Returns a list of length C: mean dice for each channel, averaged
    only over (batch, channel) entries where availability == 1. A channel
    with zero available entries in this batch returns None for that channel
    so callers can skip it rather than silently averaging in a meaningless 0.
    """
    B, C, H, W = pred_logits.shape
    pred = (torch.sigmoid(pred_logits) > threshold).float()
    pred_flat = pred.view(B, C, -1)
    target_flat = target.view(B, C, -1)
    intersection = (pred_flat * target_flat).sum(dim=2)  # (B, C)
    union = pred_flat.sum(dim=2) + target_flat.sum(dim=2)  # (B, C)
    dice_per_channel_image = (2 * intersection + eps) / (union + eps)  # (B, C)

    results = []
    for c in range(C):
        avail_c = availability[:, c]
        n_avail = avail_c.sum().item()
        if n_avail == 0:
            results.append(None)
        else:
            results.append(
                (dice_per_channel_image[:, c] * avail_c).sum().item() / n_avail
            )
    return results


class BCEDiceLoss(nn.Module):
    """Combined BCE + Dice loss, standard choice for medical image segmentation
    with thin/sparse structures like vessels or microaneurysms."""

    def __init__(self, bce_weight=0.5):
        super().__init__()
        self.bce = nn.BCEWithLogitsLoss()
        self.bce_weight = bce_weight

    def forward(self, pred_logits, target):
        bce_loss = self.bce(pred_logits, target)
        d_loss = dice_loss(pred_logits, target)
        return self.bce_weight * bce_loss + (1 - self.bce_weight) * d_loss


def masked_bce_dice_loss(pred_logits, target, availability, bce_weight=0.5, eps=1e-6,
                          pos_weight=None, channel_weight=None):
    """BCE + Dice loss for MULTI-CHANNEL segmentation where some channels are
    missing ground truth for some images (e.g. IDRiD lesion segmentation --
    Soft Exudates masks exist for only 26 of 54 training images).

    pred_logits, target: (B, C, H, W)
    availability:        (B, C) -- 1.0 where that image's channel-C mask truly
                          exists, 0.0 where target[:, c] is just a zero
                          placeholder (see idrid_lesion_dataset.py).
    pos_weight:           optional (C,) tensor, one BCE positive-class weight per
                          lesion channel (see
                          IDRiDLesionDataset.compute_pos_weights). Without this,
                          channels with very sparse foreground (MA, HE) can sit
                          at ~0 dice for many epochs: unweighted BCE lets the
                          model minimize loss by predicting background almost
                          everywhere, since foreground pixels are such a small
                          share of the total. Pass None to fall back to
                          standard unweighted BCE (the old behavior).
    channel_weight:       optional (C,) tensor, one multiplier per lesion
                          channel applied to BOTH the BCE and Dice terms
                          before they're summed into the final averaged loss
                          -- unlike pos_weight, which only reweights positive
                          pixels inside the BCE term. Use this to boost a
                          sparse channel's (e.g. MA) overall contribution to
                          the loss relative to other channels. Pass None to
                          fall back to the current behavior (all channels
                          weighted equally).

    Unlike BCEDiceLoss, this averages loss ONLY over (image, channel) pairs
    where availability == 1. A missing mask contributes nothing to the loss
    or its gradient -- it is excluded, not treated as "confirmed background,"
    which would otherwise wrongly teach the model that unannotated lesions
    don't exist.
    """
    B, C, H, W = pred_logits.shape
    assert availability.shape == (B, C), (
        f"availability must be shape (B, C) = {(B, C)}, got {tuple(availability.shape)}"
    )

    # --- Masked BCE ---
    # Per-pixel BCE, then average per (batch, channel) over spatial dims first,
    # so each available channel-image contributes one number regardless of H*W.
    # pos_weight is (C,) and must be reshaped to (1, C, 1, 1) to broadcast
    # correctly against (B, C, H, W) inputs -- PyTorch does not do this for you.
    if pos_weight is not None:
        pos_weight = pos_weight.to(device=pred_logits.device, dtype=pred_logits.dtype)
        pos_weight = pos_weight.view(1, C, 1, 1)
    bce_per_pixel = F.binary_cross_entropy_with_logits(
        pred_logits, target, reduction="none", pos_weight=pos_weight
    )
    bce_per_channel_image = bce_per_pixel.mean(dim=(2, 3))  # (B, C)

    if channel_weight is not None:
        channel_weight = channel_weight.to(device=pred_logits.device, dtype=pred_logits.dtype)
        bce_per_channel_image = bce_per_channel_image * channel_weight.view(1, C)

    bce_masked_sum = (bce_per_channel_image * availability).sum()
    n_available = availability.sum()
    bce_loss = bce_masked_sum / n_available.clamp(min=1.0)

    # --- Masked Dice ---
    probs = torch.sigmoid(pred_logits)
    probs_flat = probs.view(B, C, -1)
    target_flat = target.view(B, C, -1)
    intersection = (probs_flat * target_flat).sum(dim=2)  # (B, C)
    union = probs_flat.sum(dim=2) + target_flat.sum(dim=2)  # (B, C)
    dice_per_channel_image = (2 * intersection + eps) / (union + eps)  # (B, C)
    dice_term = 1 - dice_per_channel_image
    if channel_weight is not None:
        dice_term = dice_term * channel_weight.view(1, C)
    dice_masked_sum = (dice_term * availability).sum()
    dice_loss_val = dice_masked_sum / n_available.clamp(min=1.0)

    # If an entire batch has zero available entries for every channel (can
    # happen by chance with small batches and only 26 SE-masked images),
    # n_available is 0 and both terms above are already safely zeroed via
    # the clamp -- return 0 rather than propagating a NaN/inf loss.
    if n_available.item() == 0:
        return torch.zeros((), device=pred_logits.device, dtype=pred_logits.dtype)

    return bce_weight * bce_loss + (1 - bce_weight) * dice_loss_val
