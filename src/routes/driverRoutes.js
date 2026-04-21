// ============================================================
// Driver Routes — Firebase Firestore + Fast2SMS OTP
// ============================================================
const express = require("express");
const router = express.Router();
const axios = require("axios");
const multer = require("multer");
const { db } = require("../config/firebaseConfig");

const DRIVERS = process.env.FIREBASE_COLLECTION_DRIVERS || "Drivers";

// In-memory OTP store (use Redis/Firestore for production)
const otps = {};

// Configure storage to preserve extensions
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = 'uploads/';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage }).fields([
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

  const apiKey = process.env.FAST2SMS_API_KEY;
  console.log(`[Driver] send-otp for phone: ${phone}, OTP: ${otp}`);
  console.log(`[Driver] FAST2SMS_API_KEY present: ${!!apiKey}, length: ${apiKey?.length || 0}, starts: ${apiKey?.substring(0, 8) || 'MISSING'}`);

  const payload = { variables_values: otp, route: "otp", numbers: phone };
  console.log(`[Driver] Fast2SMS request payload:`, JSON.stringify(payload));

  try {
    const response = await axios.post(
      "https://www.fast2sms.com/dev/bulkV2",
      payload,
      {
        headers: {
          authorization: apiKey,
          "Content-Type": "application/json",
        },
      }
    );
    console.log(`[Driver] ✅ Fast2SMS status: ${response.status}`);
    console.log(`[Driver] ✅ Fast2SMS response:`, JSON.stringify(response.data));
    res.json({ success: true, message: "OTP sent successfully." });
  } catch (err) {
    console.error(`[Driver] ❌ Fast2SMS HTTP status: ${err.response?.status}`);
    console.error(`[Driver] ❌ Fast2SMS error body:`, JSON.stringify(err.response?.data));
    console.error(`[Driver] ❌ Fast2SMS error message:`, err.message);
    res.json({
      success: true,
      message: "OTP generated (SMS failed — check logs).",
      devOtp: otp,
    });
  }
});

// ─────────────────────────────────────────────────────────────
// 2.1 Verify OTP (DEVELOPER BYPASS MODE ACTIVE)
// ─────────────────────────────────────────────────────────────
router.post("/verify-otp", async (req, res) => {
  const { phone, otp } = req.body;
  console.log(`[Driver] verify-otp (BYPASS) for phone: ${phone}, OTP: ${otp}`);

  // Bypass logic: Accept any non-empty numeric OTP
  if (otp && /^\d+$/.test(otp)) {
    console.log(`[Driver] ✅ OTP verified (BYPASS MODE) for ${phone}`);
    if (otps[phone]) delete otps[phone]; // Clean up if it exists
    res.json({ success: true, message: "OTP verified successfully (Dev Bypass)." });
  } else {
    console.warn(`[Driver] ❌ Invalid OTP input for ${phone}. Got: ${otp}`);
    res.status(400).json({ success: false, message: "Invalid OTP format." });
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
    const getFilePath = (fieldname) => (req.files && req.files[fieldname]) ? `/uploads/${req.files[fieldname][0].filename}` : "";

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
      status: "PENDING",
      profilePhoto: getFilePath("profilePhoto"),
      aadhaarFront: getFilePath("aadhaarFront"),
      dlFront: getFilePath("dlFront"),
      dlBack: getFilePath("dlBack"),
      rcFront: getFilePath("rcFront"),
      insuranceFront: getFilePath("insuranceFront"),
      fcFront: getFilePath("fcFront"),
      permitFront: getFilePath("permitFront"),
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
