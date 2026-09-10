const { round, sum } = require("./money");
const { calculateDocumentInputSchema } = require("../../utils/validation/documentSchemas");

/**
 * Pure Calculation Service for Invoices and Quotations.
 *
 * Deterministic, decimal-safe arithmetic independent of Express, Mongoose, or database state.
 *
 * Standard GST & ERP Discount Proration Policy:
 * Line-level discounts are applied first to arrive at each line's initial taxable base.
 * When an overall document discount is present, it is PRORATED across applicable lines
 * proportionally based on each line's taxable base before final taxes are calculated.
 * This guarantees that:
 * 1. Final line taxable amounts reflect the actual discounted transaction value.
 * 2. Final line tax amounts reflect the true tax owed on that discounted value.
 * 3. sum(lines.taxableAmount) === document.taxableAmount === sum(taxes[].taxableAmount).
 * 4. sum(lines.tax.amount) === document.taxTotal === sum(taxes[].amount).
 *
 * Additional Charge Percentage Base:
 * A percentage-based additional charge is calculated against the document's final `taxableAmount`.
 */

function calculateLineItem(rawLine, pricingMode, decimals, proratedOverallDiscount = 0) {
  const { quantity, rate, discount = {}, tax = {} } = rawLine;

  const grossAmount = round(quantity * rate, decimals);

  // 1. Line-level discount
  let lineDiscountAmount = 0;
  const discountType = discount.type || "none";
  const discountVal = discount.value || 0;

  if (discountType === "percentage") {
    lineDiscountAmount = round(grossAmount * (discountVal / 100), decimals);
  } else if (discountType === "fixed") {
    lineDiscountAmount = round(Math.min(discountVal, grossAmount), decimals);
  }
  lineDiscountAmount = Math.min(lineDiscountAmount, grossAmount);

  const lineBase = round(grossAmount - lineDiscountAmount, decimals);

  // 2. Apply prorated overall discount to line base
  const allocatedDiscount = Math.min(proratedOverallDiscount, lineBase);

  let taxableAmount = 0;
  let lineTaxAmount = 0;
  let lineTotal = 0;

  const taxType = tax.type || "none";
  const taxRate = tax.rate || 0;
  const treatment = tax.treatment === "igst" ? "igst" : "cgst_sgst";

  if (pricingMode === "inclusive") {
    // Tax-inclusive: the net amount after line and overall discounts contains the tax
    const netInclusive = round(lineBase - allocatedDiscount, decimals);

    if (taxType === "percentage" && taxRate > 0) {
      taxableAmount = round(netInclusive / (1 + taxRate / 100), decimals);
      lineTaxAmount = round(netInclusive - taxableAmount, decimals);
    } else if (taxType === "fixed" && taxRate > 0) {
      lineTaxAmount = round(Math.min(taxRate, netInclusive), decimals);
      taxableAmount = round(netInclusive - lineTaxAmount, decimals);
    } else {
      taxableAmount = netInclusive;
      lineTaxAmount = 0;
    }

    lineTotal = netInclusive;
  } else {
    // Tax-exclusive: tax is calculated on the net taxable amount after line and overall discounts
    taxableAmount = round(lineBase - allocatedDiscount, decimals);

    if (taxType === "percentage" && taxRate > 0) {
      lineTaxAmount = round(taxableAmount * (taxRate / 100), decimals);
    } else if (taxType === "fixed" && taxRate > 0) {
      lineTaxAmount = round(taxRate, decimals);
    } else {
      lineTaxAmount = 0;
    }

    lineTotal = round(taxableAmount + lineTaxAmount, decimals);
  }

  // GST breakdown (CGST + SGST vs IGST)
  let cgst = { rate: 0, amount: 0 };
  let sgst = { rate: 0, amount: 0 };
  let igst = { rate: 0, amount: 0 };

  if (treatment === "cgst_sgst") {
    const halfRate = round(taxRate / 2, 4);
    const cgstAmount = round(lineTaxAmount / 2, decimals);
    const sgstAmount = round(lineTaxAmount - cgstAmount, decimals);
    cgst = { rate: halfRate, amount: cgstAmount };
    sgst = { rate: halfRate, amount: sgstAmount };
  } else {
    igst = { rate: taxRate, amount: lineTaxAmount };
  }

  return {
    ...rawLine,
    quantity,
    rate,
    grossAmount,
    discount: {
      type: discountType,
      value: discountVal,
      amount: lineDiscountAmount,
      label: discount.label || undefined,
    },
    allocatedOverallDiscount: allocatedDiscount,
    taxableAmount,
    tax: {
      type: taxType,
      rate: taxRate,
      amount: lineTaxAmount,
      treatment,
      label: tax.label || undefined,
      cgst,
      sgst,
      igst,
    },
    lineTotal,
  };
}

/**
 * Calculates entire document totals, line items, taxes, discounts, and additional charges.
 *
 * @param {Object} input - Raw or partial document calculation input
 * @returns {Object} Deterministically calculated document suitable for persistence
 */
function calculateDocument(input) {
  const parsed = calculateDocumentInputSchema.parse(input || {});
  const { lines: rawLines, pricingMode, overallDiscount: rawOverallDiscount, additionalCharges: rawCharges, currency } = parsed;
  const decimals = currency.decimals;

  // 1. Initial line bases after line-level discounts
  const lineBases = rawLines.map((line) => {
    const gross = round(line.quantity * line.rate, decimals);
    let disc = 0;
    const dt = line.discount?.type || "none";
    const dv = line.discount?.value || 0;
    if (dt === "percentage") {
      disc = round(gross * (dv / 100), decimals);
    } else if (dt === "fixed") {
      disc = round(Math.min(dv, gross), decimals);
    }
    disc = Math.min(disc, gross);
    return {
      gross,
      discountAmount: disc,
      base: round(gross - disc, decimals),
    };
  });

  const subtotal = round(sum(lineBases.map((l) => l.gross), decimals), decimals);
  const lineDiscountTotal = round(sum(lineBases.map((l) => l.discountAmount), decimals), decimals);
  const linesBaseTotal = round(sum(lineBases.map((l) => l.base), decimals), decimals);

  // 2. Resolve document-level overall discount
  let overallDiscountAmount = 0;
  const overallDiscountType = rawOverallDiscount.type || "none";
  const overallDiscountVal = rawOverallDiscount.value || 0;

  if (overallDiscountType === "percentage") {
    overallDiscountAmount = round(linesBaseTotal * (overallDiscountVal / 100), decimals);
  } else if (overallDiscountType === "fixed") {
    if (overallDiscountVal > linesBaseTotal) {
      throw new RangeError(
        `Overall discount (${overallDiscountVal}) cannot exceed applicable document taxable base (${linesBaseTotal}).`
      );
    }
    overallDiscountAmount = round(overallDiscountVal, decimals);
  }

  const overallDiscount = {
    type: overallDiscountType,
    value: overallDiscountVal,
    amount: overallDiscountAmount,
    label: rawOverallDiscount.label || undefined,
  };

  // 3. Proportionally prorate overall discount across lines with positive pre-overall-discount base
  // This guarantees that:
  // - Only lines with positive base participate
  // - The final participating line receives the rounding remainder
  // - sum(lineProratedDiscounts) === overallDiscountAmount exactly
  // - Zero-base lines (e.g. 100% line discount or free items) receive 0 allocation without truncating the discount
  const lineProratedDiscounts = new Array(rawLines.length).fill(0);

  const eligibleIndices = [];
  for (let i = 0; i < lineBases.length; i++) {
    if (lineBases[i].base > 0) {
      eligibleIndices.push(i);
    }
  }

  if (eligibleIndices.length > 0 && overallDiscountAmount > 0) {
    let allocatedSoFar = 0;
    let runningBaseSoFar = 0;

    for (let k = 0; k < eligibleIndices.length; k++) {
      const i = eligibleIndices[k];
      if (k === eligibleIndices.length - 1) {
        // The final participating line receives the remaining unallocated discount
        lineProratedDiscounts[i] = round(overallDiscountAmount - allocatedSoFar, decimals);
      } else {
        runningBaseSoFar += lineBases[i].base;
        const targetCumulative = round(overallDiscountAmount * (runningBaseSoFar / linesBaseTotal), decimals);
        lineProratedDiscounts[i] = round(targetCumulative - allocatedSoFar, decimals);
        allocatedSoFar = targetCumulative;
      }
    }
  }

  // 4. Calculate final lines with their prorated overall discount share
  const lines = rawLines.map((line, idx) =>
    calculateLineItem(line, pricingMode, decimals, lineProratedDiscounts[idx])
  );

  // 5. Document taxable amount and tax aggregation
  const taxableAmount = round(sum(lines.map((l) => l.taxableAmount), decimals), decimals);
  const taxTotal = round(sum(lines.map((l) => l.tax.amount), decimals), decimals);

  // Group line taxes by rate, treatment, and label
  const taxGroupMap = new Map();

  for (const line of lines) {
    if (line.tax.amount > 0 || line.tax.rate > 0) {
      const key = `${line.tax.type}_${line.tax.rate}_${line.tax.treatment}_${line.tax.label || ""}`;
      if (!taxGroupMap.has(key)) {
        taxGroupMap.set(key, {
          type: line.tax.type,
          rate: line.tax.rate,
          treatment: line.tax.treatment,
          label: line.tax.label || undefined,
          taxableAmount: line.taxableAmount,
          amount: line.tax.amount,
          cgst: { rate: line.tax.cgst.rate, amount: line.tax.cgst.amount },
          sgst: { rate: line.tax.sgst.rate, amount: line.tax.sgst.amount },
          igst: { rate: line.tax.igst.rate, amount: line.tax.igst.amount },
        });
      } else {
        const group = taxGroupMap.get(key);
        group.taxableAmount = round(group.taxableAmount + line.taxableAmount, decimals);
        group.amount = round(group.amount + line.tax.amount, decimals);
        group.cgst.amount = round(group.cgst.amount + line.tax.cgst.amount, decimals);
        group.sgst.amount = round(group.sgst.amount + line.tax.sgst.amount, decimals);
        group.igst.amount = round(group.igst.amount + line.tax.igst.amount, decimals);
      }
    }
  }

  const taxes = Array.from(taxGroupMap.values());

  // 6. Additional charges calculated against final document taxableAmount
  const additionalCharges = rawCharges.map((charge) => {
    let amount = 0;
    if (charge.type === "percentage") {
      amount = round(taxableAmount * (charge.value / 100), decimals);
    } else if (charge.type === "fixed") {
      amount = round(charge.value, decimals);
    }
    return {
      label: charge.label,
      type: charge.type,
      value: charge.value,
      amount,
    };
  });

  const additionalChargesTotal = round(sum(additionalCharges.map((c) => c.amount), decimals), decimals);

  // 7. Grand total
  const grandTotal = round(taxableAmount + taxTotal + additionalChargesTotal, decimals);

  return {
    pricingMode,
    currency,
    lines,
    subtotal,
    lineDiscountTotal,
    overallDiscount,
    taxableAmount,
    taxes,
    taxTotal,
    additionalCharges,
    additionalChargesTotal,
    grandTotal,
  };
}

module.exports = {
  calculateLineItem,
  calculateDocument,
};
