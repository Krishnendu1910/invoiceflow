const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const itemService = require("../services/item.service");

const list = asyncHandler(async (req, res) => {
  const { items, pagination } = await itemService.listItems(req.businessId, req.query);
  return sendSuccess(res, { data: { items, pagination } });
});

const create = asyncHandler(async (req, res) => {
  const item = await itemService.createItem(req.businessId, req.body);
  return sendSuccess(res, { statusCode: 201, message: "Item created.", data: { item } });
});

const getById = asyncHandler(async (req, res) => {
  const item = await itemService.getOwnedItemOrThrow(req.user._id, req.params.id);
  return sendSuccess(res, { data: { item: itemService.toPublicItem(item) } });
});

const update = asyncHandler(async (req, res) => {
  const item = await itemService.getOwnedItemOrThrow(req.user._id, req.params.id);
  const updated = await itemService.updateItem(item, req.body);
  return sendSuccess(res, { message: "Item updated.", data: { item: updated } });
});

const archive = asyncHandler(async (req, res) => {
  const item = await itemService.getOwnedItemOrThrow(req.user._id, req.params.id);
  const archived = await itemService.archiveItem(item);
  return sendSuccess(res, { message: "Item archived.", data: { item: archived } });
});

const restore = asyncHandler(async (req, res) => {
  const item = await itemService.getOwnedItemOrThrow(req.user._id, req.params.id);
  const restored = await itemService.restoreItem(item);
  return sendSuccess(res, { message: "Item restored.", data: { item: restored } });
});

module.exports = { list, create, getById, update, archive, restore };
