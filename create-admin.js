require("dotenv").config();
const { db } = require("./src/config/firebaseConfig");
const bcrypt = require("bcrypt");
const crypto = require("crypto");

async function createSuperAdmin() {
  try {
    const password = await bcrypt.hash("admin123", 10);
    const id = crypto.randomUUID();
    
    await db.collection("Admins").doc(id).set({
      id,
      name: "System Admin",
      username: "admin",
      password,
      role: "super-admin",
      permissions: [],
      createdAt: new Date().toISOString()
    });
    console.log("✅ Super Admin created: admin / admin123");
    process.exit(0);
  } catch (err) {
    console.error("❌ Failed to create admin:", err);
    process.exit(1);
  }
}

createSuperAdmin();
