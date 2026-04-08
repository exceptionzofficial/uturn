const express = require("express");
const router = express.Router();
const { 
  PutItemCommand, 
  ScanCommand, 
  GetItemCommand,
  QueryCommand
} = require("@aws-sdk/client-dynamodb");
const { dynamoClient } = require("../config/awsConfig");
require("dotenv").config();

// 1. Create a New Trip
router.post("/create-trip", async (req, res) => {
  const tripData = req.body;
  const tripId = `TRIP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  try {
    const params = {
      TableName: process.env.DYNAMODB_TABLE_TRIPS,
      Item: {
        tripId: { S: tripId },
        vendorId: { S: tripData.vendorId || "SYSTEM_VENDOR" },
        customerName: { S: tripData.customerName || "" },
        customerPhone: { S: tripData.customerPhone || "" },
        customerLanguage: { S: tripData.customerLanguage || "Tamil" },
        category: { S: tripData.category || "Passenger" },
        numberOfPeople: { N: (tripData.numberOfPeople || 1).toString() },
        loadCapacity: { S: tripData.loadCapacity || "" },
        pickup: { S: tripData.pickup || "" },
        drop: { S: tripData.drop || "" },
        pickupCoords: { 
          M: {
            latitude: { N: (tripData.pickupCoords?.latitude || 0).toString() },
            longitude: { N: (tripData.pickupCoords?.longitude || 0).toString() }
          }
        },
        dropCoords: { 
          M: {
            latitude: { N: (tripData.dropCoords?.latitude || 0).toString() },
            longitude: { N: (tripData.dropCoords?.longitude || 0).toString() }
          }
        },
        tripType: { S: tripData.tripType || "One Way" },
        rentalType: { S: tripData.rentalType || "" },
        vehicle: { S: tripData.vehicle || "Sedan" },
        scheduledDate: { S: tripData.scheduledDate || "" },
        scheduledTime: { S: tripData.scheduledTime || "" },
        returnDate: { S: tripData.returnDate || "" },
        returnTime: { S: tripData.returnTime || "" },
        baseFare: { N: (tripData.baseFare || 0).toString() },
        perKmRate: { N: (tripData.perKmRate || 0).toString() },
        waitingCharge: { N: (tripData.waitingCharge || 0).toString() },
        driverBata: { N: (tripData.driverBata || 0).toString() },
        nightAllowance: { N: (tripData.nightAllowance || 0).toString() },
        hillsAllowance: { N: (tripData.hillsAllowance || 0).toString() },
        commission: { N: (tripData.commission || 0).toString() },
        totalTripAmount: { N: (tripData.totalTripAmount || 0).toString() },
        driverPayout: { N: (tripData.driverPayout || 0).toString() },
        paymentMode: { S: tripData.paymentMode || "pay_driver" },
        status: { S: "PENDING" }, // Default status
        createdAt: { S: new Date().toISOString() }
      }
    };

    await dynamoClient.send(new PutItemCommand(params));
    res.json({ success: true, tripId, message: "Trip created successfully." });
  } catch (err) {
    console.error("Error creating trip:", err);
    res.status(500).json({ error: err.message });
  }
});

// 2. Get All Trips for a Vendor
router.get("/trips", async (req, res) => {
  const { vendorId } = req.query; // If identity is implemented

  try {
    const params = {
      TableName: process.env.DYNAMODB_TABLE_TRIPS,
      // If we want to filter by vendorId, we'd use QueryCommand with a GSI or ScanCommand
      // For now, let's just Scan for simplicity (GSI is better for production)
    };

    if (vendorId) {
      params.FilterExpression = "vendorId = :v";
      params.ExpressionAttributeValues = {
        ":v": { S: vendorId }
      };
    }

    const { Items } = await dynamoClient.send(new ScanCommand(params));
    
    const trips = Items.map(item => ({
      tripId: item.tripId?.S,
      customerName: item.customerName?.S,
      customerPhone: item.customerPhone?.S,
      pickup: item.pickup?.S,
      drop: item.drop?.S,
      status: item.status?.S,
      totalTripAmount: item.totalTripAmount?.N,
      createdAt: item.createdAt?.S,
      // Add more fields as needed for the UI
    }));

    res.json(trips);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Get Specific Trip Details
router.get("/trip/:tripId", async (req, res) => {
  const { tripId } = req.params;

  try {
    const params = {
      TableName: process.env.DYNAMODB_TABLE_TRIPS,
      Key: {
        tripId: { S: tripId }
      }
    };

    const { Item } = await dynamoClient.send(new GetItemCommand(params));
    
    if (!Item) {
      return res.status(404).json({ error: "Trip not found" });
    }

    // Unmarshal simple fields
    const trip = {};
    for (const key in Item) {
      if (Item[key].S) trip[key] = Item[key].S;
      else if (Item[key].N) trip[key] = Item[key].N;
      else if (Item[key].M) {
          // Handle simple map (like coords)
          trip[key] = {};
          for (const mKey in Item[key].M) {
              trip[key][mKey] = Item[key].M[mKey].N || Item[key].M[mKey].S;
          }
      }
    }

    res.json(trip);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
