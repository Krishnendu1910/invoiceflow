const mongoose = require("mongoose");

// Same structured shape as Customer's embedded address — line1/line2/city/
// state/postalCode/country only. No name or phone: those live on `contact`.
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

// Extra business-identity fields beyond the existing `name`/`type`/`country`
// (Phase 2, unchanged). `name` continues to serve as the display name shown
// everywhere in the app; `legalName` is a new, optional, separate field so a
// business can register under one legal entity name and trade under another.
const identitySchema = new mongoose.Schema(
  {
    legalName: { type: String, trim: true, maxlength: 200 },
    registrationNumber: { type: String, trim: true, maxlength: 50 },
    tradeName: { type: String, trim: true, maxlength: 150 },
    description: { type: String, trim: true, maxlength: 1000 },
    // Free-form, matching the existing `type` field's precedent — the UI may
    // suggest common industries but must not restrict input to a fixed list.
    industry: { type: String, trim: true, maxlength: 100 },
  },
  { _id: false }
);

const contactSchema = new mongoose.Schema(
  {
    email: { type: String, trim: true, lowercase: true, maxlength: 254 },
    phone: { type: String, trim: true, maxlength: 20 },
    website: { type: String, trim: true, maxlength: 300 },
    address: addressSchema,
  },
  { _id: false }
);

// Logo storage is provider-agnostic on purpose: Phase 4 has no production
// file-storage integration, so this stores a reference (a URL, for now) plus
// which provider it came from, rather than binary image data or a
// hard-coded dependency on one storage vendor. A future upload feature only
// needs to populate this same shape after storing the file elsewhere.
const logoSchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      enum: ["none", "url"],
      default: "none",
    },
    url: { type: String, trim: true, maxlength: 2000 },
  },
  { _id: false }
);

const brandingSchema = new mongoose.Schema(
  {
    logo: { type: logoSchema, default: () => ({}) },
    color: { type: String, trim: true, maxlength: 20 },
    // Printed, free-text content for invoice/quotation chrome — distinct
    // from payments.defaultTerms, which is the structured value used to
    // compute due dates.
    headerText: { type: String, trim: true, maxlength: 500 },
    footerText: { type: String, trim: true, maxlength: 500 },
    paymentTermsText: { type: String, trim: true, maxlength: 1000 },
    notesText: { type: String, trim: true, maxlength: 1000 },
  },
  { _id: false }
);

const taxRateSchema = new mongoose.Schema(
  {
    label: { type: String, trim: true, maxlength: 30, required: true },
    rate: { type: Number, min: 0, max: 100, required: true },
    isDefault: { type: Boolean, default: false },
  },
  { _id: false }
);

// Business-level tax DEFAULTS only. These seed future invoice/quotation line
// items but must never rewrite a document already issued — that rule is
// enforced by the (not-yet-built) Document Engine copying these values at
// creation time rather than referencing this document live.
const taxSchema = new mongoose.Schema(
  {
    registrationStatus: {
      type: String,
      enum: ["registered", "unregistered"],
      default: "unregistered",
    },
    // Isolated from Customer's identical GSTIN/PAN shape only because the
    // two models don't share a base schema; the validation rules are the
    // same and kept in sync via the shared regexes in utils/validation/common.js.
    gstin: { type: String, trim: true, uppercase: true },
    pan: { type: String, trim: true, uppercase: true },
    defaultMode: {
      type: String,
      enum: ["none", "gst"],
      default: "none",
    },
    // Configurable rather than hard-coded so a future non-GST tax system
    // (or a business with custom slabs) isn't locked out of this shape.
    rates: {
      type: [taxRateSchema],
      default: () => [
        { label: "0%", rate: 0 },
        { label: "5%", rate: 5 },
        { label: "12%", rate: 12 },
        { label: "18%", rate: 18 },
        { label: "28%", rate: 28 },
      ],
    },
    treatment: {
      type: String,
      enum: ["cgst_sgst", "igst"],
      default: "cgst_sgst",
    },
    pricingMode: {
      type: String,
      enum: ["inclusive", "exclusive"],
      default: "exclusive",
    },
  },
  { _id: false }
);

// One series' configuration (prefix/starting number/reset policy). This is
// settings only — the live, concurrency-safe allocation state lives in the
// separate DocumentSequence collection so a settings save can never race
// with, or accidentally rewind, a number that's actually being issued.
const numberingSeriesSchema = new mongoose.Schema(
  {
    prefix: { type: String, trim: true, maxlength: 20, default: "" },
    startingNumber: { type: Number, min: 1, default: 1 },
    resetPolicy: {
      type: String,
      enum: ["financial_year", "calendar_year", "never"],
      default: "financial_year",
    },
  },
  { _id: false }
);

const numberingSchema = new mongoose.Schema(
  {
    invoice: { type: numberingSeriesSchema, default: () => ({ prefix: "INV-" }) },
    quotation: { type: numberingSeriesSchema, default: () => ({ prefix: "QUO-" }) },
  },
  { _id: false }
);

const bankDetailsSchema = new mongoose.Schema(
  {
    accountHolder: { type: String, trim: true, maxlength: 150 },
    bankName: { type: String, trim: true, maxlength: 150 },
    accountNumber: { type: String, trim: true, maxlength: 34 },
    ifsc: { type: String, trim: true, uppercase: true, maxlength: 11 },
  },
  { _id: false }
);

// The structured value used to compute a due date; `custom` requires
// customDays. Distinct from branding.paymentTermsText, which is the
// free-text blurb printed on the document.
const paymentTermsSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["due_on_receipt", "7_days", "15_days", "30_days", "45_days", "custom"],
      default: "due_on_receipt",
    },
    customDays: { type: Number, min: 1 },
  },
  { _id: false }
);

const paymentsSchema = new mongoose.Schema(
  {
    acceptedMethods: {
      type: [{ type: String, enum: ["cash", "bank_transfer", "upi", "card", "cheque", "other"] }],
      default: [],
    },
    upi: {
      id: { type: String, trim: true, maxlength: 256 },
    },
    bank: { type: bankDetailsSchema, default: () => ({}) },
    instructions: { type: String, trim: true, maxlength: 1000 },
    defaultTerms: { type: paymentTermsSchema, default: () => ({}) },
  },
  { _id: false }
);

// Fiscal year is expressed as a single start month (1-12) rather than a
// separate "mode" enum: a calendar year is simply startMonth 1, so the UI
// can offer both "Calendar year" and a custom month picker without the
// model carrying two overlapping representations of the same thing.
const fiscalYearSchema = new mongoose.Schema(
  {
    startMonth: { type: Number, min: 1, max: 12, default: 4 },
  },
  { _id: false }
);

const additionalChargeSchema = new mongoose.Schema(
  {
    label: { type: String, trim: true, maxlength: 50, required: true },
    type: { type: String, enum: ["percentage", "fixed"], required: true },
    value: { type: Number, min: 0, required: true },
  },
  { _id: false }
);

const defaultDiscountSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["none", "percentage", "fixed"], default: "none" },
    value: { type: Number, min: 0, default: 0 },
  },
  { _id: false }
);

// Defaults only, consumed by the future Document Engine at creation time.
// Currency lives on the existing top-level `currency` field (Phase 2) — the
// Documents settings tab is allowed to edit it (see businessSettingsSchemas)
// but it is not duplicated here.
const documentDefaultsSchema = new mongoose.Schema(
  {
    discount: { type: defaultDiscountSchema, default: () => ({}) },
    additionalCharges: { type: [additionalChargeSchema], default: [] },
    // Free-form on purpose: no real template system exists yet, so this is
    // just a label the future Document Engine can key off of.
    template: { type: String, trim: true, maxlength: 50, default: "standard" },
    language: { type: String, trim: true, lowercase: true, default: "en" },
  },
  { _id: false }
);

const businessSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },
    // Free-form: the UI may suggest common values, but users can enter a
    // custom business type rather than being restricted to a fixed list.
    type: {
      type: String,
      trim: true,
      maxlength: 50,
      default: "other",
    },
    country: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      minlength: 2,
      maxlength: 2,
      default: "IN",
    },
    currency: {
      code: {
        type: String,
        required: true,
        trim: true,
        uppercase: true,
        default: "INR",
      },
      symbol: {
        type: String,
        required: true,
        trim: true,
        default: "₹",
      },
    },
    identity: { type: identitySchema, default: () => ({}) },
    contact: { type: contactSchema, default: () => ({}) },
    branding: { type: brandingSchema, default: () => ({}) },
    tax: { type: taxSchema, default: () => ({}) },
    numbering: { type: numberingSchema, default: () => ({}) },
    payments: { type: paymentsSchema, default: () => ({}) },
    fiscalYear: { type: fiscalYearSchema, default: () => ({}) },
    documentDefaults: { type: documentDefaultsSchema, default: () => ({}) },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Business", businessSchema);
