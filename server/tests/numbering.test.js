const testDb = require("./testDb");
const Business = require("../src/models/Business");
const numberingService = require("../src/services/numbering.service");
const { getPeriodKey } = require("../src/utils/fiscalPeriod");

beforeAll(async () => {
  await testDb.connect();
});

afterAll(async () => {
  await testDb.disconnect();
});

afterEach(async () => {
  await testDb.clear();
});

async function createBusiness(overrides = {}) {
  const business = await Business.create({
    ownerId: new (require("mongoose").Types.ObjectId)(),
    name: "Numbering Test Co",
    ...overrides,
  });
  return business;
}

describe("fiscal period key calculation", () => {
  it("returns the constant 'ALL' for a series that never resets", () => {
    expect(getPeriodKey("never", 4, new Date("2026-09-08"))).toBe("ALL");
  });

  it("returns the calendar year for calendar_year reset policy", () => {
    expect(getPeriodKey("calendar_year", 4, new Date("2026-01-01"))).toBe("2026");
    expect(getPeriodKey("calendar_year", 4, new Date("2026-12-31"))).toBe("2026");
  });

  it("computes an April-start financial year correctly on both sides of the boundary", () => {
    // Before April: still in the previous financial year.
    expect(getPeriodKey("financial_year", 4, new Date("2026-03-31"))).toBe("2025-2026");
    // On/after April: the new financial year has started.
    expect(getPeriodKey("financial_year", 4, new Date("2026-04-01"))).toBe("2026-2027");
    expect(getPeriodKey("financial_year", 4, new Date("2026-09-08"))).toBe("2026-2027");
  });

  it("supports a custom fiscal start month", () => {
    expect(getPeriodKey("financial_year", 7, new Date("2026-06-30"))).toBe("2025-2026");
    expect(getPeriodKey("financial_year", 7, new Date("2026-07-01"))).toBe("2026-2027");
  });
});


describe("numbering reset-policy transitions", () => {
  const DocumentSequence = require("../src/models/DocumentSequence");

  async function allocateForPolicy(business, policy, periodKey) {
    business.numbering.invoice.resetPolicy = policy;
    await business.save();

    await DocumentSequence.create({
      businessId: business._id,
      docType: "invoice",
      periodKey,
      counter: 7,
    });
  }

  it("never -> calendar_year does not modify the existing ALL sequence", async () => {
    const business = await createBusiness({
      numbering: {
        invoice: { prefix: "INV-", startingNumber: 1, resetPolicy: "never" },
      },
    });

    await allocateForPolicy(business, "never", "ALL");

    business.numbering.invoice.resetPolicy = "calendar_year";
    await business.save();

    const before = await DocumentSequence.findOne({
      businessId: business._id,
      docType: "invoice",
      periodKey: "ALL",
    }).lean();

    const next = await numberingService.allocateNextNumber(business._id, "invoice");

    const after = await DocumentSequence.findOne({
      businessId: business._id,
      docType: "invoice",
      periodKey: "ALL",
    }).lean();

    expect(next.periodKey).not.toBe("ALL");
    expect(before.counter).toBe(7);
    expect(after.counter).toBe(7);
  });

  it("never -> financial_year preserves the ALL sequence", async () => {
    const business = await createBusiness({
      numbering: {
        invoice: { prefix: "INV-", startingNumber: 1, resetPolicy: "never" },
      },
    });

    await DocumentSequence.create({
      businessId: business._id,
      docType: "invoice",
      periodKey: "ALL",
      counter: 9,
    });

    business.numbering.invoice.resetPolicy = "financial_year";
    await business.save();

    const next = await numberingService.allocateNextNumber(business._id, "invoice");

    const allSequence = await DocumentSequence.findOne({
      businessId: business._id,
      docType: "invoice",
      periodKey: "ALL",
    }).lean();

    expect(next.periodKey).not.toBe("ALL");
    expect(allSequence.counter).toBe(9);
  });

  it("calendar_year -> financial_year does not overwrite the calendar sequence", async () => {
    const business = await createBusiness({
      numbering: {
        invoice: { prefix: "INV-", startingNumber: 1, resetPolicy: "calendar_year" },
      },
    });

    const calendarKey = getPeriodKey("calendar_year", 4, new Date());
    await DocumentSequence.create({
      businessId: business._id,
      docType: "invoice",
      periodKey: calendarKey,
      counter: 11,
    });

    business.numbering.invoice.resetPolicy = "financial_year";
    await business.save();

    const next = await numberingService.allocateNextNumber(business._id, "invoice");

    const oldSequence = await DocumentSequence.findOne({
      businessId: business._id,
      docType: "invoice",
      periodKey: calendarKey,
    }).lean();

    expect(next.periodKey).not.toBe(calendarKey);
    expect(oldSequence.counter).toBe(11);
  });

  it("financial_year -> calendar_year does not overwrite the financial sequence", async () => {
    const business = await createBusiness({
      numbering: {
        invoice: { prefix: "INV-", startingNumber: 1, resetPolicy: "financial_year" },
      },
    });

    const financialKey = getPeriodKey("financial_year", 4, new Date());
    await DocumentSequence.create({
      businessId: business._id,
      docType: "invoice",
      periodKey: financialKey,
      counter: 13,
    });

    business.numbering.invoice.resetPolicy = "calendar_year";
    await business.save();

    const next = await numberingService.allocateNextNumber(business._id, "invoice");

    const oldSequence = await DocumentSequence.findOne({
      businessId: business._id,
      docType: "invoice",
      periodKey: financialKey,
    }).lean();

    expect(next.periodKey).not.toBe(financialKey);
    expect(oldSequence.counter).toBe(13);
  });
});

describe("numbering allocation", () => {
  it("allocates sequential numbers starting from the configured starting number", async () => {
    const business = await createBusiness({
      numbering: { invoice: { prefix: "INV-", startingNumber: 1001, resetPolicy: "never" } },
    });

    const first = await numberingService.allocateNextNumber(business._id, "invoice");
    const second = await numberingService.allocateNextNumber(business._id, "invoice");
    const third = await numberingService.allocateNextNumber(business._id, "invoice");

    expect(first.number).toBe(1001);
    expect(second.number).toBe(1002);
    expect(third.number).toBe(1003);
    expect(first.formattedNumber).toBe("INV-1001");
  });

  it("keeps invoice and quotation sequences fully independent", async () => {
    const business = await createBusiness({
      numbering: {
        invoice: { prefix: "INV-", startingNumber: 1, resetPolicy: "never" },
        quotation: { prefix: "QUO-", startingNumber: 1, resetPolicy: "never" },
      },
    });

    await numberingService.allocateNextNumber(business._id, "invoice");
    await numberingService.allocateNextNumber(business._id, "invoice");
    const invoiceThird = await numberingService.allocateNextNumber(business._id, "invoice");
    const quotationFirst = await numberingService.allocateNextNumber(business._id, "quotation");

    expect(invoiceThird.number).toBe(3);
    expect(quotationFirst.number).toBe(1);
  });

  it("isolates numbering sequences per business even with identical configuration", async () => {
    const businessA = await createBusiness({ numbering: { invoice: { prefix: "INV-", startingNumber: 1, resetPolicy: "never" } } });
    const businessB = await createBusiness({ numbering: { invoice: { prefix: "INV-", startingNumber: 1, resetPolicy: "never" } } });

    await numberingService.allocateNextNumber(businessA._id, "invoice");
    await numberingService.allocateNextNumber(businessA._id, "invoice");
    const aThird = await numberingService.allocateNextNumber(businessA._id, "invoice");
    const bFirst = await numberingService.allocateNextNumber(businessB._id, "invoice");

    expect(aThird.number).toBe(3);
    expect(bFirst.number).toBe(1);
  });

  it("allocates unique, gap-free sequential numbers under concurrent allocation", async () => {
    const business = await createBusiness({
      numbering: { invoice: { prefix: "INV-", startingNumber: 1, resetPolicy: "never" } },
    });

    const results = await Promise.all(
      Array.from({ length: 25 }, () => numberingService.allocateNextNumber(business._id, "invoice"))
    );

    const numbers = results.map((r) => r.number).sort((a, b) => a - b);
    const uniqueNumbers = new Set(numbers);

    expect(uniqueNumbers.size).toBe(25);
    expect(numbers).toEqual(Array.from({ length: 25 }, (_, i) => i + 1));
  });

  it("keeps separate counters per reset period", async () => {
    const business = await createBusiness({
      numbering: { invoice: { prefix: "INV-", startingNumber: 1, resetPolicy: "calendar_year" } },
    });

    const DocumentSequence = require("../src/models/DocumentSequence");
    await numberingService.allocateNextNumber(business._id, "invoice");
    await numberingService.allocateNextNumber(business._id, "invoice");

    // Simulate a rollover into a new calendar year by seeding a sequence
    // document for a different period directly — allocation for "this
    // year" must not be affected by, or continue, a different period.
    await DocumentSequence.create({ businessId: business._id, docType: "invoice", periodKey: "1999", counter: 500 });

    const next = await numberingService.allocateNextNumber(business._id, "invoice");
    expect(next.number).toBe(3);
  });

  it("throws when the business has no numbering configuration for the requested document type", async () => {
    const business = await createBusiness();
    business.numbering = undefined;
    await business.save({ validateBeforeSave: false });

    await expect(numberingService.allocateNextNumber(business._id, "invoice")).rejects.toThrow();
  });

  it("does not consume a number just because settings are read or saved", async () => {
    const business = await createBusiness({
      numbering: { invoice: { prefix: "INV-", startingNumber: 1, resetPolicy: "never" } },
    });

    business.numbering.invoice.prefix = "INV2-";
    await business.save();

    const DocumentSequence = require("../src/models/DocumentSequence");
    const count = await DocumentSequence.countDocuments({ businessId: business._id });
    expect(count).toBe(0);

    const first = await numberingService.allocateNextNumber(business._id, "invoice");
    expect(first.number).toBe(1);
  });

  it("reports no allocations for a series that has never issued a number", async () => {
    const business = await createBusiness({
      numbering: { invoice: { prefix: "INV-", startingNumber: 1, resetPolicy: "never" } },
    });

    const allocated = await numberingService.hasAllocations(business._id, "invoice");
    expect(allocated).toBe(false);
  });

  it("reports allocations exist after a number has been issued", async () => {
    const business = await createBusiness({
      numbering: { invoice: { prefix: "INV-", startingNumber: 1, resetPolicy: "never" } },
    });

    await numberingService.allocateNextNumber(business._id, "invoice");

    const allocated = await numberingService.hasAllocations(business._id, "invoice");
    expect(allocated).toBe(true);
  });

  it("allows changing startingNumber before the first allocation", async () => {
    const business = await createBusiness({
      numbering: { invoice: { prefix: "INV-", startingNumber: 1, resetPolicy: "never" } },
    });

    // Change startingNumber before any allocation — should be fine.
    business.numbering.invoice.startingNumber = 500;
    await business.save();

    const first = await numberingService.allocateNextNumber(business._id, "invoice");
    expect(first.number).toBe(500);
    expect(first.formattedNumber).toBe("INV-500");
  });

  it("does not rewind the counter when the prefix is changed after allocation", async () => {
    const business = await createBusiness({
      numbering: { invoice: { prefix: "INV-", startingNumber: 1, resetPolicy: "never" } },
    });

    await numberingService.allocateNextNumber(business._id, "invoice");
    await numberingService.allocateNextNumber(business._id, "invoice");

    // Change the prefix — cosmetic only, must not reset the counter.
    business.numbering.invoice.prefix = "NEW-";
    await business.save();

    const next = await numberingService.allocateNextNumber(business._id, "invoice");
    expect(next.number).toBe(3);
    expect(next.formattedNumber).toBe("NEW-3");
  });
});
