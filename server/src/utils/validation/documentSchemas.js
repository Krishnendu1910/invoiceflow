const { z } = require("zod");
const { objectId, gstin, pan, address, page, limit, optionalTrimmed } = require("./common");

const emptyToUndefined = (value) => (typeof value === "string" && value.trim() === "" ? undefined : value);

const discountTypeEnum = z.enum(["none", "percentage", "fixed"]);
const taxTypeEnum = z.enum(["none", "percentage", "fixed"]);
const taxTreatmentEnum = z.enum(["cgst_sgst", "igst"]);
const additionalChargeTypeEnum = z.enum(["percentage", "fixed"]);
const pricingModeEnum = z.enum(["exclusive", "inclusive"]);

const discountSchema = z
  .object({
    type: discountTypeEnum.default("none"),
    value: z.number().min(0, "Discount value must be non-negative").default(0),
    label: optionalTrimmed(50),
  })
  .refine(
    (d) => {
      if (d.type === "percentage" && d.value > 100) return false;
      return true;
    },
    { message: "Percentage discount cannot exceed 100%" }
  );

const taxSchema = z.object({
  type: taxTypeEnum.default("none"),
  rate: z.number().min(0, "Tax rate must be non-negative").default(0),
  treatment: taxTreatmentEnum.default("cgst_sgst"),
  label: optionalTrimmed(50),
});

const additionalChargeSchema = z
  .object({
    label: z.string().trim().min(1, "Charge label is required").max(50),
    type: additionalChargeTypeEnum,
    value: z.number().min(0, "Charge value must be non-negative"),
  })
  .refine(
    (c) => {
      if (c.type === "percentage" && c.value > 1000) return false;
      return true;
    },
    { message: "Percentage charge is unreasonably high" }
  );

const calculationLineSchema = z.object({
  itemId: optionalTrimmed(50),
  name: z.string().trim().min(1, "Line item name is required").max(150),
  description: optionalTrimmed(5000),
  sku: optionalTrimmed(50),
  hsnSac: optionalTrimmed(20),
  unit: optionalTrimmed(20),
  quantity: z.number().positive("Quantity must be greater than 0"),
  rate: z.number().min(0, "Rate must be non-negative"),
  discount: discountSchema.optional().default(() => ({ type: "none", value: 0 })),
  tax: taxSchema.optional().default(() => ({ type: "none", rate: 0, treatment: "cgst_sgst" })),
});

const calculateDocumentInputSchema = z.object({
  lines: z.array(calculationLineSchema).default([]),
  pricingMode: pricingModeEnum.default("exclusive"),
  overallDiscount: discountSchema.optional().default(() => ({ type: "none", value: 0 })),
  additionalCharges: z.array(additionalChargeSchema).optional().default([]),
  currency: z
    .object({
      code: z.string().trim().length(3).default("INR"),
      symbol: z.string().trim().default("₹"),
      decimals: z.number().int().min(0).max(4).default(2),
    })
    .optional()
    .default(() => ({ code: "INR", symbol: "₹", decimals: 2 })),
});

const customerInputSchema = z.object({
  customerId: objectId.optional(),
  type: z.enum(["individual", "business"]).optional(),
  name: z.string().trim().min(1, "Customer name is required").max(150),
  companyName: optionalTrimmed(150),
  email: z.preprocess(emptyToUndefined, z.string().trim().email("Invalid email format").max(254).optional()),
  phone: optionalTrimmed(20),
  tax: z
    .object({
      gstRegistered: z.boolean().optional().default(false),
      gstin: gstin.optional(),
      pan: pan.optional(),
    })
    .optional(),
  billingAddress: address,
  shippingAddress: address,
});

const createDocumentSchema = z
  .object({
    businessId: objectId,
    type: z.enum(["invoice", "quotation"], {
      errorMap: () => ({ message: 'Document type must be "invoice" or "quotation"' }),
    }),
    customerId: objectId.optional(),
    customer: customerInputSchema.optional(),
    business: z.record(z.any()).optional(),
    lines: z.array(calculationLineSchema).min(1, "At least one line item is required"),
    pricingMode: pricingModeEnum.optional(),
    overallDiscount: discountSchema.optional(),
    additionalCharges: z.array(additionalChargeSchema).optional(),
    currency: z
      .object({
        code: z.string().trim().length(3).default("INR"),
        symbol: z.string().trim().default("₹"),
        decimals: z.number().int().min(0).max(4).default(2),
      })
      .optional(),
    issueDate: z.coerce.date().optional(),
    dueDate: z.coerce.date().optional(),
    expiryDate: z.coerce.date().optional(),
    notes: optionalTrimmed(2000),
    terms: optionalTrimmed(5000),
    paymentInfo: z.record(z.any()).optional(),
    metadata: z.record(z.any()).optional(),
    // Strictly prevent clients from passing authoritative calculations
    subtotal: z.never({ message: "Calculated fields cannot be supplied by client" }).optional(),
    grandTotal: z.never({ message: "Calculated fields cannot be supplied by client" }).optional(),
    taxTotal: z.never({ message: "Calculated fields cannot be supplied by client" }).optional(),
  })
  .refine(
    (data) => Boolean(data.customerId || data.customer?.name),
    { message: "Either customerId or customer.name is required", path: ["customerId"] }
  );

const updateDocumentSchema = z.object({
  customerId: objectId.optional(),
  customer: customerInputSchema.partial().optional(),
  business: z.record(z.any()).optional(),
  lines: z.array(calculationLineSchema).min(1, "At least one line item is required").optional(),
  pricingMode: pricingModeEnum.optional(),
  overallDiscount: discountSchema.optional(),
  additionalCharges: z.array(additionalChargeSchema).optional(),
  currency: z
    .object({
      code: z.string().trim().length(3),
      symbol: z.string().trim(),
      decimals: z.number().int().min(0).max(4),
    })
    .optional(),
  issueDate: z.coerce.date().optional(),
  dueDate: z.coerce.date().nullable().optional(),
  expiryDate: z.coerce.date().nullable().optional(),
  notes: optionalTrimmed(2000),
  terms: optionalTrimmed(5000),
  paymentInfo: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional(),
  // Forbid mutations to immutable or internal fields
  number: z.never({ message: "Document number cannot be modified" }).optional(),
  type: z.never({ message: "Document type cannot be modified" }).optional(),
  businessId: z.never({ message: "businessId cannot be modified" }).optional(),
  status: z.never({ message: "status cannot be modified directly via draft update" }).optional(),
  subtotal: z.never({ message: "subtotal is calculated server-side" }).optional(),
  taxTotal: z.never({ message: "taxTotal is calculated server-side" }).optional(),
  grandTotal: z.never({ message: "grandTotal is calculated server-side" }).optional(),
});

const listDocumentsQuerySchema = z.object({
  businessId: objectId,
  type: z.enum(["invoice", "quotation"]).optional(),
  status: z.string().trim().optional().default("all"),
  search: optionalTrimmed(100),
  sort: z.string().trim().optional().default("-createdAt"),
  page: page,
  limit: limit,
});

const idParam = z.object({
  id: objectId,
});

const transitionInvoiceStatusSchema = z
  .object({
    status: z.string().trim().min(1, "Status is required"),
  })
  .strict();

const convertToInvoiceSchema = z.object({}).strict().optional().default({});

module.exports = {
  discountTypeEnum,
  taxTypeEnum,
  taxTreatmentEnum,
  additionalChargeTypeEnum,
  pricingModeEnum,
  discountSchema,
  taxSchema,
  additionalChargeSchema,
  calculationLineSchema,
  calculateDocumentInputSchema,
  customerInputSchema,
  createDocumentSchema,
  updateDocumentSchema,
  listDocumentsQuerySchema,
  idParam,
  transitionInvoiceStatusSchema,
  convertToInvoiceSchema,
};


