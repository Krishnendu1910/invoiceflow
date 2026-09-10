// Pure decimal arithmetic and half-up rounding utility.
// Avoids JavaScript floating point inaccuracies (e.g. 0.1 + 0.2 !== 0.3)
// and ensures consistent financial rounding ("round half away from zero").

const MAX_ALLOWED_VALUE = 1e15; // 1 quadrillion: safe upper boundary for double-precision integers

function assertFiniteNumber(val, fieldName = "value") {
  if (typeof val !== "number" || !Number.isFinite(val)) {
    throw new TypeError(`Expected finite number for ${fieldName}, received ${val}`);
  }
  if (Math.abs(val) > MAX_ALLOWED_VALUE) {
    throw new RangeError(`Monetary ${fieldName} exceeds maximum allowable boundary of ${MAX_ALLOWED_VALUE}`);
  }
}

/**
 * Rounds a number to a specified number of decimal places using
 * commercial "round half away from zero" (half-up) rounding.
 */
function round(val, decimals = 2) {
  assertFiniteNumber(val, "value");
  if (!Number.isInteger(decimals) || decimals < 0) {
    throw new RangeError("Decimals must be a non-negative integer");
  }
  if (val === 0) return 0;
  const sign = val < 0 ? -1 : 1;
  const abs = Math.abs(val);
  // Using exponential notation avoids floating point edge cases in Math.round
  const rounded = Number(Math.round(Number(`${abs}e${decimals}`)) + `e-${decimals}`);
  return sign * rounded;
}

function add(a, b, decimals = 2) {
  assertFiniteNumber(a, "first operand");
  assertFiniteNumber(b, "second operand");
  return round(a + b, decimals);
}

function subtract(a, b, decimals = 2) {
  assertFiniteNumber(a, "first operand");
  assertFiniteNumber(b, "second operand");
  return round(a - b, decimals);
}

function multiply(a, b, decimals = 2) {
  assertFiniteNumber(a, "first operand");
  assertFiniteNumber(b, "second operand");
  return round(a * b, decimals);
}

function divide(a, b, decimals = 2) {
  assertFiniteNumber(a, "numerator");
  assertFiniteNumber(b, "denominator");
  if (b === 0) {
    throw new RangeError("Division by zero");
  }
  return round(a / b, decimals);
}

function percentage(base, ratePercent, decimals = 2) {
  assertFiniteNumber(base, "base");
  assertFiniteNumber(ratePercent, "ratePercent");
  return round(base * (ratePercent / 100), decimals);
}

function sum(numbers, decimals = 2) {
  if (!Array.isArray(numbers)) {
    throw new TypeError("Expected array of numbers to sum");
  }
  const total = numbers.reduce((acc, n) => {
    assertFiniteNumber(n, "item in sum");
    return acc + n;
  }, 0);
  return round(total, decimals);
}

module.exports = {
  MAX_ALLOWED_VALUE,
  assertFiniteNumber,
  round,
  add,
  subtract,
  multiply,
  divide,
  percentage,
  sum,
};

