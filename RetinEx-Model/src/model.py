"""
Shared backbone (transfer learning) with two heads:
  - 5-class DR severity (0-4)
  - binary referable-DR (grade >= 2)

Start with everything but the heads frozen, then unfreeze gradually
(see train_classifier.py --unfreeze-at).
"""
import torch
import torch.nn as nn
import torchvision.models as models

BACKBONES = {
    "resnet50": (models.resnet50, "IMAGENET1K_V2", 2048),
    "efficientnet_b0": (models.efficientnet_b0, "IMAGENET1K_V1", 1280),
    "densenet121": (models.densenet121, "IMAGENET1K_V1", 1024),
}


class DRClassifier(nn.Module):
    def __init__(self, backbone_name="efficientnet_b0", num_grades=5, pretrained=True,
                 dropout=0.3):
        super().__init__()
        if backbone_name not in BACKBONES:
            raise ValueError(f"backbone must be one of {list(BACKBONES)}")
        ctor, weights_tag, feat_dim = BACKBONES[backbone_name]
        self.backbone_name = backbone_name

        weights = weights_tag if pretrained else None
        base = ctor(weights=weights)

        if backbone_name == "resnet50":
            self.features = nn.Sequential(*list(base.children())[:-1])  # drop fc
        elif backbone_name == "efficientnet_b0":
            self.features = nn.Sequential(base.features, base.avgpool)
        elif backbone_name == "densenet121":
            self.features = nn.Sequential(base.features, nn.AdaptiveAvgPool2d(1))

        self.dropout = nn.Dropout(dropout)
        self.grade_head = nn.Linear(feat_dim, num_grades)
        self.referable_head = nn.Linear(feat_dim, 1)

        # keep a handle on the last conv layer for Grad-CAM
        self.gradcam_target_layer = self._infer_target_layer(base)

    def _infer_target_layer(self, base):
        if self.backbone_name == "resnet50":
            return self.features[-2][-1]  # last block of layer4
        if self.backbone_name == "efficientnet_b0":
            return self.features[0][-1]  # last block of features
        if self.backbone_name == "densenet121":
            return self.features[0][-1]  # last denseblock/norm
        raise ValueError

    def freeze_backbone(self):
        for p in self.features.parameters():
            p.requires_grad = False

    def unfreeze_backbone(self):
        for p in self.features.parameters():
            p.requires_grad = True

    def forward(self, x):
        feat = self.features(x)
        feat = torch.flatten(feat, 1)
        feat = self.dropout(feat)
        grade_logits = self.grade_head(feat)
        referable_logit = self.referable_head(feat).squeeze(-1)
        return grade_logits, referable_logit
