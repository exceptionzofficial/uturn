const { s3Client, dynamoClient, snsClient } = require("../config/awsConfig");
const multer = require("multer");
const multerS3 = require("multer-s3");
require("dotenv").config();

// Temporary in-memory OTP storage
const otps = {};

// S3 Upload configuration for Multiple Files
const upload = multer({
  storage: multerS3({
    s3: s3Client,
    bucket: process.env.S3_BUCKET_NAME,
    metadata: function (req, file, cb) {
      cb(null, { fieldName: file.fieldname });
    },
    key: function (req, file, cb) {
      const folder = file.fieldname === 'profilePicture' ? 'profile' : 'docs';
      const fileName = `vendors/${folder}/${Date.now().toString()}-${file.originalname}`;
      cb(null, fileName);
    }
  })
}).fields([
  { name: 'profilePicture', maxCount: 1 },
  { name: 'aadharImage', maxCount: 1 }
]);


// 0. Check Vendor Status
router.post("/check-status", async (req, res) => {
  const { phone } = req.body;
  
  try {
    const params = {
      TableName: process.env.DYNAMODB_TABLE_VENDORS || "Vendors",
      Key: {
        vendorId: { S: phone }
      }
    };
    
    const { Item } = await dynamoClient.send(new GetItemCommand(params));
    
    if (Item) {
      res.json({ 
        exists: true, 
        status: Item.status?.S || "PENDING_REVIEW",
        message: Item.status?.S === "PENDING_REVIEW" ? "Your application is under review." : "Existing vendor found."
      });
    } else {
      res.json({ exists: false, status: "NOT_FOUND" });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 0.1 Send OTP
router.post("/send-otp", async (req, res) => {
  const { phone, appHash } = req.body;
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  
  console.log(`[VENDOR OTP] Generated for ${phone}: ${otp}`);

  const message = `<#> Your U-Turn OTP is ${otp}.\n${appHash || ""}`;
  
  try {
    otps[phone] = otp;
    const { PublishCommand } = require("@aws-sdk/client-sns");
    const { snsClient } = require("../config/awsConfig");
    
    await snsClient.send(new PublishCommand({
      Message: message,
      PhoneNumber: `+91${phone}`
    }));
    res.json({ success: true, message: "OTP sent successfully." });
  } catch (err) {
    console.error("SNS Error:", err);
    // Fallback for development if SNS not configured
    res.json({ success: true, message: "OTP generated (Dev Mode).", devOtp: otp });
  }
});

// 0.2 Verify OTP
router.post("/verify-otp", async (req, res) => {
  const { phone, otp } = req.body;
  
  if (otps[phone] && otps[phone] === otp) {
    delete otps[phone];
    res.json({ success: true, message: "OTP verified successfully." });
  } else {
    res.status(400).json({ success: false, message: "Invalid OTP." });
  }
});

// 0.3 Register Vendor
router.post("/register", upload, async (req, res) => {
  try {
    const vendorData = JSON.parse(req.body.vendorData);
    const files = req.files;

    const params = {
      TableName: process.env.DYNAMODB_TABLE_VENDORS || "Vendors",
      Item: {
        vendorId: { S: vendorData.phone },
        name: { S: vendorData.name },
        dob: { S: vendorData.dob || "" },
        businessName: { S: vendorData.businessName || "" },
        gstNumber: { S: vendorData.gstNumber || "" },
        state: { S: vendorData.state || "" },
        address: { S: vendorData.address || "" },
        status: { S: "PENDING_REVIEW" },
        createdAt: { S: new Date().toISOString() },
        // File paths from S3
        aadharImage: { S: files.aadharImage ? files.aadharImage[0].location : "" },
        profilePicture: { S: files.profilePicture ? files.profilePicture[0].location : "" }
      }
    };

    await dynamoClient.send(new PutItemCommand(params));
    res.json({ success: true, message: "Vendor registered successfully. Awaiting review." });
  } catch (err) {
    console.error("Registration Error:", err);
    res.status(500).json({ error: err.message });
  }
});

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
