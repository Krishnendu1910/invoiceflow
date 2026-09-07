const User = require("../models/User");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const tokenService = require("../services/token.service");

function extractBearerToken(req) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return null;
  }

  return token;
}

// Verifies the JWT access token and attaches the authenticated user to
// req.user. Never trust a user ID supplied by the client (body/params/query)
// for ownership decisions — only this middleware's req.user is trustworthy.
const authenticate = asyncHandler(async (req, res, next) => {
  const token = extractBearerToken(req);

  if (!token) {
    throw new ApiError(401, "Authentication required.");
  }

  let payload;
  try {
    payload = tokenService.verifyAccessToken(token);
  } catch {
    throw new ApiError(401, "Invalid or expired access token.");
  }

  // +passwordHash: not exposed to the client, but toPublicUser() needs it
  // to report the accurate `hasPassword` flag (field is select:false by default).
  const user = await User.findById(payload.sub).select("+passwordHash");

  if (!user) {
    throw new ApiError(401, "Invalid or expired access token.");
  }

  req.user = user;
  next();
});

// Applied after authenticate on routes that require a verified email.
function requireVerified(req, res, next) {
  if (!req.user.isEmailVerified) {
    throw new ApiError(403, "Please verify your email address to continue.");
  }
  next();
}

module.exports = { authenticate, requireVerified };
