jest.mock("../src/services/email/email.service", () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue({ skipped: true }),
  sendPasswordResetEmail: jest.fn().mockResolvedValue({ skipped: true }),
}));

const request = require("supertest");
const mongoose = require("mongoose");
const testDb = require("./testDb");
const createApp = require("../src/app");
const emailService = require("../src/services/email/email.service");
const { Document } = require("../src/models/Document");
const Customer = require("../src/models/Customer");
const Business = require("../src/models/Business");

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

async function createCustomerHelper(appInstance, accessToken, businessId, name = "Acme Corp") {
  const res = await authed(request(appInstance).post("/api/customers"), accessToken).send({
    businessId,
    type: "business",
    name,
    email: "billing@acme.com",
    companyName: "Acme Industrial Ltd",
    phone: "+919876543210",
    tax: {
      gstRegistered: true,
      gstin: "27AABCU9603R1ZM",
    },
    billingAddress: {
      line1: "100 Industrial Way",
      city: "Mumbai",
      state: "Maharashtra",
      postalCode: "400001",
      country: "IN",
    },
  });
  if (res.status !== 201) {
    throw new Error(`Create customer failed: ${JSON.stringify(res.body)}`);
  }
  return res.body.data.customer;
}

async function createQuotationHelper(appInstance, accessToken, businessId, customerId, lineOverrides = null) {
  const lines = lineOverrides || [
    {
      name: "Web Development",
      description: "Custom platform build",
      quantity: 10,
      rate: 150,
      discount: { type: "percentage", value: 10 },
      tax: { type: "percentage", rate: 18 },
    },
    {
      name: "Hosting Setup",
      description: "Cloud infrastructure",
      quantity: 1,
      rate: 500,
      tax: { type: "percentage", rate: 18 },
    },
  ];

  const res = await authed(request(appInstance).post("/api/documents"), accessToken).send({
    businessId,
    type: "quotation",
    customerId,
    lines,
    pricingMode: "exclusive",
    currency: { code: "USD", symbol: "$", decimals: 2 },
    notes: "Quotation valid for 30 days.",
    terms: "50% upfront, 50% upon completion.",
  });

  if (res.status !== 201) {
    throw new Error(`Create quotation failed with ${res.status}: ${JSON.stringify(res.body)}`);
  }
  return res.body.data.document;
}

async function createAcceptedQuotation(appInstance, accessToken, businessId, customerId, lineOverrides = null) {
  const quotation = await createQuotationHelper(appInstance, accessToken, businessId, customerId, lineOverrides);
  // transition draft -> sent -> viewed -> accepted
  await authed(request(appInstance).patch(`/api/documents/${quotation.id}/status`), accessToken).send({ status: "sent" });
  await authed(request(appInstance).patch(`/api/documents/${quotation.id}/status`), accessToken).send({ status: "viewed" });
  const acceptedRes = await authed(
    request(appInstance).patch(`/api/documents/${quotation.id}/status`),
    accessToken
  ).send({ status: "accepted" });

  return acceptedRes.body.data.document;
}

describe("Quotation → Invoice Conversion (Phase 5.7)", () => {
  describe("Basic Conversion Workflow", () => {
    it("successfully converts an accepted quotation to a new draft invoice", async () => {
      const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
      const customer = await createCustomerHelper(app, accessToken, businessId);
      const quotation = await createAcceptedQuotation(app, accessToken, businessId, customer.id);

      const res = await authed(
        request(app).post(`/api/documents/${quotation.id}/convert-to-invoice`),
        accessToken
      ).send();

      expect(res.status).toBe(201);
      expect(res.body.message).toMatch(/converted to invoice successfully/i);

      const invoice = res.body.data.invoice;
      expect(invoice).toBeDefined();
      expect(invoice.id).toBeDefined();
      expect(invoice.id).not.toBe(quotation.id);

      // New document type is invoice
      expect(invoice.type).toBe("invoice");
      // Starts as draft
      expect(invoice.status).toBe("draft");

      // Numbering: independent allocation
      expect(invoice.number).toBeDefined();
      expect(invoice.number).not.toBe(quotation.number);
      expect(invoice.number).toMatch(/^INV-/);
      expect(quotation.number).toMatch(/^QUO-/);

      // Bi-directional references
      expect(invoice.conversion.convertedFromQuotationId).toBe(quotation.id);
      expect(invoice.conversion.sourceQuotationId).toBe(quotation.id);
      expect(invoice.conversion.convertedAt).toBeDefined();

      // Quotation verification
      const updatedQuoteRes = await authed(request(app).get(`/api/documents/${quotation.id}`), accessToken);
      const updatedQuote = updatedQuoteRes.body.data.document;

      expect(updatedQuote.status).toBe("converted");
      expect(updatedQuote.conversion.convertedToInvoiceId).toBe(invoice.id);
      expect(updatedQuote.conversion.convertedAt).toBeDefined();

      // Snapshots match
      expect(invoice.customer.name).toBe(quotation.customer.name);
      expect(invoice.customer.companyName).toBe(quotation.customer.companyName);
      expect(invoice.customer.billingAddress).toEqual(quotation.customer.billingAddress);
      expect(invoice.business.name).toBe(quotation.business.name);

      // Lines and calculations match authoritative server recomputation
      expect(invoice.lines).toHaveLength(quotation.lines.length);
      expect(invoice.subtotal).toBe(quotation.subtotal);
      expect(invoice.lineDiscountTotal).toBe(quotation.lineDiscountTotal);
      expect(invoice.taxableAmount).toBe(quotation.taxableAmount);
      expect(invoice.taxTotal).toBe(quotation.taxTotal);
      expect(invoice.grandTotal).toBe(quotation.grandTotal);
      expect(invoice.currency).toEqual(quotation.currency);
      expect(invoice.pricingMode).toBe(quotation.pricingMode);

      // Notes & terms carried forward
      expect(invoice.notes).toBe(quotation.notes);
      expect(invoice.terms).toBe(quotation.terms);
    });

    it("verifies authoritative server-side recalculation rather than trusting stored values", async () => {
      const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
      const customer = await createCustomerHelper(app, accessToken, businessId);
      const quotation = await createAcceptedQuotation(app, accessToken, businessId, customer.id);

      const res = await authed(
        request(app).post(`/api/documents/${quotation.id}/convert-to-invoice`),
        accessToken
      ).send();

      expect(res.status).toBe(201);
      const invoice = res.body.data.invoice;

      // Line 1: 10 * 150 = 1500, 10% discount = 150 -> base 1350, 18% tax = 243 -> line total 1593
      // Line 2: 1 * 500 = 500, 0 discount -> base 500, 18% tax = 90 -> line total 590
      // Subtotal = 2000, lineDiscountTotal = 150, taxableAmount = 1850, taxTotal = 333, grandTotal = 2183
      expect(invoice.subtotal).toBe(2000);
      expect(invoice.lineDiscountTotal).toBe(150);
      expect(invoice.taxableAmount).toBe(1850);
      expect(invoice.taxTotal).toBe(333);
      expect(invoice.grandTotal).toBe(2183);
    });
  });

  describe("Invalid Quotation States Rejection", () => {
    it("rejects conversion of a draft quotation", async () => {
      const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
      const customer = await createCustomerHelper(app, accessToken, businessId);
      const quotation = await createQuotationHelper(app, accessToken, businessId, customer.id);

      const res = await authed(
        request(app).post(`/api/documents/${quotation.id}/convert-to-invoice`),
        accessToken
      ).send();

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Only accepted quotations can be converted/);
    });

    it("rejects conversion of a sent quotation", async () => {
      const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
      const customer = await createCustomerHelper(app, accessToken, businessId);
      const quotation = await createQuotationHelper(app, accessToken, businessId, customer.id);
      await authed(request(app).patch(`/api/documents/${quotation.id}/status`), accessToken).send({ status: "sent" });

      const res = await authed(
        request(app).post(`/api/documents/${quotation.id}/convert-to-invoice`),
        accessToken
      ).send();

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Only accepted quotations can be converted/);
    });

    it("rejects conversion of a viewed quotation", async () => {
      const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
      const customer = await createCustomerHelper(app, accessToken, businessId);
      const quotation = await createQuotationHelper(app, accessToken, businessId, customer.id);
      await authed(request(app).patch(`/api/documents/${quotation.id}/status`), accessToken).send({ status: "sent" });
      await authed(request(app).patch(`/api/documents/${quotation.id}/status`), accessToken).send({ status: "viewed" });

      const res = await authed(
        request(app).post(`/api/documents/${quotation.id}/convert-to-invoice`),
        accessToken
      ).send();

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Only accepted quotations can be converted/);
    });

    it("rejects conversion of a rejected quotation", async () => {
      const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
      const customer = await createCustomerHelper(app, accessToken, businessId);
      const quotation = await createQuotationHelper(app, accessToken, businessId, customer.id);
      await authed(request(app).patch(`/api/documents/${quotation.id}/status`), accessToken).send({ status: "sent" });
      await authed(request(app).patch(`/api/documents/${quotation.id}/status`), accessToken).send({ status: "rejected" });

      const res = await authed(
        request(app).post(`/api/documents/${quotation.id}/convert-to-invoice`),
        accessToken
      ).send();

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Only accepted quotations can be converted/);
    });

    it("rejects conversion of an expired quotation", async () => {
      const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
      const customer = await createCustomerHelper(app, accessToken, businessId);
      const quotation = await createQuotationHelper(app, accessToken, businessId, customer.id);
      await authed(request(app).patch(`/api/documents/${quotation.id}/status`), accessToken).send({ status: "sent" });
      await authed(request(app).patch(`/api/documents/${quotation.id}/status`), accessToken).send({ status: "expired" });

      const res = await authed(
        request(app).post(`/api/documents/${quotation.id}/convert-to-invoice`),
        accessToken
      ).send();

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Only accepted quotations can be converted/);
    });

    it("rejects conversion of an invoice document", async () => {
      const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
      const customer = await createCustomerHelper(app, accessToken, businessId);

      const invoiceRes = await authed(request(app).post("/api/documents"), accessToken).send({
        businessId,
        type: "invoice",
        customerId: customer.id,
        lines: [{ name: "Product", quantity: 1, rate: 100 }],
      });
      const invoiceId = invoiceRes.body.data.document.id;

      const res = await authed(
        request(app).post(`/api/documents/${invoiceId}/convert-to-invoice`),
        accessToken
      ).send();

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Only quotation documents can be converted/);
    });
  });

  describe("Duplicate Conversion Prevention", () => {
    it("rejects second conversion attempt and preserves original invoice reference", async () => {
      const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
      const customer = await createCustomerHelper(app, accessToken, businessId);
      const quotation = await createAcceptedQuotation(app, accessToken, businessId, customer.id);

      // First conversion
      const firstRes = await authed(
        request(app).post(`/api/documents/${quotation.id}/convert-to-invoice`),
        accessToken
      ).send();
      expect(firstRes.status).toBe(201);
      const firstInvoiceId = firstRes.body.data.invoice.id;

      // Second conversion attempt
      const secondRes = await authed(
        request(app).post(`/api/documents/${quotation.id}/convert-to-invoice`),
        accessToken
      ).send();

      expect(secondRes.status).toBe(400);
      expect(secondRes.body.message).toMatch(/already been converted/i);

      // Verify only ONE invoice exists in the database
      const totalInvoices = await Document.countDocuments({
        businessId,
        type: "invoice",
        "conversion.convertedFromQuotationId": quotation.id,
      });
      expect(totalInvoices).toBe(1);

      // Quotation still points to the first invoice
      const quoteCheck = await Document.findById(quotation.id);
      expect(quoteCheck.status).toBe("converted");
      expect(quoteCheck.conversion.convertedToInvoiceId.toString()).toBe(firstInvoiceId);
    });
  });

  describe("Authorization & Multi-Tenancy", () => {
    it("rejects unauthenticated conversion request with 401", async () => {
      const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
      const customer = await createCustomerHelper(app, accessToken, businessId);
      const quotation = await createAcceptedQuotation(app, accessToken, businessId, customer.id);

      const res = await request(app).post(`/api/documents/${quotation.id}/convert-to-invoice`).send();
      expect(res.status).toBe(401);
    });

    it("rejects unverified user conversion request with 403", async () => {
      const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
      const customer = await createCustomerHelper(app, accessToken, businessId);
      const quotation = await createAcceptedQuotation(app, accessToken, businessId, customer.id);

      // Register an unverified user
      await request(app).post("/api/auth/register").send({
        name: "Unverified User",
        email: "unverified@example.com",
        password: "password123!",
      });
      const login = await request(app).post("/api/auth/login").send({
        email: "unverified@example.com",
        password: "password123!",
      });
      const unverifiedToken = login.body.data.accessToken;

      const res = await authed(
        request(app).post(`/api/documents/${quotation.id}/convert-to-invoice`),
        unverifiedToken
      ).send();

      expect(res.status).toBe(403);
    });

    it("rejects cross-business conversion with 404 (no information leakage)", async () => {
      const alice = await verifiedUserWithBusiness(userA, "Alice Co");
      const bob = await verifiedUserWithBusiness(userB, "Bob Co");

      const customer = await createCustomerHelper(app, alice.accessToken, alice.businessId);
      const quotation = await createAcceptedQuotation(app, alice.accessToken, alice.businessId, customer.id);

      // Bob attempts to convert Alice's quotation
      const res = await authed(
        request(app).post(`/api/documents/${quotation.id}/convert-to-invoice`),
        bob.accessToken
      ).send();

      expect(res.status).toBe(404);
      expect(res.body.message).toBe("Document not found.");

      // Alice's quotation remains in accepted status
      const quoteCheck = await Document.findById(quotation.id);
      expect(quoteCheck.status).toBe("accepted");
    });
  });

  describe("Payload Security & Parameter Validation", () => {
    it("rejects client attempts to inject numbers, status, or calculations in request body", async () => {
      const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
      const customer = await createCustomerHelper(app, accessToken, businessId);
      const quotation = await createAcceptedQuotation(app, accessToken, businessId, customer.id);

      const maliciousPayloads = [
        { number: "INV-CUSTOM-001" },
        { status: "paid" },
        { businessId: new mongoose.Types.ObjectId().toString() },
        { grandTotal: 0 },
        { lines: [] },
        { type: "invoice" },
        { "conversion.convertedAt": new Date() },
      ];

      for (const payload of maliciousPayloads) {
        const res = await authed(
          request(app).post(`/api/documents/${quotation.id}/convert-to-invoice`),
          accessToken
        ).send(payload);

        expect(res.status).toBe(400);
        expect(res.body.message).toBe("Invalid request data.");
      }

      // Quotation remains untouched and ready for legitimate conversion
      const quoteCheck = await Document.findById(quotation.id);
      expect(quoteCheck.status).toBe("accepted");
    });

    it("rejects malformed quotation ObjectId with 400", async () => {
      const { accessToken } = await verifiedUserWithBusiness(userA);
      const res = await authed(
        request(app).post("/api/documents/invalid-id-123/convert-to-invoice"),
        accessToken
      ).send();

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Invalid request parameters.");
    });
  });

  describe("Immutability & Post-Conversion Behavior", () => {
    it("strictly forbids editing or deleting the converted quotation", async () => {
      const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
      const customer = await createCustomerHelper(app, accessToken, businessId);
      const quotation = await createAcceptedQuotation(app, accessToken, businessId, customer.id);

      await authed(
        request(app).post(`/api/documents/${quotation.id}/convert-to-invoice`),
        accessToken
      ).send();

      // Check quotation immutability: content and snapshots must remain untouched
      const quoteCheck = await Document.findById(quotation.id);
      expect(quoteCheck.number).toBe(quotation.number);
      expect(quoteCheck.customer.name).toBe(quotation.customer.name);
      expect(quoteCheck.business.name).toBe(quotation.business.name);
      expect(quoteCheck.lines).toHaveLength(quotation.lines.length);
      expect(quoteCheck.subtotal).toBe(quotation.subtotal);
      expect(quoteCheck.grandTotal).toBe(quotation.grandTotal);

      // Attempt to update converted quotation via PATCH /api/documents/:id
      const updateRes = await authed(
        request(app).patch(`/api/documents/${quotation.id}`),
        accessToken
      ).send({ notes: "Attempted edit" });

      expect(updateRes.status).toBe(400);
      expect(updateRes.body.message).toMatch(/Only draft documents can be updated/);

      // Attempt to delete converted quotation via DELETE /api/documents/:id
      const deleteRes = await authed(
        request(app).delete(`/api/documents/${quotation.id}`),
        accessToken
      );

      expect(deleteRes.status).toBe(400);
      expect(deleteRes.body.message).toMatch(/Cannot delete an issued document/);
    });

    it("verifies invoice number, type, and source quotation cannot be modified via update", async () => {
      const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
      const customer = await createCustomerHelper(app, accessToken, businessId);
      const quotation = await createAcceptedQuotation(app, accessToken, businessId, customer.id);

      const convRes = await authed(
        request(app).post(`/api/documents/${quotation.id}/convert-to-invoice`),
        accessToken
      ).send();
      const invoiceId = convRes.body.data.invoice.id;

      // Attempt to modify number
      const numRes = await authed(
        request(app).patch(`/api/documents/${invoiceId}`),
        accessToken
      ).send({ number: "INV-HACKED-999" });
      expect(numRes.status).toBe(400);

      // Attempt to modify type
      const typeRes = await authed(
        request(app).patch(`/api/documents/${invoiceId}`),
        accessToken
      ).send({ type: "quotation" });
      expect(typeRes.status).toBe(400);

      // Source quotation reference remains intact
      const invCheck = await Document.findById(invoiceId);
      expect(invCheck.conversion.convertedFromQuotationId.toString()).toBe(quotation.id);
      expect(invCheck.conversion.sourceQuotationId.toString()).toBe(quotation.id);
    });

    it("allows the newly created invoice to be updated as a draft", async () => {
      const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
      const customer = await createCustomerHelper(app, accessToken, businessId);
      const quotation = await createAcceptedQuotation(app, accessToken, businessId, customer.id);

      const convRes = await authed(
        request(app).post(`/api/documents/${quotation.id}/convert-to-invoice`),
        accessToken
      ).send();
      const invoiceId = convRes.body.data.invoice.id;

      // Update draft invoice notes
      const updateRes = await authed(
        request(app).patch(`/api/documents/${invoiceId}`),
        accessToken
      ).send({ notes: "Updated invoice payment instructions." });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.document.notes).toBe("Updated invoice payment instructions.");

      // Invoice status remains draft until lifecycle transitioned
      expect(updateRes.body.data.document.status).toBe("draft");

      // Can transition invoice to sent
      const sendRes = await authed(
        request(app).patch(`/api/documents/${invoiceId}/status`),
        accessToken
      ).send({ status: "sent" });

      expect(sendRes.status).toBe(200);
      expect(sendRes.body.data.document.status).toBe("sent");
    });
  });

  describe("Snapshot Independence", () => {
    it("modifying customer and business records does NOT alter quotation or invoice snapshots", async () => {
      const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
      const customer = await createCustomerHelper(app, accessToken, businessId);
      const quotation = await createAcceptedQuotation(app, accessToken, businessId, customer.id);

      const convRes = await authed(
        request(app).post(`/api/documents/${quotation.id}/convert-to-invoice`),
        accessToken
      ).send();
      const invoiceId = convRes.body.data.invoice.id;

      // Mutate underlying customer
      await Customer.findByIdAndUpdate(customer.id, {
        name: "Completely Changed Name",
        companyName: "Brand New Entity Inc",
      });

      // Mutate underlying business
      await Business.findByIdAndUpdate(businessId, {
        name: "Renamed Holding Corp",
      });

      // Read quotation - snapshot must remain original
      const quoteCheck = await authed(request(app).get(`/api/documents/${quotation.id}`), accessToken);
      expect(quoteCheck.body.data.document.customer.name).toBe("Acme Corp");
      expect(quoteCheck.body.data.document.customer.companyName).toBe("Acme Industrial Ltd");
      expect(quoteCheck.body.data.document.business.name).toBe("Test Co");

      // Read invoice - snapshot must also remain original
      const invCheck = await authed(request(app).get(`/api/documents/${invoiceId}`), accessToken);
      expect(invCheck.body.data.document.customer.name).toBe("Acme Corp");
      expect(invCheck.body.data.document.customer.companyName).toBe("Acme Industrial Ltd");
      expect(invCheck.body.data.document.business.name).toBe("Test Co");
    });
  });

  describe("Numbering Sequence Independence", () => {
    it("maintains separate sequence counters for quotations and invoices", async () => {
      const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
      const customer = await createCustomerHelper(app, accessToken, businessId);

      // Create Quotation 1 (QUO-1) and Quotation 2 (QUO-2)
      const quote1 = await createAcceptedQuotation(app, accessToken, businessId, customer.id);
      const quote2 = await createAcceptedQuotation(app, accessToken, businessId, customer.id);

      expect(quote1.number).toBe("QUO-1");
      expect(quote2.number).toBe("QUO-2");

      // Convert Quote 1 -> should become INV-1
      const conv1 = await authed(
        request(app).post(`/api/documents/${quote1.id}/convert-to-invoice`),
        accessToken
      ).send();
      expect(conv1.body.data.invoice.number).toBe("INV-1");

      // Convert Quote 2 -> should become INV-2
      const conv2 = await authed(
        request(app).post(`/api/documents/${quote2.id}/convert-to-invoice`),
        accessToken
      ).send();
      expect(conv2.body.data.invoice.number).toBe("INV-2");

      // Create a 3rd quotation -> sequence must continue with QUO-3
      const quote3 = await createQuotationHelper(app, accessToken, businessId, customer.id);
      expect(quote3.number).toBe("QUO-3");
    });
  });

  describe("Concurrency Safety", () => {
    it("handles simultaneous conversion requests atomically: exactly one succeeds and exactly one invoice is created", async () => {
      const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
      const customer = await createCustomerHelper(app, accessToken, businessId);
      const quotation = await createAcceptedQuotation(app, accessToken, businessId, customer.id);

      // Trigger two simultaneous conversion requests
      const [resA, resB] = await Promise.all([
        authed(request(app).post(`/api/documents/${quotation.id}/convert-to-invoice`), accessToken).send(),
        authed(request(app).post(`/api/documents/${quotation.id}/convert-to-invoice`), accessToken).send(),
      ]);

      const statuses = [resA.status, resB.status];
      expect(statuses).toContain(201);

      // The losing request must be rejected with 400 or 409
      const rejectedRes = resA.status === 201 ? resB : resA;
      expect([400, 409]).toContain(rejectedRes.status);
      expect(rejectedRes.body.message).toMatch(/(already been converted|conflict)/i);

      // Verify exactly ONE invoice was created in the database
      const invoices = await Document.find({
        businessId,
        type: "invoice",
        "conversion.convertedFromQuotationId": quotation.id,
      });
      expect(invoices).toHaveLength(1);

      // Quotation is converted and references the single invoice
      const updatedQuote = await Document.findById(quotation.id);
      expect(updatedQuote.status).toBe("converted");
      expect(updatedQuote.conversion.convertedToInvoiceId.toString()).toBe(invoices[0]._id.toString());
    });
  });

  describe("Generic Status Endpoint Invariant", () => {
    it("strictly forbids transitioning quotation to converted via PATCH /api/documents/:id/status", async () => {
      const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
      const customer = await createCustomerHelper(app, accessToken, businessId);
      const quotation = await createAcceptedQuotation(app, accessToken, businessId, customer.id);

      // Attempt to set status to 'converted' via generic status endpoint
      const patchRes = await authed(
        request(app).patch(`/api/documents/${quotation.id}/status`),
        accessToken
      ).send({ status: "converted" });

      expect(patchRes.status).toBe(400);
      expect(patchRes.body.message).toMatch(/converted/i);

      // Verify quotation remains accepted
      const checkRes = await authed(request(app).get(`/api/documents/${quotation.id}`), accessToken);
      expect(checkRes.body.data.document.status).toBe("accepted");
      expect(checkRes.body.data.document.conversion?.convertedToInvoiceId).toBeUndefined();
      expect(checkRes.body.data.document.conversion?.convertedAt).toBeNull();

      // Verify no invoice was created
      const invoicesBefore = await Document.find({ businessId, type: "invoice" });
      expect(invoicesBefore).toHaveLength(0);

      // Now verify legitimate conversion succeeds
      const convRes = await authed(
        request(app).post(`/api/documents/${quotation.id}/convert-to-invoice`),
        accessToken
      ).send();

      expect(convRes.status).toBe(201);
      const invoice = convRes.body.data.invoice;
      expect(invoice.type).toBe("invoice");
      expect(invoice.conversion.convertedFromQuotationId).toBe(quotation.id);
      expect(invoice.conversion.sourceQuotationId).toBe(quotation.id);

      // Quotation is now converted and linked
      const finalQuote = await Document.findById(quotation.id);
      expect(finalQuote.status).toBe("converted");
      expect(finalQuote.conversion.convertedToInvoiceId.toString()).toBe(invoice.id);
      expect(finalQuote.conversion.convertedAt).toBeDefined();

      // Exactly ONE invoice exists
      const totalInvoices = await Document.countDocuments({ businessId, type: "invoice" });
      expect(totalInvoices).toBe(1);
    });
  });
});
