// ============================================================
// Firebase Admin SDK Configuration
// Replaces AWS DynamoDB + SNS
// ============================================================
const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

console.log("[Firebase] Initializing Firebase Admin SDK...");

if (!getApps().length) {
  initializeApp({
    credential: cert({
      type: "service_account",
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID,
      auth_uri: "https://accounts.google.com/o/oauth2/auth",
      token_uri: "https://oauth2.googleapis.com/token",
    }),
  });
  console.log(`[Firebase] ✅ App initialized for project: ${process.env.FIREBASE_PROJECT_ID}`);
}

const db = getFirestore();

module.exports = { db };
