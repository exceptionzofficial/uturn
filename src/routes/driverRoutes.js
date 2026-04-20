// ============================================================
// Driver Routes — Firebase Firestore + Fast2SMS OTP
// ============================================================
const express = require("express");
const router = express.Router();
const axios = require("axios");
const multer = require("multer");
const { db } = require("../config/firebaseConfig");
require("dotenv").config();

const DRIVERS = process.env.FIREBASE_COLLECTION_DRIVERS || "Drivers";

// In-memory OTP store (use Redis/Firestore for production)
const otps = {};

// Multer: store files in memory (no S3 — use Firebase Storage or Cloudinary later)
const upload = multer({ storage: multer.memoryStorage() }).fields([
  { name: "profilePhoto", maxCount: 1 },
  { name: "aadhaarFront", maxCount: 1 },
  { name: "dlFront", maxCount: 1 },
  { name: "dlBack", maxCount: 1 },
  { name: "rcFront", maxCount: 1 },
  { name: "insuranceFront", maxCount: 1 },
  { name: "fcFront", maxCount: 1 },
  { name: "permitFront", maxCount: 1 },
]);

// ─────────────────────────────────────────────────────────────
// 1. Check Mobile Status
// ─────────────────────────────────────────────────────────────
router.post("/check-status", async (req, res) => {
  const { phone } = req.body;
  console.log(`[Driver] check-status called for phone: ${phone}`);

  try {
    const doc = await db.collection(DRIVERS).doc(phone).get();

    if (doc.exists) {
      const data = doc.data();
      console.log(`[Driver] Found driver ${phone} with status: ${data.status}`);
      res.json({
        exists: true,
        status: data.status || "PENDING_REVIEW",
        message:
          data.status === "PENDING_REVIEW"
            ? "Your application is under review."
            : "Existing driver found.",
      });
    } else {
      console.log(`[Driver] Driver not found for phone: ${phone}`);
      res.json({ exists: false, status: "NOT_FOUND" });
    }
  } catch (err) {
    console.error(`[Driver] ❌ check-status error:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// 2. Send OTP via Fast2SMS
// ─────────────────────────────────────────────────────────────
router.post("/send-otp", async (req, res) => {
  const { phone } = req.body;
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  otps[phone] = otp;

  console.log(`[Driver] Sending OTP to ${phone}: ${otp}`);

  try {
    const response = await axios.post(
      "https://www.fast2sms.com/dev/bulkV2",
      {
        variables_values: otp,
        route: "otp",
        numbers: phone,
      },
      {
        headers: {
          authorization: process.env.FAST2SMS_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    console.log(`[Driver] ✅ Fast2SMS response:`, JSON.stringify(response.data));
    res.json({ success: true, message: "OTP sent successfully." });
  } catch (err) {
    console.error(`[Driver] ❌ Fast2SMS error:`, err.response?.data || err.message);
    // Return OTP in dev mode if SMS fails
    res.json({
      success: true,
      message: "OTP generated (SMS may have failed — check logs).",
      devOtp: otp,
    });
  }
});

// ─────────────────────────────────────────────────────────────
// 2.1 Verify OTP
// ─────────────────────────────────────────────────────────────
router.post("/verify-otp", async (req, res) => {
  const { phone, otp } = req.body;
  console.log(`[Driver] verify-otp for phone: ${phone}, OTP: ${otp}`);

  if (otps[phone] && otps[phone] === otp) {
    delete otps[phone];
    console.log(`[Driver] ✅ OTP verified for ${phone}`);
    res.json({ success: true, message: "OTP verified successfully." });
  } else {
    console.warn(`[Driver] ❌ Invalid OTP for ${phone}. Expected: ${otps[phone]}, Got: ${otp}`);
    res.status(400).json({ success: false, message: "Invalid OTP." });
  }
});

// ─────────────────────────────────────────────────────────────
// 3. Check Aadhaar Existence
// ─────────────────────────────────────────────────────────────
router.post("/check-aadhar", async (req, res) => {
  const { aadhar } = req.body;
  console.log(`[Driver] check-aadhar called for aadhar: ${aadhar}`);

  try {
    const snapshot = await db
      .collection(DRIVERS)
      .where("aadhar", "==", aadhar)
      .limit(1)
      .get();

    if (!snapshot.empty) {
      console.log(`[Driver] Aadhaar already exists: ${aadhar}`);
      res.json({ exists: true, message: "Aadhaar already exists. Please login." });
    } else {
      console.log(`[Driver] Aadhaar not found: ${aadhar}`);
      res.json({ exists: false });
    }
  } catch (err) {
    console.error(`[Driver] ❌ check-aadhar error:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// 4. Register Driver
// ─────────────────────────────────────────────────────────────
router.post("/register", upload, async (req, res) => {
  console.log(`[Driver] register called`);

  try {
    const driverData = JSON.parse(req.body.driverData);
    console.log(`[Driver] Registering driver: ${driverData.name} (${driverData.phone})`);

    // Note: File URLs are empty strings — integrate Firebase Storage / Cloudinary for file uploads
    const driverDoc = {
      driverId: driverData.phone,
      name: driverData.name,
      phone: driverData.phone,
      aadhar: driverData.aadhar,
      dob: driverData.dob || "",
      state: driverData.state || "",
      licenceNumber: driverData.licenceNumber || "",
      licenceExpiry: driverData.licenceExpiry || "",
      vehicleNumber: driverData.vehicleNumber || "",
      vehicleType: driverData.vehicleType || "",
      status: "PENDING_REVIEW",
      profilePhoto: "",
      aadhaarFront: "",
      dlFront: "",
      dlBack: "",
      rcFront: "",
      insuranceFront: "",
      fcFront: "",
      permitFront: "",
      createdAt: new Date().toISOString(),
    };

    await db.collection(DRIVERS).doc(driverData.phone).set(driverDoc);
    console.log(`[Driver] ✅ Driver registered successfully: ${driverData.phone}`);
    res.json({ success: true, message: "Registration submitted for review." });
  } catch (err) {
    console.error(`[Driver] ❌ register error:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// 5. Get Driver Profile
// ─────────────────────────────────────────────────────────────
router.get("/profile/:phone", async (req, res) => {
  const { phone } = req.params;
  console.log(`[Driver] profile fetch for: ${phone}`);

  try {
    const doc = await db.collection(DRIVERS).doc(phone).get();

    if (!doc.exists) {
      console.warn(`[Driver] Driver not found: ${phone}`);
      return res.status(404).json({ error: "Driver not found" });
    }

    const profile = doc.data();
    console.log(`[Driver] ✅ Profile fetched for: ${phone}`);
    res.json(profile);
  } catch (err) {
    console.error(`[Driver] ❌ profile fetch error:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
