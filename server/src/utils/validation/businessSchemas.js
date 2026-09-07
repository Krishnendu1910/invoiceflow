const { z } = require("zod");

// Suggested values only — the UI may offer these as quick picks, but the
// business type is a free-form string so users can enter their own.
const SUGGESTED_BUSINESS_TYPES = ["freelancer", "shop", "agency", "service_provider", "other"];

const createBusiness = z.object({
  name: z.string().trim().min(1, "Business name is required").max(150, "Business name is too long"),
  type: z.string().trim().min(1, "Business type is required").max(50, "Business type is too long").default("other"),
  country: z
    .string()
    .trim()
    .length(2, "Country must be a 2-letter ISO country code")
    .toUpperCase()
    .default("IN"),
  currency: z
    .object({
      code: z.string().trim().length(3, "Currency code must be 3 letters").toUpperCase(),
      symbol: z.string().trim().min(1).max(5),
    })
    .default({ code: "INR", symbol: "₹" }),
});

module.exports = { createBusiness, SUGGESTED_BUSINESS_TYPES };
