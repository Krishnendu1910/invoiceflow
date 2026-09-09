const dotenv = require("dotenv");

dotenv.config({ quiet: true });

const REQUIRED_ENV_VARS = ["PORT", "MONGODB_URI", "CLIENT_URL", "JWT_ACCESS_SECRET"];
const ALLOWED_EMAIL_MODES = ["development", "resend"];

const rawEmailMode = (process.env.EMAIL_MODE || "").trim().toLowerCase();
const isProd = process.env.NODE_ENV === "production";
// Default to "resend" in production; default to "development" in local development and testing
const emailMode = rawEmailMode || (isProd ? "resend" : "development");

function validateEnv() {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key] || process.env[key].trim() === "");

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(", ")}. Check your .env file against .env.example.`
    );
  }

  if (rawEmailMode && !ALLOWED_EMAIL_MODES.includes(rawEmailMode)) {
    throw new Error(
      `Invalid EMAIL_MODE: "${process.env.EMAIL_MODE}". Allowed values are "development" or "resend".`
    );
  }

  if (process.env.NODE_ENV === "production") {
    if (rawEmailMode === "development") {
      throw new Error("EMAIL_MODE cannot be set to 'development' in production.");
    }
    if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
      throw new Error("RESEND_API_KEY and EMAIL_FROM are required in production.");
    }
  }
}

validateEnv();

const isGoogleConfigured = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_CALLBACK_URL
);

const isEmailConfigured = Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  isProduction: isProd,
  isTest: process.env.NODE_ENV === "test",
  port: process.env.PORT,
  mongodbUri: process.env.MONGODB_URI,
  clientUrl: process.env.CLIENT_URL,

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
  },

  refreshToken: {
    ttlDays: Number(process.env.REFRESH_TOKEN_TTL_DAYS || 30),
  },

  cookie: {
    domain: process.env.COOKIE_DOMAIN || undefined,
  },

  tokens: {
    emailVerificationTtlHours: Number(process.env.EMAIL_VERIFICATION_TTL_HOURS || 24),
    passwordResetTtlMinutes: Number(process.env.PASSWORD_RESET_TTL_MINUTES || 60),
  },

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    callbackUrl: process.env.GOOGLE_CALLBACK_URL || "",
    isConfigured: isGoogleConfigured,
  },

  email: {
    mode: emailMode,
    resendApiKey: process.env.RESEND_API_KEY || "",
    from: process.env.EMAIL_FROM || "",
    isConfigured: isEmailConfigured,
  },
};

module.exports = env;
