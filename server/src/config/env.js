const dotenv = require("dotenv");

dotenv.config({ quiet: true });

const REQUIRED_ENV_VARS = ["PORT", "MONGODB_URI", "CLIENT_URL", "JWT_ACCESS_SECRET"];

function validateEnv() {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key] || process.env[key].trim() === "");

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(", ")}. Check your .env file against .env.example.`
    );
  }
}

validateEnv();

const isGoogleConfigured = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_CALLBACK_URL
);

const isEmailConfigured = Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  isProduction: process.env.NODE_ENV === "production",
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
    resendApiKey: process.env.RESEND_API_KEY || "",
    from: process.env.EMAIL_FROM || "",
    isConfigured: isEmailConfigured,
  },
};

module.exports = env;
