require("dotenv").config();
const { db } = require("./src/config/firebaseConfig");

async function deleteCollection(collectionPath) {
    const collectionRef = db.collection(collectionPath);
    const query = collectionRef.orderBy('__name__').limit(500);

    return new Promise((resolve, reject) => {
        deleteQueryBatch(db, query, resolve).catch(reject);
    });
}

async function deleteQueryBatch(db, query, resolve) {
    const snapshot = await query.get();

    const batchSize = snapshot.size;
    if (batchSize === 0) {
        resolve();
        return;
    }

    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
    });
    await batch.commit();

    process.nextTick(() => {
        deleteQueryBatch(db, query, resolve);
    });
}

const collections = ["Drivers", "Vendors", "Trips", "AdminLogs", "Bookings", "_health"];

async function wipe() {
    console.log("🧹 Starting database wipe...");
    for (const col of collections) {
        try {
            await deleteCollection(col);
            console.log(`✅ Cleared collection: ${col}`);
        } catch (err) {
            console.error(`❌ Failed to clear ${col}:`, err.message);
        }
    }
    console.log("✨ Database is now fresh and clean!");
    process.exit(0);
}

wipe();
