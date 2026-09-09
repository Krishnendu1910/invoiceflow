// Computes the numbering-reset "period key" for a given reset policy, at a
// given point in time, for a business whose fiscal year starts in
// `fiscalStartMonth` (1-12; 4 = April, matching the India-first default —
// see Business.fiscalYear). Pure function, no I/O, so it's cheap to unit
// test independent of the database-backed allocation mechanism.
function getPeriodKey(resetPolicy, fiscalStartMonth, date = new Date()) {
  if (resetPolicy === "never") {
    return "ALL";
  }

  const year = date.getUTCFullYear();

  if (resetPolicy === "calendar_year") {
    return String(year);
  }

  if (resetPolicy === "financial_year") {
    const month = date.getUTCMonth() + 1; // 1-12
    const startYear = month >= fiscalStartMonth ? year : year - 1;
    return `${startYear}-${startYear + 1}`;
  }

  throw new Error(`Unknown reset policy: ${resetPolicy}`);
}

module.exports = { getPeriodKey };
