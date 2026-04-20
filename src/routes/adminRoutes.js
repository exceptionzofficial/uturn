// ============================================================
// Admin Routes — Firebase Firestore
// ============================================================
const express = require("express");
const router = express.Router();
const { db } = require("../config/firebaseConfig");
require("dotenv").config();

const DRIVERS = process.env.FIREBASE_COLLECTION_DRIVERS || "Drivers";
const VENDORS = process.env.FIREBASE_COLLECTION_VENDORS || "Vendors";
const TRIPS   = process.env.FIREBASE_COLLECTION_TRIPS   || "Trips";

// ─────────────────────────────────────────────────────────────
// 1. Get Pending Drivers
// ─────────────────────────────────────────────────────────────
router.get("/pending-drivers", async (req, res) => {
  console.log(`[Admin] Fetching pending drivers...`);
  try {
    const snapshot = await db
      .collection(DRIVERS)
      .where("status", "==", "PENDING_REVIEW")
      .get();

    const drivers = snapshot.docs.map((doc) => doc.data());
    console.log(`[Admin] ✅ Found ${drivers.length} pending drivers`);
    res.json(drivers);
  } catch (err) {
    console.error(`[Admin] ❌ pending-drivers error:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// 1.1 Get All Drivers
// ─────────────────────────────────────────────────────────────
router.get("/drivers", async (req, res) => {
  console.log(`[Admin] Fetching all drivers...`);
  try {
    const snapshot = await db.collection(DRIVERS).get();
    const drivers = snapshot.docs.map((doc) => doc.data());
    console.log(`[Admin] ✅ Total drivers: ${drivers.length}`);
    res.json(drivers);
  } catch (err) {
    console.error(`[Admin] ❌ drivers error:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// 1.2 Get Pending Vendors
// ─────────────────────────────────────────────────────────────
router.get("/pending-vendors", async (req, res) => {
  console.log(`[Admin] Fetching pending vendors...`);
  try {
    const snapshot = await db
      .collection(VENDORS)
      .where("status", "==", "PENDING_REVIEW")
      .get();

    const vendors = snapshot.docs.map((doc) => doc.data());
    console.log(`[Admin] ✅ Found ${vendors.length} pending vendors`);
    res.json(vendors);
  } catch (err) {
    console.error(`[Admin] ❌ pending-vendors error:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// 1.3 Get All Vendors
// ─────────────────────────────────────────────────────────────
router.get("/vendors", async (req, res) => {
  console.log(`[Admin] Fetching all vendors...`);
  try {
    const snapshot = await db.collection(VENDORS).get();
    const vendors = snapshot.docs.map((doc) => doc.data());
    console.log(`[Admin] ✅ Total vendors: ${vendors.length}`);
    res.json(vendors);
  } catch (err) {
    console.error(`[Admin] ❌ vendors error:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// 2. Update Driver Status (Approve/Reject)
// ─────────────────────────────────────────────────────────────
router.post("/update-status", async (req, res) => {
  const { driverId, status } = req.body;
  console.log(`[Admin] update-status: driverId=${driverId}, status=${status}`);

  try {
    await db.collection(DRIVERS).doc(driverId).update({ status });
    console.log(`[Admin] ✅ Driver ${driverId} status → ${status}`);
    res.json({ success: true, message: `Driver status updated to ${status}.` });
  } catch (err) {
    console.error(`[Admin] ❌ update-status error:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// 2.1 Update Driver Details
// ─────────────────────────────────────────────────────────────
router.post("/update-driver", async (req, res) => {
  const { driverId, ...updates } = req.body;
  console.log(`[Admin] update-driver: driverId=${driverId}, fields:`, Object.keys(updates));

  try {
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No fields to update." });
    }

    await db.collection(DRIVERS).doc(driverId).update(updates);
    console.log(`[Admin] ✅ Driver ${driverId} details updated`);
    res.json({ success: true, message: "Driver details updated." });
  } catch (err) {
    console.error(`[Admin] ❌ update-driver error:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// 2.2 Update Vendor Status (Approve/Reject)
// ─────────────────────────────────────────────────────────────
router.post("/update-vendor-status", async (req, res) => {
  const { vendorId, status } = req.body;
  console.log(`[Admin] update-vendor-status: vendorId=${vendorId}, status=${status}`);

  try {
    await db.collection(VENDORS).doc(vendorId).update({ status });
    console.log(`[Admin] ✅ Vendor ${vendorId} status → ${status}`);
    res.json({ success: true, message: `Vendor status updated to ${status}.` });
  } catch (err) {
    console.error(`[Admin] ❌ update-vendor-status error:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// 2.3 Update Vendor Details
// ─────────────────────────────────────────────────────────────
router.post("/update-vendor", async (req, res) => {
  const { vendorId, ...updates } = req.body;
  console.log(`[Admin] update-vendor: vendorId=${vendorId}, fields:`, Object.keys(updates));

  try {
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No fields to update." });
    }

    await db.collection(VENDORS).doc(vendorId).update(updates);
    console.log(`[Admin] ✅ Vendor ${vendorId} details updated`);
    res.json({ success: true, message: "Vendor details updated." });
  } catch (err) {
    console.error(`[Admin] ❌ update-vendor error:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// 3. Get All Trips (System Wide)
// ─────────────────────────────────────────────────────────────
router.get("/all-trips", async (req, res) => {
  console.log(`[Admin] Fetching all trips...`);
  try {
    const snapshot = await db.collection(TRIPS).get();
    const trips = snapshot.docs.map((doc) => doc.data());
    console.log(`[Admin] ✅ Total trips: ${trips.length}`);
    res.json(trips);
  } catch (err) {
    console.error(`[Admin] ❌ all-trips error:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// 4. Get System Stats
// ─────────────────────────────────────────────────────────────
router.get("/stats", async (req, res) => {
  console.log(`[Admin] Fetching system stats...`);
  try {
    const [driversSnap, tripsSnap, vendorsSnap] = await Promise.all([
      db.collection(DRIVERS).get(),
      db.collection(TRIPS).get(),
      db.collection(VENDORS).get(),
    ]);

    const drivers = driversSnap.docs.map((d) => d.data());
    const trips   = tripsSnap.docs.map((d) => d.data());
    const vendors = vendorsSnap.docs.map((d) => d.data());

    const stats = {
      totalDrivers:  drivers.length,
      pendingDrivers: drivers.filter((d) => d.status === "PENDING_REVIEW").length,
      totalVendors:  vendors.length,
      pendingVendors: vendors.filter((v) => v.status === "PENDING_REVIEW").length,
      totalTrips:    trips.length,
      pendingTrips:  trips.filter((t) => t.status === "PENDING").length,
      activeTrips:   trips.filter((t) => t.status === "ACCEPTED").length,
    };

    console.log(`[Admin] ✅ Stats:`, JSON.stringify(stats));
    res.json(stats);
  } catch (err) {
    console.error(`[Admin] ❌ stats error:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
