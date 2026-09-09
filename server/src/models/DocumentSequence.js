const mongoose = require("mongoose");

// Persisted, concurrency-safe counter state — deliberately separate from
// Business.numbering (the user-editable prefix/startingNumber/resetPolicy
// config). Allocating a number only ever touches this collection via an
// atomic $inc/upsert (see services/numbering.service.js), so it is safe
// across concurrent requests, multiple tabs, retries, and multiple backend
// instances, and a settings save can never race with or rewind a number
// that's actually being issued.
//
// `counter` always starts at 1 for a new period and increments by 1 per
// allocation; the configured `startingNumber` offset is applied in the
// service layer (`counter + startingNumber - 1`) rather than seeded here,
// so the atomic upsert never has to special-case "is this the first
// allocation for this period."
const documentSequenceSchema = new mongoose.Schema(
  {
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    docType: {
      type: String,
      enum: ["invoice", "quotation"],
      required: true,
    },
    // Identifies the reset period this counter belongs to: a financial- or
    // calendar-year label (e.g. "2026-2027", "2026"), or the constant "ALL"
    // when the series never resets. A new period gets a fresh document (and
    // therefore a fresh counter) the first time it's allocated against.
    periodKey: {
      type: String,
      required: true,
    },
    counter: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

documentSequenceSchema.index({ businessId: 1, docType: 1, periodKey: 1 }, { unique: true });

module.exports = mongoose.model("DocumentSequence", documentSequenceSchema);
