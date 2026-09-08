const Customer = require("../models/Customer");
const ApiError = require("../utils/ApiError");
const escapeRegex = require("../utils/escapeRegex");
const { buildSort, buildPagination } = require("../utils/listQuery");
const businessService = require("../services/business.service");

function toPublicCustomer(customer) {
  return {
    id: customer._id.toString(),
    businessId: customer.businessId.toString(),
    type: customer.type,
    name: customer.name,
    companyName: customer.companyName || "",
    email: customer.email || "",
    phone: customer.phone || "",
    tax: {
      gstRegistered: customer.tax?.gstRegistered || false,
      gstin: customer.tax?.gstin || "",
      pan: customer.tax?.pan || "",
    },
    billingAddress: customer.billingAddress || null,
    shippingAddress: customer.shippingAddress || null,
    tags: customer.tags || [],
    notes: customer.notes || "",
    status: customer.status,
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt,
  };
}

async function listCustomers(businessId, query) {
  const filter = { businessId };

  if (query.status !== "all") {
    filter.status = query.status;
  }

  if (query.type) {
    filter.type = query.type;
  }

  if (query.search) {
    const pattern = new RegExp(escapeRegex(query.search), "i");
    filter.$or = [{ name: pattern }, { companyName: pattern }, { email: pattern }, { phone: pattern }];
  }

  const { skip, limit } = buildPagination(query.page, query.limit);
  const sort = buildSort(query.sort);

  const [customers, total] = await Promise.all([
    Customer.find(filter).sort(sort).skip(skip).limit(limit),
    Customer.countDocuments(filter),
  ]);

  return {
    customers: customers.map(toPublicCustomer),
    pagination: { page: query.page, limit: query.limit, total, pages: Math.ceil(total / query.limit) },
  };
}

async function createCustomer(businessId, data) {
  const customer = await Customer.create({ ...data, businessId });
  return toPublicCustomer(customer);
}

// Loads a customer by id and verifies the authenticated user owns the
// business it belongs to — never trusts the id alone, and never trusts a
// client-supplied businessId for this check.
async function getOwnedCustomerOrThrow(userId, customerId) {
  const customer = await Customer.findById(customerId);

  if (!customer) {
    throw new ApiError(404, "Customer not found.");
  }

  await businessService.getOwnedBusinessOrThrow(userId, customer.businessId);

  return customer;
}

async function updateCustomer(customer, data) {
  Object.assign(customer, data);
  await customer.save();
  return toPublicCustomer(customer);
}

async function archiveCustomer(customer) {
  customer.status = "archived";
  await customer.save();
  return toPublicCustomer(customer);
}

async function restoreCustomer(customer) {
  customer.status = "active";
  await customer.save();
  return toPublicCustomer(customer);
}

module.exports = {
  listCustomers,
  createCustomer,
  getOwnedCustomerOrThrow,
  updateCustomer,
  archiveCustomer,
  restoreCustomer,
  toPublicCustomer,
};
