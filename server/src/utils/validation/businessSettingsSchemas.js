const { z } = require("zod");
const { objectId, gstin, pan, address, optionalTrimmed, countryCode } = require("./common");
const { CURRENCIES } = require("../currencies");

const idParam = z.object({ id: objectId });

// English is the only complete language today; the list is deliberately a
// small, closed set (rather than a free-text field) so it can grow without
// a schema change while still rejecting unsupported values up front.
const SUPPORTED_LANGUAGES = ["en"];
const CURRENCY_CODES = CURRENCIES.map((c) => c.code);

const emptyToUndefined = (value) => (typeof value === "string" && value.trim() === "" ? undefined : value);

const email = z.preprocess(emptyToUndefined, z.string().trim().toLowerCase().email("Invalid email address").optional());

// Deliberately permissive (no protocol requirement) since businesses paste
// URLs in all sorts of forms; this only guards against obviously malformed
// values, not a full RFC validation.
const website = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .trim()
    .max(300)
    .regex(/^(https?:\/\/)?[^\s]+\.[^\s]{2,}$/i, "Invalid website URL")
    .optional()
);

const hexColor = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .trim()
    .regex(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/, "Must be a hex color, e.g. #1F2937")
    .optional()
);

const upiId = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .trim()
    .regex(/^[\w.+-]{2,256}@[A-Za-z]{2,64}$/, "Invalid UPI ID")
    .optional()
);

// Indian bank IFSC format: 4 letters, a literal 0, then 6 alphanumerics.
const ifsc = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "Invalid IFSC code")
    .optional()
);

// ---------------------------------------------------------------------
// Business Profile (identity + contact + the existing name/type/country)
// ---------------------------------------------------------------------

const identityInput = z
  .object({
    legalName: optionalTrimmed(200),
    registrationNumber: optionalTrimmed(50),
    tradeName: optionalTrimmed(150),
    description: optionalTrimmed(1000),
    industry: optionalTrimmed(100),
  })
  .optional();

const contactInput = z
  .object({
    email,
    phone: optionalTrimmed(20),
    website,
    address,
  })
  .optional();

const updateProfile = z.object({
  name: z.string().trim().min(1, "Business name is required").max(150, "Business name is too long").optional(),
  type: z.string().trim().min(1, "Business type is required").max(50, "Business type is too long").optional(),
  // No emptyToUndefined here: unlike a genuinely optional field, `country`
  // is required on the Business model, so an explicit empty string must be
  // rejected by Zod (a clean 400) rather than silently normalized to
  // "omitted" and then failing Mongoose's own required-field validation
  // (which the error handler would report as a 500).
  country: countryCode.optional(),
  identity: identityInput,
  contact: contactInput,
});

// ---------------------------------------------------------------------
// Branding
// ---------------------------------------------------------------------

const logoInput = z
  .object({
    provider: z.enum(["none", "url"]).optional().default("none"),
    url: optionalTrimmed(2000),
  })
  .optional();

const updateBranding = z.object({
  logo: logoInput,
  color: hexColor,
  headerText: optionalTrimmed(500),
  footerText: optionalTrimmed(500),
  paymentTermsText: optionalTrimmed(1000),
  notesText: optionalTrimmed(1000),
});

// ---------------------------------------------------------------------
// Tax & GST
// ---------------------------------------------------------------------

const taxRateInput = z.object({
  label: z.string().trim().min(1, "Rate label is required").max(30),
  rate: z.coerce.number().min(0, "Rate must be zero or greater").max(100, "Rate cannot exceed 100"),
  isDefault: z.boolean().optional().default(false),
});

const updateTax = z
  .object({
    registrationStatus: z.enum(["registered", "unregistered"]).optional(),
    gstin,
    pan,
    defaultMode: z.enum(["none", "gst"]).optional(),
    rates: z.array(taxRateInput).max(20, "Too many tax rates").optional(),
    treatment: z.enum(["cgst_sgst", "igst"]).optional(),
    pricingMode: z.enum(["inclusive", "exclusive"]).optional(),
  })
  .refine((value) => value.registrationStatus !== "registered" || Boolean(value.gstin), {
    message: "GSTIN is required when the business is GST registered.",
    path: ["gstin"],
  });

// ---------------------------------------------------------------------
// Numbering
// ---------------------------------------------------------------------

const numberingSeriesInput = z
  .object({
    // Letters, digits, spaces, and a few common separators — permissive
    // enough for real prefixes ("INV-", "INV/24-25/") without letting
    // arbitrary characters end up in a document number.
    prefix: z.preprocess(
      emptyToUndefined,
      z
        .string()
        .trim()
        .max(20)
        .regex(/^[A-Za-z0-9 _/-]*$/, "Prefix may only contain letters, digits, spaces, - _ /")
        .optional()
    ),
    startingNumber: z.coerce.number().int().min(1, "Starting number must be at least 1").max(999999999).optional(),
    resetPolicy: z.enum(["financial_year", "calendar_year", "never"]).optional(),
  })
  .optional();

const updateNumbering = z.object({
  invoice: numberingSeriesInput,
  quotation: numberingSeriesInput,
});

// ---------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------

const ACCEPTED_PAYMENT_METHODS = ["cash", "bank_transfer", "upi", "card", "cheque", "other"];

const bankInput = z
  .object({
    accountHolder: optionalTrimmed(150),
    bankName: optionalTrimmed(150),
    accountNumber: z.preprocess(emptyToUndefined, z.string().trim().min(4).max(34).optional()),
    ifsc,
  })
  .optional();

const defaultTermsInput = z
  .object({
    type: z.enum(["due_on_receipt", "7_days", "15_days", "30_days", "45_days", "custom"]).optional().default("due_on_receipt"),
    customDays: z.coerce.number().int().min(1).optional(),
  })
  .optional()
  .refine((value) => !value || value.type !== "custom" || Boolean(value.customDays), {
    message: "Custom payment terms require a number of days.",
    path: ["customDays"],
  });

const updatePayments = z.object({
  acceptedMethods: z.array(z.enum(ACCEPTED_PAYMENT_METHODS)).max(ACCEPTED_PAYMENT_METHODS.length).optional(),
  upi: z.object({ id: upiId }).optional(),
  bank: bankInput,
  instructions: optionalTrimmed(1000),
  defaultTerms: defaultTermsInput,
});

// ---------------------------------------------------------------------
// Fiscal Year
// ---------------------------------------------------------------------

const updateFiscalYear = z.object({
  startMonth: z.coerce.number().int().min(1, "Month must be between 1 and 12").max(12, "Month must be between 1 and 12"),
});

// ---------------------------------------------------------------------
// Documents (defaults + currency, per the allowance in the settings spec
// that currency/language may live in the Documents tab rather than a tab
// of their own)
// ---------------------------------------------------------------------

const discountInput = z
  .object({
    type: z.enum(["none", "percentage", "fixed"]).optional().default("none"),
    value: z.coerce.number().min(0, "Must be zero or greater").optional().default(0),
  })
  .optional()
  .refine((value) => !value || value.type !== "percentage" || value.value <= 100, {
    message: "A percentage cannot exceed 100.",
    path: ["value"],
  });

const additionalChargeInput = z.object({
  label: z.string().trim().min(1, "Charge label is required").max(50),
  type: z.enum(["percentage", "fixed"]),
  value: z.coerce.number().min(0, "Must be zero or greater"),
});

const currencyInput = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .refine((code) => CURRENCY_CODES.includes(code), "Unsupported currency code"),
    symbol: z.string().trim().min(1).max(5),
  })
  .optional();

const updateDocumentDefaults = z.object({
  currency: currencyInput,
  discount: discountInput,
  additionalCharges: z.array(additionalChargeInput).max(10, "Too many additional charges").optional(),
  template: optionalTrimmed(50),
  language: z.enum(SUPPORTED_LANGUAGES).optional(),
});

module.exports = {
  idParam,
  updateProfile,
  updateBranding,
  updateTax,
  updateNumbering,
  updatePayments,
  updateFiscalYear,
  updateDocumentDefaults,
  ACCEPTED_PAYMENT_METHODS,
  SUPPORTED_LANGUAGES,
};
