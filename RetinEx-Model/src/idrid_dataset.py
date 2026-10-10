"""
PyTorch Dataset for IDRiD Disease Grading (DR severity classification).

ACTUAL layout on disk (project root = D:\\SIH\\Model):

  Dataset\\archive\\B. Disease Grading\\B. Disease Grading\\1. Original Images\\a. Training Set\\IDRiD_001.jpg ...
  Dataset\\archive\\B. Disease Grading\\B. Disease Grading\\1. Original Images\\b. Testing Set\\IDRiD_055.jpg ...
  Dataset\\archive\\B. Disease Grading\\B. Disease Grading\\2. Groundtruths\\a. IDRiD_Disease Grading_Training Labels.csv
  Dataset\\archive\\B. Disease Grading\\B. Disease Grading\\2. Groundtruths\\b. IDRiD_Disease Grading_Testing Labels.csv

CSV columns: "Image name", "Retinopathy grade", "Risk of macular edema"
`grade` is 0-4 (ICDR scale). Referable DR is derived as grade >= 2.

SPLITS:
  "train" -> full training CSV (413 images) — use this only if you are NOT
             also carving out a validation set (e.g. quick smoke tests).
  "val"   -> a stratified held-out slice of the training CSV (see val_fraction).
  "trainval_train" -> the training CSV with the "val" rows removed. Use this
             as your actual training split once you're using validation.
  "test"  -> the official IDRiD testing CSV/images. Never used for model
             selection, threshold tuning, or calibration — final numbers only.

IMPORTANT LIMITATION: IDRiD provides no patient identifier, only image IDs
(IDRiD_001, IDRiD_002, ...). We cannot verify whether any patient contributed
more than one image. So the train/val split below is done at the IMAGE level,
not the patient level. This is a known limitation, not an oversight — if IDRiD
documentation for your release confirms one-image-per-patient, this limitation
does not apply, but we are not assuming that without confirmation.
"""
import os
import pandas as pd
import numpy as np
from PIL import Image
import torch
from torch.utils.data import Dataset

IMG_EXT_CANDIDATES = [".jpg", ".jpeg", ".png"]

# ---------------------------------------------------------------------------
# Default paths, matching your actual folder structure under D:\SIH\Model
# ---------------------------------------------------------------------------
_GRADING_ROOT = os.path.join(
    "Dataset", "archive", "B. Disease Grading", "B. Disease Grading"
)
DEFAULT_TRAIN_IMAGE_DIR = os.path.join(_GRADING_ROOT, "1. Original Images", "a. Training Set")
DEFAULT_TEST_IMAGE_DIR = os.path.join(_GRADING_ROOT, "1. Original Images", "b. Testing Set")
DEFAULT_TRAIN_CSV = os.path.join(
    _GRADING_ROOT, "2. Groundtruths", "a. IDRiD_Disease Grading_Training Labels.csv"
)
DEFAULT_TEST_CSV = os.path.join(
    _GRADING_ROOT, "2. Groundtruths", "b. IDRiD_Disease Grading_Testing Labels.csv"
)


class IDRiDGradingDataset(Dataset):
    def __init__(self, data_dir, split="train", img_size=380, augment=False,
                 referable_threshold=2, val_fraction=0.2, val_seed=42):
        """
        data_dir: your project root, e.g. r"D:\\SIH\\Model"
        split: one of "train", "val", "trainval_train", "test"
        val_fraction: fraction of the TRAINING csv to hold out as validation,
                      done with a per-class (stratified) split so rare grades
                      still appear in both train and val.
        """
        assert split in ("train", "val", "trainval_train", "test"), (
            f"split must be 'train', 'val', 'trainval_train', or 'test', got {split!r}"
        )
        self.data_dir = data_dir
        self.img_size = img_size
        self.augment = augment
        self.referable_threshold = referable_threshold

        # "val" and "trainval_train" are both derived from the training CSV/images.
        # "test" uses the official test CSV/images and is never split further.
        csv_uses_train_source = split in ("train", "val", "trainval_train")
        csv_path = os.path.join(
            data_dir, DEFAULT_TRAIN_CSV if csv_uses_train_source else DEFAULT_TEST_CSV
        )
        self.image_dir = os.path.join(
            data_dir, DEFAULT_TRAIN_IMAGE_DIR if csv_uses_train_source else DEFAULT_TEST_IMAGE_DIR
        )

        if not os.path.exists(csv_path):
            raise FileNotFoundError(
                f"Could not find labels CSV at:\n  {csv_path}\n"
                f"Check that data_dir (currently {data_dir!r}) is your project root "
                f"(e.g. r'D:\\SIH\\Model'), and that the Dataset folder hasn't moved."
            )
        if not os.path.isdir(self.image_dir):
            raise FileNotFoundError(
                f"Could not find image folder at:\n  {self.image_dir}\n"
                f"Check that data_dir (currently {data_dir!r}) is correct."
            )

        df = pd.read_csv(csv_path)
        # normalize column names in case the raw IDRiD CSV headers differ slightly
        df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]
        id_col = next(c for c in df.columns if "image" in c or "id" in c)
        grade_col = next(c for c in df.columns if "retinopathy" in c or "grade" in c)
        df = df.rename(columns={id_col: "image_id", grade_col: "grade"})
        # the raw CSV sometimes has trailing blank rows with NaN grade — drop them
        df = df.dropna(subset=["image_id", "grade"]).reset_index(drop=True)
        df["grade"] = df["grade"].astype(int)

        if split in ("val", "trainval_train"):
            train_idx, val_idx = self._stratified_split(df["grade"].values, val_fraction, val_seed)
            df = df.iloc[val_idx].reset_index(drop=True) if split == "val" \
                else df.iloc[train_idx].reset_index(drop=True)

        self.df = df

    @staticmethod
    def _stratified_split(grades, val_fraction, seed):
        """Per-class shuffle-and-slice so every grade (including rare ones like
        grade 4) is represented in both the train and val subsets. Returns
        (train_indices, val_indices) as arrays of positions into `grades`."""
        rng = np.random.RandomState(seed)
        train_idx, val_idx = [], []
        for g in np.unique(grades):
            idx = np.where(grades == g)[0]
            rng.shuffle(idx)
            n_val = max(1, int(round(len(idx) * val_fraction)))
            val_idx.extend(idx[:n_val])
            train_idx.extend(idx[n_val:])
        return np.array(sorted(train_idx)), np.array(sorted(val_idx))

    def __len__(self):
        return len(self.df)

    def _find_image_path(self, image_id):
        base = str(image_id).strip()
        base = os.path.splitext(base)[0]
        for ext in IMG_EXT_CANDIDATES:
            p = os.path.join(self.image_dir, base + ext)
            if os.path.exists(p):
                return p
        raise FileNotFoundError(f"No image found for id {image_id} in {self.image_dir}")

    def __getitem__(self, idx):
        row = self.df.iloc[idx]
        path = self._find_image_path(row["image_id"])
        img = Image.open(path).convert("RGB")

        # center-crop to square on the retinal FOV, then resize — avoids squashing
        # the circular fundus into an oval, which distorts lesion geometry
        w, h = img.size
        side = min(w, h)
        left, top = (w - side) // 2, (h - side) // 2
        img = img.crop((left, top, left + side, top + side)).resize(
            (self.img_size, self.img_size), Image.BILINEAR
        )
        arr = np.array(img).astype(np.float32) / 255.0

        if self.augment:
            if np.random.rand() < 0.5:
                arr = arr[:, ::-1, :].copy()
            if np.random.rand() < 0.5:
                arr = arr[::-1, :, :].copy()
            k = np.random.randint(0, 4)
            if k:
                arr = np.rot90(arr, k, axes=(0, 1)).copy()
            # mild brightness/contrast jitter only — no hue/color shift, since color
            # is a diagnostic signal in fundus photography (report section 4)
            if np.random.rand() < 0.5:
                factor = 1.0 + (np.random.rand() - 0.5) * 0.2  # +/-10%
                arr = np.clip(arr * factor, 0, 1)

        img_t = torch.from_numpy(arr).permute(2, 0, 1)
        mean = torch.tensor([0.485, 0.456, 0.406]).view(3, 1, 1)
        std = torch.tensor([0.229, 0.224, 0.225]).view(3, 1, 1)
        img_t = (img_t - mean) / std

        grade = int(row["grade"])
        referable = 1 if grade >= self.referable_threshold else 0

        return img_t, grade, referable

    def class_counts(self):
        return self.df["grade"].value_counts().sort_index()
