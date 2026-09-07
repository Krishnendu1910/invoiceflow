const dotenv = require("dotenv");

dotenv.config();

const REQUIRED_ENV_VARS = ["PORT", "MONGODB_URI", "CLIENT_URL"];

function validateEnv() {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key] || process.env[key].trim() === "");

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(", ")}. Check your .env file against .env.example.`
    );
  }
}

validateEnv();

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  isProduction: process.env.NODE_ENV === "production",
  port: process.env.PORT,
  mongodbUri: process.env.MONGODB_URI,
  clientUrl: process.env.CLIENT_URL,
};

module.exports = env;
