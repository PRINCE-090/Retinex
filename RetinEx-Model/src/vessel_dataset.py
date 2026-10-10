"""
PyTorch Dataset for the DRIVE retinal vessel segmentation dataset.
Expects the layout you get from unzipping training.zip / test.zip as-is:

  data_dir/training/images/21_training.tif ... 40_training.tif
  data_dir/training/1st_manual/21_manual1.gif ...
  data_dir/training/mask/21_training_mask.gif ...
  data_dir/test/images/01_test.tif ...
  data_dir/test/mask/01_test_mask.gif   (test has no 1st_manual — no public GT)
"""
import os
import glob
import numpy as np
from PIL import Image
import torch
from torch.utils.data import Dataset


class DriveVesselDataset(Dataset):
    def __init__(self, data_dir, split="training", img_size=384, augment=False):
        assert split in ("training", "test")
        self.split = split
        self.img_size = img_size
        self.augment = augment

        img_dir = os.path.join(data_dir, split, "images")
        self.image_paths = sorted(glob.glob(os.path.join(img_dir, "*.tif")))
        if len(self.image_paths) == 0:
            raise FileNotFoundError(f"No .tif images found in {img_dir}")

        manual_dir = os.path.join(data_dir, split, "1st_manual")
        self.has_labels = os.path.isdir(manual_dir)
        if self.has_labels:
            self.manual_paths = sorted(glob.glob(os.path.join(manual_dir, "*.gif")))
            assert len(self.manual_paths) == len(self.image_paths), (
                f"Image/label count mismatch: {len(self.image_paths)} images, "
                f"{len(self.manual_paths)} manual masks"
            )

    def __len__(self):
        return len(self.image_paths)

    def _load_resized(self, path, is_mask):
        img = Image.open(path)
        img = img.convert("L") if is_mask else img.convert("RGB")
        img = img.resize((self.img_size, self.img_size), Image.NEAREST if is_mask else Image.BILINEAR)
        return np.array(img)

    def __getitem__(self, idx):
        img = self._load_resized(self.image_paths[idx], is_mask=False).astype(np.float32) / 255.0

        if self.has_labels:
            mask = self._load_resized(self.manual_paths[idx], is_mask=True)
            mask = (mask > 127).astype(np.float32)  # binarize vessel/not-vessel
        else:
            mask = np.zeros((self.img_size, self.img_size), dtype=np.float32)

        if self.augment:
            if np.random.rand() < 0.5:
                img, mask = img[:, ::-1, :].copy(), mask[:, ::-1].copy()
            if np.random.rand() < 0.5:
                img, mask = img[::-1, :, :].copy(), mask[::-1, :].copy()
            k = np.random.randint(0, 4)
            if k:
                img = np.rot90(img, k, axes=(0, 1)).copy()
                mask = np.rot90(mask, k, axes=(0, 1)).copy()

        img_t = torch.from_numpy(img).permute(2, 0, 1)  # C,H,W
        mask_t = torch.from_numpy(mask).unsqueeze(0)  # 1,H,W

        # ImageNet normalization (harmless even for a from-scratch U-Net, and needed
        # later if you swap in a pretrained encoder)
        mean = torch.tensor([0.485, 0.456, 0.406]).view(3, 1, 1)
        std = torch.tensor([0.229, 0.224, 0.225]).view(3, 1, 1)
        img_t = (img_t - mean) / std

        return img_t, mask_t
