const mongoose = require("mongoose");

const INVOICE_STATUSES = [
  "draft",
  "sent",
  "viewed",
  "partially_paid",
  "paid",
  "overdue",
  "cancelled",
];

const QUOTATION_STATUSES = [
  "draft",
  "sent",
  "viewed",
  "accepted",
  "rejected",
  "expired",
  "converted",
];

const ALL_STATUSES = Array.from(new Set([...INVOICE_STATUSES, ...QUOTATION_STATUSES]));

// Embedded address shape matching Customer and Business address conventions
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

// Customer Snapshot: Frozen record of customer details at the time of document creation/issuance.
// Changing the Customer record later must not alter existing historical documents.
const customerSnapshotSchema = new mongoose.Schema(
  {
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },
    type: { type: String, enum: ["individual", "business"] },
    name: { type: String, required: true, trim: true, maxlength: 150 },
    companyName: { type: String, trim: true, maxlength: 150 },
    email: { type: String, trim: true, lowercase: true, maxlength: 254 },
    phone: { type: String, trim: true, maxlength: 20 },
    tax: {
      gstRegistered: { type: Boolean, default: false },
      gstin: { type: String, trim: true, uppercase: true },
      pan: { type: String, trim: true, uppercase: true },
    },
    billingAddress: addressSchema,
    shippingAddress: addressSchema,
  },
  { _id: false }
);

// Business Snapshot: Frozen record of business details and branding at issuance.
const businessSnapshotSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 150 },
    identity: {
      legalName: { type: String, trim: true, maxlength: 200 },
      registrationNumber: { type: String, trim: true, maxlength: 50 },
      tradeName: { type: String, trim: true, maxlength: 150 },
      description: { type: String, trim: true, maxlength: 1000 },
      industry: { type: String, trim: true, maxlength: 100 },
    },
    contact: {
      email: { type: String, trim: true, lowercase: true, maxlength: 254 },
      phone: { type: String, trim: true, maxlength: 20 },
      website: { type: String, trim: true, maxlength: 300 },
      address: addressSchema,
    },
    tax: {
      registrationStatus: { type: String, enum: ["registered", "unregistered"] },
      gstin: { type: String, trim: true, uppercase: true },
      pan: { type: String, trim: true, uppercase: true },
      defaultMode: { type: String, enum: ["none", "gst"] },
      treatment: { type: String, enum: ["cgst_sgst", "igst"] },
    },
    branding: {
      logo: {
        provider: { type: String, enum: ["none", "url"], default: "none" },
        url: { type: String, trim: true, maxlength: 2000 },
      },
      color: { type: String, trim: true, maxlength: 20 },
      headerText: { type: String, trim: true, maxlength: 500 },
      footerText: { type: String, trim: true, maxlength: 500 },
      paymentTermsText: { type: String, trim: true, maxlength: 1000 },
      notesText: { type: String, trim: true, maxlength: 1000 },
    },
    documentDefaults: {
      template: { type: String, trim: true, maxlength: 50 },
      language: { type: String, trim: true, lowercase: true },
    },
  },
  { _id: false }
);

// Line Item Snapshot: Frozen calculation and details for each line.
const lineItemSnapshotSchema = new mongoose.Schema(
  {
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: "Item" },
    name: { type: String, required: true, trim: true, maxlength: 150 },
    description: { type: String, trim: true, maxlength: 5000 },
    sku: { type: String, trim: true, maxlength: 50 },
    hsnSac: { type: String, trim: true, maxlength: 20 },
    quantity: { type: Number, required: true, min: 0.0001 },
    unit: { type: String, trim: true, maxlength: 20 },
    rate: { type: Number, required: true, min: 0 },
    grossAmount: { type: Number, required: true, min: 0 },
    discount: {
      type: { type: String, enum: ["none", "percentage", "fixed"], default: "none" },
      value: { type: Number, min: 0, default: 0 },
      amount: { type: Number, min: 0, default: 0 },
      label: { type: String, trim: true, maxlength: 50 },
    },
    taxableAmount: { type: Number, required: true, min: 0 },
    tax: {
      type: { type: String, enum: ["none", "percentage", "fixed"], default: "none" },
      rate: { type: Number, min: 0, default: 0 },
      amount: { type: Number, min: 0, default: 0 },
      treatment: { type: String, enum: ["cgst_sgst", "igst"], default: "cgst_sgst" },
      label: { type: String, trim: true, maxlength: 50 },
      cgst: {
        rate: { type: Number, default: 0 },
        amount: { type: Number, default: 0 },
      },
      sgst: {
        rate: { type: Number, default: 0 },
        amount: { type: Number, default: 0 },
      },
      igst: {
        rate: { type: Number, default: 0 },
        amount: { type: Number, default: 0 },
      },
    },
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { _id: true }
);

const taxBreakdownSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["none", "percentage", "fixed"], default: "none" },
    rate: { type: Number, min: 0, default: 0 },
    taxableAmount: { type: Number, min: 0, default: 0 },
    amount: { type: Number, min: 0, default: 0 },
    treatment: { type: String, enum: ["cgst_sgst", "igst"], default: "cgst_sgst" },
    label: { type: String, trim: true, maxlength: 50 },
    cgst: {
      rate: { type: Number, default: 0 },
      amount: { type: Number, default: 0 },
    },
    sgst: {
      rate: { type: Number, default: 0 },
      amount: { type: Number, default: 0 },
    },
    igst: {
      rate: { type: Number, default: 0 },
      amount: { type: Number, default: 0 },
    },
  },
  { _id: false }
);

const additionalChargeSchema = new mongoose.Schema(
  {
    label: { type: String, trim: true, maxlength: 50, required: true },
    type: { type: String, enum: ["percentage", "fixed"], required: true },
    value: { type: Number, min: 0, required: true },
    amount: { type: Number, min: 0, required: true },
  },
  { _id: false }
);

const paymentInfoSchema = new mongoose.Schema(
  {
    paymentTerms: {
      type: {
        type: String,
        enum: ["due_on_receipt", "7_days", "15_days", "30_days", "45_days", "custom"],
        default: "due_on_receipt",
      },
      customDays: { type: Number, min: 1 },
    },
    paymentTermsText: { type: String, trim: true, maxlength: 1000 },
    bank: {
      accountHolder: { type: String, trim: true, maxlength: 150 },
      bankName: { type: String, trim: true, maxlength: 150 },
      accountNumber: { type: String, trim: true, maxlength: 34 },
      ifsc: { type: String, trim: true, uppercase: true, maxlength: 11 },
    },
    upi: {
      id: { type: String, trim: true, maxlength: 256 },
    },
    instructions: { type: String, trim: true, maxlength: 1000 },
  },
  { _id: false }
);

const conversionSchema = new mongoose.Schema(
  {
    convertedToInvoiceId: { type: mongoose.Schema.Types.ObjectId, ref: "Document" },
    convertedFromQuotationId: { type: mongoose.Schema.Types.ObjectId, ref: "Document" },
    convertedAt: { type: Date },
  },
  { _id: false }
);

const documentSchema = new mongoose.Schema(
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
      enum: ["invoice", "quotation"],
      index: true,
    },
    // Document number (e.g. INV-1 or QUO-1), immutable once allocated/issued.
    number: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
      validate: {
        validator: function (v) {
          if (!this.isNew && this.isModified && this.isModified("number")) {
            return false;
          }
          return true;
        },
        message: "Document number is immutable once issued.",
      },
    },
    status: {
      type: String,
      required: true,
      index: true,
      validate: {
        validator: async function (v) {
          let docType = this.type;
          if (!docType && this.getUpdate) {
            const update = this.getUpdate();
            docType = update?.type || update?.$set?.type;
            if (!docType && this.model) {
              const existing = await this.model.findOne(this.getQuery()).select("type").lean();
              docType = existing?.type;
            }
          }
          if (docType === "invoice") {
            return INVOICE_STATUSES.includes(v);
          }
          if (docType === "quotation") {
            return QUOTATION_STATUSES.includes(v);
          }
          return false;
        },
        message: (props) => `Status "${props.value}" is not valid for document type.`,
      },
    },
    issueDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    dueDate: {
      type: Date,
    },
    expiryDate: {
      type: Date,
    },
    sentAt: {
      type: Date,
    },
    viewedAt: {
      type: Date,
    },
    paidAt: {
      type: Date,
    },
    cancelledAt: {
      type: Date,
    },
    pricingMode: {
      type: String,
      enum: ["exclusive", "inclusive"],
      default: "exclusive",
    },
    currency: {
      code: { type: String, required: true, trim: true, uppercase: true, default: "INR" },
      symbol: { type: String, required: true, trim: true, default: "₹" },
      decimals: { type: Number, required: true, default: 2 },
    },
    customer: {
      type: customerSnapshotSchema,
      required: true,
    },
    business: {
      type: businessSnapshotSchema,
      required: true,
    },
    lines: {
      type: [lineItemSnapshotSchema],
      default: [],
    },
    subtotal: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    lineDiscountTotal: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    overallDiscount: {
      type: { type: String, enum: ["none", "percentage", "fixed"], default: "none" },
      value: { type: Number, min: 0, default: 0 },
      amount: { type: Number, min: 0, default: 0 },
      label: { type: String, trim: true, maxlength: 50 },
    },
    taxableAmount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    taxes: {
      type: [taxBreakdownSchema],
      default: [],
    },
    taxTotal: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    additionalCharges: {
      type: [additionalChargeSchema],
      default: [],
    },
    additionalChargesTotal: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    grandTotal: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    paymentInfo: {
      type: paymentInfoSchema,
      default: () => ({}),
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 5000,
    },
    footer: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    template: {
      type: String,
      trim: true,
      maxlength: 50,
      default: "standard",
    },
    language: {
      type: String,
      trim: true,
      lowercase: true,
      default: "en",
    },
    conversion: {
      type: conversionSchema,
      default: () => ({}),
    },
    version: {
      type: Number,
      default: 1,
      min: 1,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({}),
    },
  },
  { timestamps: true }
);

const PROTECTED_SNAPSHOT_FIELDS = [
  "customer",
  "business",
  "lines",
  "subtotal",
  "lineDiscountTotal",
  "overallDiscount",
  "taxableAmount",
  "taxes",
  "taxTotal",
  "additionalCharges",
  "additionalChargesTotal",
  "grandTotal",
];

function getTouchedFields(update) {
  if (!update) return [];
  const keys = new Set();
  for (const topKey of Object.keys(update)) {
    if (topKey.startsWith("$")) {
      const inner = update[topKey];
      if (inner && typeof inner === "object") {
        for (const k of Object.keys(inner)) keys.add(k);
      }
    } else {
      keys.add(topKey);
    }
  }
  return Array.from(keys);
}

// 1. Save hook: prevents changing number and prevents modifying historical snapshots on non-draft documents
documentSchema.pre("save", async function () {
  if (!this.isNew) {
    if (this.isModified("number")) {
      throw new Error("Document number is immutable once issued.");
    }
    if (this._id) {
      const original = await this.constructor.findById(this._id).select("status").lean();
      if (original && original.status !== "draft") {
        for (const field of PROTECTED_SNAPSHOT_FIELDS) {
          if (this.isModified(field)) {
            throw new Error(`Cannot modify ${field} on an issued document.`);
          }
        }
      }
    }
  }
});

// 2. Query middleware: prevents bypassing save hooks via updateOne, updateMany, findOneAndUpdate
documentSchema.pre(["updateOne", "updateMany", "findOneAndUpdate"], async function () {
  const update = this.getUpdate();
  if (!update) return;

  const touched = getTouchedFields(update);

  // Never allow changing an already-allocated number via update queries
  if (touched.some((k) => k === "number" || k.startsWith("number."))) {
    if (this.model) {
      const existing = await this.model.findOne(this.getQuery()).select("number").lean();
      if (existing && existing.number) {
        throw new Error("Document number is immutable once issued.");
      }
    } else {
      throw new Error("Document number is immutable once issued.");
    }
  }

  // Prevent modifying historical snapshot / calculation fields on non-draft documents
  const touchesProtected = touched.some((k) =>
    PROTECTED_SNAPSHOT_FIELDS.some((p) => k === p || k.startsWith(`${p}.`))
  );

  if (touchesProtected && this.model) {
    const existing = await this.model
      .findOne({
        ...this.getQuery(),
        status: { $ne: "draft" },
      })
      .select("status")
      .lean();
    if (existing) {
      throw new Error("Cannot modify content or snapshots of an issued document.");
    }
  }
});

// Enforce number uniqueness per document type within a business
documentSchema.index({ businessId: 1, type: 1, number: 1 }, { unique: true });

// Primary operational query indexes
documentSchema.index({ businessId: 1, type: 1, status: 1 });
documentSchema.index({ businessId: 1, issueDate: -1 });
documentSchema.index({ businessId: 1, "customer.customerId": 1 });

const INVOICE_STATUS_TRANSITIONS = {
  draft: ["sent"],
  sent: ["viewed", "cancelled"],
  viewed: ["partially_paid", "paid", "overdue"],
  partially_paid: ["paid", "overdue", "cancelled"],
  overdue: ["partially_paid", "paid", "cancelled"],
  paid: [],
  cancelled: [],
};

const Document = mongoose.model("Document", documentSchema);

module.exports = {
  Document,
  INVOICE_STATUSES,
  QUOTATION_STATUSES,
  ALL_STATUSES,
  INVOICE_STATUS_TRANSITIONS,
};

