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
      isSelfRide: tripData.isSelfRide || false,
      driverId: tripData.driverId || "",
      driverName: tripData.driverName || "",
      driverPhone: tripData.driverPhone || tripData.driverId || "",
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
      vehicleType: tripData.vehicle || tripData.vehicleType || "Sedan",
      category: tripData.category || "Passenger",
      numberOfPeople: tripData.numberOfPeople || 1,
      loadCapacity: tripData.loadCapacity || "",
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
      nightAllowance: tripData.nightAllowance || 0,
      hillsAllowance: tripData.hillsAllowance || 0,
      vendorCommission: tripData.vendorCommission || 0,
      vendorCommissionPercentage: tripData.vendorCommissionPercentage || 0,
      packageAmount: tripData.totalFare || tripData.totalTripAmount || 0,
      estimatedFare: tripData.totalFare || tripData.totalTripAmount || 0,
      estimatedDistance: tripData.estimatedDistance || tripData.distance || "0 km",
      estimatedTime: tripData.estimatedTime || "",
      totalAmount: tripData.totalFare || tripData.totalTripAmount || 0,
      totalTripAmount: tripData.totalTripAmount || tripData.totalFare || 0,
      totalFare: tripData.totalFare || tripData.totalTripAmount || 0,
      paymentMode: tripData.paymentMode || "customer_pays_driver",
      additionalStops: tripData.additionalStops || tripData.stops || [],
      // For self rides, also reveal customer info immediately
      revealedCustomerName: tripData.isSelfRide ? (tripData.customerName || "") : "",
      revealedCustomerPhone: tripData.isSelfRide ? (tripData.customerPhone || "") : "",
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

    // Check if driver already has an active trip
    if (driverId) {
      const activeTripsSnapshot = await db.collection(TRIPS)
        .where("driverId", "==", driverId)
        .where("status", "in", ["driverAccepted", "vendorApproved", "arrived", "inProgress"])
        .get();
      
      if (!activeTripsSnapshot.empty) {
        return res.status(403).json({ 
          error: "You already have an active trip. Please complete or cancel it before accepting another." 
        });
      }
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
// Start Trip — OTP Verification + Odometer Photo
// Self rides: verify against real generated OTP
// Vendor rides: bypass mode (any 4-digit numeric)
// ─────────────────────────────────────────────────────────────
router.post("/:id/start", upload.single('odometerPhoto'), async (req, res) => {
  const { id } = req.params;
  const { otp } = req.body;
  const odometerPhoto = req.file ? `/uploads/${req.file.filename}` : "";
  console.log(`[Bookings] start for trip: ${id}, otp received: ${otp}, photo: ${odometerPhoto}`);
  try {
    const tripRef = db.collection(TRIPS).doc(id);
    const tripDoc = await tripRef.get();
    if (!tripDoc.exists) return res.status(404).json({ error: "Trip not found" });

    const tripData = tripDoc.data();
    const otpStr = String(otp || "").trim();

    if (!otpStr || !/^\d{4}$/.test(otpStr)) {
      console.warn(`[Bookings] ❌ Invalid OTP format for ${id}: "${otp}"`);
      return res.json({ success: false, message: "Please enter a valid 4-digit OTP." });
    }

    // Self rides: verify against the real generated OTP
    if (tripData.isSelfRide) {
      const storedOtp = String(tripData.rideOtp || "").trim();
      if (!storedOtp) {
        return res.json({ success: false, message: "OTP not yet generated. Please wait for customer to open tracking link." });
      }
      if (otpStr !== storedOtp) {
        console.warn(`[Bookings] ❌ Wrong OTP for self-ride ${id}: entered ${otpStr}, expected ${storedOtp}`);
        return res.json({ success: false, message: "Incorrect OTP. Please ask the customer for the correct OTP from their tracking link." });
      }
      console.log(`[Bookings] ✅ Self-ride OTP verified for ${id}`);
    }

    const startKmVal = parseFloat(req.body.startKm) || 0;

    await tripRef.update({
      status: "inProgress",
      tripStartedAt: new Date().toISOString(),
      otpUsed: otpStr,
      startKm: startKmVal,
      startOdometerPhoto: odometerPhoto,
    });
    console.log(`[Bookings] ✅ Trip started: ${id}, startKm: ${startKmVal}, photo: ${odometerPhoto}`);
    res.json({ success: true, message: "Trip started successfully." });
  } catch (err) {
    console.error(`[Bookings] ❌ start error:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// Drop Customer — Extra Charges + Server-Side Final Fare Calc
// ─────────────────────────────────────────────────────────────
router.post("/:id/drop", upload.single('odometerPhoto'), async (req, res) => {
  const { id } = req.params;
    const { 
      tollCharges    = 0, 
      parkingCharges = 0, 
      permitCharges  = 0, 
      otherCharges   = 0,
      waitCharges    = 0,
      startKm,
      endKm,
      distanceKm
    } = req.body;
    const odometerPhoto = req.file ? `/uploads/${req.file.filename}` : "";
    console.log(`[Bookings] drop called for trip: ${id} with distance: ${distanceKm}, photo: ${odometerPhoto}`);
    try {
      const tripRef = db.collection(TRIPS).doc(id);
      const tripDoc = await tripRef.get();
      if (!tripDoc.exists) return res.status(404).json({ error: "Trip not found" });

      const trip = tripDoc.data();
      const now   = new Date();

      // ── Wait time calculation ────────────────────────────────
      // If waitCharges is provided by app, use it. Otherwise calculate from time.
      let waitFare = parseFloat(waitCharges) || 0;
      let waitMinutes = 0;

      if (waitFare <= 0 && trip.tripStartedAt) {
        const startTime = new Date(trip.tripStartedAt);
        if (!isNaN(startTime.getTime())) {
          waitMinutes = Math.max(0, Math.ceil((now - startTime) / 60000));
        }
        const waitingChargesPerMin = parseFloat(trip.waitingChargesPerMin) || 0;
        waitFare = waitMinutes * waitingChargesPerMin;
      }
      if (isNaN(waitFare)) waitFare = 0;

      // ── Final fare breakdown ─────────────────────────────────
      const baseFare       = parseFloat(trip.baseFare)        || 0;
      const distanceCharge = parseFloat(trip.distanceCharge)  || 0;
      const driverBata     = parseFloat(trip.driverBata)      || 0;
      
      const toll    = parseFloat(tollCharges)    || 0;
      const parking = parseFloat(parkingCharges) || 0;
      const permit  = parseFloat(permitCharges)  || 0;
      const other   = parseFloat(otherCharges)   || 0;
      const extraTotal = toll + parking + permit + other;

      let finalFare    = baseFare + distanceCharge + driverBata + waitFare + extraTotal;
      if (isNaN(finalFare)) finalFare = baseFare + distanceCharge + driverBata + extraTotal;
      if (isNaN(finalFare)) finalFare = 0;

      // Calculate commission: Use percentage if available, else flat
      let commissionPercentage = parseFloat(trip.vendorCommissionPercentage) || 0;
      let commission = parseFloat(trip.vendorCommission) || 0;
      if (commissionPercentage > 0) {
        commission = (finalFare * commissionPercentage) / 100;
      }

      let driverPayout = finalFare - commission;
      if (isNaN(driverPayout)) driverPayout = 0;

      const updatedFields = {
        status:            "dropped",
        droppedAt:         now.toISOString(),
        waitMinutes:       waitMinutes || 0,
        waitFare:          parseFloat(waitFare.toFixed(2)) || 0,
        tollCharges:       parseFloat(toll.toFixed(2)) || 0,
        parkingCharges:    parseFloat(parking.toFixed(2)) || 0,
        permitCharges:     parseFloat(permit.toFixed(2)) || 0,
        otherCharges:      parseFloat(other.toFixed(2)) || 0,
        extraChargesTotal: parseFloat(extraTotal.toFixed(2)) || 0,
        finalFare:         parseFloat(finalFare.toFixed(2)) || 0,
        vendorCommission:  parseFloat(commission.toFixed(2)) || 0,
        driverPayout:      parseFloat(driverPayout.toFixed(2)) || 0,
        totalFare:         parseFloat(finalFare.toFixed(2)) || 0,
        totalTripAmount:   parseFloat(finalFare.toFixed(2)) || 0,
        startKm:           startKm || 0,
        endKm:             endKm || 0,
        endOdometerPhoto:  odometerPhoto,
        distanceKm:        parseFloat(distanceKm) || (parseFloat(endKm) - parseFloat(startKm)) || 0,
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
    const isSelfRide  = trip.isSelfRide || false;
    const now         = new Date().toISOString();

    // Self rides: driver collects cash directly, no commission, complete immediately
    if (isSelfRide || paymentMode === "pay_driver") {
      await tripRef.update({ status: "completed", completedAt: now, cashCollectedAt: now });
      console.log(`[Bookings] ✅ Self-ride ${id} → completed. No commission.`);
      res.json({ success: true, status: "completed", message: "Self ride completed. Cash collected directly." });
    } else if (paymentMode === "customer_pays_driver") {
      // Driver collected cash → owes vendor commission → lock driver
      await tripRef.update({ status: "commissionPending", completedAt: now, cashCollectedAt: now });
      if (trip.driverId) {
        await db.collection(DRIVERS).doc(trip.driverId).update({
          isBlocked:               true,
          blockedReason:           `Commission pending for trip ${id}`,
          pendingCommissionTripId: id,
          pendingCommissionAmount: trip.vendorCommission || 0,
        }).catch(e => console.warn(`[Bookings] Could not block driver: ${e.message}`));
      }
      console.log(`[Bookings] ✅ Trip ${id} → commissionPending. Driver ${trip.driverId} blocked.`);
      res.json({ success: true, status: "commissionPending", message: "Cash collected. Please settle commission with vendor." });
    } else {
      // customer_pays_vendor — vendor already has the money, complete immediately
      await tripRef.update({ status: "completed", completedAt: now });
      console.log(`[Bookings] ✅ Trip ${id} → completed.`);
      res.json({ success: true, status: "completed", message: "Trip completed successfully." });
    }
  } catch (err) {
    console.error(`[Bookings] ❌ complete error:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// Commission Actions
// ─────────────────────────────────────────────────────────────
router.post("/:id/verify-payment", async (req, res) => {
  const { id } = req.params;
  try {
    await db.collection(TRIPS).doc(id).update({ status: "commissionPending" });
    res.json({ success: true, message: "Payment verified." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:id/approve-commission", async (req, res) => {
  const { id } = req.params;
  try {
    const doc = await db.collection(TRIPS).doc(id).get();
    if (doc.exists && doc.data().driverId) {
      await db.collection(DRIVERS).doc(doc.data().driverId).update({
        isBlocked: false,
        blockedReason: "",
        pendingCommissionTripId: null,
        pendingCommissionAmount: 0,
      }).catch(() => {});
    }
    await db.collection(TRIPS).doc(id).update({
      status: "completed",
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
      status: "commissionRejected",
      commissionRejectReason: reason || "",
      commissionRejectedAt: new Date().toISOString()
    });
    res.json({ success: true, message: "Commission rejected." });
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

// ─────────────────────────────────────────────────────────────
// Public Tracking Page (HTML)
// ─────────────────────────────────────────────────────────────
router.get("/track/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const doc = await db.collection(TRIPS).doc(id).get();
    if (!doc.exists) return res.status(404).send("<h1>Trip Not Found</h1>");
    const trip = doc.data();

    // The HTML content
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>UTurn - Track Your Ride</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Inter', sans-serif; background: #F5F7FA; margin: 0; padding: 20px; color: #1A202C; }
        .card { background: white; border-radius: 20px; padding: 24px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); max-width: 500px; margin: 0 auto; }
        .header { text-align: center; margin-bottom: 24px; }
        .header h1 { margin: 0; color: #1E40AF; font-size: 24px; font-weight: 800; }
        .status-badge { display: inline-block; padding: 6px 12px; border-radius: 20px; background: #DBEAFE; color: #1E40AF; font-weight: 600; font-size: 14px; margin-top: 8px; }
        .info-row { display: flex; align-items: center; margin-bottom: 16px; }
        .info-icon { font-size: 20px; margin-right: 12px; width: 24px; text-align: center; }
        .info-label { color: #718096; font-size: 14px; margin-bottom: 2px; }
        .info-value { font-weight: 600; font-size: 16px; }
        .otp-container { background: #F0FDF4; border: 2px dashed #4ADE80; border-radius: 16px; padding: 20px; text-align: center; margin-top: 24px; }
        .otp-title { color: #166534; font-weight: 600; margin-bottom: 8px; font-size: 14px; }
        .otp-code { font-size: 48px; font-weight: 800; color: #166534; letter-spacing: 8px; margin: 0; }
        .driver-info { border-top: 1px solid #E2E8F0; padding-top: 20px; margin-top: 20px; }
        .footer { text-align: center; margin-top: 24px; color: #718096; font-size: 12px; }
        .refresh-btn { background: #1E40AF; color: white; border: none; padding: 12px 24px; border-radius: 12px; font-weight: 600; cursor: pointer; width: 100%; margin-top: 16px; }
    </style>
</head>
<body>
    <div class="card">
        <div class="header">
            <h1>UTURN</h1>
            <div class="status-badge">${(trip.status || 'Active').toUpperCase()}</div>
        </div>

        <div class="info-row">
            <div class="info-icon">📍</div>
            <div>
                <div class="info-label">Pickup Location</div>
                <div class="info-value">${trip.pickupAddress || trip.pickup}</div>
            </div>
        </div>

        <div class="info-row">
            <div class="info-icon">🏁</div>
            <div>
                <div class="info-label">Drop Destination</div>
                <div class="info-value">${trip.dropAddress || trip.drop}</div>
            </div>
        </div>

        <div class="driver-info">
            <div class="info-row">
                <div class="info-icon">👤</div>
                <div>
                    <div class="info-label">Driver Details</div>
                    <div class="info-value">${trip.driverName || 'Assigning...'}</div>
                    ${trip.driverPhone ? `<a href="tel:${trip.driverPhone}" style="color: #1E40AF; font-size: 14px;">📞 Call Driver</a>` : ''}
                </div>
            </div>
        </div>

        ${trip.rideOtp ? `
        <div class="otp-container">
            <div class="otp-title">YOUR START OTP</div>
            <p class="otp-code">${trip.rideOtp}</p>
            <p style="font-size: 12px; color: #166534; margin-top: 8px;">Share this with the driver to start the ride</p>
        </div>
        ` : `
        <div class="otp-container" style="background: #FFFBEB; border-color: #FBBF24;">
            <div class="otp-title" style="color: #92400E;">OTP PENDING</div>
            <p style="color: #92400E; font-size: 14px;">The driver hasn't requested the OTP yet.</p>
        </div>
        `}

        <button class="refresh-btn" onclick="window.location.reload()">Refresh Status</button>
    </div>
    <div class="footer">
        Ride ID: #${id.slice(-8)}<br>
        © 2026 UTurn Technologies
    </div>

    <script>
        // Auto refresh every 10 seconds
        setInterval(() => window.location.reload(), 10000);
    </script>
</body>
</html>
    `;
    res.send(html);
  } catch (err) {
    res.status(500).send("<h1>Internal Server Error</h1>");
  }
});

// ─────────────────────────────────────────────────────────────
// Trigger SOS for a Trip
// ─────────────────────────────────────────────────────────────
router.post("/:id/sos", async (req, res) => {
  try {
    const { id } = req.params;
    const { driverId, location } = req.body;
    
    // Save SOS alert to a dedicated collection
    const sosId = `SOS-${Date.now()}`;
    await db.collection("SOS_Alerts").doc(sosId).set({
      sosId,
      tripId: id,
      driverId: driverId || "UNKNOWN",
      location: location || "UNKNOWN",
      timestamp: new Date().toISOString(),
      status: "unresolved",
    });

    // Optionally update trip status or add a flag
    await db.collection(TRIPS).doc(id).update({
      sosTriggered: true,
      sosTriggeredAt: new Date().toISOString(),
    });

    console.log(`[Bookings] 🚨 SOS Triggered for Trip ${id} by Driver ${driverId}`);
    res.json({ success: true, message: "SOS Alert sent to Admin successfully" });
  } catch (err) {
    console.error(`[Bookings] ❌ SOS error:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
