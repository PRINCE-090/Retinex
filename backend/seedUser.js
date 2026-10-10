require("dotenv").config();

const crypto = require("crypto");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const User = require("./models/User");
const Patient = require("./models/Patient");

// Safe to run repeatedly: existing accounts are left exactly as they are
// (including any password changed since), missing ones are created.
const DEFAULT_PASSWORD = "RetinEx@2026";

const STAFF = [
    { name: "Dr. Sharma", email: "doctor@retinex.com", role: "doctor" },
    { name: "Dr. Patel", email: "doctor2@retinex.com", role: "doctor" },
    { name: "Technician", email: "tech@retinex.com", role: "technician" },
    { name: "Admin", email: "admin@retinex.com", role: "admin" }
];

// Demo patient so the patient portal can be signed into straight away
// (sign in with phone 1234567890).
const DEMO_PATIENT = { name: "Ramesh Kumar", age: 58, phone: "1234567890" };

const seed = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);

        const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 12);

        let firstDoctor = null;

        for (const s of STAFF) {
            let user = await User.findOne({ email: s.email });

            if (user) {
                console.log(`exists   ${s.role.padEnd(10)} ${s.email}`);
            } else {
                user = await User.create({ ...s, password: hashedPassword });
                console.log(`created  ${s.role.padEnd(10)} ${s.email}`);
            }

            if (s.role === "doctor" && !firstDoctor) firstDoctor = user;
        }

        const existingPatient = await Patient.findOne({ phone: DEMO_PATIENT.phone });

        if (existingPatient) {
            console.log(`exists   patient    ${DEMO_PATIENT.phone}`);
        } else {
            await Patient.create({
                patient_id: crypto.randomUUID(),
                user_id: firstDoctor._id,
                ...DEMO_PATIENT
            });
            console.log(`created  patient    ${DEMO_PATIENT.phone}`);
        }

        console.log(`\nStaff password (new accounts): ${DEFAULT_PASSWORD}`);
    } catch (error) {
        console.error("Error seeding:", error.message);
    } finally {
        await mongoose.connection.close();
    }
};

seed();
