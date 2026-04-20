// ============================================================
// U-Turn Backend Server — Firebase Edition
// ============================================================
require("dotenv").config();
const express = require("express");
console.log(">>> [SERVER] LOADED AT", new Date().toISOString(), "V2.0");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("  U-Turn Backend — Starting up...");
console.log(`  Environment: ${process.env.NODE_ENV || "development"}`);
console.log(`  Port: ${PORT}`);
console.log(`  Firebase Project: ${process.env.FIREBASE_PROJECT_ID}`);
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

// Load Firebase — this also validates the credentials
const { db } = require("./src/config/firebaseConfig");

const driverRoutes = require("./src/routes/driverRoutes");
const adminRoutes  = require("./src/routes/adminRoutes");
const vendorRoutes = require("./src/routes/vendorRoutes");
const bookingRoutes = require("./src/routes/bookingRoutes");

app.use(cors());
app.use(express.json());

// ── Request Logger ─────────────────────────────────────────
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    const statusIcon = res.statusCode < 400 ? "✅" : "❌";
    console.log(
      `${statusIcon} [${new Date().toLocaleTimeString("en-IN")}] ${req.method} ${req.originalUrl} → ${res.statusCode} (${duration}ms)`
    );
  });
  next();
});

// ── Routes ─────────────────────────────────────────────────
app.use("/api/driver", driverRoutes);
app.use("/api/admin",  adminRoutes);
app.use("/api/vendor", vendorRoutes);
app.use("/api/bookings", bookingRoutes);

// ── Health Check ───────────────────────────────────────────
app.get("/", async (req, res) => {
  try {
    // Ping Firestore to confirm connectivity
    await db.collection("_health").doc("ping").set({ ts: new Date().toISOString() });
    res.json({
      status: "ok",
      message: "U-Turn Backend is running.",
      firebase: process.env.FIREBASE_PROJECT_ID,
      time: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[Health] ❌ Firestore ping failed:", err.message);
    res.status(500).json({ status: "error", message: err.message });
  }
});

// ── 404 Handler ────────────────────────────────────────────
app.use((req, res) => {
  console.warn(`[404] Route not found: ${req.method} ${req.url}`);
  res.status(404).json({ error: "Route not found" });
});

// ── Global Error Handler ───────────────────────────────────
app.use((err, req, res, next) => {
  console.error(`[ERROR] Unhandled error on ${req.method} ${req.url}:`, err.message);
  res.status(500).json({ error: "Internal server error" });
});

// ── Start ──────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 Server is live on http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/`);
  console.log(`   Driver API:   http://localhost:${PORT}/api/driver`);
  console.log(`   Vendor API:   http://localhost:${PORT}/api/vendor`);
  console.log(`   Admin API:    http://localhost:${PORT}/api/admin\n`);
});
