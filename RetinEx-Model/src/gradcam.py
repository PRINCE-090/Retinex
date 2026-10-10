"""
Grad-CAM (Selvaraju et al. 2017) for the DR classifier.

Run:
  python src/gradcam.py --checkpoint runs/classifier/best.pt --image path/to/fundus.jpg \
      --out-dir runs/gradcam
"""
import os
import argparse
import numpy as np
from PIL import Image
import matplotlib.cm as cm
import torch
import torch.nn.functional as F

from model import DRClassifier

GRADE_NAMES = ["No DR", "Mild NPDR", "Moderate NPDR", "Severe NPDR", "Proliferative DR"]


class GradCAM:
    def __init__(self, model, target_layer):
        self.model = model
        self.activations = None
        self.gradients = None
        target_layer.register_forward_hook(self._save_activation)
        target_layer.register_full_backward_hook(self._save_gradient)

    def _save_activation(self, module, input, output):
        self.activations = output.detach()

    def _save_gradient(self, module, grad_input, grad_output):
        self.gradients = grad_output[0].detach()

    def generate(self, input_tensor, class_idx=None):
        self.model.zero_grad()
        grade_logits, ref_logit = self.model(input_tensor)
        if class_idx is None:
            class_idx = grade_logits.argmax(dim=1).item()

        score = grade_logits[0, class_idx]
        score.backward()

        # global-average-pool the gradients to get per-channel importance weights,
        # then weight the activation maps and sum — the core Grad-CAM step
        weights = self.gradients.mean(dim=(2, 3), keepdim=True)
        cam = (weights * self.activations).sum(dim=1, keepdim=True)
        cam = F.relu(cam)
        cam = cam.squeeze().cpu().numpy()
        cam = (cam - cam.min()) / (cam.max() - cam.min() + 1e-8)

        probs = F.softmax(grade_logits, dim=1).detach().cpu().numpy()[0]
        confidence = float(probs[class_idx])
        referable_prob = float(torch.sigmoid(ref_logit).item())

        return cam, class_idx, confidence, referable_prob


def load_and_preprocess(image_path, img_size):
    img = Image.open(image_path).convert("RGB")
    w, h = img.size
    side = min(w, h)
    left, top = (w - side) // 2, (h - side) // 2
    img_cropped = img.crop((left, top, left + side, top + side)).resize(
        (img_size, img_size), Image.BILINEAR
    )
    arr = np.array(img_cropped).astype(np.float32) / 255.0

    mean = np.array([0.485, 0.456, 0.406])
    std = np.array([0.229, 0.224, 0.225])
    norm = (arr - mean) / std
    tensor = torch.from_numpy(norm).permute(2, 0, 1).unsqueeze(0).float()
    return tensor, img_cropped


def overlay_heatmap(cam, original_img, alpha=0.45):
    cam_resized = np.array(Image.fromarray((cam * 255).astype(np.uint8)).resize(
        original_img.size, Image.BILINEAR
    ))
    heatmap = cm.jet(cam_resized / 255.0)[:, :, :3]  # drop alpha channel
    heatmap = (heatmap * 255).astype(np.uint8)
    orig_arr = np.array(original_img).astype(np.uint8)
    overlay = (alpha * heatmap + (1 - alpha) * orig_arr).astype(np.uint8)
    return Image.fromarray(overlay), Image.fromarray(heatmap)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--checkpoint", required=True)
    ap.add_argument("--image", required=True)
    ap.add_argument("--img-size", type=int, default=380)
    ap.add_argument("--out-dir", default="runs/gradcam")
    args = ap.parse_args()

    os.makedirs(args.out_dir, exist_ok=True)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    ckpt = torch.load(
    args.checkpoint,
    map_location=device,
    weights_only=False
    )
    model = DRClassifier(backbone_name=ckpt["backbone"], num_grades=5, pretrained=False)
    model.load_state_dict(ckpt["model_state"])
    model.to(device).eval()

    cam_engine = GradCAM(model, model.gradcam_target_layer)

    input_tensor, cropped_img = load_and_preprocess(args.image, args.img_size)
    input_tensor = input_tensor.to(device)
    input_tensor.requires_grad_(True)

    cam, class_idx, confidence, referable_prob = cam_engine.generate(input_tensor)
    overlay, heatmap = overlay_heatmap(cam, cropped_img)

    base = os.path.splitext(os.path.basename(args.image))[0]
    cropped_img.save(os.path.join(args.out_dir, f"{base}_original.png"))
    heatmap.save(os.path.join(args.out_dir, f"{base}_heatmap.png"))
    overlay.save(os.path.join(args.out_dir, f"{base}_overlay.png"))

    print(f"Predicted grade: {class_idx} ({GRADE_NAMES[class_idx]})")
    print(f"Confidence: {confidence:.1%}")
    print(f"Referable DR probability: {referable_prob:.1%}")
    print(f"Saved: {args.out_dir}/{base}_{{original,heatmap,overlay}}.png")


if __name__ == "__main__":
    main()
