// ============================================================
// Firebase Firestore - Database Setup Script
// This creates all 5 collections (tables) with example 
// documents showing the EXACT same fields as your DynamoDB tables.
// 
// RUN THIS ONCE to initialize:
//   node src/scripts/setupFirebaseCollections.js
// ============================================================

require("dotenv").config();
const { db } = require("../config/firebaseConfig");

async function setupCollections() {
  console.log("🚀 Setting up Firebase Firestore collections for U-Turn...\n");

  // ============================================================
  // COLLECTION 1: Drivers
  // Primary Key: driverId (phone number)
  // ============================================================
  console.log("📁 Creating 'Drivers' collection...");
  await db.collection("Drivers").doc("_schema_info").set({
    _description: "Driver registration data for U-Turn platform",
    _primaryKey: "driverId (phone number)",
    // --- All column definitions ---
    driverId: "string - Phone number used as unique ID",
    name: "string - Driver full name",
    phone: "string - Phone number",
    aadhar: "string - Aadhaar number",
    dob: "string - Date of birth (YYYY-MM-DD)",
    state: "string - State of residence",
    licenceNumber: "string - Driving licence number",
    licenceExpiry: "string - Licence expiry date (YYYY-MM-DD)",
    vehicleNumber: "string - Vehicle plate number",
    vehicleType: "string - Type: Car / Auto / Bike etc",
    status: "string - PENDING_REVIEW | APPROVED | REJECTED",
    profilePhoto: "string - URL to profile photo",
    aadhaarFront: "string - URL to Aadhaar front image",
    dlFront: "string - URL to Driving Licence front image",
    dlBack: "string - URL to Driving Licence back image",
    rcFront: "string - URL to RC (Registration Certificate) image",
    insuranceFront: "string - URL to Insurance document image",
    fcFront: "string - URL to Fitness Certificate image",
    permitFront: "string - URL to Permit document image",
    createdAt: "string - ISO 8601 timestamp (e.g. 2024-01-01T00:00:00.000Z)",
  });
  console.log("   ✅ Drivers schema created.\n");

  // ============================================================
  // COLLECTION 2: Vendors
  // Primary Key: vendorId (phone number)
  // ============================================================
  console.log("📁 Creating 'Vendors' collection...");
  await db.collection("Vendors").doc("_schema_info").set({
    _description: "Vendor (travel agency/operator) registration data",
    _primaryKey: "vendorId (phone number)",
    // --- All column definitions ---
    vendorId: "string - Phone number used as unique ID",
    name: "string - Owner full name",
    dob: "string - Date of birth (YYYY-MM-DD)",
    businessName: "string - Travel company or agency name",
    gstNumber: "string - GST registration number",
    state: "string - State of business",
    address: "string - Business address",
    status: "string - PENDING_REVIEW | APPROVED | REJECTED",
    aadharImage: "string - URL to Aadhaar image",
    profilePicture: "string - URL to profile picture",
    createdAt: "string - ISO 8601 timestamp",
  });
  console.log("   ✅ Vendors schema created.\n");

  // ============================================================
  // COLLECTION 3: Trips
  // Primary Key: tripId (auto-generated)
  // ============================================================
  console.log("📁 Creating 'Trips' collection...");
  await db.collection("Trips").doc("_schema_info").set({
    _description: "Trip booking records created by vendors",
    _primaryKey: "tripId (auto-generated: TRIP-timestamp-random)",
    // --- All column definitions ---
    tripId: "string - Auto-generated unique trip ID",
    vendorId: "string - Reference to vendor who created the trip",
    customerName: "string - Customer full name",
    customerPhone: "string - Customer phone number",
    customerLanguage: "string - Preferred language (e.g. Tamil)",
    category: "string - Trip category: Passenger | Goods",
    numberOfPeople: "number - Number of passengers",
    loadCapacity: "string - Load capacity for goods trips",
    pickup: "string - Pickup location name/address",
    drop: "string - Drop location name/address",
    pickupCoords: "map - {latitude: number, longitude: number}",
    dropCoords: "map - {latitude: number, longitude: number}",
    tripType: "string - One Way | Round Trip | Rental",
    rentalType: "string - Rental package type",
    vehicle: "string - Vehicle type: Sedan | SUV | Tempo etc",
    scheduledDate: "string - Date of trip (YYYY-MM-DD)",
    scheduledTime: "string - Time of trip (HH:MM)",
    returnDate: "string - Return date for round trips",
    returnTime: "string - Return time for round trips",
    baseFare: "number - Base fare amount (INR)",
    perKmRate: "number - Per kilometer rate (INR)",
    waitingCharge: "number - Waiting charge (INR)",
    driverBata: "number - Driver daily allowance (INR)",
    nightAllowance: "number - Night surcharge (INR)",
    hillsAllowance: "number - Hills/terrain surcharge (INR)",
    commission: "number - Platform commission (INR)",
    totalTripAmount: "number - Total fare amount (INR)",
    driverPayout: "number - Amount paid to driver (INR)",
    paymentMode: "string - pay_driver | pay_vendor | online",
    status: "string - PENDING | ACCEPTED | COMPLETED | CANCELLED",
    createdAt: "string - ISO 8601 timestamp",
  });
  console.log("   ✅ Trips schema created.\n");

  // ============================================================
  // COLLECTION 4: DriverDocuments
  // Reserved for future use
  // ============================================================
  console.log("📁 Creating 'DriverDocuments' collection...");
  await db.collection("DriverDocuments").doc("_schema_info").set({
    _description: "Reserved for extended driver document storage",
    _primaryKey: "documentId",
    documentId: "string - Unique document ID",
    driverId: "string - Reference to driver",
    documentType: "string - Type of document",
    documentUrl: "string - URL to document",
    uploadedAt: "string - ISO 8601 timestamp",
  });
  console.log("   ✅ DriverDocuments schema created.\n");

  // ============================================================
  // COLLECTION 5: DriverLogs
  // Reserved for future use
  // ============================================================
  console.log("📁 Creating 'DriverLogs' collection...");
  await db.collection("DriverLogs").doc("_schema_info").set({
    _description: "Driver activity/audit logs",
    _primaryKey: "logId",
    logId: "string - Unique log entry ID",
    driverId: "string - Reference to driver",
    action: "string - Action type (LOGIN, TRIP_ACCEPT, etc)",
    tripId: "string - Reference to trip if applicable",
    timestamp: "string - ISO 8601 timestamp",
    metadata: "map - Additional log data",
  });
  console.log("   ✅ DriverLogs schema created.\n");

  console.log("============================================================");
  console.log("✅ ALL 5 COLLECTIONS CREATED SUCCESSFULLY!");
  console.log("============================================================");
  console.log("\n📋 Collections created:");
  console.log("   1. Drivers       (Primary Key: driverId)");
  console.log("   2. Vendors       (Primary Key: vendorId)");
  console.log("   3. Trips         (Primary Key: tripId)");
  console.log("   4. DriverDocuments (Primary Key: documentId)");
  console.log("   5. DriverLogs    (Primary Key: logId)");
  console.log("\n🔗 View your database at: https://console.firebase.google.com");
  console.log("   -> Select your project -> Firestore Database\n");
}

setupCollections().catch((err) => {
  console.error("❌ Error setting up collections:", err);
  process.exit(1);
});
