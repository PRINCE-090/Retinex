const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const User = require("../models/User");
const Patient = require("../models/Patient");
const authMiddleware = require("../middleware/auth");

const router = express.Router();


// POST /api/auth/login
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log(`[AUTH] Login attempt for email: "${email}" from origin: "${req.headers.origin}"`);

        // Validate input
        if (!email || !password) {
            console.log("[AUTH] Rejected: missing email or password");
            return res.status(400).json({
                success: false,
                message: "Email and password are required"
            });
        }

        // Find user
        const user = await User.findOne({
            email: email.toLowerCase()
        });

        if (!user) {
            console.log(`[AUTH] Rejected: user not found for "${email.toLowerCase()}"`);
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        // Compare password
        const passwordMatch = await bcrypt.compare(
            password,
            user.password
        );

        if (!passwordMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        // Create JWT
        const token = jwt.sign(
            {
                userId: user._id,
                email: user.email,
                role: user.role
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "8h"
            }
        );

        // Send response
        return res.status(200).json({
            success: true,
            message: "Login successful",
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {
        console.error("Login error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
});


// POST /api/auth/patient/login
//
// DEMO STAND-IN for a real OTP flow: looks the patient up by the phone
// number they registered with and issues a patient-scoped token. There is
// NO OTP verification, so anyone who knows a registered number can sign
// in -- replace with request-otp / verify-otp before real use.
router.post("/patient/login", async (req, res) => {
    try {
        const digits = String((req.body || {}).phone || "").replace(/\D/g, "").slice(-10);

        if (digits.length !== 10) {
            return res.status(400).json({
                success: false,
                message: "Enter a valid 10-digit phone number"
            });
        }

        const patient = await Patient.findOne({ phone: digits });

        if (!patient) {
            return res.status(404).json({
                success: false,
                message: "No patient is registered with this number. Please ask the clinic to register you."
            });
        }

        const token = jwt.sign(
            { patientId: patient.patient_id, role: "patient" },
            process.env.JWT_SECRET,
            { expiresIn: "8h" }
        );

        return res.status(200).json({
            success: true,
            token,
            user: {
                id: patient.patient_id,
                name: patient.name,
                role: "patient"
            }
        });
    } catch (error) {
        console.error("Patient login error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
});

// PATCH /api/auth/me  { name?, email? }   (staff)
router.patch("/me", authMiddleware, authMiddleware.requireRole("doctor", "reviewer", "technician", "admin"), async (req, res) => {
    try {
        const { name, email } = req.body || {};
        const update = {};

        if (name !== undefined) {
            if (!String(name).trim()) {
                return res.status(400).json({ success: false, message: "Name cannot be empty" });
            }
            update.name = String(name).trim();
        }

        if (email !== undefined) {
            const e = String(email).trim().toLowerCase();
            if (!/^\S+@\S+\.\S+$/.test(e)) {
                return res.status(400).json({ success: false, message: "Enter a valid email address" });
            }
            const taken = await User.findOne({ email: e, _id: { $ne: req.user.userId } });
            if (taken) {
                return res.status(409).json({ success: false, message: "That email is already in use" });
            }
            update.email = e;
        }

        const user = await User.findByIdAndUpdate(req.user.userId, update, { new: true });

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        return res.status(200).json({
            success: true,
            user: { id: user._id, name: user.name, email: user.email, role: user.role }
        });
    } catch (error) {
        console.error("Update profile error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
});

// POST /api/auth/change-password  { currentPassword, newPassword }   (staff)
router.post("/change-password", authMiddleware, authMiddleware.requireRole("doctor", "reviewer", "technician", "admin"), async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body || {};

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ success: false, message: "Current and new password are required" });
        }
        if (String(newPassword).length < 8) {
            return res.status(400).json({ success: false, message: "New password must be at least 8 characters" });
        }

        const user = await User.findById(req.user.userId);

        if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
            return res.status(401).json({ success: false, message: "Current password is incorrect" });
        }

        user.password = await bcrypt.hash(newPassword, 12);
        await user.save();

        return res.status(200).json({ success: true, message: "Password updated" });
    } catch (error) {
        console.error("Change password error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
});

module.exports = router;