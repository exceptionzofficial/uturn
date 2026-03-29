const express = require("express");
const cors = require("cors");
const INITIALIZE_AWS = require("./src/utils/initializeAWS");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

const driverRoutes = require("./src/routes/driverRoutes");
const adminRoutes = require("./src/routes/adminRoutes");

app.use(cors());
app.use(express.json());

// Routes
app.use("/api/driver", driverRoutes);
app.use("/api/admin", adminRoutes);

// Basic Health Check
app.get("/", (req, res) => {
  res.send("U-Turn Backend is Running Successfully.");
});

// Start Server after AWS Initialization
const startServer = async () => {
  try {
    await INITIALIZE_AWS();
    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("Critical Error during startup:", err);
    process.exit(1);
  }
};

startServer();
