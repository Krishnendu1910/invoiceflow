const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const businessService = require("../services/business.service");

const list = asyncHandler(async (req, res) => {
  const businesses = await businessService.listOwnedBusinesses(req.user._id);
  return sendSuccess(res, { data: { businesses } });
});

const create = asyncHandler(async (req, res) => {
  const business = await businessService.createBusiness(req.user._id, req.body);
  return sendSuccess(res, {
    statusCode: 201,
    message: "Business created.",
    data: { business },
  });
});

const getById = asyncHandler(async (req, res) => {
  const business = await businessService.getOwnedBusinessOrThrow(req.user._id, req.params.id);
  return sendSuccess(res, { data: { business: businessService.toPublicBusiness(business) } });
});

module.exports = { list, create, getById };
