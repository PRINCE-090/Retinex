// models/Result.js
// Mongoose model for the RetinEx AI pipeline output schema (schema_version "1.0")

const mongoose = require("mongoose");

const { Schema } = mongoose;

// ---------------------------------------------------------
// Classification
// ---------------------------------------------------------

const CalibrationSchema = new Schema(
    {
        temperature: Number,
        fitted_on: String,
        note: String,
    },
    { _id: false }
);

const KnownPerformanceSchema = new Schema(
    {
        official_test_sensitivity: Number,
        official_test_specificity: Number,
        official_test_auc: Number,
        target_sensitivity: Number,
        target_specificity: Number,
        meets_target: Boolean,
    },
    { _id: false }
);

const ReferableSchema = new Schema(
    {
        probability: Number,
        threshold: Number,
        threshold_source: String,
        is_referable: Boolean,
        known_performance: KnownPerformanceSchema,
    },
    { _id: false }
);

const ClassificationSchema = new Schema(
    {
        grade: Number,
        grade_name: String,
        grade_probabilities_raw: [Number],
        grade_probabilities_calibrated: [Number],
        calibration: CalibrationSchema,
        referable: ReferableSchema,
    },
    { _id: false }
);

// ---------------------------------------------------------
// Grad-CAM
// ---------------------------------------------------------

const CropRegionSchema = new Schema(
    {
        note: String,
        left: Number,
        top: Number,
        side: Number,
        original_width: Number,
        original_height: Number,
    },
    { _id: false }
);

const GradCamSchema = new Schema(
    {
        target_grade: Number,
        heatmap_path: String,
        overlay_path: String,
        crop_region: CropRegionSchema,
        lesion_overlap_validated: Boolean,
    },
    { _id: false }
);

// ---------------------------------------------------------
// Lesion Segmentation
// ---------------------------------------------------------

const LesionChannelSchema = new Schema(
    {
        mask_path: {
            type: String,
            default: null,
        },

        probability_map_path: {
            type: String,
            default: null,
        },

        val_dice: Number,

        dice_unreliable: Boolean,
    },
    { _id: false }
);

const LesionSegmentationSchema = new Schema(
    {
        model_img_size: Number,

        channels: {
            microaneurysms: LesionChannelSchema,
            haemorrhages: LesionChannelSchema,
            hard_exudates: LesionChannelSchema,
            soft_exudates: LesionChannelSchema,
        },
    },
    { _id: false }
);

// ---------------------------------------------------------
// Image Quality
// ---------------------------------------------------------

const ImageQualitySchema = new Schema(
    {
        status: String,

        quality: {
            type: String,
            default: null,
        },

        reject_reason: {
            type: String,
            default: null,
        },

        enhanced_image_path: {
            type: String,
            default: null,
        },
    },
    { _id: false }
);

// ---------------------------------------------------------
// Vessel Segmentation
// ---------------------------------------------------------

const VesselSegmentationSchema = new Schema(
    {
        status: String,

        mask_path: {
            type: String,
            default: null,
        },
    },
    { _id: false }
);

// ---------------------------------------------------------
// Optic Disc
// ---------------------------------------------------------

const OpticDiscSchema = new Schema(
    {
        status: String,

        location: {
            type: Schema.Types.Mixed,
            default: null,
        },
    },
    { _id: false }
);

// ---------------------------------------------------------
// Fovea
// ---------------------------------------------------------

const FoveaSchema = new Schema(
    {
        status: String,

        location: {
            type: Schema.Types.Mixed,
            default: null,
        },
    },
    { _id: false }
);

// ---------------------------------------------------------
// Neovascularization
// ---------------------------------------------------------

const NeovascularizationSchema = new Schema(
    {
        status: String,

        detected: {
            type: Boolean,
            default: null,
        },
    },
    { _id: false }
);

// ---------------------------------------------------------
// Pipeline Status
// ---------------------------------------------------------

const PipelineStatusSchema = new Schema(
    {
        image_quality_assessment: String,
        classification: String,
        grad_cam: String,
        lesion_segmentation: String,
        vessel_segmentation: String,
        optic_disc_localization: String,
        fovea_localization: String,
        neovascularization_detection: String,
    },
    { _id: false }
);

// ---------------------------------------------------------
// Clinical Evaluation
// ---------------------------------------------------------

// Same shape as Visit.clinical_evaluation -- synced onto the matching
// Result document(s) whenever a visit is finalized, so a Result read in
// isolation reflects the doctor's reviewed/overridden grade instead of
// only the raw AI output.
const ClinicalEvaluationSchema = new Schema(
    {
        status: {
            type: String,
            enum: ["pending", "finalized"],
            default: "pending",
        },
        decision: {
            type: String,
            enum: ["agree", "override", null],
            default: null,
        },
        override_grade: {
            type: Number,
            default: null,
        },
        doctor_notes: {
            type: String,
            default: "",
        },
        prescription: {
            type: String,
            default: "",
        },
        diet: {
            type: String,
            default: "",
        },
        finalized_at: {
            type: Date,
            default: null,
        },
        finalized_by: {
            type: String,
            default: null,
        },
    },
    { _id: false }
);

// ---------------------------------------------------------
// Main Result Schema
// ---------------------------------------------------------

const ResultSchema = new Schema(
    {
        // AI schema version
        schema_version: {
            type: String,
            required: true,
            default: "1.0",
        },

        // Unique image identifier generated by the backend
        image_id: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },

        // User who uploaded/owns this result
        // Comes from the authenticated JWT, NOT from the AI JSON.
        user_id: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },

        // AI processing timestamp
        processed_at: {
            type: Date,
            required: true,
            default: Date.now,
        },

        // -------------------------------------------------
        // AI pipeline blocks
        // -------------------------------------------------

        pipeline_status: {
            type: PipelineStatusSchema,
            default: null,
        },

        image_quality: {
            type: ImageQualitySchema,
            default: null,
        },

        classification: {
            type: ClassificationSchema,
            default: null,
        },

        grad_cam: {
            type: GradCamSchema,
            default: null,
        },

        lesion_segmentation: {
            type: LesionSegmentationSchema,
            default: null,
        },

        vessel_segmentation: {
            type: VesselSegmentationSchema,
            default: null,
        },

        optic_disc: {
            type: OpticDiscSchema,
            default: null,
        },

        fovea: {
            type: FoveaSchema,
            default: null,
        },

        neovascularization: {
            type: NeovascularizationSchema,
            default: null,
        },

        clinical_evaluation: {
            type: ClinicalEvaluationSchema,
            default: null,
        },
    },
    {
        // MongoDB bookkeeping fields
        timestamps: true,
    }
);

const ResultModel = mongoose.model("Result", ResultSchema);

// Exposes the raw schema (in addition to the compiled model, exported as
// before) so it can be embedded as a sub-schema elsewhere -- e.g.
// models/Visit.js reuses this exact shape for its od/os fields instead of
// redefining every field. Purely additive: existing `require("./Result")`
// callers still get the same working Model, unchanged.
ResultModel.ResultSchema = ResultSchema;

module.exports = ResultModel;