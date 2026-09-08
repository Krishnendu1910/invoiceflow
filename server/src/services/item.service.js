const Item = require("../models/Item");
const ApiError = require("../utils/ApiError");
const escapeRegex = require("../utils/escapeRegex");
const { buildSort, buildPagination } = require("../utils/listQuery");
const businessService = require("../services/business.service");

const DUPLICATE_KEY = 11000;
const DUPLICATE_SKU_MESSAGE = "An active item with this SKU already exists for this business.";

function toPublicItem(item) {
  return {
    id: item._id.toString(),
    businessId: item.businessId.toString(),
    type: item.type,
    name: item.name,
    description: item.description || "",
    sku: item.sku || "",
    hsnSac: item.hsnSac || "",
    unit: item.unit || "",
    rate: item.rate,
    defaultTax: {
      type: item.defaultTax?.type || "none",
      rate: item.defaultTax?.rate ?? 0,
      label: item.defaultTax?.label || "",
    },
    defaultDiscount: {
      type: item.defaultDiscount?.type || "none",
      value: item.defaultDiscount?.value ?? 0,
      label: item.defaultDiscount?.label || "",
    },
    tags: item.tags || [],
    notes: item.notes || "",
    status: item.status,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

async function listItems(businessId, query) {
  const filter = { businessId };

  if (query.status !== "all") {
    filter.status = query.status;
  }

  if (query.type) {
    filter.type = query.type;
  }

  if (query.search) {
    const pattern = new RegExp(escapeRegex(query.search), "i");
    filter.$or = [{ name: pattern }, { sku: pattern }, { hsnSac: pattern }];
  }

  const { skip, limit } = buildPagination(query.page, query.limit);
  const sort = buildSort(query.sort);

  const [items, total] = await Promise.all([
    Item.find(filter).sort(sort).skip(skip).limit(limit),
    Item.countDocuments(filter),
  ]);

  return {
    items: items.map(toPublicItem),
    pagination: { page: query.page, limit: query.limit, total, pages: Math.ceil(total / query.limit) },
  };
}

async function createItem(businessId, data) {
  try {
    const item = await Item.create({ ...data, businessId });
    return toPublicItem(item);
  } catch (err) {
    if (err.code === DUPLICATE_KEY) {
      throw new ApiError(409, DUPLICATE_SKU_MESSAGE);
    }
    throw err;
  }
}

// Loads an item by id and verifies the authenticated user owns the business
// it belongs to — never trusts the id alone, and never trusts a
// client-supplied businessId for this check.
async function getOwnedItemOrThrow(userId, itemId) {
  const item = await Item.findById(itemId);

  if (!item) {
    throw new ApiError(404, "Item not found.");
  }

  await businessService.getOwnedBusinessOrThrow(userId, item.businessId);

  return item;
}

async function updateItem(item, data) {
  try {
    Object.assign(item, data);
    await item.save();
    return toPublicItem(item);
  } catch (err) {
    if (err.code === DUPLICATE_KEY) {
      throw new ApiError(409, DUPLICATE_SKU_MESSAGE);
    }
    throw err;
  }
}

async function archiveItem(item) {
  item.status = "archived";
  await item.save();
  return toPublicItem(item);
}

async function restoreItem(item) {
  try {
    item.status = "active";
    await item.save();
    return toPublicItem(item);
  } catch (err) {
    // The item's SKU may since have been reused by another active item.
    if (err.code === DUPLICATE_KEY) {
      throw new ApiError(409, "Cannot restore: another active item already uses this SKU.");
    }
    throw err;
  }
}

module.exports = {
  listItems,
  createItem,
  getOwnedItemOrThrow,
  updateItem,
  archiveItem,
  restoreItem,
  toPublicItem,
};
