const { calculateDocument, calculateLineItem } = require("../src/services/calculation/calculationEngine");
const { round, add, subtract, multiply, divide, percentage, sum, MAX_ALLOWED_VALUE } = require("../src/services/calculation/money");

describe("Calculation Engine (Phase 5.2)", () => {
  // 1. Simple single line
  it("1. calculates simple single line without tax or discount", () => {
    const result = calculateDocument({
      lines: [
        {
          name: "Design Services",
          quantity: 2,
          rate: 500,
        },
      ],
      pricingMode: "exclusive",
    });

    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].grossAmount).toBe(1000);
    expect(result.lines[0].taxableAmount).toBe(1000);
    expect(result.lines[0].lineTotal).toBe(1000);
    expect(result.subtotal).toBe(1000);
    expect(result.taxableAmount).toBe(1000);
    expect(result.taxTotal).toBe(0);
    expect(result.grandTotal).toBe(1000);
  });

  // 2. Multiple lines
  it("2. calculates multiple lines and aggregates subtotal accurately", () => {
    const result = calculateDocument({
      lines: [
        { name: "Item A", quantity: 3, rate: 150 },
        { name: "Item B", quantity: 2, rate: 250 },
        { name: "Item C", quantity: 1, rate: 100 },
      ],
      pricingMode: "exclusive",
    });

    expect(result.lines).toHaveLength(3);
    expect(result.lines[0].grossAmount).toBe(450);
    expect(result.lines[1].grossAmount).toBe(500);
    expect(result.lines[2].grossAmount).toBe(100);
    expect(result.subtotal).toBe(1050);
    expect(result.grandTotal).toBe(1050);
  });

  // 3. Percentage line discount
  it("3. calculates percentage line discount correctly", () => {
    const result = calculateDocument({
      lines: [
        {
          name: "Product with 10% discount",
          quantity: 2,
          rate: 1000,
          discount: { type: "percentage", value: 10 },
        },
      ],
      pricingMode: "exclusive",
    });

    expect(result.lines[0].grossAmount).toBe(2000);
    expect(result.lines[0].discount.amount).toBe(200);
    expect(result.lines[0].taxableAmount).toBe(1800);
    expect(result.lineDiscountTotal).toBe(200);
    expect(result.taxableAmount).toBe(1800);
    expect(result.grandTotal).toBe(1800);
  });

  // 4. Fixed line discount
  it("4. calculates fixed line discount correctly and caps at gross amount", () => {
    const result = calculateDocument({
      lines: [
        {
          name: "Product with ₹150 discount",
          quantity: 2,
          rate: 500,
          discount: { type: "fixed", value: 150 },
        },
        {
          name: "Product with excessive discount capped at gross",
          quantity: 1,
          rate: 100,
          discount: { type: "fixed", value: 250 },
        },
      ],
      pricingMode: "exclusive",
    });

    expect(result.lines[0].grossAmount).toBe(1000);
    expect(result.lines[0].discount.amount).toBe(150);
    expect(result.lines[0].taxableAmount).toBe(850);

    expect(result.lines[1].grossAmount).toBe(100);
    expect(result.lines[1].discount.amount).toBe(100);
    expect(result.lines[1].taxableAmount).toBe(0);

    expect(result.subtotal).toBe(1100);
    expect(result.lineDiscountTotal).toBe(250);
    expect(result.taxableAmount).toBe(850);
    expect(result.grandTotal).toBe(850);
  });

  // 5. Percentage overall discount prorated across lines
  it("5. calculates percentage overall discount prorated across lines", () => {
    const result = calculateDocument({
      lines: [
        { name: "Item 1", quantity: 2, rate: 500 }, // 1000 base
        { name: "Item 2", quantity: 1, rate: 1000 }, // 1000 base
      ],
      overallDiscount: { type: "percentage", value: 15 },
      pricingMode: "exclusive",
    });

    expect(result.subtotal).toBe(2000);
    expect(result.overallDiscount.amount).toBe(300); // 15% of 2000
    expect(result.lines[0].allocatedOverallDiscount).toBe(150);
    expect(result.lines[0].taxableAmount).toBe(850);
    expect(result.lines[1].allocatedOverallDiscount).toBe(150);
    expect(result.lines[1].taxableAmount).toBe(850);
    expect(result.taxableAmount).toBe(1700);
    expect(result.grandTotal).toBe(1700);
  });

  // 6. Fixed overall discount prorated and explicit bounds
  it("6. calculates fixed overall discount prorated across lines and rejects when exceeding base", () => {
    const result = calculateDocument({
      lines: [
        { name: "Item 1", quantity: 1, rate: 500 },
      ],
      overallDiscount: { type: "fixed", value: 100 },
      pricingMode: "exclusive",
    });

    expect(result.subtotal).toBe(500);
    expect(result.overallDiscount.amount).toBe(100);
    expect(result.taxableAmount).toBe(400);
    expect(result.grandTotal).toBe(400);

    // Overall discount equal to taxable amount
    const exactResult = calculateDocument({
      lines: [{ name: "Item 1", quantity: 1, rate: 500 }],
      overallDiscount: { type: "fixed", value: 500 },
    });
    expect(exactResult.taxableAmount).toBe(0);
    expect(exactResult.grandTotal).toBe(0);

    // Overall discount greater than taxable amount -> must reject explicitly
    expect(() => {
      calculateDocument({
        lines: [{ name: "Item 1", quantity: 1, rate: 200 }],
        overallDiscount: { type: "fixed", value: 500 },
      });
    }).toThrow(/Overall discount \(500\) cannot exceed applicable document taxable base/);
  });

  // 7. Percentage tax
  it("7. calculates percentage tax on taxable amount", () => {
    const result = calculateDocument({
      lines: [
        {
          name: "Standard Item",
          quantity: 2,
          rate: 500,
          discount: { type: "percentage", value: 10 }, // 1000 - 100 = 900
          tax: { type: "percentage", rate: 18, treatment: "igst" },
        },
      ],
      pricingMode: "exclusive",
    });

    expect(result.lines[0].taxableAmount).toBe(900);
    expect(result.lines[0].tax.amount).toBe(162); // 18% of 900
    expect(result.lines[0].lineTotal).toBe(1062);
    expect(result.taxTotal).toBe(162);
    expect(result.grandTotal).toBe(1062);
  });

  // 8. Fixed tax
  it("8. calculates fixed tax correctly", () => {
    const result = calculateDocument({
      lines: [
        {
          name: "Custom Duty Item",
          quantity: 1,
          rate: 400,
          tax: { type: "fixed", rate: 50, treatment: "igst" },
        },
      ],
      pricingMode: "exclusive",
    });

    expect(result.lines[0].taxableAmount).toBe(400);
    expect(result.lines[0].tax.amount).toBe(50);
    expect(result.lines[0].lineTotal).toBe(450);
    expect(result.taxTotal).toBe(50);
    expect(result.grandTotal).toBe(450);
  });

  // 9. Tax-inclusive pricing
  it("9. calculates tax-inclusive pricing correctly extracting tax from rate", () => {
    // 1 unit @ ₹118 inclusive of 18% GST -> base = ₹100, tax = ₹18
    const result = calculateDocument({
      lines: [
        {
          name: "Inclusive Product",
          quantity: 1,
          rate: 118,
          tax: { type: "percentage", rate: 18, treatment: "igst" },
        },
      ],
      pricingMode: "inclusive",
    });

    expect(result.lines[0].grossAmount).toBe(118);
    expect(result.lines[0].taxableAmount).toBe(100);
    expect(result.lines[0].tax.amount).toBe(18);
    expect(result.lines[0].lineTotal).toBe(118);
    expect(result.subtotal).toBe(118);
    expect(result.taxableAmount).toBe(100);
    expect(result.taxTotal).toBe(18);
    expect(result.grandTotal).toBe(118);
  });

  // 10. Tax-exclusive pricing
  it("10. calculates tax-exclusive pricing adding tax on top", () => {
    const result = calculateDocument({
      lines: [
        {
          name: "Exclusive Product",
          quantity: 1,
          rate: 100,
          tax: { type: "percentage", rate: 18, treatment: "igst" },
        },
      ],
      pricingMode: "exclusive",
    });

    expect(result.lines[0].taxableAmount).toBe(100);
    expect(result.lines[0].tax.amount).toBe(18);
    expect(result.lines[0].lineTotal).toBe(118);
    expect(result.taxableAmount).toBe(100);
    expect(result.taxTotal).toBe(18);
    expect(result.grandTotal).toBe(118);
  });

  // 11. CGST + SGST
  it("11. splits CGST + SGST evenly with no penny discrepancy", () => {
    // 1 item @ ₹35.35 with 5% GST -> total tax = ₹1.77 -> CGST 0.89, SGST 0.88 (sum = 1.77)
    const result = calculateDocument({
      lines: [
        {
          name: "Goods",
          quantity: 1,
          rate: 35.35,
          tax: { type: "percentage", rate: 5, treatment: "cgst_sgst" },
        },
      ],
      pricingMode: "exclusive",
    });

    const line = result.lines[0];
    expect(line.tax.amount).toBe(1.77);
    expect(line.tax.cgst.rate).toBe(2.5);
    expect(line.tax.sgst.rate).toBe(2.5);
    expect(line.tax.cgst.amount + line.tax.sgst.amount).toBe(1.77);
    expect(line.tax.igst.amount).toBe(0);

    const docTax = result.taxes[0];
    expect(docTax.cgst.amount + docTax.sgst.amount).toBe(1.77);
    expect(result.taxTotal).toBe(1.77);
    expect(result.grandTotal).toBe(37.12);
  });

  // 12. IGST
  it("12. allocates IGST fully without CGST/SGST", () => {
    const result = calculateDocument({
      lines: [
        {
          name: "Inter-state Service",
          quantity: 2,
          rate: 1000,
          tax: { type: "percentage", rate: 18, treatment: "igst" },
        },
      ],
      pricingMode: "exclusive",
    });

    const line = result.lines[0];
    expect(line.tax.amount).toBe(360);
    expect(line.tax.igst.rate).toBe(18);
    expect(line.tax.igst.amount).toBe(360);
    expect(line.tax.cgst.amount).toBe(0);
    expect(line.tax.sgst.amount).toBe(0);
    expect(result.taxTotal).toBe(360);
    expect(result.grandTotal).toBe(2360);
  });

  // 13. Multiple additional charges
  it("13. aggregates multiple additional charges correctly", () => {
    const result = calculateDocument({
      lines: [{ name: "Item", quantity: 1, rate: 1000 }],
      additionalCharges: [
        { label: "Freight", type: "fixed", value: 150 },
        { label: "Insurance", type: "fixed", value: 50 },
        { label: "Handling (2%)", type: "percentage", value: 2 }, // 2% of 1000 = 20
      ],
      pricingMode: "exclusive",
    });

    expect(result.additionalCharges).toHaveLength(3);
    expect(result.additionalCharges[0].amount).toBe(150);
    expect(result.additionalCharges[1].amount).toBe(50);
    expect(result.additionalCharges[2].amount).toBe(20);
    expect(result.additionalChargesTotal).toBe(220);
    expect(result.grandTotal).toBe(1220);
  });

  // 14. Fixed additional charge
  it("14. handles fixed additional charge", () => {
    const result = calculateDocument({
      lines: [{ name: "Widget", quantity: 2, rate: 250 }],
      additionalCharges: [{ label: "Packaging", type: "fixed", value: 45.5 }],
    });

    expect(result.subtotal).toBe(500);
    expect(result.additionalChargesTotal).toBe(45.5);
    expect(result.grandTotal).toBe(545.5);
  });

  // 15. Percentage additional charge calculated against taxableAmount
  it("15. calculates percentage additional charge strictly against document taxableAmount", () => {
    const result = calculateDocument({
      lines: [
        {
          name: "Item",
          quantity: 2,
          rate: 1000,
          discount: { type: "percentage", value: 10 }, // 2000 - 200 = 1800
        },
      ],
      overallDiscount: { type: "fixed", value: 300 }, // 1800 - 300 = 1500 taxableAmount
      additionalCharges: [
        { label: "Service Fee 5%", type: "percentage", value: 5 }, // 5% of 1500 = 75
      ],
    });

    expect(result.taxableAmount).toBe(1500);
    expect(result.additionalCharges[0].amount).toBe(75);
    expect(result.additionalChargesTotal).toBe(75);
    expect(result.grandTotal).toBe(1575);
  });

  // 16. Zero tax
  it("16. handles zero tax rate and none tax type without NaN", () => {
    const result = calculateDocument({
      lines: [
        { name: "Exempt Item", quantity: 5, rate: 20, tax: { type: "none", rate: 0 } },
        { name: "Zero Rated Item", quantity: 2, rate: 50, tax: { type: "percentage", rate: 0 } },
      ],
    });

    expect(result.lines[0].tax.amount).toBe(0);
    expect(result.lines[1].tax.amount).toBe(0);
    expect(result.taxTotal).toBe(0);
    expect(result.grandTotal).toBe(200);
  });

  // 17. Zero discount
  it("17. handles zero discount safely", () => {
    const result = calculateDocument({
      lines: [
        { name: "Item", quantity: 3, rate: 100, discount: { type: "none", value: 0 } },
        { name: "Item 2", quantity: 2, rate: 50, discount: { type: "percentage", value: 0 } },
      ],
      overallDiscount: { type: "fixed", value: 0 },
    });

    expect(result.lineDiscountTotal).toBe(0);
    expect(result.overallDiscount.amount).toBe(0);
    expect(result.taxableAmount).toBe(400);
    expect(result.grandTotal).toBe(400);
  });

  // 18. Decimal quantities and rates
  it("18. calculates decimal quantities and fractional rates accurately", () => {
    // 3.75 hours @ ₹1250.50 = 4689.375 -> rounded to 4689.38
    const result = calculateDocument({
      lines: [
        { name: "Consulting Hours", quantity: 3.75, rate: 1250.5 },
      ],
    });

    expect(result.lines[0].grossAmount).toBe(4689.38);
    expect(result.subtotal).toBe(4689.38);
    expect(result.grandTotal).toBe(4689.38);
  });

  // 19. Rounding edge cases & precision guarantees
  it("19. applies consistent half-up commercial rounding for edge cases", () => {
    // 1.005 -> 1.01
    expect(round(1.005, 2)).toBe(1.01);
    // 2.675 -> 2.68
    expect(round(2.675, 2)).toBe(2.68);
    // 35.405 -> 35.41
    expect(round(35.405, 2)).toBe(35.41);
    // 10.10 * 3 -> 30.30
    expect(multiply(10.10, 3, 2)).toBe(30.3);
    // Negative numbers
    expect(round(-1.005, 2)).toBe(-1.01);
    expect(round(-2.675, 2)).toBe(-2.68);
    // Repeating percentages: 100 / 3 -> 33.33
    expect(divide(100, 3, 2)).toBe(33.33);
  });

  // 20. Invalid and negative inputs
  it("20. rejects invalid, negative, or malformed inputs", () => {
    expect(() => {
      calculateDocument({
        lines: [{ name: "Invalid", quantity: -2, rate: 100 }],
      });
    }).toThrow();

    expect(() => {
      calculateDocument({
        lines: [{ name: "Invalid", quantity: 0, rate: 100 }],
      });
    }).toThrow();

    expect(() => {
      calculateDocument({
        lines: [{ name: "Invalid", quantity: 1, rate: -50 }],
      });
    }).toThrow();

    expect(() => {
      calculateDocument({
        lines: [
          {
            name: "Invalid",
            quantity: 1,
            rate: 100,
            discount: { type: "percentage", value: 150 },
          },
        ],
      });
    }).toThrow();
  });

  // 21. Very small monetary values
  it("21. handles very small monetary values without losing precision", () => {
    const result = calculateDocument({
      lines: [
        { name: "Microservice call", quantity: 1000, rate: 0.01 },
        { name: "Sub-cent fee", quantity: 1, rate: 0.05 },
      ],
    });

    expect(result.lines[0].grossAmount).toBe(10);
    expect(result.lines[1].grossAmount).toBe(0.05);
    expect(result.subtotal).toBe(10.05);
    expect(result.grandTotal).toBe(10.05);
  });

  // 22. Large but valid values and boundary guards
  it("22. handles large monetary values and rejects oversized inputs beyond MAX_ALLOWED_VALUE", () => {
    const result = calculateDocument({
      lines: [
        {
          name: "Enterprise Machinery",
          quantity: 50,
          rate: 10000000,
          tax: { type: "percentage", rate: 18, treatment: "igst" },
        },
      ],
    });

    expect(result.subtotal).toBe(500000000);
    expect(result.taxTotal).toBe(90000000);
    expect(result.grandTotal).toBe(590000000);
    expect(Number.isFinite(result.grandTotal)).toBe(true);

    // Oversized input > 1e15 (MAX_ALLOWED_VALUE) must throw RangeError rather than produce NaN
    expect(() => {
      round(1e16, 2);
    }).toThrow(RangeError);
    expect(() => {
      calculateDocument({
        lines: [{ name: "Gigantic", quantity: 1, rate: 1e16 }],
      });
    }).toThrow(RangeError);
  });

  // 23. No floating point artifacts (0.1 + 0.2)
  it("23. eliminates floating point artifacts such as 0.1 + 0.2", () => {
    expect(add(0.1, 0.2, 2)).toBe(0.3);
    expect(add(0.1, 0.2, 2)).not.toBe(0.30000000000000004);

    const result = calculateDocument({
      lines: [
        { name: "Line 1", quantity: 1, rate: 0.1 },
        { name: "Line 2", quantity: 1, rate: 0.2 },
      ],
    });

    expect(result.subtotal).toBe(0.3);
    expect(result.grandTotal).toBe(0.3);
  });

  // Deep tests for Overall Discount Proration and Multi-Tax Rate GST alignment
  describe("Overall Discount Proration & Tax Realignment", () => {
    it("prorates overall discount on one line and recomputes tax on discounted taxable base", () => {
      // 1 line of ₹100 with 18% IGST; overall discount ₹50
      // Line taxable base before overall discount: ₹100
      // Line taxable base after overall discount: ₹50
      // Line tax at 18%: 18% of ₹50 = ₹9.00
      // Grand total: ₹50 + ₹9.00 = ₹59.00
      const result = calculateDocument({
        lines: [
          { name: "Consulting", quantity: 1, rate: 100, tax: { type: "percentage", rate: 18, treatment: "igst" } },
        ],
        overallDiscount: { type: "fixed", value: 50 },
        pricingMode: "exclusive",
      });

      expect(result.subtotal).toBe(100);
      expect(result.overallDiscount.amount).toBe(50);
      expect(result.lines[0].allocatedOverallDiscount).toBe(50);
      expect(result.lines[0].taxableAmount).toBe(50);
      expect(result.lines[0].tax.amount).toBe(9);
      expect(result.lines[0].lineTotal).toBe(59);

      expect(result.taxableAmount).toBe(50);
      expect(result.taxTotal).toBe(9);
      expect(result.grandTotal).toBe(59);

      // Verify taxes[] summary matches discounted base
      expect(result.taxes).toHaveLength(1);
      expect(result.taxes[0].taxableAmount).toBe(50);
      expect(result.taxes[0].amount).toBe(9);
    });

    it("prorates overall discount proportionally across multiple lines with the same tax rate", () => {
      // Line 1: ₹300 (60% of ₹500 base)
      // Line 2: ₹200 (40% of ₹500 base)
      // Overall discount: ₹100
      // Line 1 allocated: 60% of ₹100 = ₹60 -> taxable: ₹240 -> 18% tax: ₹43.20
      // Line 2 allocated: 40% of ₹100 = ₹40 -> taxable: ₹160 -> 18% tax: ₹28.80
      // Total taxable: ₹400, Total tax: ₹72.00 (exactly 18% of 400)
      const result = calculateDocument({
        lines: [
          { name: "Item A", quantity: 3, rate: 100, tax: { type: "percentage", rate: 18, treatment: "igst" } },
          { name: "Item B", quantity: 2, rate: 100, tax: { type: "percentage", rate: 18, treatment: "igst" } },
        ],
        overallDiscount: { type: "fixed", value: 100 },
        pricingMode: "exclusive",
      });

      expect(result.lines[0].allocatedOverallDiscount).toBe(60);
      expect(result.lines[0].taxableAmount).toBe(240);
      expect(result.lines[0].tax.amount).toBe(43.2);

      expect(result.lines[1].allocatedOverallDiscount).toBe(40);
      expect(result.lines[1].taxableAmount).toBe(160);
      expect(result.lines[1].tax.amount).toBe(28.8);

      expect(result.taxableAmount).toBe(400);
      expect(result.taxTotal).toBe(72);
      expect(result.grandTotal).toBe(472);

      expect(result.taxes[0].taxableAmount).toBe(400);
      expect(result.taxes[0].amount).toBe(72);
    });

    it("prorates overall discount across multiple lines with DIFFERENT tax rates and mixed CGST/SGST and IGST", () => {
      // Line 1: ₹1000 base, 18% GST (CGST+SGST)
      // Line 2: ₹500 base, 12% IGST
      // Total base: ₹1500
      // Overall discount: ₹300 (20%)
      // Line 1 share: 1000/1500 * 300 = ₹200 -> taxable: ₹800 -> 18% GST = ₹144 (CGST ₹72, SGST ₹72)
      // Line 2 share: 500/1500 * 300 = ₹100 -> taxable: ₹400 -> 12% IGST = ₹48
      // Total taxable: ₹1200, Total tax: ₹192
      const result = calculateDocument({
        lines: [
          { name: "Software", quantity: 1, rate: 1000, tax: { type: "percentage", rate: 18, treatment: "cgst_sgst" } },
          { name: "Hardware", quantity: 1, rate: 500, tax: { type: "percentage", rate: 12, treatment: "igst" } },
        ],
        overallDiscount: { type: "fixed", value: 300 },
        pricingMode: "exclusive",
      });

      expect(result.lines[0].allocatedOverallDiscount).toBe(200);
      expect(result.lines[0].taxableAmount).toBe(800);
      expect(result.lines[0].tax.amount).toBe(144);
      expect(result.lines[0].tax.cgst.amount).toBe(72);
      expect(result.lines[0].tax.sgst.amount).toBe(72);

      expect(result.lines[1].allocatedOverallDiscount).toBe(100);
      expect(result.lines[1].taxableAmount).toBe(400);
      expect(result.lines[1].tax.amount).toBe(48);
      expect(result.lines[1].tax.igst.amount).toBe(48);

      expect(result.taxableAmount).toBe(1200);
      expect(result.taxTotal).toBe(192);
      expect(result.grandTotal).toBe(1392);

      // Verify mathematical identity: sum(lines.taxableAmount) === document.taxableAmount
      const sumLineTaxable = sum(result.lines.map((l) => l.taxableAmount), 2);
      expect(sumLineTaxable).toBe(result.taxableAmount);

      // Verify mathematical identity: sum(lines.tax.amount) === document.taxTotal
      const sumLineTax = sum(result.lines.map((l) => l.tax.amount), 2);
      expect(sumLineTax).toBe(result.taxTotal);

      // Verify taxes summary breakdown
      expect(result.taxes).toHaveLength(2);
      const tax18 = result.taxes.find((t) => t.rate === 18);
      const tax12 = result.taxes.find((t) => t.rate === 12);
      expect(tax18.taxableAmount).toBe(800);
      expect(tax18.amount).toBe(144);
      expect(tax12.taxableAmount).toBe(400);
      expect(tax12.amount).toBe(48);
    });

    it("handles rounding allocation edge cases where prorated discount produces cent fractions", () => {
      // 3 lines of ₹100 each (Total ₹300). Overall discount ₹10.
      // ₹10 split 3 ways is 3.3333... each.
      // Cumulative allocation guarantees:
      // Line 0: target = round(10 * 100/300) = 3.33 -> 3.33
      // Line 1: target = round(10 * 200/300) = 6.67 -> 6.67 - 3.33 = 3.34
      // Line 2: target = round(10 * 300/300) = 10.00 -> 10.00 - 6.67 = 3.33
      // Sum of allocated discounts: 3.33 + 3.34 + 3.33 = 10.00 exactly!
      const result = calculateDocument({
        lines: [
          { name: "Item 1", quantity: 1, rate: 100 },
          { name: "Item 2", quantity: 1, rate: 100 },
          { name: "Item 3", quantity: 1, rate: 100 },
        ],
        overallDiscount: { type: "fixed", value: 10 },
      });

      const allocatedDiscounts = result.lines.map((l) => l.allocatedOverallDiscount);
      expect(allocatedDiscounts).toEqual([3.33, 3.34, 3.33]);
      expect(sum(allocatedDiscounts, 2)).toBe(10);
      expect(result.taxableAmount).toBe(290);
      expect(result.grandTotal).toBe(290);
    });

    it("handles tax-inclusive pricing with overall discount proration", () => {
      // 1 item @ ₹118 inclusive (taxable 100, tax 18)
      // Overall discount: 10%
      // 10% of 118 = ₹11.80 overall discount
      // Net inclusive after discount: ₹118 - ₹11.80 = ₹106.20
      // Extracted taxable base: 106.20 / 1.18 = ₹90.00
      // Extracted tax: 106.20 - 90.00 = ₹16.20
      // Grand total = ₹106.20
      const result = calculateDocument({
        lines: [
          { name: "Inclusive Item", quantity: 1, rate: 118, tax: { type: "percentage", rate: 18, treatment: "igst" } },
        ],
        overallDiscount: { type: "percentage", value: 10 },
        pricingMode: "inclusive",
      });

      expect(result.subtotal).toBe(118);
      expect(result.overallDiscount.amount).toBe(11.8);
      expect(result.lines[0].allocatedOverallDiscount).toBe(11.8);
      expect(result.lines[0].taxableAmount).toBe(90);
      expect(result.lines[0].tax.amount).toBe(16.2);
      expect(result.lines[0].lineTotal).toBe(106.2);

      expect(result.taxableAmount).toBe(90);
      expect(result.taxTotal).toBe(16.2);
      expect(result.grandTotal).toBe(106.2);
    });

    it("correctly prorates overall discount when a zero-base line is at the end", () => {
      // Line 1: rate 100 (base 100)
      // Line 2: rate 50, 100% discount (base 0)
      // Overall discount: 25
      // Line 1 must receive the full 25; Line 2 receives 0.
      const result = calculateDocument({
        lines: [
          { name: "Paid Item", quantity: 1, rate: 100, tax: { type: "percentage", rate: 18, treatment: "igst" } },
          { name: "Free Item", quantity: 1, rate: 50, discount: { type: "percentage", value: 100 } },
        ],
        overallDiscount: { type: "fixed", value: 25 },
        pricingMode: "exclusive",
      });

      expect(result.lines[0].allocatedOverallDiscount).toBe(25);
      expect(result.lines[0].taxableAmount).toBe(75);
      expect(result.lines[0].tax.amount).toBe(13.5); // 18% of 75

      expect(result.lines[1].allocatedOverallDiscount).toBe(0);
      expect(result.lines[1].taxableAmount).toBe(0);

      expect(result.overallDiscount.amount).toBe(25);
      expect(sum(result.lines.map((l) => l.allocatedOverallDiscount), 2)).toBe(25);
      expect(result.taxableAmount).toBe(75);
      expect(result.taxTotal).toBe(13.5);
      expect(result.grandTotal).toBe(88.5);
    });

    it("correctly prorates overall discount when zero-base lines are in the middle", () => {
      // Line 1: base 100
      // Line 2: base 0 (free sample)
      // Line 3: base 100
      // Overall discount: 50
      // Line 1 receives 25, Line 2 receives 0, Line 3 receives 25
      const result = calculateDocument({
        lines: [
          { name: "Item 1", quantity: 1, rate: 100, tax: { type: "percentage", rate: 18, treatment: "igst" } },
          { name: "Free Sample", quantity: 1, rate: 0 },
          { name: "Item 3", quantity: 1, rate: 100, tax: { type: "percentage", rate: 18, treatment: "igst" } },
        ],
        overallDiscount: { type: "fixed", value: 50 },
        pricingMode: "exclusive",
      });

      expect(result.lines[0].allocatedOverallDiscount).toBe(25);
      expect(result.lines[0].taxableAmount).toBe(75);

      expect(result.lines[1].allocatedOverallDiscount).toBe(0);
      expect(result.lines[1].taxableAmount).toBe(0);

      expect(result.lines[2].allocatedOverallDiscount).toBe(25);
      expect(result.lines[2].taxableAmount).toBe(75);

      expect(sum(result.lines.map((l) => l.allocatedOverallDiscount), 2)).toBe(50);
      expect(result.taxableAmount).toBe(150);
      expect(result.taxTotal).toBe(27); // 18% of 150
      expect(result.grandTotal).toBe(177);
    });

    it("correctly handles multi-rate GST with zero-base lines and multiple positive lines", () => {
      // Line 1: base 400, 18% CGST/SGST
      // Line 2: base 0, 100% discount
      // Line 3: base 600, 12% IGST
      // Line 4: base 0, rate 0
      // Total base: 1000
      // Overall discount: 200 (20%)
      // Line 1 gets 400/1000 * 200 = 80 -> taxable 320 -> 18% GST (CGST 28.80, SGST 28.80)
      // Line 2 gets 0
      // Line 3 gets 600/1000 * 200 = 120 -> taxable 480 -> 12% IGST (57.60)
      // Line 4 gets 0
      // Total allocated discount: exactly 200
      const result = calculateDocument({
        lines: [
          { name: "Service A", quantity: 1, rate: 400, tax: { type: "percentage", rate: 18, treatment: "cgst_sgst" } },
          { name: "Discounted to 0", quantity: 1, rate: 100, discount: { type: "percentage", value: 100 } },
          { name: "Service B", quantity: 1, rate: 600, tax: { type: "percentage", rate: 12, treatment: "igst" } },
          { name: "Free Bonus", quantity: 1, rate: 0 },
        ],
        overallDiscount: { type: "fixed", value: 200 },
        pricingMode: "exclusive",
      });

      expect(result.lines[0].allocatedOverallDiscount).toBe(80);
      expect(result.lines[0].taxableAmount).toBe(320);
      expect(result.lines[0].tax.amount).toBe(57.6);
      expect(result.lines[0].tax.cgst.amount).toBe(28.8);
      expect(result.lines[0].tax.sgst.amount).toBe(28.8);

      expect(result.lines[1].allocatedOverallDiscount).toBe(0);
      expect(result.lines[1].taxableAmount).toBe(0);

      expect(result.lines[2].allocatedOverallDiscount).toBe(120);
      expect(result.lines[2].taxableAmount).toBe(480);
      expect(result.lines[2].tax.amount).toBe(57.6);
      expect(result.lines[2].tax.igst.amount).toBe(57.6);

      expect(result.lines[3].allocatedOverallDiscount).toBe(0);
      expect(result.lines[3].taxableAmount).toBe(0);

      // Exact equality
      const totalAllocated = sum(result.lines.map((l) => l.allocatedOverallDiscount), 2);
      expect(totalAllocated).toBe(200);
      expect(result.taxableAmount).toBe(800);
      expect(result.taxTotal).toBe(115.2);
      expect(result.grandTotal).toBe(915.2);
    });

    it("correctly handles inclusive pricing with overall discount and a zero-base line", () => {
      // Line 1: 118 inclusive (base 118)
      // Line 2: 0 rate (base 0)
      // Overall discount: 10%
      // Line 1 gets 11.80 discount -> net inclusive 106.20 -> taxable 90, tax 16.20
      // Line 2 gets 0
      const result = calculateDocument({
        lines: [
          { name: "Inclusive Item", quantity: 1, rate: 118, tax: { type: "percentage", rate: 18, treatment: "igst" } },
          { name: "Free Extra", quantity: 1, rate: 0 },
        ],
        overallDiscount: { type: "percentage", value: 10 },
        pricingMode: "inclusive",
      });

      expect(result.lines[0].allocatedOverallDiscount).toBe(11.8);
      expect(result.lines[0].taxableAmount).toBe(90);
      expect(result.lines[0].tax.amount).toBe(16.2);
      expect(result.lines[0].lineTotal).toBe(106.2);

      expect(result.lines[1].allocatedOverallDiscount).toBe(0);
      expect(result.lines[1].taxableAmount).toBe(0);

      expect(result.taxableAmount).toBe(90);
      expect(result.taxTotal).toBe(16.2);
      expect(result.grandTotal).toBe(106.2);
    });
  });

  // Multi-Currency Precision
  describe("Multi-Currency Decimal Precision", () => {
    it("supports 0 decimal currencies like JPY", () => {
      const result = calculateDocument({
        lines: [
          { name: "Tokyo Tour", quantity: 3, rate: 2500, tax: { type: "percentage", rate: 10, treatment: "igst" } },
        ],
        currency: { code: "JPY", symbol: "¥", decimals: 0 },
      });

      expect(result.subtotal).toBe(7500);
      expect(result.taxTotal).toBe(750);
      expect(result.grandTotal).toBe(8250);
    });

    it("supports 3 decimal currencies like KWD", () => {
      const result = calculateDocument({
        lines: [
          { name: "Oil Barrels", quantity: 10, rate: 23.455 },
        ],
        currency: { code: "KWD", symbol: "د.ك", decimals: 3 },
      });

      expect(result.subtotal).toBe(234.55);
      expect(result.grandTotal).toBe(234.55);
    });
  });

  // Empty document edge case
  it("handles empty lines array gracefully", () => {
    const result = calculateDocument({ lines: [] });
    expect(result.lines).toEqual([]);
    expect(result.subtotal).toBe(0);
    expect(result.lineDiscountTotal).toBe(0);
    expect(result.taxableAmount).toBe(0);
    expect(result.taxTotal).toBe(0);
    expect(result.additionalChargesTotal).toBe(0);
    expect(result.grandTotal).toBe(0);
  });
});
