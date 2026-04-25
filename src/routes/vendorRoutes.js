// ============================================================
// Vendor Routes — Firebase Firestore + Fast2SMS OTP
// ============================================================
const express = require("express");
const router = express.Router();
const axios = require("axios");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { db } = require("../config/firebaseConfig");

const VENDORS = process.env.FIREBASE_COLLECTION_VENDORS || "Vendors";
const TRIPS   = process.env.FIREBASE_COLLECTION_TRIPS   || "Trips";

// In-memory OTP store
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
  { name: "aadharImage", maxCount: 1 },
  { name: "profilePicture", maxCount: 1 },
]);

// ─────────────────────────────────────────────────────────────
// Debug Middleware
// ─────────────────────────────────────────────────────────────
router.use((req, res, next) => {
  console.log(`[VendorRouter] Incoming: ${req.method} ${req.url}`);
  next();
});

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
// 0.0 Get Vendor Profile
// ─────────────────────────────────────────────────────────────
router.get("/profile/:phone", async (req, res) => {
  const { phone } = req.params;
  try {
    const doc = await db.collection(VENDORS).doc(phone).get();
    if (doc.exists) {
      res.json({ success: true, vendor: doc.data() });
    } else {
      res.status(404).json({ success: false, message: "Vendor not found" });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// 0.1 Send OTP via Fast2SMS
// ─────────────────────────────────────────────────────────────
router.post("/send-otp", async (req, res) => {
  const { phone } = req.body;
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  otps[phone] = otp;

  const apiKey = process.env.FAST2SMS_API_KEY;
  console.log(`[Vendor] send-otp for phone: ${phone}, OTP: ${otp}`);
  console.log(`[Vendor] FAST2SMS_API_KEY present: ${!!apiKey}, length: ${apiKey?.length || 0}, starts: ${apiKey?.substring(0, 8) || 'MISSING'}`);

  const payload = { variables_values: otp, route: "otp", numbers: phone };
  console.log(`[Vendor] Fast2SMS request payload:`, JSON.stringify(payload));

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
    console.log(`[Vendor] ✅ Fast2SMS status: ${response.status}`);
    console.log(`[Vendor] ✅ Fast2SMS response:`, JSON.stringify(response.data));
    res.json({ success: true, message: "OTP sent successfully." });
  } catch (err) {
    console.error(`[Vendor] ❌ Fast2SMS HTTP status: ${err.response?.status}`);
    console.error(`[Vendor] ❌ Fast2SMS error body:`, JSON.stringify(err.response?.data));
    console.error(`[Vendor] ❌ Fast2SMS error message:`, err.message);
    res.json({
      success: true,
      message: "OTP generated (SMS failed — check logs).",
      devOtp: otp,
    });
  }
});

// ─────────────────────────────────────────────────────────────
// 0.2 Verify OTP (DEVELOPER BYPASS MODE ACTIVE)
// ─────────────────────────────────────────────────────────────
router.post("/verify-otp", async (req, res) => {
  const { phone, otp } = req.body;
  console.log(`[Vendor] verify-otp (BYPASS) for phone: ${phone}, OTP: ${otp}`);

  // Bypass logic: Accept any non-empty numeric OTP
  if (otp && /^\d+$/.test(otp)) {
    console.log(`[Vendor] ✅ OTP verified (BYPASS MODE) for ${phone}`);
    if (otps[phone]) delete otps[phone]; // Clean up if it exists
    // Check if vendor exists to return status
    const vendorDoc = await db.collection(VENDORS).doc(phone).get();
    let status = 'NOT_REGISTERED';
    if (vendorDoc.exists) {
      status = vendorDoc.data().status || 'PENDING_REVIEW';
    }

    res.json({ 
      success: true, 
      status: status,
      message: "OTP verified successfully (Dev Bypass)." 
    });
  } else {
    console.warn(`[Vendor] ❌ Invalid OTP input for ${phone}. Got: ${otp}`);
    res.status(400).json({ success: false, message: "Invalid OTP format." });
  }
});

// ─────────────────────────────────────────────────────────────
// 0.3 Register Vendor
// ─────────────────────────────────────────────────────────────
router.post("/register", upload, async (req, res) => {
  console.log(`[Vendor] register called`);

  try {
    if (!req.body.vendorData) {
      throw new Error("Missing 'vendorData' in request body");
    }
    const vendorData = JSON.parse(req.body.vendorData);
    if (!vendorData.phone) throw new Error("Vendor phone missing in vendorData");

    console.log(`[Vendor] Registering vendor: ${vendorData.name} (${vendorData.phone})`);

    // In a real app, we'd upload these to S3/Cloud Storage. 
    // Here we'll store basic info. If you need actual image URLs, 
    // we would use a proper storage service.
    const aadharImage = (req.files && req.files["aadharImage"]) ? `/uploads/${req.files["aadharImage"][0].filename}` : "";
    const profilePicture = (req.files && req.files["profilePicture"]) ? `/uploads/${req.files["profilePicture"][0].filename}` : "";

    const vendorDoc = {
      vendorId: vendorData.phone,
      phone: vendorData.phone,
      name: vendorData.name,
      dob: vendorData.dob || "",
      businessName: vendorData.businessName || "",
      gstNumber: vendorData.gstNumber || "",
      state: vendorData.state || "",
      address: vendorData.address || "",
      status: "PENDING", // Standardized status
      aadharImage,
      profilePicture,
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    // Save to Firestore
    await db.collection(VENDORS).doc(vendorData.phone).set(vendorDoc);
    
    console.log(`[Vendor] ✅ Vendor registered: ${vendorData.phone}`);
    res.json({ 
      success: true, 
      message: "Vendor registered successfully. Review pending.",
      vendor: vendorDoc 
    });
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
      pickup: tripData.pickup || tripData.pickupAddress || "",
      drop: tripData.drop || tripData.dropAddress || "",
      pickupAddress: tripData.pickupAddress || tripData.pickup || "",
      dropAddress: tripData.dropAddress || tripData.drop || "",
      pickupCoords: {
        latitude: tripData.pickupCoords?.latitude || tripData.pickupLocation?.latitude || 0,
        longitude: tripData.pickupCoords?.longitude || tripData.pickupLocation?.longitude || 0,
      },
      dropCoords: {
        latitude: tripData.dropCoords?.latitude || tripData.dropLocation?.latitude || 0,
        longitude: tripData.dropCoords?.longitude || tripData.dropLocation?.longitude || 0,
      },
      tripType: tripData.tripType || "One Way",
      rentalType: tripData.rentalType || "",
      vehicle: tripData.vehicle || "Sedan",
      scheduledDate: tripData.scheduledDate || "",
      scheduledTime: tripData.scheduledTime || "",
      returnDate: tripData.returnDate || "",
      returnTime: tripData.returnTime || "",
      distance: tripData.distance || tripData.estimatedDistance || "0 km",
      distanceCharge: tripData.distanceCharge || 0,
      baseFare: tripData.baseFare || 0,
      perKmRate: tripData.perKmRate || 0,
      waitingCharge: tripData.waitingCharge || 0,
      driverBata: tripData.driverBata || 0,
      nightAllowance: tripData.nightAllowance || 0,
      hillsAllowance: tripData.hillsAllowance || 0,
      commission: tripData.commission || 0,
      totalTripAmount: tripData.totalTripAmount || tripData.totalFare || 0,
      totalFare: tripData.totalFare || tripData.totalTripAmount || 0,
      driverPayout: tripData.driverPayout || 0,
      paymentMode: tripData.paymentMode || "pay_driver",
      status: tripData.status || "pending",
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

    const trips = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    }));

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

// ─────────────────────────────────────────────────────────────
// 4. Check Customer (Auto-fill)
// ─────────────────────────────────────────────────────────────
router.post("/check-customer", async (req, res) => {
  const { phone } = req.body;
  
  if (!phone || phone.length !== 10) {
    return res.status(400).json({ error: "Valid 10-digit phone required." });
  }

  try {
    // Look for previous trips by customer phone to get their name & language
    const snapshot = await db.collection(TRIPS)
                             .where("customerPhone", "==", phone)
                             .limit(1)
                             .get();
    
    if (!snapshot.empty) {
      const data = snapshot.docs[0].data();
      res.json({
        exists: true,
        name: data.customerName || "",
        language: data.customerLanguage || "Tamil"
      });
    } else {
      res.json({ exists: false });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// 5. Trip Management Actions
// ─────────────────────────────────────────────────────────────
router.post("/trips/:id/publish", async (req, res) => {
  const { id } = req.params;
  try {
    await db.collection(TRIPS).doc(id).update({ status: "pending" });
    res.json({ success: true, message: "Trip published." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/trips/:id/unpublish", async (req, res) => {
  const { id } = req.params;
  try {
    await db.collection(TRIPS).doc(id).update({ status: "draft" });
    res.json({ success: true, message: "Trip unpublished." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/trips/:id/cancel", async (req, res) => {
  const { id } = req.params;
  try {
    await db.collection(TRIPS).doc(id).update({ status: "cancelled" });
    res.json({ success: true, message: "Trip cancelled." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/trips/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await db.collection(TRIPS).doc(id).delete();
    res.json({ success: true, message: "Trip deleted." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/trips/:id", async (req, res) => {
  const { id } = req.params;
  const tripData = req.body;
  try {
    await db.collection(TRIPS).doc(id).update(tripData);
    res.json({ success: true, message: "Trip updated." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
