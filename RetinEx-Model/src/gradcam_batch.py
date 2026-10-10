import os
import argparse
from glob import glob

import torch

from model import DRClassifier
from gradcam import GradCAM, load_and_preprocess, overlay_heatmap, GRADE_NAMES


def main():
    ap = argparse.ArgumentParser()

    ap.add_argument("--checkpoint", required=True)
    ap.add_argument("--image-dir", required=True)
    ap.add_argument("--img-size", type=int, default=380)
    ap.add_argument("--out-dir", default="runs/gradcam_batch")

    args = ap.parse_args()

    os.makedirs(args.out_dir, exist_ok=True)

    device = torch.device(
        "cuda" if torch.cuda.is_available() else "cpu"
    )

    print(f"Using device: {device}")

    # Load trained model
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
    model.eval()

    # Use the same target layer as the single-image Grad-CAM script
    cam_engine = GradCAM(
        model,
        model.gradcam_target_layer
    )

    # Find retinal images
    image_paths = []

    for extension in ["*.jpg", "*.jpeg", "*.png"]:
        image_paths.extend(
            glob(os.path.join(args.image_dir, extension))
        )

    image_paths = sorted(set(os.path.normcase(path) for path in image_paths))

    print(f"Found {len(image_paths)} images")

    if len(image_paths) == 0:
        raise FileNotFoundError(
            "No images found in the specified directory."
        )

    successful = 0

    for i, image_path in enumerate(image_paths, start=1):

        try:
            input_tensor, cropped_img = load_and_preprocess(
                image_path,
                args.img_size
            )

            input_tensor = input_tensor.to(device)
            input_tensor.requires_grad_(True)

            cam, class_idx, confidence, referable_prob = (
                cam_engine.generate(input_tensor)
            )

            overlay, heatmap = overlay_heatmap(
                cam,
                cropped_img
            )

            base = os.path.splitext(
                os.path.basename(image_path)
            )[0]

            cropped_img.save(
                os.path.join(
                    args.out_dir,
                    f"{base}_original.png"
                )
            )

            heatmap.save(
                os.path.join(
                    args.out_dir,
                    f"{base}_heatmap.png"
                )
            )

            overlay.save(
                os.path.join(
                    args.out_dir,
                    f"{base}_overlay.png"
                )
            )

            print(
                f"[{i}/{len(image_paths)}] "
                f"{base}: "
                f"Grade {class_idx} ({GRADE_NAMES[class_idx]}) | "
                f"Confidence {confidence:.1%} | "
                f"Referable {referable_prob:.1%}"
            )

            successful += 1

        except Exception as e:
            print(
                f"[{i}/{len(image_paths)}] "
                f"{os.path.basename(image_path)} FAILED: {e}"
            )

    print("\n" + "=" * 60)
    print("BATCH GRAD-CAM COMPLETE")
    print("=" * 60)
    print(f"Successful: {successful}/{len(image_paths)}")
    print(f"Output directory: {args.out_dir}")


if __name__ == "__main__":
    main()