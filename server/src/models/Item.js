const mongoose = require("mongoose");

// Defaults only — invoice/quotation line items (a later phase) copy these in
// but must remain free to override them per line. Tax and discount use
// differently-named magnitude fields ("rate" vs "value", matching the Zod
// schemas and the public API shape), so each gets its own subdocument
// schema rather than sharing one — a shared schema would silently drop
// whichever field name it didn't declare.
const taxSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["none", "percentage", "fixed"],
      default: "none",
    },
    rate: { type: Number, default: 0, min: 0 },
    label: { type: String, trim: true, maxlength: 50 },
  },
  { _id: false }
);

const discountSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["none", "percentage", "fixed"],
      default: "none",
    },
    value: { type: Number, default: 0, min: 0 },
    label: { type: String, trim: true, maxlength: 50 },
  },
  { _id: false }
);

const itemSchema = new mongoose.Schema(
  {
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      enum: ["product", "service"],
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 5000,
    },
    // Optional; uniqueness is enforced per-business by a partial index below
    // rather than here, so it stays undefined (not "") when not supplied.
    sku: {
      type: String,
      trim: true,
      maxlength: 50,
    },
    // Always a string — HSN/SAC codes can carry leading zeros and must never
    // be coerced to a number.
    hsnSac: {
      type: String,
      trim: true,
      maxlength: 20,
    },
    // Free-form on purpose: the UI offers common units as suggestions only.
    unit: {
      type: String,
      trim: true,
      maxlength: 20,
    },
    rate: {
      type: Number,
      required: true,
      min: 0,
    },
    defaultTax: {
      type: taxSchema,
      default: () => ({}),
    },
    defaultDiscount: {
      type: discountSchema,
      default: () => ({}),
    },
    tags: {
      type: [String],
      default: [],
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    status: {
      type: String,
      enum: ["active", "archived"],
      default: "active",
      index: true,
    },
  },
  { timestamps: true }
);

itemSchema.index({ businessId: 1, status: 1 });
itemSchema.index({ businessId: 1, type: 1 });

// SKU uniqueness applies only among active items in the same business, so
// archiving an item frees its SKU for reuse. Missing/absent sku (not the
// empty string, which the validation layer never persists) never matches
// $type: "string" and is excluded from the constraint entirely.
itemSchema.index(
  { businessId: 1, sku: 1 },
  { unique: true, partialFilterExpression: { sku: { $type: "string" }, status: "active" } }
);

module.exports = mongoose.model("Item", itemSchema);
