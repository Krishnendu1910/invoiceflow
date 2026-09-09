// A curated (not exhaustive) list of standard ISO 4217 currencies, closed
// so a business can't set an arbitrary/malformed currency code. Each entry
// carries the minor-unit decimal precision so downstream formatting (and,
// later, tax/discount rounding) doesn't have to special-case currencies
// like JPY (0 decimals) or BHD (3 decimals). Extend this list as needed —
// it isn't referenced by the schema itself, only by validation.
const CURRENCIES = [
  { code: "INR", symbol: "₹", decimals: 2 },
  { code: "USD", symbol: "$", decimals: 2 },
  { code: "EUR", symbol: "€", decimals: 2 },
  { code: "GBP", symbol: "£", decimals: 2 },
  { code: "AED", symbol: "د.إ", decimals: 2 },
  { code: "AUD", symbol: "A$", decimals: 2 },
  { code: "CAD", symbol: "C$", decimals: 2 },
  { code: "SGD", symbol: "S$", decimals: 2 },
  { code: "JPY", symbol: "¥", decimals: 0 },
  { code: "CNY", symbol: "¥", decimals: 2 },
  { code: "CHF", symbol: "CHF", decimals: 2 },
  { code: "NZD", symbol: "NZ$", decimals: 2 },
  { code: "ZAR", symbol: "R", decimals: 2 },
  { code: "HKD", symbol: "HK$", decimals: 2 },
  { code: "SAR", symbol: "﷼", decimals: 2 },
  { code: "QAR", symbol: "﷼", decimals: 2 },
  { code: "KWD", symbol: "د.ك", decimals: 3 },
  { code: "BHD", symbol: ".د.ب", decimals: 3 },
  { code: "OMR", symbol: "﷼", decimals: 3 },
  { code: "MYR", symbol: "RM", decimals: 2 },
  { code: "THB", symbol: "฿", decimals: 2 },
  { code: "IDR", symbol: "Rp", decimals: 2 },
  { code: "PHP", symbol: "₱", decimals: 2 },
  { code: "VND", symbol: "₫", decimals: 0 },
  { code: "BDT", symbol: "৳", decimals: 2 },
  { code: "PKR", symbol: "₨", decimals: 2 },
  { code: "LKR", symbol: "₨", decimals: 2 },
  { code: "NPR", symbol: "₨", decimals: 2 },
  { code: "SEK", symbol: "kr", decimals: 2 },
  { code: "NOK", symbol: "kr", decimals: 2 },
  { code: "DKK", symbol: "kr", decimals: 2 },
  { code: "PLN", symbol: "zł", decimals: 2 },
  { code: "BRL", symbol: "R$", decimals: 2 },
  { code: "MXN", symbol: "$", decimals: 2 },
  { code: "KES", symbol: "KSh", decimals: 2 },
  { code: "NGN", symbol: "₦", decimals: 2 },
  { code: "EGP", symbol: "£", decimals: 2 },
];

const CURRENCY_BY_CODE = new Map(CURRENCIES.map((c) => [c.code, c]));

function getCurrency(code) {
  return CURRENCY_BY_CODE.get(code);
}

module.exports = { CURRENCIES, getCurrency };
