jest.mock("../src/services/email/email.service", () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue({ skipped: true }),
  sendPasswordResetEmail: jest.fn().mockResolvedValue({ skipped: true }),
}));

const request = require("supertest");
const testDb = require("./testDb");
const createApp = require("../src/app");
const emailService = require("../src/services/email/email.service");
const SettingsAuditLog = require("../src/models/SettingsAuditLog");

let app;

beforeAll(async () => {
  await testDb.connect();
  app = createApp();
});

afterAll(async () => {
  await testDb.disconnect();
});

afterEach(async () => {
  await testDb.clear();
  jest.clearAllMocks();
});

async function verifiedUserWithBusiness({ name, email, password }, businessName = "Test Co") {
  await request(app).post("/api/auth/register").send({ name, email, password });
  const calls = emailService.sendVerificationEmail.mock.calls;
  const rawToken = calls[calls.length - 1][1];
  await request(app).post("/api/auth/verify-email").send({ token: rawToken });

  const login = await request(app).post("/api/auth/login").send({ email, password });
  const accessToken = login.body.data.accessToken;

  const business = await request(app)
    .post("/api/businesses")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ name: businessName });

  return { accessToken, userId: login.body.data.user.id, businessId: business.body.data.business.id };
}

const userA = { name: "Alice Owner", email: "alice@example.com", password: "alice-password-1" };
const userB = { name: "Bob Outsider", email: "bob@example.com", password: "bob-password-1" };

function authed(req, accessToken) {
  return req.set("Authorization", `Bearer ${accessToken}`);
}

describe("business settings API", () => {
  it("requires authentication", async () => {
    const res = await request(app).get("/api/businesses/000000000000000000000000/settings");
    expect(res.status).toBe(401);
  });

  it("returns default settings for a freshly created business", async () => {
    const { accessToken, businessId } = await verifiedUserWithBusiness(userA);

    const res = await authed(request(app).get(`/api/businesses/${businessId}/settings`), accessToken);

    expect(res.status).toBe(200);
    expect(res.body.data.settings.tax.registrationStatus).toBe("unregistered");
    expect(res.body.data.settings.tax.rates.map((r) => r.rate)).toEqual([0, 5, 12, 18, 28]);
    expect(res.body.data.settings.numbering.invoice.prefix).toBe("INV-");
    expect(res.body.data.settings.numbering.quotation.prefix).toBe("QUO-");
    expect(res.body.data.settings.fiscalYear.startMonth).toBe(4);
    expect(res.body.data.settings.documentDefaults.language).toBe("en");
    expect(res.body.data.settings.documentDefaults.template).toBe("standard");
  });

  it("prevents another user from reading settings for a business they don't own", async () => {
    const a = await verifiedUserWithBusiness(userA);
    const b = await verifiedUserWithBusiness(userB, "Bob's Shop");

    const res = await authed(request(app).get(`/api/businesses/${a.businessId}/settings`), b.accessToken);
    expect(res.status).toBe(403);
  });

  it("prevents another user from updating settings for a business they don't own", async () => {
    const a = await verifiedUserWithBusiness(userA);
    const b = await verifiedUserWithBusiness(userB, "Bob's Shop");

    const res = await authed(request(app).patch(`/api/businesses/${a.businessId}/settings/branding`), b.accessToken).send({
      color: "#112233",
    });
    expect(res.status).toBe(403);
  });

  it("updates the business profile section, including legal name and contact address", async () => {
    const { accessToken, businessId } = await verifiedUserWithBusiness(userA);

    const res = await authed(request(app).patch(`/api/businesses/${businessId}/settings/profile`), accessToken).send({
      name: "Sarkar Enterprises",
      identity: { legalName: "Sarkar Enterprises Pvt. Ltd.", industry: "Retail" },
      contact: {
        email: "hello@sarkar.example",
        phone: "9876543210",
        address: { line1: "1 MG Road", city: "Pune", state: "MH", postalCode: "411001", country: "IN" },
      },
    });

    expect(res.status).toBe(200);
    expect(res.body.data.settings.name).toBe("Sarkar Enterprises");
    expect(res.body.data.settings.identity.legalName).toBe("Sarkar Enterprises Pvt. Ltd.");
    expect(res.body.data.settings.contact.email).toBe("hello@sarkar.example");
    expect(res.body.data.settings.contact.address.city).toBe("Pune");
  });

  it("supports a partial section update without disturbing other fields in the same section", async () => {
    const { accessToken, businessId } = await verifiedUserWithBusiness(userA);

    await authed(request(app).patch(`/api/businesses/${businessId}/settings/profile`), accessToken).send({
      identity: { legalName: "Original Legal Name", tradeName: "Original Trade Name" },
    });

    const res = await authed(request(app).patch(`/api/businesses/${businessId}/settings/profile`), accessToken).send({
      identity: { tradeName: "Updated Trade Name" },
    });

    expect(res.status).toBe(200);
    expect(res.body.data.settings.identity.legalName).toBe("Original Legal Name");
    expect(res.body.data.settings.identity.tradeName).toBe("Updated Trade Name");
  });

  it("rejects an invalid website and an invalid business email", async () => {
    const { accessToken, businessId } = await verifiedUserWithBusiness(userA);

    const res = await authed(request(app).patch(`/api/businesses/${businessId}/settings/profile`), accessToken).send({
      contact: { email: "not-an-email", website: "not a url" },
    });

    expect(res.status).toBe(400);
  });

  it("updates branding, including a hex color and logo reference", async () => {
    const { accessToken, businessId } = await verifiedUserWithBusiness(userA);

    const res = await authed(request(app).patch(`/api/businesses/${businessId}/settings/branding`), accessToken).send({
      color: "#1F2937",
      logo: { provider: "url", url: "https://example.com/logo.png" },
      footerText: "Thank you for your business.",
    });

    expect(res.status).toBe(200);
    expect(res.body.data.settings.branding.color).toBe("#1F2937");
    expect(res.body.data.settings.branding.logo.url).toBe("https://example.com/logo.png");
  });

  it("rejects an invalid hex color", async () => {
    const { accessToken, businessId } = await verifiedUserWithBusiness(userA);

    const res = await authed(request(app).patch(`/api/businesses/${businessId}/settings/branding`), accessToken).send({
      color: "blue",
    });

    expect(res.status).toBe(400);
  });

  it("requires a GSTIN when tax registrationStatus is set to registered", async () => {
    const { accessToken, businessId } = await verifiedUserWithBusiness(userA);

    const res = await authed(request(app).patch(`/api/businesses/${businessId}/settings/tax`), accessToken).send({
      registrationStatus: "registered",
    });

    expect(res.status).toBe(400);
  });

  it("accepts a valid GSTIN and updates GST treatment/pricing mode", async () => {
    const { accessToken, businessId } = await verifiedUserWithBusiness(userA);

    const res = await authed(request(app).patch(`/api/businesses/${businessId}/settings/tax`), accessToken).send({
      registrationStatus: "registered",
      gstin: "27aabcu9603r1zm",
      defaultMode: "gst",
      treatment: "igst",
      pricingMode: "inclusive",
    });

    expect(res.status).toBe(200);
    expect(res.body.data.settings.tax.gstin).toBe("27AABCU9603R1ZM");
    expect(res.body.data.settings.tax.treatment).toBe("igst");
    expect(res.body.data.settings.tax.pricingMode).toBe("inclusive");
  });

  it("rejects a tax rate above 100", async () => {
    const { accessToken, businessId } = await verifiedUserWithBusiness(userA);

    const res = await authed(request(app).patch(`/api/businesses/${businessId}/settings/tax`), accessToken).send({
      rates: [{ label: "Invalid", rate: 150 }],
    });

    expect(res.status).toBe(400);
  });

  it("updates numbering configuration for invoice and quotation independently", async () => {
    const { accessToken, businessId } = await verifiedUserWithBusiness(userA);

    const res = await authed(request(app).patch(`/api/businesses/${businessId}/settings/numbering`), accessToken).send({
      invoice: { prefix: "INV/24-25/", startingNumber: 1001, resetPolicy: "financial_year" },
    });

    expect(res.status).toBe(200);
    expect(res.body.data.settings.numbering.invoice.prefix).toBe("INV/24-25/");
    expect(res.body.data.settings.numbering.invoice.startingNumber).toBe(1001);
    // Untouched series keeps its defaults.
    expect(res.body.data.settings.numbering.quotation.prefix).toBe("QUO-");
  });

  it("rejects an invalid numbering prefix and a starting number below 1", async () => {
    const { accessToken, businessId } = await verifiedUserWithBusiness(userA);

    const badPrefix = await authed(request(app).patch(`/api/businesses/${businessId}/settings/numbering`), accessToken).send({
      invoice: { prefix: "INV#$%" },
    });
    expect(badPrefix.status).toBe(400);

    const badStart = await authed(request(app).patch(`/api/businesses/${businessId}/settings/numbering`), accessToken).send({
      invoice: { startingNumber: 0 },
    });
    expect(badStart.status).toBe(400);
  });

  it("allows changing startingNumber before the first allocation", async () => {
    const { accessToken, businessId } = await verifiedUserWithBusiness(userA);

    const res = await authed(request(app).patch(`/api/businesses/${businessId}/settings/numbering`), accessToken).send({
      invoice: { startingNumber: 500 },
    });

    expect(res.status).toBe(200);
    expect(res.body.data.settings.numbering.invoice.startingNumber).toBe(500);
  });

  it("rejects changing startingNumber after a number has been allocated", async () => {
    const { accessToken, businessId } = await verifiedUserWithBusiness(userA);

    // Allocate one invoice number.
    const DocumentSequence = require("../src/models/DocumentSequence");
    await DocumentSequence.findOneAndUpdate(
      { businessId, docType: "invoice", periodKey: "ALL" },
      { $inc: { counter: 1 } },
      { upsert: true, returnDocument: "after" }
    );

    const res = await authed(request(app).patch(`/api/businesses/${businessId}/settings/numbering`), accessToken).send({
      invoice: { startingNumber: 9999 },
    });

    expect(res.status).toBe(409);
  });

  it("allows prefix changes after allocation without resetting the counter", async () => {
    const { accessToken, businessId } = await verifiedUserWithBusiness(userA);

    // Allocate one invoice number.
    const DocumentSequence = require("../src/models/DocumentSequence");
    await DocumentSequence.findOneAndUpdate(
      { businessId, docType: "invoice", periodKey: "ALL" },
      { $inc: { counter: 1 } },
      { upsert: true, returnDocument: "after" }
    );

    const res = await authed(request(app).patch(`/api/businesses/${businessId}/settings/numbering`), accessToken).send({
      invoice: { prefix: "NEW-" },
    });

    expect(res.status).toBe(200);
    expect(res.body.data.settings.numbering.invoice.prefix).toBe("NEW-");

    // Verify counter was not reset.
    const seq = await DocumentSequence.findOne({ businessId, docType: "invoice" });
    expect(seq.counter).toBe(1);
  });

  it("updates payment settings including UPI, bank details, and default terms", async () => {
    const { accessToken, businessId } = await verifiedUserWithBusiness(userA);

    const res = await authed(request(app).patch(`/api/businesses/${businessId}/settings/payments`), accessToken).send({
      acceptedMethods: ["upi", "bank_transfer", "cash"],
      upi: { id: "business@okhdfcbank" },
      bank: { accountHolder: "Sarkar Enterprises", bankName: "HDFC Bank", accountNumber: "123456789012", ifsc: "hdfc0001234" },
      defaultTerms: { type: "30_days" },
    });

    expect(res.status).toBe(200);
    expect(res.body.data.settings.payments.acceptedMethods).toEqual(["upi", "bank_transfer", "cash"]);
    expect(res.body.data.settings.payments.upi.id).toBe("business@okhdfcbank");
    expect(res.body.data.settings.payments.bank.ifsc).toBe("HDFC0001234");
    expect(res.body.data.settings.payments.defaultTerms.type).toBe("30_days");
  });

  it("rejects an invalid UPI ID and an invalid IFSC", async () => {
    const { accessToken, businessId } = await verifiedUserWithBusiness(userA);

    const badUpi = await authed(request(app).patch(`/api/businesses/${businessId}/settings/payments`), accessToken).send({
      upi: { id: "not-a-upi-id" },
    });
    expect(badUpi.status).toBe(400);

    const badIfsc = await authed(request(app).patch(`/api/businesses/${businessId}/settings/payments`), accessToken).send({
      bank: { ifsc: "12345" },
    });
    expect(badIfsc.status).toBe(400);
  });

  it("requires customDays when default payment terms type is custom", async () => {
    const { accessToken, businessId } = await verifiedUserWithBusiness(userA);

    const res = await authed(request(app).patch(`/api/businesses/${businessId}/settings/payments`), accessToken).send({
      defaultTerms: { type: "custom" },
    });

    expect(res.status).toBe(400);
  });

  it("updates fiscal year start month and rejects an out-of-range month", async () => {
    const { accessToken, businessId } = await verifiedUserWithBusiness(userA);

    const ok = await authed(request(app).patch(`/api/businesses/${businessId}/settings/fiscal-year`), accessToken).send({
      startMonth: 1,
    });
    expect(ok.status).toBe(200);
    expect(ok.body.data.settings.fiscalYear.startMonth).toBe(1);

    const bad = await authed(request(app).patch(`/api/businesses/${businessId}/settings/fiscal-year`), accessToken).send({
      startMonth: 13,
    });
    expect(bad.status).toBe(400);
  });

  it("updates document defaults, including currency, discount, and additional charges", async () => {
    const { accessToken, businessId } = await verifiedUserWithBusiness(userA);

    const res = await authed(request(app).patch(`/api/businesses/${businessId}/settings/documents`), accessToken).send({
      currency: { code: "USD", symbol: "$" },
      discount: { type: "percentage", value: 10 },
      additionalCharges: [{ label: "Shipping", type: "fixed", value: 50 }],
      template: "modern",
      language: "en",
    });

    expect(res.status).toBe(200);
    expect(res.body.data.settings.currency.code).toBe("USD");
    expect(res.body.data.settings.documentDefaults.discount).toMatchObject({ type: "percentage", value: 10 });
    expect(res.body.data.settings.documentDefaults.additionalCharges).toHaveLength(1);
    expect(res.body.data.settings.documentDefaults.template).toBe("modern");
  });

  it("rejects an unsupported currency code and an unsupported language", async () => {
    const { accessToken, businessId } = await verifiedUserWithBusiness(userA);

    const badCurrency = await authed(request(app).patch(`/api/businesses/${businessId}/settings/documents`), accessToken).send({
      currency: { code: "XXX", symbol: "?" },
    });
    expect(badCurrency.status).toBe(400);

    const badLanguage = await authed(request(app).patch(`/api/businesses/${businessId}/settings/documents`), accessToken).send({
      language: "fr",
    });
    expect(badLanguage.status).toBe(400);
  });

  it("rejects a discount percentage above 100", async () => {
    const { accessToken, businessId } = await verifiedUserWithBusiness(userA);

    const res = await authed(request(app).patch(`/api/businesses/${businessId}/settings/documents`), accessToken).send({
      discount: { type: "percentage", value: 150 },
    });

    expect(res.status).toBe(400);
  });
});

describe("settings audit history", () => {
  it("records an audit entry with the correct businessId, actor, section, and before/after values", async () => {
    const { accessToken, userId, businessId } = await verifiedUserWithBusiness(userA);

    await authed(request(app).patch(`/api/businesses/${businessId}/settings/branding`), accessToken).send({
      color: "#ABCDEF",
    });

    const entries = await SettingsAuditLog.find({ businessId }).lean();
    const colorEntry = entries.find((e) => e.field === "color");

    expect(colorEntry).toBeTruthy();
    expect(colorEntry.section).toBe("branding");
    expect(colorEntry.actorId.toString()).toBe(userId);
    expect(colorEntry.previousValue).toBeUndefined();
    expect(colorEntry.newValue).toBe("#ABCDEF");
  });

  it("does not create an audit entry when nothing actually changed", async () => {
    const { accessToken, businessId } = await verifiedUserWithBusiness(userA);

    await authed(request(app).patch(`/api/businesses/${businessId}/settings/branding`), accessToken).send({
      color: "#ABCDEF",
    });
    const countAfterFirst = await SettingsAuditLog.countDocuments({ businessId });

    await authed(request(app).patch(`/api/businesses/${businessId}/settings/branding`), accessToken).send({
      color: "#ABCDEF",
    });
    const countAfterRepeat = await SettingsAuditLog.countDocuments({ businessId });

    expect(countAfterRepeat).toBe(countAfterFirst);
  });

  it("redacts the bank account number and IFSC instead of storing them in the clear", async () => {
    const { accessToken, businessId } = await verifiedUserWithBusiness(userA);

    await authed(request(app).patch(`/api/businesses/${businessId}/settings/payments`), accessToken).send({
      bank: { accountNumber: "123456789012", ifsc: "HDFC0001234", accountHolder: "Sarkar Enterprises" },
    });

    const entries = await SettingsAuditLog.find({ businessId }).lean();
    const accountNumberEntry = entries.find((e) => e.field === "bank.accountNumber");
    const ifscEntry = entries.find((e) => e.field === "bank.ifsc");
    const holderEntry = entries.find((e) => e.field === "bank.accountHolder");

    expect(accountNumberEntry.newValue).toBe("[redacted]");
    expect(ifscEntry.newValue).toBe("[redacted]");
    // Non-sensitive bank fields are still logged in the clear.
    expect(holderEntry.newValue).toBe("Sarkar Enterprises");
  });

  it("scopes audit entries to the correct business and does not leak across businesses", async () => {
    const a = await verifiedUserWithBusiness(userA);
    const b = await verifiedUserWithBusiness(userB, "Bob's Shop");

    await authed(request(app).patch(`/api/businesses/${a.businessId}/settings/branding`), a.accessToken).send({
      color: "#111111",
    });
    await authed(request(app).patch(`/api/businesses/${b.businessId}/settings/branding`), b.accessToken).send({
      color: "#222222",
    });

    const aEntries = await SettingsAuditLog.find({ businessId: a.businessId }).lean();
    const bEntries = await SettingsAuditLog.find({ businessId: b.businessId }).lean();

    expect(aEntries.every((e) => e.newValue !== "#222222")).toBe(true);
    expect(bEntries.every((e) => e.newValue !== "#111111")).toBe(true);
  });

  it("rolls back the business update when audit logging fails", async () => {
    const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
    const Business = require("../src/models/Business");
    const auditLogService = require("../src/services/auditLog.service");

    const before = await Business.findById(businessId).lean();
    expect(before.branding?.color).toBeUndefined();

    const spy = jest
      .spyOn(auditLogService, "recordSectionChanges")
      .mockRejectedValueOnce(new Error("Simulated audit failure"));

    try {
      const response = await authed(
        request(app).patch(`/api/businesses/${businessId}/settings/branding`),
        accessToken
      ).send({
        color: "#1F2937",
      });

      expect(response.status).toBe(500);

      const after = await Business.findById(businessId).lean();
      expect(after.branding?.color).toBeUndefined();

      const auditLogs = await SettingsAuditLog.find({
        businessId,
        section: "branding",
      });

      expect(auditLogs).toHaveLength(0);
    } finally {
      spy.mockRestore();
    }
  });

});
