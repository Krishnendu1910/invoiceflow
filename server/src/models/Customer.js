const mongoose = require("mongoose");

// No _id on the embedded address — it isn't a standalone resource, just a
// structured field on the customer. Name/phone live on Customer, not here.
const addressSchema = new mongoose.Schema(
  {
    line1: { type: String, trim: true },
    line2: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    postalCode: { type: String, trim: true },
    country: { type: String, trim: true, uppercase: true },
  },
  { _id: false }
);

const customerSchema = new mongoose.Schema(
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
      enum: ["individual", "business"],
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },
    companyName: {
      type: String,
      trim: true,
      maxlength: 150,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 254,
    },
    phone: {
      type: String,
      trim: true,
      maxlength: 20,
    },
    tax: {
      // Isolated so a future country's tax-id shape can sit alongside GSTIN/PAN
      // without reworking the rest of the Customer model.
      gstRegistered: { type: Boolean, default: false },
      gstin: { type: String, trim: true, uppercase: true },
      pan: { type: String, trim: true, uppercase: true },
    },
    billingAddress: addressSchema,
    shippingAddress: addressSchema,
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

customerSchema.index({ businessId: 1, status: 1 });
customerSchema.index({ businessId: 1, name: 1 });
customerSchema.index({ businessId: 1, email: 1 });
customerSchema.index({ businessId: 1, phone: 1 });

module.exports = mongoose.model("Customer", customerSchema);
