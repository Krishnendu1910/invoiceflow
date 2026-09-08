const { z } = require("zod");
const { gstin, pan, tags, address, optionalTrimmed } = require("./common");

const CUSTOMER_TYPES = ["individual", "business"];

const email = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().toLowerCase().email("Invalid email address").optional()
);

// GST rule lives once, here, so create and update can't drift apart.
const taxInput = z
  .object({
    gstRegistered: z.boolean().optional().default(false),
    gstin,
    pan,
  })
  .refine((value) => !value.gstRegistered || Boolean(value.gstin), {
    message: "GSTIN is required when the customer is GST registered.",
    path: ["gstin"],
  });

const createCustomer = z.object({
  type: z.enum(CUSTOMER_TYPES),
  name: z.string().trim().min(1, "Name is required").max(150, "Name is too long"),
  companyName: optionalTrimmed(150),
  email,
  phone: optionalTrimmed(20),
  tax: taxInput.optional().default({ gstRegistered: false }),
  billingAddress: address,
  shippingAddress: address,
  tags,
  notes: optionalTrimmed(2000),
});

// Same field set, everything optional — a PATCH only changes what it sends.
// `tax`/`billingAddress`/`shippingAddress`, when sent, replace the whole
// sub-object (matching how the rest of the app treats nested objects).
const updateCustomer = z.object({
  type: z.enum(CUSTOMER_TYPES).optional(),
  name: z.string().trim().min(1, "Name is required").max(150, "Name is too long").optional(),
  companyName: optionalTrimmed(150),
  email,
  phone: optionalTrimmed(20),
  tax: taxInput.optional(),
  billingAddress: address,
  shippingAddress: address,
  tags: tags.optional(),
  notes: optionalTrimmed(2000),
});

const listCustomers = z.object({
  search: optionalTrimmed(200),
  status: z.enum(["active", "archived", "all"]).optional().default("active"),
  type: z.enum(CUSTOMER_TYPES).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  sort: z.enum(["name", "-name", "createdAt", "-createdAt"]).optional().default("-createdAt"),
});

const idParam = z.object({ id: z.string().trim().regex(/^[0-9a-fA-F]{24}$/, "Invalid id") });

module.exports = { createCustomer, updateCustomer, listCustomers, idParam, CUSTOMER_TYPES };
