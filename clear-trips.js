require("dotenv").config();
const { db } = require("./src/config/firebaseConfig");

async function deleteCollection(collectionPath, batchSize = 100) {
    const collectionRef = db.collection(collectionPath);
    const query = collectionRef.orderBy("__name__").limit(batchSize);

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

async function clearTrips() {
    console.log("🧹 Clearing ONLY the Trips collection...");
    try {
        await deleteCollection("Trips");
        await deleteCollection("Bookings");
        console.log("✅ Trips and Bookings cleared!");
    } catch (error) {
        console.error("❌ Error clearing data:", error);
    }
    process.exit();
}

clearTrips();
