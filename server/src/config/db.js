const mongoose = require("mongoose");
const env = require("./env");

let isConnecting = false;

async function connectDB() {
  if (mongoose.connection.readyState === 1 || isConnecting) {
    return mongoose.connection;
  }

  isConnecting = true;

  try {
    await mongoose.connect(env.mongodbUri);
    console.log("MongoDB connected successfully");
    return mongoose.connection;
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    throw error;
  } finally {
    isConnecting = false;
  }
}

async function disconnectDB() {
  if (mongoose.connection.readyState === 0) {
    return;
  }

  await mongoose.connection.close();
  console.log("MongoDB connection closed");
}

function getDbState() {
  const stateNames = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting",
  };

  return stateNames[mongoose.connection.readyState] || "unknown";
}

module.exports = { connectDB, disconnectDB, getDbState };
