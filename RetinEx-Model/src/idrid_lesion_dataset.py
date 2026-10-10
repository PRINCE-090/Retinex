"""
PyTorch Dataset for IDRiD lesion segmentation (Microaneurysms, Haemorrhages,
Hard Exudates, Soft Exudates).

ACTUAL layout on disk (project root = D:\\SIH\\Model):

  Dataset\\archive\\A. Segmentation\\A. Segmentation\\1. Original Images\\a. Training Set\\IDRiD_01.jpg ...
  Dataset\\archive\\A. Segmentation\\A. Segmentation\\2. All Segmentation Groundtruths\\a. Training Set\\
      1. Microaneurysms\\IDRiD_01_MA.tif   (54 images have this)
      2. Haemorrhages\\IDRiD_01_HE.tif     (53 images have this)
      3. Hard Exudates\\IDRiD_01_EX.tif    (54 images have this)
      4. Soft Exudates\\IDRiD_01_SE.tif    (only 26 images have this)

IMPORTANT: this is a SEPARATE, smaller, independently-curated set of images
from the 413-image IDRiD disease-grading set used by idrid_dataset.py. The
image IDs here use 2-digit zero-padding (IDRiD_01 .. IDRiD_54), a DIFFERENT
convention from the disease-grading set's 3-digit padding (IDRiD_001). Do not
assume any image-ID overlap or shared splits between the two datasets.

Because Soft Exudates masks are missing for more than half these images (and
Haemorrhages is missing for 1), this dataset returns, for every image:
  - a 4-channel target mask (MA, HE, EX, SE), with missing channels filled
    with zeros as a placeholder,
  - a matching 4-element "availability" vector (1.0 = this channel's mask
    truly exists for this image, 0.0 = missing/placeholder).
The availability vector must be used to mask the loss per-channel (see
masked_bce_dice_loss in unet.py) so missing masks are excluded from training
and validation metrics rather than being treated as "confirmed background."

The train/val split is done ONCE at the image level (not per lesion type),
so a given image lands in exactly one split regardless of which lesion masks
it happens to have. This avoids the same image appearing in both train and
val under different lesion channels.
"""
import os
import glob
import numpy as np
from PIL import Image
import torch
from torch.utils.data import Dataset

LESION_CHANNELS = ["MA", "HE", "EX", "SE"]
LESION_FOLDER_NAMES = {
    "MA": "1. Microaneurysms",
    "HE": "2. Haemorrhages",
    "EX": "3. Hard Exudates",
    "SE": "4. Soft Exudates",
}

_SEG_ROOT = os.path.join("Dataset", "archive", "A. Segmentation", "A. Segmentation")
DEFAULT_IMAGE_DIR = os.path.join(_SEG_ROOT, "1. Original Images", "a. Training Set")
DEFAULT_MASK_ROOT = os.path.join(
    _SEG_ROOT, "2. All Segmentation Groundtruths", "a. Training Set"
)


class IDRiDLesionDataset(Dataset):
    def __init__(self, data_dir, image_ids, img_size=512, augment=False,
                 image_dir=None, mask_root=None):
        """
        data_dir: project root, e.g. r"D:\\SIH\\Model"
        image_ids: list of image IDs to include, e.g. ["IDRiD_01", "IDRiD_02", ...].
                   Callers are responsible for computing the train/val split
                   ONCE (see split_image_ids below) and passing the right
                   subset here, so the same image can't leak into both splits.
        """
        self.data_dir = data_dir
        self.img_size = img_size
        self.augment = augment
        self.image_ids = list(image_ids)

        self.image_dir = os.path.join(data_dir, image_dir or DEFAULT_IMAGE_DIR)
        self.mask_root = os.path.join(data_dir, mask_root or DEFAULT_MASK_ROOT)

        if not os.path.isdir(self.image_dir):
            raise FileNotFoundError(f"Could not find image folder at:\n  {self.image_dir}")
        if not os.path.isdir(self.mask_root):
            raise FileNotFoundError(f"Could not find mask folder at:\n  {self.mask_root}")

    @staticmethod
    def compute_pos_weights(data_dir, image_ids, mask_root=None, max_weight=15.0):
        """Computes a per-channel BCE pos_weight from the given image IDs' masks
        -- call this with TRAIN ids only, same rule as any other statistic
        derived from data.

        Raw neg/pos pixel ratios for these lesions are all extreme (even "large"
        EX lesions are a tiny fraction of an 8-million-pixel mask), so a first
        version of this function used the raw ratio clipped at 50 -- but MA, HE,
        and EX all blew past 50 and got clipped to the SAME weight, erasing the
        very differentiation this function exists to provide. In practice this
        showed up as HE and EX being pushed just as hard as MA, producing heavy
        over-prediction (e.g. HE predicted-positive-pixel counts ~40x the GT
        count) while MA dice barely improved.

        Fix: take sqrt(raw_ratio) before clipping. This keeps weights ordered
        the same way (sparser lesion -> larger weight) but compresses the
        spread so MA/HE/EX/SE land at meaningfully different values instead of
        all hitting the ceiling. max_weight is lowered to 15 accordingly, since
        sqrt-compressed values don't need as high a ceiling as raw ratios did.

        Uses masks at their native resolution (no resizing): only the pos/neg
        ratio matters for weighting, not exact pixel counts, so skipping the
        resize keeps this fast. Missing masks are skipped entirely per channel,
        the same skip-missing rule used everywhere else in this file and in
        masked_bce_dice_loss -- a missing mask must not be treated as "all
        background" here either, or it would silently bias the weight.

        Why this exists: MA and Haemorrhage lesions can be a tiny fraction of
        a mask's pixels (well under 1%). Unweighted BCE can then minimize loss
        by never predicting foreground with >50% confidence, which looks like
        "the model isn't learning MA/HE at all" in per-epoch dice even while
        the soft probabilities are moving in the right direction underneath.
        Weighting the rare positive class more heavily in the loss counteracts
        that. The sqrt-compressed weight is still clipped (max_weight) because
        even after compression a lesion type this sparse could produce a
        destabilizingly large weight.

        max_weight may also be a dict or list of per-channel caps (e.g.
        {"MA": 40.0, "HE": 15.0, "EX": 15.0, "SE": 15.0}), for cases like MA
        where the sqrt-compressed ratio is still likely to hit a shared
        ceiling and get compressed down to the same weight as less-sparse
        channels. A plain float applies the same cap to every channel and is
        byte-identical to the previous behavior.

        Returns a torch.Tensor of shape (len(LESION_CHANNELS),), in the same
        MA/HE/EX/SE order as LESION_CHANNELS.
        """
        if isinstance(max_weight, dict):
            max_weight_per_channel = {ch: max_weight[ch] for ch in LESION_CHANNELS}
        elif isinstance(max_weight, (list, tuple)):
            max_weight_per_channel = dict(zip(LESION_CHANNELS, max_weight))
        else:
            max_weight_per_channel = {ch: max_weight for ch in LESION_CHANNELS}

        full_mask_root = os.path.join(data_dir, mask_root or DEFAULT_MASK_ROOT)
        pos_pixels = {ch: 0 for ch in LESION_CHANNELS}
        total_pixels = {ch: 0 for ch in LESION_CHANNELS}

        for image_id in image_ids:
            for channel in LESION_CHANNELS:
                path = os.path.join(
                    full_mask_root, LESION_FOLDER_NAMES[channel], f"{image_id}_{channel}.tif"
                )
                if not os.path.exists(path):
                    continue  # skip-missing, matches masked_bce_dice_loss's availability rule
                mask = np.array(Image.open(path).convert("L"))
                mask = mask > 0
                pos_pixels[channel] += int(mask.sum())
                total_pixels[channel] += int(mask.size)

        weights = []
        for channel in LESION_CHANNELS:
            pos = pos_pixels[channel]
            total = total_pixels[channel]
            channel_max_weight = max_weight_per_channel[channel]
            if pos == 0:
                # No positive pixels found across every available mask for this
                # channel -- shouldn't happen with real IDRiD data, but avoid a
                # divide-by-zero if it ever does.
                weights.append(channel_max_weight)
                continue
            neg = total - pos
            raw_ratio = neg / pos
            weights.append(min(np.sqrt(raw_ratio), channel_max_weight))

        return torch.tensor(weights, dtype=torch.float32)

    @staticmethod
    def discover_all_image_ids(data_dir, image_dir=None):
        """Scans the training image folder and returns every IDRiD_NN id found
        (2-digit convention, e.g. IDRiD_01). Use this once, then split it with
        split_image_ids() so train/val stay disjoint at the image level."""
        full_image_dir = os.path.join(data_dir, image_dir or DEFAULT_IMAGE_DIR)
        paths = sorted(glob.glob(os.path.join(full_image_dir, "*.jpg")))
        return [os.path.splitext(os.path.basename(p))[0] for p in paths]

    def __len__(self):
        return len(self.image_ids)

    def _mask_path(self, image_id, channel):
        folder = LESION_FOLDER_NAMES[channel]
        return os.path.join(self.mask_root, folder, f"{image_id}_{channel}.tif")

    def _load_mask_channel(self, image_id, channel):
        path = self._mask_path(image_id, channel)
        if not os.path.exists(path):
            return None
        # Force single-channel grayscale: some IDRiD mask TIFFs are stored as
        # RGBA even though content is binary (same issue found and fixed in
        # gradcam_lesion_eval_batch.py's load_mask()).
        mask = np.array(Image.open(path).convert("L"))
        return (mask > 0).astype(np.float32)

    def __getitem__(self, idx):
        image_id = self.image_ids[idx]
        img_path = os.path.join(self.image_dir, f"{image_id}.jpg")
        img = Image.open(img_path).convert("RGB")

        # Same center-crop-to-square-then-resize approach used everywhere else
        # in this project (idrid_dataset.py, gradcam.py), so image and masks
        # stay pixel-aligned and lesion geometry isn't distorted.
        w, h = img.size
        side = min(w, h)
        left, top = (w - side) // 2, (h - side) // 2
        img_cropped = img.crop((left, top, left + side, top + side)).resize(
            (self.img_size, self.img_size), Image.BILINEAR
        )
        arr = np.array(img_cropped).astype(np.float32) / 255.0

        # Build the 4-channel mask + availability vector. Each channel is
        # cropped with the SAME left/top/side as the image before resizing
        # (nearest-neighbor, since masks are binary), matching the crop-
        # alignment fix used in gradcam_lesion_eval.py.
        mask_channels = np.zeros((len(LESION_CHANNELS), self.img_size, self.img_size),
                                  dtype=np.float32)
        availability = np.zeros(len(LESION_CHANNELS), dtype=np.float32)

        for ch_idx, channel in enumerate(LESION_CHANNELS):
            full_mask = self._load_mask_channel(image_id, channel)
            if full_mask is None:
                continue  # leave as zero placeholder, availability stays 0
            mask_h, mask_w = full_mask.shape
            m_side = min(mask_w, mask_h)
            m_left, m_top = (mask_w - m_side) // 2, (mask_h - m_side) // 2
            mask_cropped = full_mask[m_top:m_top + m_side, m_left:m_left + m_side]
            mask_img = Image.fromarray((mask_cropped * 255).astype(np.uint8))
            mask_resized = mask_img.resize((self.img_size, self.img_size), Image.NEAREST)
            mask_channels[ch_idx] = (np.array(mask_resized) > 127).astype(np.float32)
            availability[ch_idx] = 1.0

        if self.augment:
            if np.random.rand() < 0.5:
                arr = arr[:, ::-1, :].copy()
                mask_channels = mask_channels[:, :, ::-1].copy()
            if np.random.rand() < 0.5:
                arr = arr[::-1, :, :].copy()
                mask_channels = mask_channels[:, ::-1, :].copy()
            k = np.random.randint(0, 4)
            if k:
                arr = np.rot90(arr, k, axes=(0, 1)).copy()
                mask_channels = np.rot90(mask_channels, k, axes=(1, 2)).copy()

        img_t = torch.from_numpy(arr).permute(2, 0, 1)
        mean = torch.tensor([0.485, 0.456, 0.406]).view(3, 1, 1)
        std = torch.tensor([0.229, 0.224, 0.225]).view(3, 1, 1)
        img_t = (img_t - mean) / std

        mask_t = torch.from_numpy(mask_channels)  # (4, H, W)
        availability_t = torch.from_numpy(availability)  # (4,)

        return img_t, mask_t, availability_t


def split_image_ids(all_ids, val_fraction=0.2, seed=42):
    """Splits the full list of image IDs ONCE at the image level (not per
    lesion type), so a given image lands in exactly one of train/val
    regardless of which lesion masks it happens to have. With only ~54
    images total, this is a small split -- do not over-interpret val
    metrics from it as if it were a large, statistically robust holdout.

    KNOWN LIMITATION: this split is NOT stratified by which lesion masks
    each image has. Soft Exudates masks exist for only 26 of 54 images, so
    a random split can, by chance, put an uneven share of SE-annotated
    images into train vs val -- meaning the SE validation metric may be
    based on very few images in a given run. With only 26 SE-masked images
    total, meaningful stratification isn't really achievable anyway; this
    is a real constraint of the dataset, not something this function should
    paper over."""
    rng = np.random.RandomState(seed)
    ids = list(all_ids)
    rng.shuffle(ids)
    n_val = max(1, int(round(len(ids) * val_fraction)))
    val_ids = sorted(ids[:n_val])
    train_ids = sorted(ids[n_val:])
    return train_ids, val_ids
