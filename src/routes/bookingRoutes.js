// ============================================================
// Booking Routes — Full Ride Lifecycle
// ============================================================
const express = require("express");
const router = express.Router();
const { db } = require("../config/firebaseConfig");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

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
const upload = multer({ storage: storage });

const TRIPS   = process.env.FIREBASE_COLLECTION_TRIPS   || "Trips";
const DRIVERS = process.env.FIREBASE_COLLECTION_DRIVERS || "Drivers";

// ─────────────────────────────────────────────────────────────
// Debug Middleware
// ─────────────────────────────────────────────────────────────
router.use((req, res, next) => {
  console.log(`[BookingRouter] ${req.method} ${req.url}`);
  next();
});

// ─────────────────────────────────────────────────────────────
// Create a New Trip (Booking)
// ─────────────────────────────────────────────────────────────
router.post("/create", async (req, res) => {
  const tripData = req.body;
  const tripId = `TRIP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  console.log(`[Bookings] create called, tripId: ${tripId}`);
  try {
    const tripDoc = {
      tripId,
      vendorId: tripData.vendorId || "SYSTEM_VENDOR",
      customerName: tripData.customerName || "",
      customerPhone: tripData.customerPhone || "",
      customerLanguage: tripData.customerLanguage || "Tamil",
      pickupAddress: tripData.pickupAddress || tripData.pickup || "",
      dropAddress: tripData.dropAddress || tripData.drop || "",
      pickup: tripData.pickup || tripData.pickupAddress || "",
      drop: tripData.drop || tripData.dropAddress || "",
      pickupLocation: tripData.pickupLocation || tripData.pickupCoords || { latitude: 0, longitude: 0 },
      dropLocation: tripData.dropLocation || tripData.dropCoords || { latitude: 0, longitude: 0 },
      pickupCoords: tripData.pickupCoords || tripData.pickupLocation || { latitude: 0, longitude: 0 },
      dropCoords: tripData.dropCoords || tripData.dropLocation || { latitude: 0, longitude: 0 },
      tripType: tripData.tripType || "oneWay",
      vehicleType: tripData.vehicleType || "Sedan",
      scheduleDate: tripData.scheduleDate || "",
      scheduleTime: tripData.scheduleTime || "",
      returnDate: tripData.returnDate || "",
      returnTime: tripData.returnTime || "",
      baseFare: tripData.baseFare || 0,
      distanceKm: tripData.distanceKm || 0,
      distanceCharge: tripData.distanceCharge || 0,
      perKmRate: tripData.perKmRate || 0,
      waitingChargesPerMin: tripData.waitingChargesPerMin || 0,
      waitingChargesPerHour: (tripData.waitingChargesPerMin || 0) * 60,
      driverBata: tripData.driverBata || 0,
      vendorCommission: tripData.vendorCommission || 0,
      vendorCommissionPercentage: tripData.vendorCommissionPercentage || 0,
      packageAmount: tripData.totalFare || tripData.totalTripAmount || 0,
      estimatedFare: tripData.totalFare || tripData.totalTripAmount || 0,
      totalAmount: tripData.totalFare || tripData.totalTripAmount || 0,
      totalTripAmount: tripData.totalTripAmount || tripData.totalFare || 0,
      totalFare: tripData.totalFare || tripData.totalTripAmount || 0,
      paymentMode: tripData.paymentMode || "customer_pays_driver",
      additionalStops: tripData.additionalStops || [],
      status: tripData.status || "pending",
      createdAt: new Date().toISOString(),
    };
    await db.collection(TRIPS).doc(tripId).set(tripDoc);
    console.log(`[Bookings] ✅ Booking created: ${tripId}`);
    res.json({ success: true, tripId, message: "Booking created successfully." });
  } catch (err) {
    console.error(`[Bookings] ❌ create error:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// Get Available Trips (for Drivers) — MUST be before /:id
// ─────────────────────────────────────────────────────────────
router.get("/available", async (req, res) => {
  console.log(`[Bookings] get available called`);
  try {
    const snapshot = await db.collection(TRIPS)
      .where("status", "==", "pending")
      .get();
    const trips = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(trips);
  } catch (err) {
    console.error(`[Bookings] ❌ get available error:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// Get Driver Trips (History/Active) — MUST be before /:id
// ─────────────────────────────────────────────────────────────
router.get("/driver/:driverId", async (req, res) => {
  const { driverId } = req.params;
  const { status } = req.query;
  console.log(`[Bookings] Get driver trips: ${driverId}, status: ${status}`);
  try {
    let query = db.collection(TRIPS).where("driverId", "==", driverId);
    if (status) query = query.where("status", "==", status);
    const snapshot = await query.get();
    const trips = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(trips);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// Vendor: Get Pending Driver Approvals — MUST be before /:id
// ─────────────────────────────────────────────────────────────
router.get("/vendor/:vendorId/pending-approvals", async (req, res) => {
  const { vendorId } = req.params;
  console.log(`[Bookings] pending-approvals for vendor: ${vendorId}`);
  try {
    const snapshot = await db.collection(TRIPS)
      .where("vendorId", "==", vendorId)
      .where("status", "==", "driverAccepted")
      .get();
    const trips = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    console.log(`[Bookings] ✅ Found ${trips.length} pending approvals`);
    res.json({ success: true, data: trips, count: trips.length });
  } catch (err) {
    console.error(`[Bookings] ❌ pending-approvals error:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// Accept Trip (Driver + optional video URL)
// ─────────────────────────────────────────────────────────────
router.post("/:id/accept", upload.single('video'), async (req, res) => {
  const { id } = req.params;
  const driverId = req.body.driverId;
  let videoUrl = req.body.videoUrl || "";

  if (req.file) {
    // Generate public URL assuming backend is served correctly
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.headers.host;
    videoUrl = `${protocol}://${host}/uploads/${req.file.filename}`;
  }

  console.log(`[Bookings] Accept called for trip: ${id}, driver: ${driverId}, video: ${videoUrl}`);
  try {
    const tripRef = db.collection(TRIPS).doc(id);
    const trip = await tripRef.get();
    if (!trip.exists) return res.status(404).json({ error: "Trip not found" });
    if (trip.data().status !== "pending") {
      return res.status(400).json({ error: "Trip is no longer available" });
    }
    // Check if driver is blocked (outstanding commission)
    let driverData = {};
    if (driverId) {
      const driverDoc = await db.collection(DRIVERS).doc(driverId).get().catch(() => null);
      if (driverDoc && driverDoc.exists) {
        driverData = driverDoc.data();
        if (driverData.isBlocked) {
          return res.status(403).json({
            error: "You have a pending commission. Please settle with your vendor before accepting new rides.",
            blocked: true,
          });
        }
      }
    }
    await tripRef.update({
      status: "driverAccepted",
      driverId: driverId || "",
      driverName: driverData.name || driverData.username || "Unknown Driver",
      driverPhoto: driverData.profilePhoto || "",
      videoUrl: videoUrl || "",
      acceptedAt: new Date().toISOString(),
    });
    res.json({ success: true, message: "Trip accepted. Awaiting vendor approval." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// Vendor: Approve Driver
// ─────────────────────────────────────────────────────────────
router.post("/:id/approve-driver", async (req, res) => {
  const { id } = req.params;
  console.log(`[Bookings] approve-driver for trip: ${id}`);
  try {
    const doc = await db.collection(TRIPS).doc(id).get();
    if (!doc.exists) return res.status(404).json({ error: "Trip not found" });
    const tripData = doc.data();
    await db.collection(TRIPS).doc(id).update({
      status: "vendorApproved",
      vendorApprovedAt: new Date().toISOString(),
      // Reveal customer contact to driver after approval
      revealedCustomerName: tripData.customerName || "",
      revealedCustomerPhone: tripData.customerPhone || "",
    });
    console.log(`[Bookings] ✅ Driver approved for trip: ${id}`);
    res.json({ success: true, message: "Driver approved. Customer details revealed." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// Vendor: Reject Driver
// ─────────────────────────────────────────────────────────────
router.post("/:id/reject-driver", async (req, res) => {
  const { id } = req.params;
  const { reason, driverId } = req.body;
  console.log(`[Bookings] reject-driver for trip: ${id}`);
  try {
    const updateData = {
      status: "pending",
      rejectReason: reason || "",
      driverId: null,
      driverName: null,
      driverPhoto: null,
      videoUrl: null,
      rejectedAt: new Date().toISOString(),
    };
    if (driverId) {
      updateData.rejectedDrivers = require("firebase-admin/firestore").FieldValue.arrayUnion(driverId);
      updateData.lastRejectedDriver = driverId;
    }
    await db.collection(TRIPS).doc(id).update(updateData);
    console.log(`[Bookings] ✅ Driver rejected for trip: ${id}`);
    res.json({ success: true, message: "Driver rejected. Trip returned to pending." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// Driver: Update Status (arrived, confirmed)
// ─────────────────────────────────────────────────────────────
router.put("/:id/status", async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const allowed = ["confirmed", "arrived", "inProgress", "dropped", "cancelled"];
  console.log(`[Bookings] status-update for trip: ${id} → ${status}`);
  try {
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Allowed: ${allowed.join(", ")}` });
    }
    const update = { status };
    if (status === "arrived")   update.arrivedAt   = new Date().toISOString();
    if (status === "confirmed") update.confirmedAt = new Date().toISOString();
    await db.collection(TRIPS).doc(id).update(update);
    res.json({ success: true, message: `Status updated to ${status}.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// Generate OTP for Ride Start
// ─────────────────────────────────────────────────────────────
router.post("/:id/otp-generate", async (req, res) => {
  const { id } = req.params;
  console.log(`[Bookings] otp-generate for trip: ${id}`);
  try {
    const tripRef = db.collection(TRIPS).doc(id);
    const trip = await tripRef.get();
    if (!trip.exists) return res.status(404).json({ error: "Trip not found" });
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    await tripRef.update({ rideOtp: otp, otpGeneratedAt: new Date().toISOString() });
    console.log(`[Bookings] ✅ OTP generated for trip ${id}: ${otp}`);
    // Return OTP in dev mode — remove in production
    res.json({ success: true, otp, message: "OTP generated. Share with customer." });
  } catch (err) {
    console.error(`[Bookings] ❌ otp-generate error:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// Start Trip — OTP Verification (BYPASS: any 4-digit numeric)
// ─────────────────────────────────────────────────────────────
router.post("/:id/start", async (req, res) => {
  const { id } = req.params;
  const { otp } = req.body;
  console.log(`[Bookings] start (OTP BYPASS) for trip: ${id}, otp received: ${otp}`);
  try {
    const tripRef = db.collection(TRIPS).doc(id);
    const trip = await tripRef.get();
    if (!trip.exists) return res.status(404).json({ error: "Trip not found" });

    // BYPASS MODE: Accept any 4-digit numeric OTP
    // Same pattern as /vendor/verify-otp — swap to strict check in production
    const otpStr = String(otp || "").trim();
    if (!otpStr || !/^\d{4}$/.test(otpStr)) {
      console.warn(`[Bookings] ❌ Invalid OTP format for ${id}: "${otp}"`);
      return res.json({ success: false, message: "Please enter a valid 4-digit OTP." });
    }

    await tripRef.update({
      status: "inProgress",
      tripStartedAt: new Date().toISOString(),
      otpUsed: otpStr,
    });
    console.log(`[Bookings] ✅ Trip started (OTP bypass): ${id}`);
    res.json({ success: true, message: "Trip started successfully." });
  } catch (err) {
    console.error(`[Bookings] ❌ start error:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// Drop Customer — Extra Charges + Server-Side Final Fare Calc
// ─────────────────────────────────────────────────────────────
router.post("/:id/drop", async (req, res) => {
  const { id } = req.params;
  const {
    tollCharges    = 0,
    parkingCharges = 0,
    permitCharges  = 0,
    otherCharges   = 0,
  } = req.body;
  console.log(`[Bookings] drop called for trip: ${id}`);
  try {
    const tripRef = db.collection(TRIPS).doc(id);
    const tripDoc = await tripRef.get();
    if (!tripDoc.exists) return res.status(404).json({ error: "Trip not found" });

    const trip = tripDoc.data();
    const now   = new Date();

    // ── Wait time calculation ────────────────────────────────
    let waitMinutes = 0;
    if (trip.tripStartedAt) {
      const startTime = new Date(trip.tripStartedAt);
      waitMinutes = Math.max(0, Math.ceil((now - startTime) / 60000));
    }
    const waitingChargesPerMin = parseFloat(trip.waitingChargesPerMin) || 0;
    const waitFare = waitMinutes * waitingChargesPerMin;

    // ── Final fare breakdown ─────────────────────────────────
    const baseFare       = parseFloat(trip.baseFare)        || 0;
    const distanceCharge = parseFloat(trip.distanceCharge)  || 0;
    const driverBata     = parseFloat(trip.driverBata)      || 0;
    const commission     = parseFloat(trip.vendorCommission) || 0;

    const toll    = parseFloat(tollCharges)    || 0;
    const parking = parseFloat(parkingCharges) || 0;
    const permit  = parseFloat(permitCharges)  || 0;
    const other   = parseFloat(otherCharges)   || 0;
    const extraTotal = toll + parking + permit + other;

    const finalFare    = baseFare + distanceCharge + driverBata + waitFare + extraTotal;
    const driverPayout = finalFare - commission;

    const updatedFields = {
      status:            "dropped",
      droppedAt:         now.toISOString(),
      waitMinutes,
      waitFare:          parseFloat(waitFare.toFixed(2)),
      tollCharges:       parseFloat(toll.toFixed(2)),
      parkingCharges:    parseFloat(parking.toFixed(2)),
      permitCharges:     parseFloat(permit.toFixed(2)),
      otherCharges:      parseFloat(other.toFixed(2)),
      extraChargesTotal: parseFloat(extraTotal.toFixed(2)),
      finalFare:         parseFloat(finalFare.toFixed(2)),
      driverPayout:      parseFloat(driverPayout.toFixed(2)),
      driverEarning:     parseFloat(driverPayout.toFixed(2)),
      totalFare:         parseFloat(finalFare.toFixed(2)),
      totalTripAmount:   parseFloat(finalFare.toFixed(2)),
    };

    await tripRef.update(updatedFields);
    const updatedTrip = { id, ...trip, ...updatedFields };
    console.log(`[Bookings] ✅ Trip dropped. Final Fare: ₹${finalFare.toFixed(2)} for trip: ${id}`);
    res.json({ success: true, message: "Customer dropped. Final fare calculated.", data: updatedTrip });
  } catch (err) {
    console.error(`[Bookings] ❌ drop error:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// Complete Trip — Commission Logic + Driver Lock
// ─────────────────────────────────────────────────────────────
router.post("/:id/complete", async (req, res) => {
  const { id } = req.params;
  console.log(`[Bookings] complete called for trip: ${id}`);
  try {
    const tripRef = db.collection(TRIPS).doc(id);
    const tripDoc = await tripRef.get();
    if (!tripDoc.exists) return res.status(404).json({ error: "Trip not found" });

    const trip        = tripDoc.data();
    const paymentMode = trip.paymentMode || "customer_pays_driver";
    const now         = new Date().toISOString();

    if (paymentMode === "customer_pays_driver") {
      // Scenario 1: Customer Pays Driver (Cash Collection)
      await tripRef.update({ 
        status: "payment_verification_pending", 
        completedAt: now, 
        cashCollectedAt: now 
      });
      if (trip.driverId) {
        await db.collection(DRIVERS).doc(trip.driverId).update({
          status: "blocked_for_payment",
          isBlocked: true, // Legacy support
          blockedReason: `Commission pending for trip ${id}`,
          pendingCommissionTripId: id,
          pendingCommissionAmount: trip.vendorCommission || 0,
        }).catch(e => console.warn(`[Bookings] Could not block driver: ${e.message}`));
      }
      console.log(`[Bookings] ✅ Trip ${id} → payment_verification_pending. Driver ${trip.driverId} blocked.`);
      res.json({ success: true, status: "payment_verification_pending", message: "Cash collected. Please settle commission with vendor." });
    } else {
      // Scenario 2: Customer Pays Vendor
      await tripRef.update({ status: "vendor_payment_pending", completedAt: now, vendorPaymentStatus: "pending" });
      console.log(`[Bookings] ✅ Trip ${id} → vendor_payment_pending.`);
      res.json({ success: true, status: "vendor_payment_pending", message: "Trip completed. Waiting for vendor to pay driver." });
    }
  } catch (err) {
    console.error(`[Bookings] ❌ complete error:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// Commission Actions
// ─────────────────────────────────────────────────────────────
router.post("/:id/verify-cash", async (req, res) => {
  const { id } = req.params;
  try {
    await db.collection(TRIPS).doc(id).update({ 
      status: "commission_pending",
      paymentStatus: "completed"
    });
    res.json({ success: true, message: "Cash verified." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:id/pay-commission", async (req, res) => {
  const { id } = req.params;
  try {
    await db.collection(TRIPS).doc(id).update({ 
      status: "commission_verification_pending",
      commissionStatus: "paid_by_driver"
    });
    res.json({ success: true, message: "Commission paid by driver." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:id/approve-commission", async (req, res) => {
  const { id } = req.params;
  try {
    const doc = await db.collection(TRIPS).doc(id).get();
    if (doc.exists) {
      if (doc.data().status === "vendor_payment_pending") {
        await db.collection(TRIPS).doc(id).update({
          status: "completed",
          vendorPaymentStatus: "paid"
        });
        return res.json({ success: true, message: "Vendor paid driver. Trip complete." });
      }

      if (doc.data().driverId) {
      await db.collection(DRIVERS).doc(doc.data().driverId).update({
        status: "active",
        isBlocked: false,
        blockedReason: "",
        pendingCommissionTripId: null,
        pendingCommissionAmount: 0,
      }).catch(() => {});
    }
    await db.collection(TRIPS).doc(id).update({
      status: "completed",
      commissionStatus: "received",
      commissionClearedAt: new Date().toISOString(),
    });
    res.json({ success: true, message: "Commission approved. Driver unblocked." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:id/reject-commission", async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  try {
    await db.collection(TRIPS).doc(id).update({
      status: "commission_pending",
      commissionStatus: "rejected",
      commissionRejectReason: reason || "",
      commissionRejectedAt: new Date().toISOString()
    });
    res.json({ success: true, message: "Commission rejected. Loops back to driver." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// Get Single Booking by ID — MUST be last to avoid matching above
// ─────────────────────────────────────────────────────────────
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const doc = await db.collection(TRIPS).doc(id).get();
    if (!doc.exists) return res.status(404).json({ error: "Trip not found" });
    res.json({ success: true, data: { id: doc.id, ...doc.data() } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
