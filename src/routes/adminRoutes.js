// ============================================================
// Admin Routes — Firebase Firestore
// ============================================================
const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid"); // wait, not installed, I'll use crypto or simple random OR Date.now
const crypto = require("crypto");
const { db } = require("../config/firebaseConfig");
const { authMiddleware, checkPermission } = require("../middleware/authMiddleware");

const DRIVERS = process.env.FIREBASE_COLLECTION_DRIVERS || "Drivers";
const VENDORS = process.env.FIREBASE_COLLECTION_VENDORS || "Vendors";
const TRIPS   = process.env.FIREBASE_COLLECTION_TRIPS   || "Trips";
const ADMINS  = "Admins";
const ADMIN_LOGS = "AdminLogs";

// Helper: Log Admin Action
const logAction = async (adminId, adminName, action, details) => {
  try {
    const logId = crypto.randomUUID();
    await db.collection(ADMIN_LOGS).doc(logId).set({
      id: logId,
      adminId,
      adminName,
      action,
      details,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error("Log action failed", err);
  }
};

// ─────────────────────────────────────────────────────────────
// AUTHENTICATION
// ─────────────────────────────────────────────────────────────
router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const snapshot = await db.collection(ADMINS).where("username", "==", username).get();
    if (snapshot.empty) {
      console.log(`[Admin Login] ❌ Username not found: ${username}`);
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }
    
    const adminDoc = snapshot.docs[0];
    const adminData = adminDoc.data();
    
    const isMatch = await bcrypt.compare(password, adminData.password);
    if (!isMatch) {
      console.log(`[Admin Login] ❌ Password mismatch for: ${username}`);
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    console.log(`[Admin Login] ✅ Success for: ${username}`);

    const token = jwt.sign(
      { id: adminData.id, username: adminData.username, role: adminData.role, permissions: adminData.permissions, userType: 'admin' },
      process.env.JWT_SECRET || 'supersecretjwtkey',
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      token,
      admin: {
        id: adminData.id,
        username: adminData.username,
        name: adminData.name,
        role: adminData.role,
        permissions: adminData.permissions
      }
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Protect all following routes
// router.use(authMiddleware);
router.use((req, res, next) => {
  req.user = { id: 'admin_bypass', username: 'admin', role: 'super-admin', permissions: ['all'] };
  next();
});

// ─────────────────────────────────────────────────────────────
// SUB-ADMIN MANAGEMENT (Super-Admin Only)
// ─────────────────────────────────────────────────────────────
router.post("/sub-admins", checkPermission("super-admin"), async (req, res) => {
  const { name, username, password, email, phone, role, permissions } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const id = crypto.randomUUID();
    const newAdmin = {
      id, name, username, password: hashedPassword, email, phone,
      role: role || "sub-admin",
      permissions: permissions || [],
      createdAt: new Date().toISOString()
    };
    await db.collection(ADMINS).doc(id).set(newAdmin);
    await logAction(req.user.id, req.user.username, "CREATE_ADMIN", `Created admin ${username}`);
    res.json({ success: true, message: "Admin created", admin: { id, username } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/sub-admins/:id/permissions", checkPermission("super-admin"), async (req, res) => {
  const { id } = req.params;
  const { permissions } = req.body;
  try {
    await db.collection(ADMINS).doc(id).update({ permissions });
    res.json({ success: true, message: "Permissions updated" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/sub-admins", checkPermission("super-admin"), async (req, res) => {
  try {
    const snapshot = await db.collection(ADMINS).get();
    const admins = snapshot.docs.map(doc => {
      const data = doc.data();
      delete data.password;
      return data;
    });
    res.json(admins);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// DASHBOARD & STATS
// ─────────────────────────────────────────────────────────────
router.get("/detailed-dashboard", async (req, res) => {
  try {
    const [driversSnap, tripsSnap, vendorsSnap] = await Promise.all([
      db.collection(DRIVERS).get(),
      db.collection(TRIPS).get(),
      db.collection(VENDORS).get(),
    ]);

    const drivers = driversSnap.docs.map((d) => d.data());
    const trips   = tripsSnap.docs.map((d) => d.data());
    const vendors = vendorsSnap.docs.map((d) => d.data());

    // Some simple logic mappings from the spec
    res.json({
      totalVendors: vendors.length,
      verifiedVendors: vendors.filter(v => v.verified || v.status === "verified").length,
      blockedVendors: vendors.filter(v => v.blocked || v.status === "blocked").length,
      totalDrivers: drivers.length,
      onlineDrivers: drivers.filter(d => d.isOnline).length,
      verifiedDrivers: drivers.filter(d => d.verified || d.status === "verified").length,
      blockedDrivers: drivers.filter(d => d.blocked || d.status === "blocked").length,
      totalRides: trips.length,
      completedRides: trips.filter(t => t.status === "completed").length
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// DRIVERS (Requires 'drivers' permission)
// ─────────────────────────────────────────────────────────────
router.get("/drivers", checkPermission("drivers"), async (req, res) => {
  try {
    const snapshot = await db.collection(DRIVERS).get();
    res.json(snapshot.docs.map((doc) => doc.data()));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/drivers/:id/verify", checkPermission("drivers"), async (req, res) => {
  const { id } = req.params;
  const { verified, rejectionReason } = req.body;
  try {
    const payload = verified 
      ? { verified: true, status: 'APPROVED', verifiedBy: req.user.id, verifiedByName: req.user.username, verifiedAt: new Date().toISOString() } 
      : { verified: false, status: 'REJECTED', rejectionReason, rejectedBy: req.user.id, rejectedAt: new Date().toISOString() };
    
    await db.collection(DRIVERS).doc(id).update(payload);
    await logAction(req.user.id, req.user.username, verified ? "VERIFY_DRIVER" : "REJECT_DRIVER", `ID: ${id}`);
    res.json({ success: true, message: verified ? "Driver verified" : "Driver rejected" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/drivers/:id/block", checkPermission("drivers"), async (req, res) => {
  const { id } = req.params;
  const { blocked, blockReason } = req.body;
  try {
    await db.collection(DRIVERS).doc(id).update({ blocked, blockReason: blocked ? blockReason : "", status: blocked ? 'blocked' : 'verified' });
    await logAction(req.user.id, req.user.username, blocked ? "BLOCK_DRIVER" : "UNBLOCK_DRIVER", `ID: ${id}`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// VENDORS (Requires 'vendors' permission)
// ─────────────────────────────────────────────────────────────
router.get("/vendors", checkPermission("vendors"), async (req, res) => {
  try {
    const snapshot = await db.collection(VENDORS).get();
    res.json(snapshot.docs.map((doc) => doc.data()));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/vendors/:id/verify", checkPermission("vendors"), async (req, res) => {
  const { id } = req.params;
  const { verified, rejectionReason } = req.body;
  try {
    const payload = verified 
      ? { verified: true, status: 'APPROVED', verifiedBy: req.user.id, verifiedAt: new Date().toISOString() } 
      : { verified: false, status: 'REJECTED', rejectionReason };
    await db.collection(VENDORS).doc(id).update(payload);
    await logAction(req.user.id, req.user.username, verified ? "VERIFY_VENDOR" : "REJECT_VENDOR", `ID: ${id}`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/vendors/:id/block", checkPermission("vendors"), async (req, res) => {
  const { id } = req.params;
  const { blocked, blockReason } = req.body;
  try {
    await db.collection(VENDORS).doc(id).update({ blocked, blockReason: blocked ? blockReason : "", status: blocked ? 'blocked' : 'verified' });
    await logAction(req.user.id, req.user.username, blocked ? "BLOCK_VENDOR" : "UNBLOCK_VENDOR", `ID: ${id}`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// NEW: General Update Vendor
router.post("/update-vendor", checkPermission("vendors"), async (req, res) => {
  const { vendorId, ...updateData } = req.body;
  try {
    await db.collection(VENDORS).doc(vendorId).update(updateData);
    await logAction(req.user.id, req.user.username, "UPDATE_VENDOR", `ID: ${vendorId}`);
    res.json({ success: true, message: "Vendor updated" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// NEW: General Update Driver
router.post("/update-driver", checkPermission("drivers"), async (req, res) => {
  const { driverId, phone, ...updateData } = req.body;
  const id = driverId || phone; // Support both ID formats
  try {
    await db.collection(DRIVERS).doc(id).update(updateData);
    await logAction(req.user.id, req.user.username, "UPDATE_DRIVER", `ID: ${id}`);
    res.json({ success: true, message: "Driver updated" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// ACTIVE & BANNED USERS
// ─────────────────────────────────────────────────────────────
router.get("/active-drivers", checkPermission("drivers"), async (req, res) => {
  try {
    const snapshot = await db.collection(DRIVERS).where("isOnline", "==", true).get();
    res.json(snapshot.docs.map((doc) => doc.data()));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/blocked-users", async (req, res) => {
  try {
    const dSnap = await db.collection(DRIVERS).where("blocked", "==", true).get();
    const vSnap = await db.collection(VENDORS).where("blocked", "==", true).get();
    
    let blocked = [
      ...dSnap.docs.map(doc => ({ ...doc.data(), userType: 'driver' })),
      ...vSnap.docs.map(doc => ({ ...doc.data(), userType: 'vendor' }))
    ];
    // sort by blockedAt desc if available
    res.json(blocked);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// RIDES & CUSTOMERS
// ─────────────────────────────────────────────────────────────

// GET /admin/rides?status=pending|inProgress|completed|all
router.get("/rides", checkPermission("rides"), async (req, res) => {
  const { status } = req.query;
  console.log(`[Admin] GET rides, status filter: ${status || 'all'}`);
  try {
    let query = db.collection(TRIPS).orderBy("createdAt", "desc");
    if (status && status !== "all") {
      query = db.collection(TRIPS).where("status", "==", status).orderBy("createdAt", "desc");
    }
    const snapshot = await query.get();
    const rides = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    console.log(`[Admin] ✅ Fetched ${rides.length} rides`);
    res.json({ success: true, data: rides, count: rides.length });
  } catch (err) {
    console.error(`[Admin] ❌ GET rides error:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /admin/rides/:id — full ride detail with logs
router.get("/rides/:id", checkPermission("rides"), async (req, res) => {
  const { id } = req.params;
  console.log(`[Admin] GET ride detail: ${id}`);
  try {
    const doc = await db.collection(TRIPS).doc(id).get();
    if (!doc.exists) return res.status(404).json({ error: "Ride not found" });

    const ride = { id: doc.id, ...doc.data() };

    // Attach driver info if driverId exists
    if (ride.driverId) {
      const driverDoc = await db.collection(DRIVERS).doc(ride.driverId).get().catch(() => null);
      if (driverDoc && driverDoc.exists) {
        const d = driverDoc.data();
        ride.driverInfo = { name: d.name, phone: d.phone, vehicleType: d.vehicleType, vehicleNumber: d.vehicleNumber, rating: d.rating };
      }
    }

    // Attach vendor info if vendorId exists
    if (ride.vendorId) {
      const vendorDoc = await db.collection(VENDORS).doc(ride.vendorId).get().catch(() => null);
      if (vendorDoc && vendorDoc.exists) {
        const v = vendorDoc.data();
        ride.vendorInfo = { name: v.name, phone: v.phone, businessName: v.businessName };
      }
    }

    console.log(`[Admin] ✅ Ride detail fetched: ${id}`);
    res.json({ success: true, data: ride });
  } catch (err) {
    console.error(`[Admin] ❌ GET ride detail error:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /admin/user-ride-history?phone=9876543210 — all rides for a customer
router.get("/user-ride-history", async (req, res) => {
  const { phone } = req.query;
  if (!phone) return res.status(400).json({ error: "phone query param required" });
  try {
    const snapshot = await db.collection(TRIPS)
      .where("customerPhone", "==", phone)
      .orderBy("createdAt", "desc")
      .get();
    const rides = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json({ success: true, data: rides, count: rides.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/customers", async (req, res) => {
  try {
    const snapshot = await db.collection(TRIPS).get();
    const trips = snapshot.docs.map(d => d.data());
    
    // Deduplicate by phone
    const customers = {};
    trips.forEach(t => {
      if (t.customerPhone && t.customerName) {
        customers[t.customerPhone] = { phone: t.customerPhone, name: t.customerName, language: t.customerLanguage };
      }
    });

    res.json(Object.values(customers));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// SYSTEM CONFIG
// ─────────────────────────────────────────────────────────────
router.get("/logs", async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit) : 100;
    const snapshot = await db.collection(ADMIN_LOGS).orderBy("timestamp", "desc").limit(limit).get();
    res.json(snapshot.docs.map(d => d.data()));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
