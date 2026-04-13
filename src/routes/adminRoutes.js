const express = require("express");
const router = express.Router();
const { 
  ScanCommand, 
  UpdateItemCommand 
} = require("@aws-sdk/client-dynamodb");
const { dynamoClient } = require("../config/awsConfig");
require("dotenv").config();

// 1. Get Pending Riders
router.get("/pending-drivers", async (req, res) => {
  try {
    const params = {
      TableName: process.env.DYNAMODB_TABLE_DRIVERS,
      FilterExpression: "#s = :p",
      ExpressionAttributeNames: {
        "#s": "status"
      },
      ExpressionAttributeValues: {
        ":p": { S: "PENDING_REVIEW" }
      }
    };
    
    const { Items } = await dynamoClient.send(new ScanCommand(params));
    
    // Convert DynamoDB items to regular JSON objects
    const drivers = Items.map(item => ({
      driverId: item.driverId?.S,
      name: item.name?.S,
      phone: item.phone?.S,
      aadhar: item.aadhar?.S,
      dob: item.dob?.S,
      state: item.state?.S,
      licenceNumber: item.licenceNumber?.S,
      licenceExpiry: item.licenceExpiry?.S,
      vehicleNumber: item.vehicleNumber?.S,
      vehicleType: item.vehicleType?.S,
      status: item.status?.S,
      profilePhoto: item.profilePhoto?.S,
      aadhaarFront: item.aadhaarFront?.S,
      dlFront: item.dlFront?.S,
      dlBack: item.dlBack?.S,
      rcFront: item.rcFront?.S,
      insuranceFront: item.insuranceFront?.S,
      fcFront: item.fcFront?.S,
      permitFront: item.permitFront?.S,
      createdAt: item.createdAt?.S
    }));
    
    res.json(drivers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 1.1 Get Pending Vendors
router.get("/pending-vendors", async (req, res) => {
  try {
    const params = {
      TableName: process.env.DYNAMODB_TABLE_VENDORS || "Vendors",
      FilterExpression: "#s = :p",
      ExpressionAttributeNames: {
        "#s": "status"
      },
      ExpressionAttributeValues: {
        ":p": { S: "PENDING_REVIEW" }
      }
    };
    
    const { Items } = await dynamoClient.send(new ScanCommand(params));
    
    const vendors = Items.map(item => ({
      vendorId: item.vendorId?.S,
      name: item.name?.S,
      dob: item.dob?.S,
      businessName: item.businessName?.S,
      gstNumber: item.gstNumber?.S,
      state: item.state?.S,
      address: item.address?.S,
      status: item.status?.S,
      aadharImage: item.aadharImage?.S,
      profilePicture: item.profilePicture?.S,
      createdAt: item.createdAt?.S
    }));
    
    res.json(vendors);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Update Driver Status (Approve/Reject)
router.post("/update-status", async (req, res) => {
  const { driverId, status } = req.body; // status: "APPROVED" or "REJECTED"
  
  try {
    const params = {
      TableName: process.env.DYNAMODB_TABLE_DRIVERS,
      Key: {
        driverId: { S: driverId }
      },
      UpdateExpression: "SET #s = :s",
      ExpressionAttributeNames: {
        "#s": "status"
      },
      ExpressionAttributeValues: {
        ":s": { S: status }
      }
    };
    
    await dynamoClient.send(new UpdateItemCommand(params));
    res.json({ success: true, message: `Driver status updated to ${status}.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2.1 Update Vendor Status (Approve/Reject)
router.post("/update-vendor-status", async (req, res) => {
  const { vendorId, status } = req.body; // status: "APPROVED" or "REJECTED"
  
  try {
    const params = {
      TableName: process.env.DYNAMODB_TABLE_VENDORS || "Vendors",
      Key: {
        vendorId: { S: vendorId }
      },
      UpdateExpression: "SET #s = :s",
      ExpressionAttributeNames: {
        "#s": "status"
      },
      ExpressionAttributeValues: {
        ":s": { S: status }
      }
    };
    
    await dynamoClient.send(new UpdateItemCommand(params));
    res.json({ success: true, message: `Vendor status updated to ${status}.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Get All Trips (System Wide)
router.get("/all-trips", async (req, res) => {
  try {
    const params = {
      TableName: process.env.DYNAMODB_TABLE_TRIPS
    };
    
    const { Items } = await dynamoClient.send(new ScanCommand(params));
    
    const trips = Items.map(item => {
      const trip = {};
      for (const key in item) {
        if (item[key].S) trip[key] = item[key].S;
        else if (item[key].N) trip[key] = item[key].N;
        else if (item[key].M) {
          trip[key] = {};
          for (const mKey in item[key].M) {
            trip[key][mKey] = item[key].M[mKey].N || item[key].M[mKey].S;
          }
        }
      }
      return trip;
    });
    
    res.json(trips);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Get System Stats
router.get("/stats", async (req, res) => {
  try {
    // For a small scale, we can Scan. For large scale, use GSI or metadata tables.
    const driverParams = { TableName: process.env.DYNAMODB_TABLE_DRIVERS };
    const tripParams = { TableName: process.env.DYNAMODB_TABLE_TRIPS };
    const vendorParams = { TableName: process.env.DYNAMODB_TABLE_VENDORS || "Vendors" };
    
    const [driversData, tripsData, vendorsData] = await Promise.all([
      dynamoClient.send(new ScanCommand(driverParams)),
      dynamoClient.send(new ScanCommand(tripParams)),
      dynamoClient.send(new ScanCommand(vendorParams))
    ]);
    
    const totalDrivers = driversData.Items.length;
    const pendingDrivers = driversData.Items.filter(i => i.status?.S === "PENDING_REVIEW").length;
    
    const totalVendors = vendorsData.Items.length;
    const pendingVendors = vendorsData.Items.filter(i => i.status?.S === "PENDING_REVIEW").length;

    const totalTrips = tripsData.Items.length;
    const pendingTrips = tripsData.Items.filter(i => i.status?.S === "PENDING").length;
    
    res.json({
      totalDrivers,
      pendingDrivers,
      totalVendors,
      pendingVendors,
      totalTrips,
      pendingTrips,
      activeTrips: tripsData.Items.filter(i => i.status?.S === "ACCEPTED").length
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
