require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { spawn } = require("child_process");

const { connectDB } = require("./config/db");

const Result = require("./models/Result");
const Visit = require("./models/Visit");
const Patient = require("./models/Patient");
const User = require("./models/User");
const { upload, uploadVisit, UPLOAD_DIR } = require("./middleware/upload");

const authRoutes = require("./routes/auth");
const authMiddleware = require("./middleware/auth");

// Role gates (see middleware/auth.js). Tokens carry `role`.
const { requireRole } = authMiddleware;
const anyStaff = requireRole("doctor", "reviewer", "technician", "admin");
const canRegister = requireRole("technician", "doctor", "admin");
const canReview = requireRole("doctor", "admin");

const { getMockMatlabResult } = require("../MATLAB/mock/mockMatlabResult");

const app = express();


// =====================================================
// Middleware
// =====================================================

// Frontend dev origins (Vite's default port, plus the next couple it
// falls back to if 5173 is already in use, and `vite preview`'s port).
// Auth is Bearer-token-based (Authorization header), not cookies, so
// credentials/Access-Control-Allow-Credentials isn't required here --
// only Access-Control-Allow-Headers needs to permit "Authorization",
// which the cors package does automatically by reflecting whatever the
// preflight's Access-Control-Request-Headers asks for.
const ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
    process.env.FRONTEND_ORIGIN
].filter(Boolean);

app.use(
    cors({
        origin: (origin, callback) => {
            if (!origin || ALLOWED_ORIGINS.includes(origin)) {
                return callback(null, true);
            }

            return callback(new Error("Origin is not allowed by CORS"));
        },
        credentials: true
    })
);

app.use(express.json());


// =====================================================
// Authentication Routes
// =====================================================

app.use("/api/auth", authRoutes);


// =====================================================
// AI Configuration
// =====================================================

// AI project folder
const AI_PROJECT_DIR =
    process.env.AI_PROJECT_DIR ||
    "C:/Users/LENOVO/data";


// Python executable
const AI_PYTHON =
    process.env.AI_PYTHON ||
    "C:/Users/LENOVO/data/.venv/Scripts/python.exe";


// AI inference script
const AI_SCRIPT =
    process.env.AI_SCRIPT ||
    "C:/Users/LENOVO/data/run_inference_pipeline.py";


// AI checkpoints directory
const AI_CHECKPOINTS_DIR =
    process.env.AI_CHECKPOINTS_DIR ||
    "C:/Users/LENOVO/data/src/runs";


// AI output directory
const AI_OUTPUT_DIR =
    process.env.AI_OUTPUT_DIR ||
    "C:/Users/LENOVO/data/src/runs/pipeline_test";


// MATLAB code directory (holds runRetinExJSON.m)
const MATLAB_CODE_DIR =
    process.env.MATLAB_CODE_DIR ||
    path.join(__dirname, "..", "MATLAB", "code");


// =====================================================
// MATLAB Quality/Localization Step
// =====================================================

// USE_MOCK_MATLAB lets the full upload -> quality-check -> AI-pipeline flow
// be developed/tested without MATLAB installed, by returning a fixed JSON
// contract in place of real MATLAB output. Set to false to invoke the real
// runRetinExJSON.m wrapper via `matlab -batch`.
const USE_MOCK_MATLAB =
    process.env.USE_MOCK_MATLAB === "true";


function runMatlabQualityCheck(imagePath, forcedQuality, imageId) {

    if (USE_MOCK_MATLAB) {

        return Promise.resolve(
            getMockMatlabResult(imagePath, forcedQuality)
        );

    }

    return new Promise((resolve, reject) => {

        const outputJsonPath = path.join(
            AI_OUTPUT_DIR,
            `${imageId}_matlab_quality.json`
        );

        const matlabCommand =
            `addpath('${MATLAB_CODE_DIR.replace(/\\/g, "/")}'); ` +
            `runRetinExJSON('${imagePath.replace(/\\/g, "/")}', ` +
            `'${outputJsonPath.replace(/\\/g, "/")}');`;

        console.log("\n======================================");
        console.log("Starting MATLAB quality check");
        console.log("Image:", imagePath);
        console.log("Output:", outputJsonPath);
        console.log("======================================\n");

        const matlabProcess = spawn(
            "matlab",
            ["-batch", matlabCommand]
        );

        let stdout = "";
        let stderr = "";


        matlabProcess.stdout.on("data", (data) => {

            const text = data.toString();

            stdout += text;

            console.log(
                "[MATLAB]",
                text.trim()
            );

        });


        matlabProcess.stderr.on("data", (data) => {

            const text = data.toString();

            stderr += text;

            console.error(
                "[MATLAB ERROR]",
                text.trim()
            );

        });


        matlabProcess.on("error", (error) => {

            reject(
                new Error(
                    `Failed to start MATLAB process: ${error.message}`
                )
            );

        });


        matlabProcess.on("close", (code) => {

            console.log(
                `MATLAB process exited with code ${code}`
            );

            if (!fs.existsSync(outputJsonPath)) {

                return reject(
                    new Error(
                        `MATLAB quality check did not produce an output file (exit code ${code}):\n${stderr}`
                    )
                );

            }

            try {

                const jsonData = fs.readFileSync(
                    outputJsonPath,
                    "utf8"
                );

                const matlabResult = JSON.parse(jsonData);

                resolve(matlabResult);

            } catch (error) {

                reject(
                    new Error(
                        `Failed to read/parse MATLAB quality JSON: ${error.message}`
                    )
                );

            }

        });

    });

}


// =====================================================
// Path normalization
// =====================================================

// The Python pipeline writes absolute filesystem paths into its result
// JSON (they're absolute on its end too, built from AI_OUTPUT_DIR). Store
// them relative to AI_OUTPUT_DIR instead, so saved Mongo documents aren't
// tied to one machine's filesystem layout. The asset-serving route
// re-joins them onto AI_OUTPUT_DIR to resolve an actual file.
function toRelativeAssetPath(absolutePath) {

    if (!absolutePath) {

        return absolutePath;

    }

    return path
        .relative(AI_OUTPUT_DIR, absolutePath)
        .split(path.sep)
        .join("/");

}

function makeAssetPathsRelative(aiResult) {

    if (aiResult.grad_cam) {

        aiResult.grad_cam.heatmap_path =
            toRelativeAssetPath(aiResult.grad_cam.heatmap_path);

        aiResult.grad_cam.overlay_path =
            toRelativeAssetPath(aiResult.grad_cam.overlay_path);

    }

    if (aiResult.lesion_segmentation?.channels) {

        for (const channel of Object.values(
            aiResult.lesion_segmentation.channels
        )) {

            channel.mask_path =
                toRelativeAssetPath(channel.mask_path);

            channel.probability_map_path =
                toRelativeAssetPath(channel.probability_map_path);

        }

    }

    if (aiResult.vessel_segmentation) {

        aiResult.vessel_segmentation.mask_path =
            toRelativeAssetPath(aiResult.vessel_segmentation.mask_path);

    }

    return aiResult;

}


// =====================================================
// Run AI Pipeline
// =====================================================

function runAIPipeline(imagePath, imageId) {

    return new Promise((resolve, reject) => {

        const outputDir = path.join(
            AI_OUTPUT_DIR,
            imageId
        );


        console.log("\n======================================");
        console.log("Starting RetinEx AI pipeline");
        console.log("Image:", imagePath);
        console.log("Image ID:", imageId);
        console.log("Output:", outputDir);
        console.log("======================================\n");


        const args = [
            AI_SCRIPT,
            "--image",
            imagePath,
            "--checkpoints-dir",
            AI_CHECKPOINTS_DIR,
            "--out-dir",
            outputDir
        ];


        const pythonProcess = spawn(
            AI_PYTHON,
            args,
            {
                cwd: AI_PROJECT_DIR
            }
        );


        let stdout = "";
        let stderr = "";


        // ---------------------------------------------
        // Python standard output
        // ---------------------------------------------

        pythonProcess.stdout.on("data", (data) => {

            const text = data.toString();

            stdout += text;

            console.log(
                "[AI]",
                text.trim()
            );

        });


        // ---------------------------------------------
        // Python error output
        // ---------------------------------------------

        pythonProcess.stderr.on("data", (data) => {

            const text = data.toString();

            stderr += text;

            console.error(
                "[AI ERROR]",
                text.trim()
            );

        });


        // ---------------------------------------------
        // Python process error
        // ---------------------------------------------

        pythonProcess.on("error", (error) => {

            reject(
                new Error(
                    `Failed to start AI process: ${error.message}`
                )
            );

        });


        // ---------------------------------------------
        // Python process completed
        // ---------------------------------------------

        pythonProcess.on("close", (code) => {

            console.log(
                `AI process exited with code ${code}`
            );


            if (code !== 0) {

                return reject(
                    new Error(
                        `AI pipeline failed with exit code ${code}\n${stderr}`
                    )
                );

            }


            // -----------------------------------------
            // Expected JSON result
            // -----------------------------------------

            // The Python script names its result JSON after the basename
            // of whatever --image path it was given (e.g. "<id>.jpg" for
            // an untouched upload, "<id>_enhanced.jpg" after MATLAB
            // enhancement), so the exact filename can't be assumed here --
            // find it by suffix within the per-image output directory
            // instead.
            let resultFiles = [];

            try {

                resultFiles = fs
                    .readdirSync(outputDir)
                    .filter((file) => file.endsWith("_result.json"));

            } catch (error) {

                return reject(
                    new Error(
                        `Could not read AI output directory: ${outputDir}\n${error.message}`
                    )
                );

            }

            if (resultFiles.length === 0) {

                return reject(
                    new Error(
                        `No result JSON produced by Python pipeline for this image (looked in ${outputDir})`
                    )
                );

            }

            if (resultFiles.length > 1) {

                return reject(
                    new Error(
                        `Expected exactly one result JSON, found ${resultFiles.length}: [${resultFiles.join(", ")}]`
                    )
                );

            }

            const resultPath = path.join(
                outputDir,
                resultFiles[0]
            );


            try {

                const jsonData = fs.readFileSync(
                    resultPath,
                    "utf8"
                );


                const aiResult =
                    JSON.parse(jsonData);


                resolve(
                    makeAssetPathsRelative(aiResult)
                );

            } catch (error) {

                reject(
                    new Error(
                        `Failed to read AI result JSON: ${error.message}`
                    )
                );

            }

        });

    });

}


// =====================================================
// Process a single image end-to-end (MATLAB + AI pipeline)
// =====================================================

// Shared by POST /api/images (single image) and POST /api/visits (one
// call per uploaded eye) so the MATLAB/AI orchestration isn't duplicated.
// Returns the same result-object shape either route ends up persisting;
// does NOT save anything to Mongo itself -- callers decide where it goes
// (a top-level Result document, or nested under a Visit's od/os).
async function processImageForResult(imagePath, imageId, userId, mockQuality) {

    const matlabResult = await runMatlabQualityCheck(
        imagePath,
        mockQuality,
        imageId
    );

    if (matlabResult.quality === "reject") {

        return {

            schema_version: "1.0",
            image_id: imageId,
            user_id: userId,
            processed_at: new Date(),

            pipeline_status: {
                image_quality_assessment: "implemented",
                classification: "not_implemented",
                grad_cam: "not_implemented",
                lesion_segmentation: "not_implemented",
                vessel_segmentation: "not_implemented",
                optic_disc_localization: "not_implemented",
                fovea_localization: "not_implemented",
                neovascularization_detection: "not_implemented"
            },

            image_quality: {
                status: "implemented",
                quality: "reject",
                reject_reason: matlabResult.reject_reason,
                enhanced_image_path: null
            },

            classification: null,
            grad_cam: null,
            lesion_segmentation: null,
            vessel_segmentation: null,
            optic_disc: null,
            fovea: null,
            neovascularization: null

        };

    }

    const aiResult = await runAIPipeline(
        matlabResult.image_path,
        imageId
    );

    // Python names its image_id after the basename of the --image path it
    // was given, which is "<imageId>" for an untouched upload but
    // "<imageId>_enhanced" once MATLAB has enhanced it -- so a prefix
    // match is used instead of exact equality.
    if (
        !aiResult.image_id ||
        !aiResult.image_id.startsWith(imageId)
    ) {

        throw new Error(
            "AI result image_id does not match uploaded image_id"
        );

    }

    aiResult.pipeline_status.image_quality_assessment = "implemented";
    aiResult.pipeline_status.optic_disc_localization = "implemented";
    aiResult.pipeline_status.fovea_localization = "implemented";

    aiResult.image_quality = {
        status: "implemented",
        quality: matlabResult.quality,
        reject_reason: null,
        enhanced_image_path:
            matlabResult.quality === "borderline"
                ? matlabResult.image_path
                : null
    };

    aiResult.optic_disc = {
        status: "implemented",
        location: matlabResult.optic_disc
    };

    aiResult.fovea = {
        status: "implemented",
        location: matlabResult.fovea
    };

    aiResult.user_id = userId;

    // findOneAndUpdate (single-image route) / assignment onto Visit.od|os
    // both persist this object's image_id as-is, so force it back to the
    // canonical id here rather than leaving Python's possibly-suffixed
    // echo in place.
    aiResult.image_id = imageId;

    return aiResult;

}


// =====================================================
// AI asset path resolution + file serving
// =====================================================

// Shared by the single-image and visit asset routes.
function getAssetPathForType(resultDoc, assetType) {
    if (assetType === "original" && resultDoc.image_id) {
        try {
            if (fs.existsSync(UPLOAD_DIR)) {
                const files = fs.readdirSync(UPLOAD_DIR);
                const match = files.find((f) => f.startsWith(resultDoc.image_id));
                if (match) {
                    return path.join(UPLOAD_DIR, match);
                }
            }
        } catch (e) {
            console.error("Error finding original uploaded image:", e);
        }
    }

    const assetMap = {

        enhanced:
            resultDoc.image_quality?.enhanced_image_path,

        gradcam_heatmap:
            resultDoc.grad_cam?.heatmap_path,

        gradcam_overlay:
            resultDoc.grad_cam?.overlay_path,

        microaneurysms:
            resultDoc.lesion_segmentation
                ?.channels
                ?.microaneurysms
                ?.mask_path,

        haemorrhages:
            resultDoc.lesion_segmentation
                ?.channels
                ?.haemorrhages
                ?.mask_path,

        hard_exudates:
            resultDoc.lesion_segmentation
                ?.channels
                ?.hard_exudates
                ?.mask_path,

        soft_exudates:
            resultDoc.lesion_segmentation
                ?.channels
                ?.soft_exudates
                ?.mask_path,

        vessels:
            resultDoc.vessel_segmentation
                ?.mask_path

    };

    return assetMap[assetType] || null;

}

function sendAssetFile(res, assetPath) {

    // Supports files inside either AI_OUTPUT_DIR or UPLOAD_DIR
    const resolvedUploadDir = path.resolve(UPLOAD_DIR);
    const resolvedAIOutputDir = path.resolve(AI_OUTPUT_DIR);
    const resolvedAssetPath = path.isAbsolute(assetPath)
        ? path.resolve(assetPath)
        : path.resolve(AI_OUTPUT_DIR, assetPath);

    const relUpload = path.relative(resolvedUploadDir, resolvedAssetPath);
    const relAI = path.relative(resolvedAIOutputDir, resolvedAssetPath);

    const inUpload = !relUpload.startsWith("..") && !path.isAbsolute(relUpload);
    const inAI = !relAI.startsWith("..") && !path.isAbsolute(relAI);

    if (!inUpload && !inAI) {

        return res.status(403).json({
            success: false,
            error:
                "Access to this file is not allowed"
        });

    }

    if (!fs.existsSync(resolvedAssetPath)) {

        return res.status(404).json({
            success: false,
            error:
                "Image file not found"
        });

    }

    return res.sendFile(resolvedAssetPath);

}


// =====================================================
// Get AI Result
// Protected by JWT Authentication
// =====================================================

app.get(
    "/api/results/:imageId",
    authMiddleware,
    anyStaff,
    async (req, res) => {

        try {

            const result =
                await Result.findOne({
                    image_id: req.params.imageId,
                    user_id: req.user.userId
                });


            if (!result) {

                return res.status(404).json({
                    success: false,
                    error: "Result not found"
                });

            }


            return res.status(200).json(result);

        } catch (err) {

            console.error(
                "Error fetching result:",
                err
            );


            return res.status(500).json({
                success: false,
                error: err.message
            });

        }

    }
);


// =====================================================
// AI Generated Image Assets
// Protected by JWT Authentication
// =====================================================

app.get(
    "/api/results/:imageId/assets/:assetType",
    authMiddleware,
    anyStaff,
    async (req, res) => {

        try {

            const {
                imageId,
                assetType
            } = req.params;


            // -----------------------------------------
            // Verify result belongs to logged-in user
            // -----------------------------------------

            const result =
                await Result.findOne({
                    image_id: imageId,
                    user_id: req.user.userId
                });


            if (!result) {

                return res.status(404).json({
                    success: false,
                    error: "Result not found"
                });

            }


            // -----------------------------------------
            // Get requested asset
            // -----------------------------------------

            const assetPath =
                getAssetPathForType(result, assetType);


            if (!assetPath) {

                return res.status(404).json({
                    success: false,
                    error:
                        "Requested AI asset is not available"
                });

            }


            // -----------------------------------------
            // Resolve, security-check, and send
            // -----------------------------------------

            return sendAssetFile(res, assetPath);

        } catch (error) {

            console.error(
                "Error serving AI asset:",
                error
            );


            return res.status(500).json({
                success: false,
                error: error.message
            });

        }

    }
);


// =====================================================
// Image Upload + AI Processing
// Protected by JWT Authentication
// =====================================================

app.post(
    "/api/images",
    authMiddleware,
    anyStaff,
    (req, res) => {

        upload.single("image")(
            req,
            res,
            async (err) => {

                // -----------------------------------------
                // Multer/upload error
                // -----------------------------------------

                if (err) {

                    return res.status(400).json({
                        success: false,
                        error: err.message
                    });

                }


                // -----------------------------------------
                // No file uploaded
                // -----------------------------------------

                if (!req.file) {

                    return res.status(400).json({
                        success: false,
                        error:
                            'No file uploaded. Send it as multipart/form-data under the field "image".'
                    });

                }


                try {

                    console.log(
                        `Image uploaded successfully: ${req.imageId}`
                    );


                    // -------------------------------------
                    // MATLAB quality check + AI pipeline
                    // (shared with POST /api/visits)
                    // -------------------------------------

                    const resultObject =
                        await processImageForResult(
                            req.file.path,
                            req.imageId,
                            req.user.userId,
                            req.query.mock_quality
                        );


                    // -------------------------------------
                    // Save result in MongoDB
                    // -------------------------------------

                    const savedResult =
                        await Result.findOneAndUpdate(
                            {
                                image_id:
                                    req.imageId
                            },
                            resultObject,
                            {
                                new: true,
                                upsert: true,
                                runValidators: true,
                                setDefaultsOnInsert: true
                            }
                        );


                    // -------------------------------------
                    // Response
                    // -------------------------------------

                    const isReject =
                        resultObject.image_quality.quality === "reject";

                    return res.status(201).json({

                        success: true,

                        message:
                            isReject
                                ? "Image uploaded but rejected by quality check -- AI analysis skipped"
                                : "Image uploaded and AI analysis completed successfully",

                        image_id:
                            req.imageId,

                        original_filename:
                            req.file.originalname,

                        stored_filename:
                            req.storedFilename,

                        size_bytes:
                            req.file.size,

                        mime_type:
                            req.file.mimetype,

                        uploaded_at:
                            new Date().toISOString(),

                        result:
                            savedResult

                    });


                } catch (error) {

                    console.error(
                        "\nAI processing error:",
                        error
                    );


                    return res.status(500).json({

                        success: false,

                        error:
                            "Image uploaded but AI processing failed",

                        details:
                            error.message,

                        image_id:
                            req.imageId

                    });

                }

            }
        );

    }
);


// =====================================================
// Create Patient
// Protected by JWT Authentication
// =====================================================

app.post(
    "/api/patients",
    authMiddleware,
    canRegister,
    async (req, res) => {

        try {

            const { name, age, phone, gender, diabetic_history } = req.body || {};

            if (!name || !String(name).trim() || age === undefined || age === null || age === "") {

                return res.status(400).json({
                    success: false,
                    error: "Both \"name\" and \"age\" are required."
                });

            }

            const ageNumber = Number(age);

            if (!Number.isFinite(ageNumber) || ageNumber < 0) {

                return res.status(400).json({
                    success: false,
                    error: "\"age\" must be a non-negative number."
                });

            }

            // Patients sign in by phone, so it must be a usable, unique number.
            const phoneDigits =
                String(phone || "").replace(/\D/g, "").slice(-10);

            if (phoneDigits.length !== 10) {

                return res.status(400).json({
                    success: false,
                    error: "A valid 10-digit \"phone\" number is required."
                });

            }

            const existing =
                await Patient.findOne({ phone: phoneDigits });

            if (existing) {

                return res.status(409).json({
                    success: false,
                    error: `A patient (${existing.name}) is already registered with this phone number.`
                });

            }

            const patient =
                await Patient.create({
                    patient_id: crypto.randomUUID(),
                    user_id: req.user.userId,
                    name: String(name).trim(),
                    age: ageNumber,
                    phone: phoneDigits,
                    gender: ["male", "female", "other"].includes(gender) ? gender : "",
                    diabetic_history:
                        typeof diabetic_history === "boolean" ? diabetic_history : null
                });

            return res.status(201).json({
                success: true,
                patient
            });

        } catch (error) {

            console.error(
                "Error creating patient:",
                error
            );

            return res.status(500).json({
                success: false,
                error: error.message
            });

        }

    }
);


// =====================================================
// List Patients (clinic-wide, staff only)
// =====================================================

app.get(
    "/api/patients",
    authMiddleware,
    anyStaff,
    async (req, res) => {

        try {

            const patients =
                await Patient.find({}).sort({ created_at: -1 });

            return res.status(200).json({
                success: true,
                patients
            });

        } catch (error) {

            console.error(
                "Error listing patients:",
                error
            );

            return res.status(500).json({
                success: false,
                error: error.message
            });

        }

    }
);


// =====================================================
// The logged-in patient's own record
// =====================================================

app.get(
    "/api/patients/me",
    authMiddleware,
    requireRole("patient"),
    async (req, res) => {

        try {

            const patient =
                await Patient.findOne({
                    patient_id: req.user.patientId
                });

            if (!patient) {

                return res.status(404).json({
                    success: false,
                    error: "Patient record not found"
                });

            }

            return res.status(200).json({
                success: true,
                patient
            });

        } catch (error) {

            return res.status(500).json({
                success: false,
                error: error.message
            });

        }

    }
);


// =====================================================
// List Doctors (for the technician's "assign to doctor" picker)
// =====================================================

app.get(
    "/api/doctors",
    authMiddleware,
    anyStaff,
    async (req, res) => {

        try {

            const doctors =
                await User.find({ role: "doctor" })
                    .select("name email")
                    .sort({ name: 1 });

            return res.status(200).json({
                success: true,
                doctors: doctors.map((d) => ({
                    id: String(d._id),
                    name: d.name
                }))
            });

        } catch (error) {

            return res.status(500).json({
                success: false,
                error: error.message
            });

        }

    }
);


// =====================================================
// Background visit processing
// =====================================================

// POST /api/visits answers as soon as the visit is accepted; the (slow)
// MATLAB + AI run happens here afterwards and writes its outcome onto the
// Visit (`processing.status`). Jobs run one at a time: MATLAB's licence may
// not allow two `matlab -batch` sessions, and the GPU is shared anyway.
let pipelineQueue = Promise.resolve();

function enqueuePipelineJob(job) {

    pipelineQueue =
        pipelineQueue
            .then(job)
            .catch((error) => {
                console.error("Pipeline job crashed:", error);
            });

    return pipelineQueue;

}

async function runVisitPipeline({
    visitId,
    odFile,
    osFile,
    odImageId,
    osImageId,
    userId,
    mockQuality
}) {

    try {

        console.log(`Visit ${visitId}: AI analysis started`);

        let odResult = null;
        let osResult = null;

        for (const [file, imageId, eye] of [
            [odFile, odImageId, "od"],
            [osFile, osImageId, "os"]
        ]) {

            if (!file) continue;

            const result =
                await processImageForResult(
                    file.path,
                    imageId,
                    userId,
                    mockQuality
                );

            await Result.findOneAndUpdate(
                { image_id: imageId },
                result,
                {
                    new: true,
                    upsert: true,
                    runValidators: true,
                    setDefaultsOnInsert: true
                }
            );

            if (eye === "od") odResult = result;
            else osResult = result;

        }

        await Visit.findOneAndUpdate(
            { visit_id: visitId },
            {
                $set: {
                    od: odResult,
                    os: osResult,
                    "processing.status": "complete",
                    "processing.error": null,
                    "processing.finished_at": new Date()
                }
            },
            { runValidators: true }
        );

        console.log(`Visit ${visitId}: AI analysis complete`);

    } catch (error) {

        // The raw error (often a Python traceback) stays in the server
        // log; the visit only carries a message fit to show to a user.
        console.error(`Visit ${visitId}: AI analysis FAILED:`, error);

        await Visit.updateOne(
            { visit_id: visitId },
            {
                $set: {
                    "processing.status": "failed",
                    "processing.error":
                        "The AI analysis could not be completed for these images. Please upload the scans again.",
                    "processing.finished_at": new Date()
                }
            }
        ).catch((e) => console.error("Could not record failure:", e));

    }

}


// =====================================================
// Two-Eye Visit Upload + AI Processing
// Protected by JWT Authentication
// =====================================================

// New, separate flow alongside POST /api/images -- does not replace it.
// Accepts up to two files ("image_od"/"image_os"), runs each through the
// same processImageForResult() used by /api/images, and saves both
// results nested under a single Visit document instead of two separate
// Result documents.
app.post(
    "/api/visits",
    authMiddleware,
    canRegister,
    (req, res) => {

        uploadVisit.fields([
            { name: "image_od", maxCount: 1 },
            { name: "image_os", maxCount: 1 }
        ])(
            req,
            res,
            async (err) => {

                // -----------------------------------------
                // Multer/upload error
                // -----------------------------------------

                if (err) {

                    return res.status(400).json({
                        success: false,
                        error: err.message
                    });

                }


                const files = req.files || {};
                const odFile = files.image_od?.[0] || null;
                const osFile = files.image_os?.[0] || null;


                // -----------------------------------------
                // No file uploaded
                // -----------------------------------------

                // A screening needs BOTH eyes: a single eye can't support a
                // reliable per-patient assessment.
                if (!odFile || !osFile) {

                    // don't leave the half-uploaded file behind
                    for (const f of [odFile, osFile]) {
                        if (f) fs.unlink(f.path, () => {});
                    }

                    return res.status(400).json({
                        success: false,
                        error:
                            'Both eyes are required. Send "image_od" (right eye) and "image_os" (left eye) as multipart/form-data.'
                    });

                }


                // -----------------------------------------
                // Patient ID required and must exist
                // -----------------------------------------

                const patientId = req.body?.patient_id;

                if (!patientId) {

                    return res.status(400).json({
                        success: false,
                        error:
                            "patient_id is required (send it as a multipart/form-data field alongside the image(s))."
                    });

                }

                const patient =
                    await Patient.findOne({
                        patient_id: patientId
                    });

                if (!patient) {

                    return res.status(400).json({
                        success: false,
                        error:
                            `No patient found with patient_id "${patientId}".`
                    });

                }


                // -----------------------------------------
                // Optional doctor assignment
                // -----------------------------------------

                let assignedDoctorId = null;

                if (req.body?.assigned_doctor_id) {

                    const doctor =
                        await User.findOne({
                            _id: req.body.assigned_doctor_id,
                            role: "doctor"
                        }).catch(() => null);

                    if (!doctor) {

                        return res.status(400).json({
                            success: false,
                            error:
                                "assigned_doctor_id does not match a doctor account."
                        });

                    }

                    assignedDoctorId = doctor._id;

                }


                const visitId = crypto.randomUUID();

                try {

                    await Visit.create({
                        visit_id: visitId,
                        patient_id: patientId,
                        user_id: req.user.userId,
                        assigned_doctor_id: assignedDoctorId,
                        created_at: new Date(),
                        od: null,
                        os: null,
                        processing: {
                            status: "processing",
                            error: null,
                            started_at: new Date(),
                            finished_at: null
                        }
                    });

                } catch (error) {

                    console.error(
                        "\nCould not create visit:",
                        error
                    );

                    return res.status(500).json({
                        success: false,
                        error: "Could not save the visit",
                        visit_id: visitId
                    });

                }

                console.log(
                    `Visit accepted: ${visitId} (od: ${odFile ? "yes" : "no"}, os: ${osFile ? "yes" : "no"})`
                );

                // Answer now; the pipeline runs in the background and the
                // outcome is read back through GET /api/visits.
                enqueuePipelineJob(() =>
                    runVisitPipeline({
                        visitId,
                        odFile,
                        osFile,
                        odImageId: odFile ? req.eyeUploads.image_od.imageId : null,
                        osImageId: osFile ? req.eyeUploads.image_os.imageId : null,
                        userId: req.user.userId,
                        mockQuality: req.query.mock_quality
                    })
                );

                return res.status(202).json({

                    success: true,

                    message:
                        "Visit accepted -- AI analysis is running",

                    visit_id:
                        visitId,

                    patient_id:
                        patientId,

                    processing_status:
                        "processing"

                });

            }
        );

    }
);


// Visibility rules shared by the visit routes:
//   technician / admin : every visit
//   doctor / reviewer  : visits assigned to them, plus unassigned ones
//   patient            : only their own visits, and full detail only once
//                        the doctor has finalized the report
function visitScopeFor(user) {

    if (user.role === "patient") {
        return {
            patient_id: user.patientId,
            "processing.status": { $ne: "failed" }
        };
    }

    if (user.role === "doctor" || user.role === "reviewer") {
        return {
            $and: [
                {
                    $or: [
                        { assigned_doctor_id: user.userId },
                        { assigned_doctor_id: null }
                    ]
                },
                // Only finished analyses reach a doctor's queue.
                { "processing.status": { $nin: ["processing", "failed"] } }
            ]
        };
    }

    return {};

}

const isFinalized = (visit) =>
    visit.clinical_evaluation?.status === "finalized";


// =====================================================
// List Visits (queues + patient status)
// Protected by JWT Authentication
// =====================================================

app.get(
    "/api/visits",
    authMiddleware,
    async (req, res) => {

        try {

            const isPatient = req.user.role === "patient";

            const visits =
                await Visit.find(visitScopeFor(req.user))
                    .sort({ created_at: -1 });

            const patientIds = [
                ...new Set(visits.map((v) => v.patient_id))
            ];

            const patients =
                await Patient.find({
                    patient_id: { $in: patientIds }
                });

            const patientMap = new Map(
                patients.map((p) => [p.patient_id, p])
            );

            const doctorIds = [
                ...new Set(
                    visits
                        .map((v) => v.assigned_doctor_id)
                        .filter(Boolean)
                        .map(String)
                )
            ];

            const doctors =
                doctorIds.length
                    ? await User.find({ _id: { $in: doctorIds } }).select("name")
                    : [];

            const doctorMap = new Map(
                doctors.map((d) => [String(d._id), d.name])
            );

            const eyeSummary = (eye) => {
                if (!eye) return null;
                return {
                    quality: eye.image_quality?.quality ?? null,
                    grade: eye.classification?.grade ?? null,
                    grade_name: eye.classification?.grade_name ?? null,
                    referable:
                        eye.classification?.referable?.is_referable ?? null
                };
            };

            const summaries = visits.map((v) => {

                const patient = patientMap.get(v.patient_id) || null;

                // A patient must not see raw AI output before the doctor
                // has reviewed it.
                const hide = isPatient && !isFinalized(v);

                const od = hide ? null : eyeSummary(v.od);
                const os = hide ? null : eyeSummary(v.os);

                const grades = [od?.grade, os?.grade].filter(
                    (g) => g !== null && g !== undefined
                );

                return {
                    visit_id: v.visit_id,
                    patient_id: v.patient_id,
                    patient_name: patient?.name ?? "Unknown",
                    patient_age: patient?.age ?? null,
                    patient_phone: patient?.phone ?? "",
                    created_at: v.created_at,
                    assigned_doctor_id: v.assigned_doctor_id
                        ? String(v.assigned_doctor_id)
                        : null,
                    assigned_doctor_name: v.assigned_doctor_id
                        ? doctorMap.get(String(v.assigned_doctor_id)) ?? null
                        : null,
                    has_od: !!v.od,
                    has_os: !!v.os,
                    processing_status: v.processing?.status ?? "complete",
                    processing_error: v.processing?.error ?? null,
                    processing_started_at: v.processing?.started_at ?? null,
                    od,
                    os,
                    worst_grade: grades.length ? Math.max(...grades) : null,
                    clinical_evaluation: v.clinical_evaluation || null
                };

            });

            return res.status(200).json({
                success: true,
                visits: summaries
            });

        } catch (error) {

            console.error(
                "Error listing visits:",
                error
            );

            return res.status(500).json({
                success: false,
                error: error.message
            });

        }

    }
);


// Loads a visit the requester is allowed to open, or sends the error.
async function loadAccessibleVisit(req, res, visitId) {

    const visit =
        await Visit.findOne({ visit_id: visitId });

    if (!visit) {

        res.status(404).json({
            success: false,
            error: "Visit not found"
        });

        return null;

    }

    if (req.user.role === "patient") {

        if (visit.patient_id !== req.user.patientId) {

            res.status(404).json({
                success: false,
                error: "Visit not found"
            });

            return null;

        }

        if (!isFinalized(visit)) {

            res.status(403).json({
                success: false,
                error: "Your report is not ready yet"
            });

            return null;

        }

    }

    return visit;

}


// =====================================================
// Get Visit
// Protected by JWT Authentication
// =====================================================

app.get(
    "/api/visits/:visitId",
    authMiddleware,
    async (req, res) => {

        try {

            const found =
                await loadAccessibleVisit(req, res, req.params.visitId);

            if (!found) return;

            const visit = found.toObject();

            const patient = await Patient.findOne({
                patient_id: visit.patient_id
            });

            return res.status(200).json({
                ...visit,
                patient_name: patient ? patient.name : "Unknown Patient",
                patient_age: patient ? patient.age : null,
                patient_phone: patient ? patient.phone : ""
            });

        } catch (err) {

            console.error(
                "Error fetching visit:",
                err
            );

            return res.status(500).json({
                success: false,
                error: err.message
            });

        }

    }
);


// =====================================================
// Finalize / Update Visit Clinical Evaluation (doctors)
// Protected by JWT Authentication
// =====================================================

app.patch(
    "/api/visits/:visitId/evaluation",
    authMiddleware,
    canReview,
    async (req, res) => {

        try {

            const {
                decision,
                override_grade,
                doctor_notes,
                prescription,
                diet
            } = req.body || {};

            if (!decision || (decision !== "agree" && decision !== "override")) {

                return res.status(400).json({
                    success: false,
                    error: 'decision must be either "agree" or "override"'
                });

            }

            if (decision === "override") {

                const gradeNum = Number(override_grade);

                if (!Number.isInteger(gradeNum) || gradeNum < 0 || gradeNum > 4) {

                    return res.status(400).json({
                        success: false,
                        error: "When overriding, a valid override_grade (0-4) is required"
                    });

                }

            }

            const visit =
                await Visit.findOne({
                    visit_id: req.params.visitId
                });

            if (!visit) {

                return res.status(404).json({
                    success: false,
                    error: "Visit not found"
                });

            }

            // A report that has been pushed to the patient is final.
            if (visit.clinical_evaluation?.status === "finalized") {

                return res.status(409).json({
                    success: false,
                    error: "This report has already been finalized and sent to the patient."
                });

            }

            // Sign with the doctor's name (falls back to their email).
            const doctor =
                await User.findById(req.user.userId).select("name email");

            const doctorIdentifier =
                doctor?.name || doctor?.email || req.user?.email || "Doctor";

            visit.clinical_evaluation = {
                status: "finalized",
                decision,
                override_grade: decision === "override" ? Number(override_grade) : null,
                doctor_notes: doctor_notes ? String(doctor_notes).trim() : "",
                prescription: prescription ? String(prescription).trim() : "",
                diet: diet ? String(diet).trim() : "",
                finalized_at: new Date(),
                finalized_by: doctorIdentifier
            };

            await visit.save();

            // Sync the same clinical evaluation onto each eye's Result
            // document, so a Result read on its own reflects the
            // doctor-reviewed grade instead of only the raw AI output.
            const eyeImageIds =
                [visit.od?.image_id, visit.os?.image_id].filter(Boolean);

            if (eyeImageIds.length > 0) {

                await Result.updateMany(
                    {
                        image_id: { $in: eyeImageIds }
                    },
                    {
                        clinical_evaluation: visit.clinical_evaluation
                    }
                );

            }

            return res.status(200).json({
                success: true,
                message: "Visit clinical evaluation finalized successfully",
                clinical_evaluation: visit.clinical_evaluation
            });

        } catch (error) {

            console.error(
                "Error finalizing visit evaluation:",
                error
            );

            return res.status(500).json({
                success: false,
                error: error.message
            });

        }

    }
);


// =====================================================
// Two-Eye Visit AI Generated Image Assets
// Protected by JWT Authentication
// =====================================================

app.get(
    "/api/visits/:visitId/assets/:eye/:assetType",
    authMiddleware,
    async (req, res) => {

        try {

            const {
                visitId,
                eye,
                assetType
            } = req.params;

            if (eye !== "od" && eye !== "os") {

                return res.status(404).json({
                    success: false,
                    error:
                        'Invalid eye -- must be "od" or "os"'
                });

            }

            // Staff: any visit. Patient: own, finalized visits only.
            const visit =
                await loadAccessibleVisit(req, res, visitId);

            if (!visit) return;

            const eyeResult = visit[eye];

            if (!eyeResult) {

                return res.status(404).json({
                    success: false,
                    error:
                        `No result for eye "${eye}" on this visit`
                });

            }

            const assetPath =
                getAssetPathForType(eyeResult, assetType);

            if (!assetPath) {

                return res.status(404).json({
                    success: false,
                    error:
                        "Requested AI asset is not available"
                });

            }

            return sendAssetFile(res, assetPath);

        } catch (error) {

            console.error(
                "Error serving visit AI asset:",
                error
            );

            return res.status(500).json({
                success: false,
                error: error.message
            });

        }

    }
);


// =====================================================
// Health Check
// =====================================================

app.get(
    "/health",
    (req, res) => {

        res.json({

            status: "healthy",

            timestamp:
                new Date().toISOString()

        });

    }
);


// =====================================================
// Start Server
// =====================================================

const PORT =
    process.env.PORT || 3000;


connectDB()
    .then(async () => {

        // A restart kills any in-flight background run; don't leave those
        // visits "processing" forever.
        const stale = await Visit.updateMany(
            { "processing.status": "processing" },
            {
                $set: {
                    "processing.status": "failed",
                    "processing.error":
                        "The server restarted while this visit was being analysed. Please upload the scans again.",
                    "processing.finished_at": new Date()
                }
            }
        );

        if (stale.modifiedCount) {
            console.log(`Marked ${stale.modifiedCount} interrupted visit(s) as failed`);
        }

        app.listen(
            PORT,
            () => {

                console.log(
                    `RetinEx backend listening on port ${PORT}`
                );

            }
        );

    })
    .catch((err) => {

        console.error(
            "Failed to start server:",
            err
        );

    });