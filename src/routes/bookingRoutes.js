const express = require("express");
const router = express.Router();
const { db } = require("../config/firebaseConfig");

const TRIPS = process.env.FIREBASE_COLLECTION_TRIPS || "Trips";

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
      pickupAddress: tripData.pickupAddress || "",
      dropAddress: tripData.dropAddress || "",
      pickupLocation: tripData.pickupLocation || { latitude: 0, longitude: 0 },
      dropLocation: tripData.dropLocation || { latitude: 0, longitude: 0 },
      tripType: tripData.tripType || "oneWay",
      vehicleType: tripData.vehicleType || "Sedan",
      scheduleDate: tripData.scheduleDate || "",
      scheduleTime: tripData.scheduleTime || "",
      returnDate: tripData.returnDate || "",
      returnTime: tripData.returnTime || "",
      baseFare: tripData.baseFare || 0,
      distanceKm: tripData.distanceKm || 0,
      vendorCommission: tripData.vendorCommission || 0,
      vendorCommissionPercentage: tripData.vendorCommissionPercentage || 0,
      waitingChargesPerMin: tripData.waitingChargesPerMin || 0,
      waitingChargesPerHour: (tripData.waitingChargesPerMin || 0) * 60,
      packageAmount: tripData.totalFare || 0,
      estimatedFare: tripData.totalFare || 0,
      totalAmount: tripData.totalFare || 0,
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
// Shared Booking Actions (Approve/Reject Driver/Commission)
// ─────────────────────────────────────────────────────────────
router.post("/:id/approve-driver", async (req, res) => {
  const { id } = req.params;
  try {
    await db.collection(TRIPS).doc(id).update({ status: "vendor_approved" });
    res.json({ success: true, message: "Driver approved." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:id/reject-driver", async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  try {
    await db.collection(TRIPS).doc(id).update({ status: "pending", rejectReason: reason || "", driverId: null });
    res.json({ success: true, message: "Driver rejected." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:id/verify-payment", async (req, res) => {
  const { id } = req.params;
  try {
    await db.collection(TRIPS).doc(id).update({ status: "commission_pending" });
    res.json({ success: true, message: "Payment verified." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:id/approve-commission", async (req, res) => {
  const { id } = req.params;
  try {
    await db.collection(TRIPS).doc(id).update({ status: "completed" });
    // Also logic to unblock driver should go here
    res.json({ success: true, message: "Commission approved." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:id/reject-commission", async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  try {
    await db.collection(TRIPS).doc(id).update({ status: "commission_pending", commissionRejectReason: reason || "" });
    res.json({ success: true, message: "Commission rejected." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
