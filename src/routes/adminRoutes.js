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
      createdAt: item.createdAt?.S
    }));
    
    res.json(drivers);
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

module.exports = router;
