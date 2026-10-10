// Hardcoded stand-in for the AI pipeline's output, matching schema_version "1.0"
// from the AI/DL & Explainability Lead's handoff doc. This is the ONE contract
// shared with Frontend — do not change field names/shape here without syncing
// with them. Values are fake; the structure is what matters.
//
// getMockResult(imageId) returns a fresh deep copy each call, with image_id and
// processed_at filled in per-request, so multiple calls / tests don't share
// mutable state.

function buildMockResult() {
  return {
    schema_version: '1.0',
    image_id: null, // filled in by getMockResult
    processed_at: null, // filled in by getMockResult

    pipeline_status: {
      image_quality_assessment: 'not_implemented',
      classification: 'implemented',
      grad_cam: 'implemented',
      lesion_segmentation: 'implemented_low_confidence',
      vessel_segmentation: 'trained_not_integrated',
      optic_disc_localization: 'not_implemented',
      fovea_localization: 'not_implemented',
      neovascularization_detection: 'not_implemented',
    },

    image_quality: {
      status: 'not_implemented',
      quality: null,
      reject_reason: null,
      enhanced_image_path: null,
    },

    classification: {
      grade: 4,
      grade_name: 'Proliferative DR',
      grade_probabilities_raw: [0.02, 0.05, 0.12, 0.4, 0.41],
      grade_probabilities_calibrated: [0.03, 0.06, 0.14, 0.38, 0.39],
      calibration: {
        temperature: 0.904,
        fitted_on: 'validation',
        note: 'Validation ECE improved (0.1073->0.0934); held-out test ECE slightly worsened (0.0751->0.0802).',
      },
      referable: {
        probability: 0.919,
        threshold: 0.48,
        threshold_source: 'validation',
        is_referable: true,
        known_performance: {
          official_test_sensitivity: 0.875,
          official_test_specificity: 0.769,
          official_test_auc: 0.915,
          target_sensitivity: 0.9,
          target_specificity: 0.85,
          meets_target: false,
        },
      },
    },

    grad_cam: {
      target_grade: 4,
      heatmap_path: 'IDRiD_055_heatmap.png',
      overlay_path: 'IDRiD_055_overlay.png',
      crop_region: {
        note: 'CAM/heatmap only covers this square region of the ORIGINAL image.',
        left: 720,
        top: 0,
        side: 2848,
        original_width: 4288,
        original_height: 2848,
      },
      lesion_overlap_validated: false,
    },

    lesion_segmentation: {
      model_img_size: 512,
      channels: {
        microaneurysms: {
          mask_path: null,
          probability_map_path: 'IDRiD_055_MA_prob.png',
          val_dice: 0.0,
          dice_unreliable: true,
        },
        haemorrhages: {
          mask_path: 'IDRiD_055_HE_mask.png',
          val_dice: 0.1654,
          dice_unreliable: true,
        },
        hard_exudates: {
          mask_path: 'IDRiD_055_EX_mask.png',
          val_dice: 0.5761,
          dice_unreliable: false,
        },
        soft_exudates: {
          mask_path: 'IDRiD_055_SE_mask.png',
          val_dice: 0.1452,
          dice_unreliable: true,
        },
      },
    },

    vessel_segmentation: { status: 'trained_not_integrated', mask_path: null },
    optic_disc: { status: 'not_implemented', location: null },
    fovea: { status: 'not_implemented', location: null },
    neovascularization: { status: 'not_implemented', detected: null },
  };
}

function getMockResult(imageId) {
  const result = buildMockResult();
  result.image_id = imageId || 'IDRiD_055';
  result.processed_at = new Date().toISOString();
  return result;
}

module.exports = { getMockResult, buildMockResult };
