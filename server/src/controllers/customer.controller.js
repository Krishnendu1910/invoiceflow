const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const customerService = require("../services/customer.service");

const list = asyncHandler(async (req, res) => {
  const { customers, pagination } = await customerService.listCustomers(req.businessId, req.query);
  return sendSuccess(res, { data: { customers, pagination } });
});

const create = asyncHandler(async (req, res) => {
  const customer = await customerService.createCustomer(req.businessId, req.body);
  return sendSuccess(res, { statusCode: 201, message: "Customer created.", data: { customer } });
});

const getById = asyncHandler(async (req, res) => {
  const customer = await customerService.getOwnedCustomerOrThrow(req.user._id, req.params.id);
  return sendSuccess(res, { data: { customer: customerService.toPublicCustomer(customer) } });
});

const update = asyncHandler(async (req, res) => {
  const customer = await customerService.getOwnedCustomerOrThrow(req.user._id, req.params.id);
  const updated = await customerService.updateCustomer(customer, req.body);
  return sendSuccess(res, { message: "Customer updated.", data: { customer: updated } });
});

const archive = asyncHandler(async (req, res) => {
  const customer = await customerService.getOwnedCustomerOrThrow(req.user._id, req.params.id);
  const archived = await customerService.archiveCustomer(customer);
  return sendSuccess(res, { message: "Customer archived.", data: { customer: archived } });
});

const restore = asyncHandler(async (req, res) => {
  const customer = await customerService.getOwnedCustomerOrThrow(req.user._id, req.params.id);
  const restored = await customerService.restoreCustomer(customer);
  return sendSuccess(res, { message: "Customer restored.", data: { customer: restored } });
});

module.exports = { list, create, getById, update, archive, restore };
