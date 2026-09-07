const rateLimit = require("express-rate-limit");
const env = require("../config/env");

// Disabled in tests so the auth test suite isn't rate-limited against itself;
// the rate limiting behavior itself is covered by a dedicated test that
// constructs the limiter directly with a small window.
const skip = () => env.isTest;

const standardHandler = (req, res) => {
  res.status(429).json({
    success: false,
    message: "Too many requests. Please try again later.",
  });
};

// Login: brute-force protection, keyed by IP.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  handler: standardHandler,
});

// Registration: slow down automated account creation.
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  handler: standardHandler,
});

// Forgot password / resend verification: prevent email-bombing a target address.
const emailActionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  handler: standardHandler,
});

// Reset password: token is already single-use, but still throttle guesses.
const resetPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  handler: standardHandler,
});

module.exports = {
  loginLimiter,
  registerLimiter,
  emailActionLimiter,
  resetPasswordLimiter,
};
