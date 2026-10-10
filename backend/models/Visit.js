// models/Visit.js
// Two-eye (OD/OS) visit — a NEW, separate model alongside Result.js.
// Does not replace or modify Result.js; POST /api/images and
// GET /api/results/:imageId keep saving/reading single-eye Result
// documents exactly as before.

const mongoose = require("mongoose");

const { Schema } = mongoose;

const Result = require("./Result");

// ---------------------------------------------------------
// Embedded per-eye result — same shape as Result, reused via .clone()
// ---------------------------------------------------------

// Result.ResultSchema declares `image_id` as unique+indexed and `user_id`
// as indexed, which makes sense for the top-level Result collection but
// not once embedded as a single nested (non-array) subdocument under
// od/os: od and os are independently nullable, so multiple Visit
// documents can legitimately have (say) od: null at the same time, and a
// carried-over unique index on "od.image_id" would treat those as
// colliding null values and fail inserts.
//
// Schema.clearIndexes() alone does NOT remove these -- it only clears a
// schema's own registered index() calls, not per-path index/unique
// options, which Mongoose re-derives when compiling the PARENT schema's
// nested single-subdocument paths (confirmed directly: after clone() +
// clearIndexes(), Visit.schema.indexes() still listed "od.image_id" and
// "os.image_id" as unique). Explicitly unsetting the index on each
// previously-indexed path is what actually works -- verified this
// removes them from the compiled parent schema's indexes() while every
// field, type, and validator stays identical.
const EmbeddedResultSchema = Result.ResultSchema.clone();
EmbeddedResultSchema.path("image_id").index(false);
EmbeddedResultSchema.path("user_id").index(false);

// ---------------------------------------------------------
// Visit Schema
// ---------------------------------------------------------

const VisitSchema = new Schema(
    {
        visit_id: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },

        // Plain UUID string, same convention as visit_id/image_id -- not
        // a Mongoose ObjectId ref, since Patient.patient_id is likewise a
        // UUID string rather than a Mongo _id. Joins are done manually in
        // the route handler (fetch the user's patients, map by
        // patient_id) rather than via .populate().
        patient_id: {
            type: String,
            required: true,
            index: true,
        },

        user_id: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },

        created_at: {
            type: Date,
            required: true,
            default: Date.now,
        },

        // Doctor this visit was routed to by the technician. null = any
        // doctor may pick it up.
        assigned_doctor_id: {
            type: Schema.Types.ObjectId,
            ref: "User",
            default: null,
            index: true,
        },

        // Server-side state of the MATLAB + AI run. The upload request
        // returns as soon as the visit is accepted; the pipeline then runs
        // in the background, so this is what every client (technician
        // roster, refresh, another device) reads to show "processing".
        // Visits created before this field existed count as complete.
        processing: {
            status: {
                type: String,
                enum: ["processing", "complete", "failed"],
                default: "complete",
            },
            error: {
                type: String,
                default: null,
            },
            started_at: {
                type: Date,
                default: null,
            },
            finished_at: {
                type: Date,
                default: null,
            },
        },

        // Independently nullable: a visit may have only one eye uploaded,
        // or processing may still be pending/failed for one side.
        od: {
            type: EmbeddedResultSchema,
            default: null,
        },

        os: {
            type: EmbeddedResultSchema,
            default: null,
        },

        // Clinical finalization and doctor decision (Agree with AI or Override)
        clinical_evaluation: {
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
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model("Visit", VisitSchema);
