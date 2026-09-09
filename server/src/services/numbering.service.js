const Business = require("../models/Business");
const DocumentSequence = require("../models/DocumentSequence");
const ApiError = require("../utils/ApiError");
const { getPeriodKey } = require("../utils/fiscalPeriod");

// Allocates the next number in a business's invoice or quotation series.
// This is the one function that may ever consume a number — settings reads
// and writes never call it, so opening or saving the numbering settings
// page never burns a number.
//
// Concurrency safety: the only mutation is a single atomic
// `findOneAndUpdate` with `$inc` (upsert: true) against DocumentSequence,
// scoped to {businessId, docType, periodKey}. MongoDB applies a single
// document's update atomically, so concurrent requests — from multiple
// browser tabs, retries, or (in the future) multiple backend instances —
// each get a distinct, strictly increasing counter value with no
// duplicates and no in-memory state involved. The configured
// `startingNumber` offset is pure arithmetic applied after the atomic
// increment, so it never has to be special-cased inside the atomic op.
async function allocateNextNumber(businessId, docType) {
  const business = await Business.findOne({ _id: businessId, isDeleted: false }).lean();

  if (!business) {
    throw new ApiError(404, "Business not found.");
  }

  const seriesConfig = business.numbering?.[docType];

  if (!seriesConfig) {
    throw new ApiError(400, `No numbering configuration for document type "${docType}".`);
  }

  const periodKey = getPeriodKey(seriesConfig.resetPolicy, business.fiscalYear?.startMonth ?? 4, new Date());

  const sequence = await DocumentSequence.findOneAndUpdate(
    { businessId, docType, periodKey },
    { $inc: { counter: 1 } },
    { upsert: true, returnDocument: "after" }
  );

  const number = sequence.counter + (seriesConfig.startingNumber ?? 1) - 1;
  const formattedNumber = `${seriesConfig.prefix || ""}${number}`;

  return { number, formattedNumber, periodKey };
}

// Returns true if the given series has ever allocated at least one number.
// Used by the numbering settings endpoint to lock startingNumber after the
// first allocation — changing startingNumber after numbers are issued would
// rewind or collide with previously issued document numbers.
async function hasAllocations(businessId, docType) {
  const count = await DocumentSequence.countDocuments({ businessId, docType });
  return count > 0;
}

module.exports = { allocateNextNumber, hasAllocations };
