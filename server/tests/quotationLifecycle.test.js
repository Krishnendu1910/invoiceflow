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
const documentService = require("../src/services/document.service");

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

function authed(req, accessToken) {
  return req.set("Authorization", `Bearer ${accessToken}`);
}

async function createQuotationHelper(app, accessToken, businessId) {
  const res = await authed(request(app).post("/api/documents"), accessToken).send({
    businessId,
    type: "quotation",
    customer: {
      name: "Acme Quotations Ltd",
      email: "quotes@acme.com",
      companyName: "Acme Global Solutions",
    },
    lines: [
      {
        name: "Enterprise Architecture Consulting",
        quantity: 5,
        rate: 8000,
        discount: { type: "percentage", value: 10 },
        tax: { type: "percentage", rate: 18, treatment: "cgst_sgst" },
      },
    ],
    notes: "Quotation valid for 30 days.",
  });
  return res.body.data.document;
}

const userA = { name: "Alice Owner", email: "alice@example.com", password: "alice-password-1" };
const userB = { name: "Bob Outsider", email: "bob@example.com", password: "bob-password-1" };

describe("Quotation Lifecycle (Phase 5.6)", () => {
  describe("Valid Lifecycle Transitions & Timestamps", () => {
    it("transitions draft → sent and sets sentAt", async () => {
      const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
      const quote = await createQuotationHelper(app, accessToken, businessId);
      expect(quote.status).toBe("draft");
      expect(quote.sentAt).toBeNull();

      const res = await authed(
        request(app).patch(`/api/documents/${quote.id}/status`),
        accessToken
      ).send({ status: "sent" });

      expect(res.status).toBe(200);
      expect(res.body.data.document.status).toBe("sent");
      expect(res.body.data.document.sentAt).toBeDefined();
      expect(new Date(res.body.data.document.sentAt).getTime()).not.toBeNaN();
    });

    it("transitions sent → viewed and sets viewedAt while preserving sentAt", async () => {
      const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
      const quote = await createQuotationHelper(app, accessToken, businessId);

      const sentRes = await authed(
        request(app).patch(`/api/documents/${quote.id}/status`),
        accessToken
      ).send({ status: "sent" });
      const sentAt = sentRes.body.data.document.sentAt;

      const viewedRes = await authed(
        request(app).patch(`/api/documents/${quote.id}/status`),
        accessToken
      ).send({ status: "viewed" });

      expect(viewedRes.status).toBe(200);
      expect(viewedRes.body.data.document.status).toBe("viewed");
      expect(viewedRes.body.data.document.sentAt).toBe(sentAt);
      expect(viewedRes.body.data.document.viewedAt).toBeDefined();
    });

    it("transitions sent → rejected and sets rejectedAt", async () => {
      const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
      const quote = await createQuotationHelper(app, accessToken, businessId);

      await authed(request(app).patch(`/api/documents/${quote.id}/status`), accessToken).send({ status: "sent" });

      const res = await authed(
        request(app).patch(`/api/documents/${quote.id}/status`),
        accessToken
      ).send({ status: "rejected" });

      expect(res.status).toBe(200);
      expect(res.body.data.document.status).toBe("rejected");
      expect(res.body.data.document.rejectedAt).toBeDefined();
    });

    it("transitions sent → expired and sets expiredAt", async () => {
      const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
      const quote = await createQuotationHelper(app, accessToken, businessId);

      await authed(request(app).patch(`/api/documents/${quote.id}/status`), accessToken).send({ status: "sent" });

      const res = await authed(
        request(app).patch(`/api/documents/${quote.id}/status`),
        accessToken
      ).send({ status: "expired" });

      expect(res.status).toBe(200);
      expect(res.body.data.document.status).toBe("expired");
      expect(res.body.data.document.expiredAt).toBeDefined();
    });

    it("transitions viewed → accepted and sets acceptedAt", async () => {
      const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
      const quote = await createQuotationHelper(app, accessToken, businessId);

      await authed(request(app).patch(`/api/documents/${quote.id}/status`), accessToken).send({ status: "sent" });
      await authed(request(app).patch(`/api/documents/${quote.id}/status`), accessToken).send({ status: "viewed" });

      const res = await authed(
        request(app).patch(`/api/documents/${quote.id}/status`),
        accessToken
      ).send({ status: "accepted" });

      expect(res.status).toBe(200);
      expect(res.body.data.document.status).toBe("accepted");
      expect(res.body.data.document.acceptedAt).toBeDefined();
    });

    it("transitions viewed → rejected and sets rejectedAt", async () => {
      const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
      const quote = await createQuotationHelper(app, accessToken, businessId);

      await authed(request(app).patch(`/api/documents/${quote.id}/status`), accessToken).send({ status: "sent" });
      await authed(request(app).patch(`/api/documents/${quote.id}/status`), accessToken).send({ status: "viewed" });

      const res = await authed(
        request(app).patch(`/api/documents/${quote.id}/status`),
        accessToken
      ).send({ status: "rejected" });

      expect(res.status).toBe(200);
      expect(res.body.data.document.status).toBe("rejected");
      expect(res.body.data.document.rejectedAt).toBeDefined();
    });

    it("transitions viewed → expired and sets expiredAt", async () => {
      const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
      const quote = await createQuotationHelper(app, accessToken, businessId);

      await authed(request(app).patch(`/api/documents/${quote.id}/status`), accessToken).send({ status: "sent" });
      await authed(request(app).patch(`/api/documents/${quote.id}/status`), accessToken).send({ status: "viewed" });

      const res = await authed(
        request(app).patch(`/api/documents/${quote.id}/status`),
        accessToken
      ).send({ status: "expired" });

      expect(res.status).toBe(200);
      expect(res.body.data.document.status).toBe("expired");
      expect(res.body.data.document.expiredAt).toBeDefined();
    });

    it("strictly rejects accepted → converted via generic status endpoint (reserved for conversion workflow)", async () => {
      const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
      const quote = await createQuotationHelper(app, accessToken, businessId);

      await authed(request(app).patch(`/api/documents/${quote.id}/status`), accessToken).send({ status: "sent" });
      await authed(request(app).patch(`/api/documents/${quote.id}/status`), accessToken).send({ status: "viewed" });
      await authed(request(app).patch(`/api/documents/${quote.id}/status`), accessToken).send({ status: "accepted" });

      const res = await authed(
        request(app).patch(`/api/documents/${quote.id}/status`),
        accessToken
      ).send({ status: "converted" });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/converted/i);

      // Verify quotation remains accepted
      const checkRes = await authed(request(app).get(`/api/documents/${quote.id}`), accessToken);
      expect(checkRes.body.data.document.status).toBe("accepted");
      expect(checkRes.body.data.document.conversion?.convertedToInvoiceId).toBeUndefined();

      // Verify no invoice was created
      const invoices = await Document.find({ businessId, type: "invoice" });
      expect(invoices).toHaveLength(0);
    });
  });

  describe("Terminal States & Disallowed Transitions", () => {
    it("rejects draft → accepted (skipping sent/viewed)", async () => {
      const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
      const quote = await createQuotationHelper(app, accessToken, businessId);

      const res = await authed(
        request(app).patch(`/api/documents/${quote.id}/status`),
        accessToken
      ).send({ status: "accepted" });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Cannot transition quotation from "draft" to "accepted"/);
    });

    it("rejects draft → converted", async () => {
      const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
      const quote = await createQuotationHelper(app, accessToken, businessId);

      const res = await authed(
        request(app).patch(`/api/documents/${quote.id}/status`),
        accessToken
      ).send({ status: "converted" });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Cannot transition quotation from "draft" to "converted"/);
    });

    it("rejects sent → accepted (must be viewed first)", async () => {
      const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
      const quote = await createQuotationHelper(app, accessToken, businessId);
      await authed(request(app).patch(`/api/documents/${quote.id}/status`), accessToken).send({ status: "sent" });

      const res = await authed(
        request(app).patch(`/api/documents/${quote.id}/status`),
        accessToken
      ).send({ status: "accepted" });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Cannot transition quotation from "sent" to "accepted"/);
    });

    it("rejects sent → converted", async () => {
      const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
      const quote = await createQuotationHelper(app, accessToken, businessId);
      await authed(request(app).patch(`/api/documents/${quote.id}/status`), accessToken).send({ status: "sent" });

      const res = await authed(
        request(app).patch(`/api/documents/${quote.id}/status`),
        accessToken
      ).send({ status: "converted" });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Cannot transition quotation from "sent" to "converted"/);
    });

    it("rejects viewed → converted (must be accepted first)", async () => {
      const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
      const quote = await createQuotationHelper(app, accessToken, businessId);
      await authed(request(app).patch(`/api/documents/${quote.id}/status`), accessToken).send({ status: "sent" });
      await authed(request(app).patch(`/api/documents/${quote.id}/status`), accessToken).send({ status: "viewed" });

      const res = await authed(
        request(app).patch(`/api/documents/${quote.id}/status`),
        accessToken
      ).send({ status: "converted" });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Cannot transition quotation from "viewed" to "converted"/);
    });

    it("rejects accepted → draft (cannot return to draft once accepted)", async () => {
      const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
      const quote = await createQuotationHelper(app, accessToken, businessId);
      await authed(request(app).patch(`/api/documents/${quote.id}/status`), accessToken).send({ status: "sent" });
      await authed(request(app).patch(`/api/documents/${quote.id}/status`), accessToken).send({ status: "viewed" });
      await authed(request(app).patch(`/api/documents/${quote.id}/status`), accessToken).send({ status: "accepted" });

      const res = await authed(
        request(app).patch(`/api/documents/${quote.id}/status`),
        accessToken
      ).send({ status: "draft" });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Cannot transition quotation from "accepted" to "draft"/);
    });

    it("rejects rejected → draft (rejected is terminal)", async () => {
      const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
      const quote = await createQuotationHelper(app, accessToken, businessId);
      await authed(request(app).patch(`/api/documents/${quote.id}/status`), accessToken).send({ status: "sent" });
      await authed(request(app).patch(`/api/documents/${quote.id}/status`), accessToken).send({ status: "rejected" });

      const res = await authed(
        request(app).patch(`/api/documents/${quote.id}/status`),
        accessToken
      ).send({ status: "draft" });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Cannot transition quotation from "rejected" to "draft"/);
    });

    it("rejects rejected → accepted (rejected is terminal)", async () => {
      const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
      const quote = await createQuotationHelper(app, accessToken, businessId);
      await authed(request(app).patch(`/api/documents/${quote.id}/status`), accessToken).send({ status: "sent" });
      await authed(request(app).patch(`/api/documents/${quote.id}/status`), accessToken).send({ status: "rejected" });

      const res = await authed(
        request(app).patch(`/api/documents/${quote.id}/status`),
        accessToken
      ).send({ status: "accepted" });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Cannot transition quotation from "rejected" to "accepted"/);
    });

    it("rejects expired → draft (expired is terminal)", async () => {
      const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
      const quote = await createQuotationHelper(app, accessToken, businessId);
      await authed(request(app).patch(`/api/documents/${quote.id}/status`), accessToken).send({ status: "sent" });
      await authed(request(app).patch(`/api/documents/${quote.id}/status`), accessToken).send({ status: "expired" });

      const res = await authed(
        request(app).patch(`/api/documents/${quote.id}/status`),
        accessToken
      ).send({ status: "draft" });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Cannot transition quotation from "expired" to "draft"/);
    });

    it("rejects converted → draft (converted is terminal)", async () => {
      const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
      const quote = await createQuotationHelper(app, accessToken, businessId);
      await authed(request(app).patch(`/api/documents/${quote.id}/status`), accessToken).send({ status: "sent" });
      await authed(request(app).patch(`/api/documents/${quote.id}/status`), accessToken).send({ status: "viewed" });
      await authed(request(app).patch(`/api/documents/${quote.id}/status`), accessToken).send({ status: "accepted" });
      await authed(request(app).post(`/api/documents/${quote.id}/convert-to-invoice`), accessToken).send();

      const res = await authed(
        request(app).patch(`/api/documents/${quote.id}/status`),
        accessToken
      ).send({ status: "draft" });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Cannot transition quotation from "converted" to "draft"/);
    });

    it("rejects repeating the same status", async () => {
      const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
      const quote = await createQuotationHelper(app, accessToken, businessId);
      await authed(request(app).patch(`/api/documents/${quote.id}/status`), accessToken).send({ status: "sent" });

      const res = await authed(
        request(app).patch(`/api/documents/${quote.id}/status`),
        accessToken
      ).send({ status: "sent" });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Quotation is already in "sent" status/);
    });
  });

  describe("Validation, Cross-Type & Security Isolation", () => {
    it("rejects transition on invoice via transitionQuotationStatus", async () => {
      const { accessToken, businessId, userId } = await verifiedUserWithBusiness(userA);
      const invRes = await authed(request(app).post("/api/documents"), accessToken).send({
        businessId,
        type: "invoice",
        customer: { name: "Client Inv" },
        lines: [{ name: "Product A", quantity: 1, rate: 1000 }],
      });
      const invId = invRes.body.data.document.id;

      // Direct service call
      await expect(
        documentService.transitionQuotationStatus(userId, invId, "sent")
      ).rejects.toThrow(/Quotation lifecycle transitions only apply to quotations/);

      // Endpoint rejects quotation-only status on invoice
      const res = await authed(
        request(app).patch(`/api/documents/${invId}/status`),
        accessToken
      ).send({ status: "accepted" });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Invalid invoice status "accepted"/);
    });

    it("rejects quotation transition with invoice-only status", async () => {
      const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
      const quote = await createQuotationHelper(app, accessToken, businessId);

      const res = await authed(
        request(app).patch(`/api/documents/${quote.id}/status`),
        accessToken
      ).send({ status: "paid" });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Invalid quotation status "paid"/);
    });

    it("rejects transition with invalid/unknown status", async () => {
      const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
      const quote = await createQuotationHelper(app, accessToken, businessId);

      const res = await authed(
        request(app).patch(`/api/documents/${quote.id}/status`),
        accessToken
      ).send({ status: "completed" });

      expect(res.status).toBe(400);
    });

    it("rejects cross-business quotation status update with 404", async () => {
      const alice = await verifiedUserWithBusiness(userA, "Alice Co");
      const bob = await verifiedUserWithBusiness(userB, "Bob Co");
      const aliceQuote = await createQuotationHelper(app, alice.accessToken, alice.businessId);

      const res = await authed(
        request(app).patch(`/api/documents/${aliceQuote.id}/status`),
        bob.accessToken
      ).send({ status: "sent" });

      expect(res.status).toBe(404);
      expect(res.body.message).toBe("Document not found.");
    });
  });

  describe("Immutability & Concurrency Safety", () => {
    it("confirms number, customer, and calculations remain unchanged across transitions", async () => {
      const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
      const quote = await createQuotationHelper(app, accessToken, businessId);

      const originalNumber = quote.number;
      const originalGrandTotal = quote.grandTotal;
      const originalCustomer = quote.customer;
      const originalLines = quote.lines;

      const res = await authed(
        request(app).patch(`/api/documents/${quote.id}/status`),
        accessToken
      ).send({ status: "sent" });

      const updated = res.body.data.document;
      expect(updated.number).toBe(originalNumber);
      expect(updated.grandTotal).toBe(originalGrandTotal);
      expect(updated.customer.name).toBe(originalCustomer.name);
      expect(updated.lines[0].rate).toBe(originalLines[0].rate);
    });

    it("verifies issued quotation content cannot be modified via draft update", async () => {
      const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
      const quote = await createQuotationHelper(app, accessToken, businessId);

      await authed(request(app).patch(`/api/documents/${quote.id}/status`), accessToken).send({ status: "sent" });

      const editRes = await authed(request(app).patch(`/api/documents/${quote.id}`), accessToken).send({
        notes: "Trying to modify issued quotation",
      });

      expect(editRes.status).toBe(400);
      expect(editRes.body.message).toMatch(/Only draft documents can be updated/);
    });

    it("prevents race condition when two concurrent requests attempt competing transitions from 'viewed'", async () => {
      const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
      const quote = await createQuotationHelper(app, accessToken, businessId);

      // Move to viewed
      await authed(request(app).patch(`/api/documents/${quote.id}/status`), accessToken).send({ status: "sent" });
      await authed(request(app).patch(`/api/documents/${quote.id}/status`), accessToken).send({ status: "viewed" });

      // Two simultaneous requests: Request A -> "accepted", Request B -> "rejected"
      const [resA, resB] = await Promise.all([
        authed(request(app).patch(`/api/documents/${quote.id}/status`), accessToken).send({ status: "accepted" }),
        authed(request(app).patch(`/api/documents/${quote.id}/status`), accessToken).send({ status: "rejected" }),
      ]);

      const statuses = [resA.status, resB.status];
      expect(statuses).toContain(200);
      expect(statuses.filter((s) => s === 200)).toHaveLength(1);

      const failStatus = statuses.find((s) => s !== 200);
      expect([400, 409]).toContain(failStatus);

      // Database reflects winner and was not corrupted
      const docInDb = await Document.findById(quote.id);
      if (resA.status === 200) {
        expect(docInDb.status).toBe("accepted");
        expect(docInDb.acceptedAt).toBeDefined();
      } else {
        expect(docInDb.status).toBe("rejected");
        expect(docInDb.rejectedAt).toBeDefined();
      }
    });

    it("prevents race condition when two concurrent requests attempt the same transition", async () => {
      const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
      const quote = await createQuotationHelper(app, accessToken, businessId);

      const [res1, res2] = await Promise.all([
        authed(request(app).patch(`/api/documents/${quote.id}/status`), accessToken).send({ status: "sent" }),
        authed(request(app).patch(`/api/documents/${quote.id}/status`), accessToken).send({ status: "sent" }),
      ]);

      const statuses = [res1.status, res2.status];
      expect(statuses.filter((s) => s === 200)).toHaveLength(1);
      const failRes = res1.status !== 200 ? res1 : res2;
      expect([400, 409]).toContain(failRes.status);
    });
  });
});

