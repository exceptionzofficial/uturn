// ============================================================
// Vendor Routes — Firebase Firestore + Fast2SMS OTP
// ============================================================
const express = require("express");
const router = express.Router();
const axios = require("axios");
const multer = require("multer");
const { db } = require("../config/firebaseConfig");

const VENDORS = process.env.FIREBASE_COLLECTION_VENDORS || "Vendors";
const TRIPS   = process.env.FIREBASE_COLLECTION_TRIPS   || "Trips";

// In-memory OTP store
const otps = {};

// Multer memory storage (no S3)
const upload = multer({ storage: multer.memoryStorage() }).fields([
  { name: "profilePicture", maxCount: 1 },
  { name: "aadharImage", maxCount: 1 },
]);

// ─────────────────────────────────────────────────────────────
// 0. Check Vendor Status
// ─────────────────────────────────────────────────────────────
router.post("/check-status", async (req, res) => {
  const { phone } = req.body;
  console.log(`[Vendor] check-status for phone: ${phone}`);

  try {
    const doc = await db.collection(VENDORS).doc(phone).get();

    if (doc.exists) {
      const data = doc.data();
      console.log(`[Vendor] Found vendor ${phone} with status: ${data.status}`);
      res.json({
        exists: true,
        status: data.status || "PENDING_REVIEW",
        message:
          data.status === "PENDING_REVIEW"
            ? "Your application is under review."
            : "Existing vendor found.",
      });
    } else {
      console.log(`[Vendor] Vendor not found for phone: ${phone}`);
      res.json({ exists: false, status: "NOT_FOUND" });
    }
  } catch (err) {
    console.error(`[Vendor] ❌ check-status error:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// 0.1 Send OTP via Fast2SMS
// ─────────────────────────────────────────────────────────────
router.post("/send-otp", async (req, res) => {
  const { phone } = req.body;
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  otps[phone] = otp;

  console.log(`[Vendor] Sending OTP to ${phone}: ${otp}`);

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

    console.log(`[Vendor] ✅ Fast2SMS response:`, JSON.stringify(response.data));
    res.json({ success: true, message: "OTP sent successfully." });
  } catch (err) {
    console.error(`[Vendor] ❌ Fast2SMS error:`, err.response?.data || err.message);
    res.json({
      success: true,
      message: "OTP generated (SMS may have failed — check logs).",
      devOtp: otp,
    });
  }
});

// ─────────────────────────────────────────────────────────────
// 0.2 Verify OTP
// ─────────────────────────────────────────────────────────────
router.post("/verify-otp", async (req, res) => {
  const { phone, otp } = req.body;
  console.log(`[Vendor] verify-otp for phone: ${phone}, OTP: ${otp}`);

  if (otps[phone] && otps[phone] === otp) {
    delete otps[phone];
    console.log(`[Vendor] ✅ OTP verified for ${phone}`);
    res.json({ success: true, message: "OTP verified successfully." });
  } else {
    console.warn(`[Vendor] ❌ Invalid OTP for ${phone}. Expected: ${otps[phone]}, Got: ${otp}`);
    res.status(400).json({ success: false, message: "Invalid OTP." });
  }
});

// ─────────────────────────────────────────────────────────────
// 0.3 Register Vendor
// ─────────────────────────────────────────────────────────────
router.post("/register", upload, async (req, res) => {
  console.log(`[Vendor] register called`);

  try {
    const vendorData = JSON.parse(req.body.vendorData);
    console.log(`[Vendor] Registering vendor: ${vendorData.name} (${vendorData.phone})`);

    const vendorDoc = {
      vendorId: vendorData.phone,
      name: vendorData.name,
      dob: vendorData.dob || "",
      businessName: vendorData.businessName || "",
      gstNumber: vendorData.gstNumber || "",
      state: vendorData.state || "",
      address: vendorData.address || "",
      status: "PENDING_REVIEW",
      aadharImage: "",
      profilePicture: "",
      createdAt: new Date().toISOString(),
    };

    await db.collection(VENDORS).doc(vendorData.phone).set(vendorDoc);
    console.log(`[Vendor] ✅ Vendor registered: ${vendorData.phone}`);
    res.json({ success: true, message: "Vendor registered successfully. Awaiting review." });
  } catch (err) {
    console.error(`[Vendor] ❌ register error:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// 1. Create a New Trip
// ─────────────────────────────────────────────────────────────
router.post("/create-trip", async (req, res) => {
  const tripData = req.body;
  const tripId = `TRIP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  console.log(`[Vendor] create-trip called, tripId: ${tripId}`);

  try {
    const tripDoc = {
      tripId,
      vendorId: tripData.vendorId || "SYSTEM_VENDOR",
      customerName: tripData.customerName || "",
      customerPhone: tripData.customerPhone || "",
      customerLanguage: tripData.customerLanguage || "Tamil",
      category: tripData.category || "Passenger",
      numberOfPeople: tripData.numberOfPeople || 1,
      loadCapacity: tripData.loadCapacity || "",
      pickup: tripData.pickup || "",
      drop: tripData.drop || "",
      pickupCoords: {
        latitude: tripData.pickupCoords?.latitude || 0,
        longitude: tripData.pickupCoords?.longitude || 0,
      },
      dropCoords: {
        latitude: tripData.dropCoords?.latitude || 0,
        longitude: tripData.dropCoords?.longitude || 0,
      },
      tripType: tripData.tripType || "One Way",
      rentalType: tripData.rentalType || "",
      vehicle: tripData.vehicle || "Sedan",
      scheduledDate: tripData.scheduledDate || "",
      scheduledTime: tripData.scheduledTime || "",
      returnDate: tripData.returnDate || "",
      returnTime: tripData.returnTime || "",
      baseFare: tripData.baseFare || 0,
      perKmRate: tripData.perKmRate || 0,
      waitingCharge: tripData.waitingCharge || 0,
      driverBata: tripData.driverBata || 0,
      nightAllowance: tripData.nightAllowance || 0,
      hillsAllowance: tripData.hillsAllowance || 0,
      commission: tripData.commission || 0,
      totalTripAmount: tripData.totalTripAmount || 0,
      driverPayout: tripData.driverPayout || 0,
      paymentMode: tripData.paymentMode || "pay_driver",
      status: "PENDING",
      createdAt: new Date().toISOString(),
    };

    await db.collection(TRIPS).doc(tripId).set(tripDoc);
    console.log(`[Vendor] ✅ Trip created: ${tripId}`);
    res.json({ success: true, tripId, message: "Trip created successfully." });
  } catch (err) {
    console.error(`[Vendor] ❌ create-trip error:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// 2. Get All Trips for a Vendor
// ─────────────────────────────────────────────────────────────
router.get("/trips", async (req, res) => {
  const { vendorId } = req.query;
  console.log(`[Vendor] get trips called, vendorId filter: ${vendorId || "NONE"}`);

  try {
    let query = db.collection(TRIPS);
    if (vendorId) {
      query = query.where("vendorId", "==", vendorId);
    }

    const snapshot = await query.get();
    const trips = snapshot.docs.map((doc) => {
      const d = doc.data();
      return {
        tripId: d.tripId,
        customerName: d.customerName,
        customerPhone: d.customerPhone,
        pickup: d.pickup,
        drop: d.drop,
        status: d.status,
        totalTripAmount: d.totalTripAmount,
        createdAt: d.createdAt,
      };
    });

    console.log(`[Vendor] ✅ Fetched ${trips.length} trips`);
    res.json(trips);
  } catch (err) {
    console.error(`[Vendor] ❌ get trips error:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// 3. Get Specific Trip Details
// ─────────────────────────────────────────────────────────────
router.get("/trip/:tripId", async (req, res) => {
  const { tripId } = req.params;
  console.log(`[Vendor] get trip detail for: ${tripId}`);

  try {
    const doc = await db.collection(TRIPS).doc(tripId).get();

    if (!doc.exists) {
      console.warn(`[Vendor] Trip not found: ${tripId}`);
      return res.status(404).json({ error: "Trip not found" });
    }

    console.log(`[Vendor] ✅ Trip fetched: ${tripId}`);
    res.json(doc.data());
  } catch (err) {
    console.error(`[Vendor] ❌ get trip error:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
