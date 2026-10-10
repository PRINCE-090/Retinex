// models/Patient.js
// Minimal patient record -- just enough to identify a patient and list
// them for the review queue, not a full EHR.

const mongoose = require("mongoose");

const { Schema } = mongoose;

const PatientSchema = new Schema(
    {
        // UUID, same convention as image_id/visit_id elsewhere in this
        // backend (plain string ids, not Mongo ObjectIds).
        patient_id: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },

        // The staff member (technician/doctor) who registered this patient.
        // Access is clinic-wide -- this is provenance, not an ownership filter.
        user_id: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },

        name: {
            type: String,
            required: true,
            trim: true,
        },

        age: {
            type: Number,
            required: true,
        },

        // Digits only (10-digit Indian mobile, no country code). Patients
        // sign in with this number; not required so patients created
        // before this field existed remain valid.
        phone: {
            type: String,
            trim: true,
            default: "",
            index: true,
        },

        gender: {
            type: String,
            enum: ["male", "female", "other", ""],
            default: "",
        },

        // null = not recorded.
        diabetic_history: {
            type: Boolean,
            default: null,
        },

        created_at: {
            type: Date,
            required: true,
            default: Date.now,
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model("Patient", PatientSchema);
