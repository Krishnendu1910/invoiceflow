const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const businessService = require("../services/business.service");
const { objectId } = require("../utils/validation/common");

// Resolves which Business a Customer/Item request applies to and verifies
// the authenticated user actually owns it, before any controller code runs.
// Reuses businessService.getOwnedBusinessOrThrow — the same ownership check
// already used by GET /api/businesses/:id — so there is one authorization
// path for "does this user own this business", not a second one.
//
// `source` says where the client supplies the businessId: "query" for list
// endpoints (GET /api/customers?businessId=...), "body" for create
// endpoints. Downstream code must read the verified id from req.businessId,
// never from req.query/req.body directly.
function requireBusinessAccess(source = "query") {
  return asyncHandler(async (req, res, next) => {
    const raw = source === "body" ? req.body?.businessId : req.query?.businessId;

    if (!raw || !objectId.safeParse(raw).success) {
      throw new ApiError(400, "A valid businessId is required.");
    }

    const business = await businessService.getOwnedBusinessOrThrow(req.user._id, raw);
    req.businessId = business._id;
    next();
  });
}

// Reads the business ID from req.params[paramName] (defaulting to "id") and
// verifies the authenticated user owns it. Used by Business Settings routes
// where the business ID is part of the URL path (e.g. /:id/settings/...).
// Attaches the full Business document to req.business so controllers can
// pass it directly to services without a second DB lookup.
function requireBusinessOwner(paramName = "id") {
  return asyncHandler(async (req, res, next) => {
    const raw = req.params?.[paramName];

    if (!raw || !objectId.safeParse(raw).success) {
      throw new ApiError(400, "A valid business ID is required.");
    }

    const business = await businessService.getOwnedBusinessOrThrow(req.user._id, raw);
    req.businessId = business._id;
    req.business = business;
    next();
  });
}

module.exports = { requireBusinessAccess, requireBusinessOwner };
