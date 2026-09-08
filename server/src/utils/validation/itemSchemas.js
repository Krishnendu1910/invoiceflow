const { z } = require("zod");
const { tags, optionalTrimmed } = require("./common");

const ITEM_TYPES = ["product", "service"];
const CHARGE_TYPES = ["none", "percentage", "fixed"];

// Shared shape for defaultTax/defaultDiscount, which differ only in whether
// the magnitude field is called "rate" (tax) or "value" (discount) — kept as
// a factory so the percentage-cap rule can't drift between the two.
function chargeSchema(magnitudeField) {
  return z
    .object({
      type: z.enum(CHARGE_TYPES).optional().default("none"),
      [magnitudeField]: z.coerce.number().min(0, "Must be zero or greater").optional().default(0),
      label: optionalTrimmed(50),
    })
    .refine((value) => value.type !== "percentage" || value[magnitudeField] <= 100, {
      message: "A percentage cannot exceed 100.",
      path: [magnitudeField],
    });
}

const defaultTax = chargeSchema("rate");
const defaultDiscount = chargeSchema("value");

const createItem = z.object({
  type: z.enum(ITEM_TYPES),
  name: z.string().trim().min(1, "Name is required").max(150, "Name is too long"),
  description: optionalTrimmed(5000),
  sku: optionalTrimmed(50),
  hsnSac: optionalTrimmed(20),
  unit: optionalTrimmed(20),
  rate: z.coerce.number().min(0, "Rate must be zero or greater"),
  defaultTax: defaultTax.optional().default({ type: "none", rate: 0 }),
  defaultDiscount: defaultDiscount.optional().default({ type: "none", value: 0 }),
  tags,
  notes: optionalTrimmed(2000),
});

// Same field set, everything optional — a PATCH only changes what it sends.
const updateItem = z.object({
  type: z.enum(ITEM_TYPES).optional(),
  name: z.string().trim().min(1, "Name is required").max(150, "Name is too long").optional(),
  description: optionalTrimmed(5000),
  sku: optionalTrimmed(50),
  hsnSac: optionalTrimmed(20),
  unit: optionalTrimmed(20),
  rate: z.coerce.number().min(0, "Rate must be zero or greater").optional(),
  defaultTax: defaultTax.optional(),
  defaultDiscount: defaultDiscount.optional(),
  tags: tags.optional(),
  notes: optionalTrimmed(2000),
});

const listItems = z.object({
  search: optionalTrimmed(200),
  status: z.enum(["active", "archived", "all"]).optional().default("active"),
  type: z.enum(ITEM_TYPES).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  sort: z.enum(["name", "-name", "rate", "-rate", "createdAt", "-createdAt"]).optional().default("-createdAt"),
});

const idParam = z.object({ id: z.string().trim().regex(/^[0-9a-fA-F]{24}$/, "Invalid id") });

module.exports = { createItem, updateItem, listItems, idParam, ITEM_TYPES };
