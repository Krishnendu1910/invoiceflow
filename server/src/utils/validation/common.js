const { z } = require("zod");

const objectId = z.string().trim().regex(/^[0-9a-fA-F]{24}$/, "Invalid id");

// India-first format (2-digit state code + 10-char PAN + entity + check
// digits). Kept as an isolated, swappable check so a future country's tax-id
// format can be added alongside it without touching the Customer model.
const gstinPattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const panPattern = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

// Empty string is treated the same as "not provided" so a form field that
// was typed into and cleared doesn't fail validation.
const emptyToUndefined = (value) => (typeof value === "string" && value.trim() === "" ? undefined : value);

// An optional trimmed string where an empty/whitespace-only value is treated
// as "not provided" rather than stored as "".
function optionalTrimmed(maxLength) {
  return z.preprocess(emptyToUndefined, z.string().trim().max(maxLength).optional());
}

const gstin = z.preprocess(
  emptyToUndefined,
  z.string().trim().toUpperCase().regex(gstinPattern, "Invalid GSTIN format").optional()
);

const pan = z.preprocess(
  emptyToUndefined,
  z.string().trim().toUpperCase().regex(panPattern, "Invalid PAN format").optional()
);

// Trims, drops empties, and case-insensitively de-duplicates (first
// occurrence wins) so "VIP" and "vip" don't both end up on the same record.
const tags = z
  .array(z.string().trim().max(40))
  .max(20)
  .optional()
  .default([])
  .transform((values) => {
    const seen = new Set();
    const result = [];
    for (const value of values) {
      if (!value) continue;
      const key = value.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(value);
    }
    return result;
  });

// Matches Business.country's 2-letter ISO code convention.
const countryCode = z.string().trim().length(2, "Country must be a 2-letter ISO code").toUpperCase();

const address = z
  .object({
    line1: optionalTrimmed(200),
    line2: optionalTrimmed(200),
    city: optionalTrimmed(100),
    state: optionalTrimmed(100),
    postalCode: optionalTrimmed(20),
    country: z.preprocess(emptyToUndefined, countryCode.optional()),
  })
  .optional();

const page = z.coerce.number().int().min(1).optional().default(1);
const limit = z.coerce.number().int().min(1).max(100).optional().default(20);

module.exports = { objectId, gstin, pan, tags, address, countryCode, optionalTrimmed, page, limit };
