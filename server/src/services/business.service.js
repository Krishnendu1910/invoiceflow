const Business = require("../models/Business");
const User = require("../models/User");
const ApiError = require("../utils/ApiError");

function toPublicBusiness(business) {
  return {
    id: business._id.toString(),
    ownerId: business.ownerId.toString(),
    name: business.name,
    type: business.type,
    country: business.country,
    currency: business.currency,
    createdAt: business.createdAt,
  };
}

async function listOwnedBusinesses(userId) {
  const businesses = await Business.find({ ownerId: userId, isDeleted: false }).sort({ createdAt: 1 });
  return businesses.map(toPublicBusiness);
}

async function createBusiness(userId, data) {
  const business = await Business.create({ ownerId: userId, ...data });

  // The first business a user creates becomes their default/active business.
  const user = await User.findById(userId);
  if (!user.lastActiveBusiness) {
    user.lastActiveBusiness = business._id;
    await user.save();
  }

  return toPublicBusiness(business);
}

// Loads a business and verifies the authenticated user owns it. Never trust
// a business ID's ownership based on client-supplied data alone.
async function getOwnedBusinessOrThrow(userId, businessId) {
  const business = await Business.findOne({ _id: businessId, isDeleted: false });

  if (!business) {
    throw new ApiError(404, "Business not found.");
  }

  if (business.ownerId.toString() !== userId.toString()) {
    throw new ApiError(403, "You do not have access to this business.");
  }

  return business;
}

module.exports = { listOwnedBusinesses, createBusiness, getOwnedBusinessOrThrow, toPublicBusiness };
