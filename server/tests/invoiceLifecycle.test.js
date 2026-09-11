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

async function createInvoiceHelper(app, accessToken, businessId) {
  const res = await authed(request(app).post("/api/documents"), accessToken).send({
    businessId,
    type: "invoice",
    customer: {
      name: "Acme Corp",
      email: "billing@acme.com",
      companyName: "Acme Industrial Ltd",
    },
    lines: [
      {
        name: "Software Consulting",
        quantity: 2,
        rate: 5000,
        discount: { type: "percentage", value: 10 },
        tax: { type: "percentage", rate: 18, treatment: "cgst_sgst" },
      },
    ],
    notes: "Original invoice notes",
  });
  return res.body.data.document;
}

const userA = { name: "Alice Owner", email: "alice@example.com", password: "alice-password-1" };
const userB = { name: "Bob Outsider", email: "bob@example.com", password: "bob-password-1" };

describe("Invoice Lifecycle (Phase 5.5)", () => {
  describe("Valid Lifecycle Transitions & Timestamps", () => {
    it("transitions draft → sent and sets sentAt", async () => {
      const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
      const invoice = await createInvoiceHelper(app, accessToken, businessId);
      expect(invoice.status).toBe("draft");
      expect(invoice.sentAt).toBeNull();

      const res = await authed(
        request(app).patch(`/api/documents/${invoice.id}/status`),
        accessToken
      ).send({ status: "sent" });

      expect(res.status).toBe(200);
      expect(res.body.data.document.status).toBe("sent");
      expect(res.body.data.document.sentAt).toBeDefined();
      expect(new Date(res.body.data.document.sentAt).getTime()).not.toBeNaN();
    });

    it("transitions sent → viewed and sets viewedAt while preserving sentAt", async () => {
      const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
      const invoice = await createInvoiceHelper(app, accessToken, businessId);

      const sentRes = await authed(
        request(app).patch(`/api/documents/${invoice.id}/status`),
        accessToken
      ).send({ status: "sent" });
      const sentAt = sentRes.body.data.document.sentAt;

      const viewedRes = await authed(
        request(app).patch(`/api/documents/${invoice.id}/status`),
        accessToken
      ).send({ status: "viewed" });

      expect(viewedRes.status).toBe(200);
      expect(viewedRes.body.data.document.status).toBe("viewed");
      expect(viewedRes.body.data.document.sentAt).toBe(sentAt);
      expect(viewedRes.body.data.document.viewedAt).toBeDefined();
    });

    it("transitions sent → cancelled and sets cancelledAt", async () => {
      const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
      const invoice = await createInvoiceHelper(app, accessToken, businessId);

      await authed(request(app).patch(`/api/documents/${invoice.id}/status`), accessToken).send({
        status: "sent",
      });

      const res = await authed(
        request(app).patch(`/api/documents/${invoice.id}/status`),
        accessToken
      ).send({ status: "cancelled" });

      expect(res.status).toBe(200);
      expect(res.body.data.document.status).toBe("cancelled");
      expect(res.body.data.document.cancelledAt).toBeDefined();
    });

    it("transitions viewed → partially_paid", async () => {
      const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
      const invoice = await createInvoiceHelper(app, accessToken, businessId);

      await authed(request(app).patch(`/api/documents/${invoice.id}/status`), accessToken).send({ status: "sent" });
      await authed(request(app).patch(`/api/documents/${invoice.id}/status`), accessToken).send({ status: "viewed" });

      const res = await authed(
        request(app).patch(`/api/documents/${invoice.id}/status`),
        accessToken
      ).send({ status: "partially_paid" });

      expect(res.status).toBe(200);
      expect(res.body.data.document.status).toBe("partially_paid");
    });

    it("transitions viewed → paid and sets paidAt", async () => {
      const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
      const invoice = await createInvoiceHelper(app, accessToken, businessId);

      await authed(request(app).patch(`/api/documents/${invoice.id}/status`), accessToken).send({ status: "sent" });
      await authed(request(app).patch(`/api/documents/${invoice.id}/status`), accessToken).send({ status: "viewed" });

      const res = await authed(
        request(app).patch(`/api/documents/${invoice.id}/status`),
        accessToken
      ).send({ status: "paid" });

      expect(res.status).toBe(200);
      expect(res.body.data.document.status).toBe("paid");
      expect(res.body.data.document.paidAt).toBeDefined();
    });

    it("transitions viewed → overdue", async () => {
      const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
      const invoice = await createInvoiceHelper(app, accessToken, businessId);

      await authed(request(app).patch(`/api/documents/${invoice.id}/status`), accessToken).send({ status: "sent" });
      await authed(request(app).patch(`/api/documents/${invoice.id}/status`), accessToken).send({ status: "viewed" });

      const res = await authed(
        request(app).patch(`/api/documents/${invoice.id}/status`),
        accessToken
      ).send({ status: "overdue" });

      expect(res.status).toBe(200);
      expect(res.body.data.document.status).toBe("overdue");
    });

    it("transitions partially_paid → paid", async () => {
      const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
      const invoice = await createInvoiceHelper(app, accessToken, businessId);

      await authed(request(app).patch(`/api/documents/${invoice.id}/status`), accessToken).send({ status: "sent" });
      await authed(request(app).patch(`/api/documents/${invoice.id}/status`), accessToken).send({ status: "viewed" });
      await authed(request(app).patch(`/api/documents/${invoice.id}/status`), accessToken).send({ status: "partially_paid" });

      const res = await authed(
        request(app).patch(`/api/documents/${invoice.id}/status`),
        accessToken
      ).send({ status: "paid" });

      expect(res.status).toBe(200);
      expect(res.body.data.document.status).toBe("paid");
      expect(res.body.data.document.paidAt).toBeDefined();
    });

    it("transitions partially_paid → overdue", async () => {
      const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
      const invoice = await createInvoiceHelper(app, accessToken, businessId);

      await authed(request(app).patch(`/api/documents/${invoice.id}/status`), accessToken).send({ status: "sent" });
      await authed(request(app).patch(`/api/documents/${invoice.id}/status`), accessToken).send({ status: "viewed" });
      await authed(request(app).patch(`/api/documents/${invoice.id}/status`), accessToken).send({ status: "partially_paid" });

      const res = await authed(
        request(app).patch(`/api/documents/${invoice.id}/status`),
        accessToken
      ).send({ status: "overdue" });

      expect(res.status).toBe(200);
      expect(res.body.data.document.status).toBe("overdue");
    });

    it("transitions partially_paid → cancelled", async () => {
      const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
      const invoice = await createInvoiceHelper(app, accessToken, businessId);

      await authed(request(app).patch(`/api/documents/${invoice.id}/status`), accessToken).send({ status: "sent" });
      await authed(request(app).patch(`/api/documents/${invoice.id}/status`), accessToken).send({ status: "viewed" });
      await authed(request(app).patch(`/api/documents/${invoice.id}/status`), accessToken).send({ status: "partially_paid" });

      const res = await authed(
        request(app).patch(`/api/documents/${invoice.id}/status`),
        accessToken
      ).send({ status: "cancelled" });

      expect(res.status).toBe(200);
      expect(res.body.data.document.status).toBe("cancelled");
      expect(res.body.data.document.cancelledAt).toBeDefined();
    });

    it("transitions overdue → partially_paid", async () => {
      const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
      const invoice = await createInvoiceHelper(app, accessToken, businessId);

      await authed(request(app).patch(`/api/documents/${invoice.id}/status`), accessToken).send({ status: "sent" });
      await authed(request(app).patch(`/api/documents/${invoice.id}/status`), accessToken).send({ status: "viewed" });
      await authed(request(app).patch(`/api/documents/${invoice.id}/status`), accessToken).send({ status: "overdue" });

      const res = await authed(
        request(app).patch(`/api/documents/${invoice.id}/status`),
        accessToken
      ).send({ status: "partially_paid" });

      expect(res.status).toBe(200);
      expect(res.body.data.document.status).toBe("partially_paid");
    });

    it("transitions overdue → paid", async () => {
      const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
      const invoice = await createInvoiceHelper(app, accessToken, businessId);

      await authed(request(app).patch(`/api/documents/${invoice.id}/status`), accessToken).send({ status: "sent" });
      await authed(request(app).patch(`/api/documents/${invoice.id}/status`), accessToken).send({ status: "viewed" });
      await authed(request(app).patch(`/api/documents/${invoice.id}/status`), accessToken).send({ status: "overdue" });

      const res = await authed(
        request(app).patch(`/api/documents/${invoice.id}/status`),
        accessToken
      ).send({ status: "paid" });

      expect(res.status).toBe(200);
      expect(res.body.data.document.status).toBe("paid");
      expect(res.body.data.document.paidAt).toBeDefined();
    });

    it("transitions overdue → cancelled", async () => {
      const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
      const invoice = await createInvoiceHelper(app, accessToken, businessId);

      await authed(request(app).patch(`/api/documents/${invoice.id}/status`), accessToken).send({ status: "sent" });
      await authed(request(app).patch(`/api/documents/${invoice.id}/status`), accessToken).send({ status: "viewed" });
      await authed(request(app).patch(`/api/documents/${invoice.id}/status`), accessToken).send({ status: "overdue" });

      const res = await authed(
        request(app).patch(`/api/documents/${invoice.id}/status`),
        accessToken
      ).send({ status: "cancelled" });

      expect(res.status).toBe(200);
      expect(res.body.data.document.status).toBe("cancelled");
      expect(res.body.data.document.cancelledAt).toBeDefined();
    });
  });

  describe("Invalid & Disallowed Transitions", () => {
    it("rejects draft → paid", async () => {
      const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
      const invoice = await createInvoiceHelper(app, accessToken, businessId);

      const res = await authed(
        request(app).patch(`/api/documents/${invoice.id}/status`),
        accessToken
      ).send({ status: "paid" });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Cannot transition invoice from "draft" to "paid"/);
    });

    it("rejects draft → viewed", async () => {
      const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
      const invoice = await createInvoiceHelper(app, accessToken, businessId);

      const res = await authed(
        request(app).patch(`/api/documents/${invoice.id}/status`),
        accessToken
      ).send({ status: "viewed" });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Cannot transition invoice from "draft" to "viewed"/);
    });

    it("rejects sent → paid", async () => {
      const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
      const invoice = await createInvoiceHelper(app, accessToken, businessId);
      await authed(request(app).patch(`/api/documents/${invoice.id}/status`), accessToken).send({ status: "sent" });

      const res = await authed(
        request(app).patch(`/api/documents/${invoice.id}/status`),
        accessToken
      ).send({ status: "paid" });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Cannot transition invoice from "sent" to "paid"/);
    });

    it("rejects sent → partially_paid", async () => {
      const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
      const invoice = await createInvoiceHelper(app, accessToken, businessId);
      await authed(request(app).patch(`/api/documents/${invoice.id}/status`), accessToken).send({ status: "sent" });

      const res = await authed(
        request(app).patch(`/api/documents/${invoice.id}/status`),
        accessToken
      ).send({ status: "partially_paid" });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Cannot transition invoice from "sent" to "partially_paid"/);
    });

    it("rejects paid → draft (terminal)", async () => {
      const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
      const invoice = await createInvoiceHelper(app, accessToken, businessId);
      await authed(request(app).patch(`/api/documents/${invoice.id}/status`), accessToken).send({ status: "sent" });
      await authed(request(app).patch(`/api/documents/${invoice.id}/status`), accessToken).send({ status: "viewed" });
      await authed(request(app).patch(`/api/documents/${invoice.id}/status`), accessToken).send({ status: "paid" });

      const res = await authed(
        request(app).patch(`/api/documents/${invoice.id}/status`),
        accessToken
      ).send({ status: "draft" });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Cannot transition invoice from "paid" to "draft"/);
    });

    it("rejects paid → cancelled (terminal)", async () => {
      const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
      const invoice = await createInvoiceHelper(app, accessToken, businessId);
      await authed(request(app).patch(`/api/documents/${invoice.id}/status`), accessToken).send({ status: "sent" });
      await authed(request(app).patch(`/api/documents/${invoice.id}/status`), accessToken).send({ status: "viewed" });
      await authed(request(app).patch(`/api/documents/${invoice.id}/status`), accessToken).send({ status: "paid" });

      const res = await authed(
        request(app).patch(`/api/documents/${invoice.id}/status`),
        accessToken
      ).send({ status: "cancelled" });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Cannot transition invoice from "paid" to "cancelled"/);
    });

    it("rejects cancelled → draft (terminal)", async () => {
      const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
      const invoice = await createInvoiceHelper(app, accessToken, businessId);
      await authed(request(app).patch(`/api/documents/${invoice.id}/status`), accessToken).send({ status: "sent" });
      await authed(request(app).patch(`/api/documents/${invoice.id}/status`), accessToken).send({ status: "cancelled" });

      const res = await authed(
        request(app).patch(`/api/documents/${invoice.id}/status`),
        accessToken
      ).send({ status: "draft" });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Cannot transition invoice from "cancelled" to "draft"/);
    });

    it("rejects cancelled → sent (terminal)", async () => {
      const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
      const invoice = await createInvoiceHelper(app, accessToken, businessId);
      await authed(request(app).patch(`/api/documents/${invoice.id}/status`), accessToken).send({ status: "sent" });
      await authed(request(app).patch(`/api/documents/${invoice.id}/status`), accessToken).send({ status: "cancelled" });

      const res = await authed(
        request(app).patch(`/api/documents/${invoice.id}/status`),
        accessToken
      ).send({ status: "sent" });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Cannot transition invoice from "cancelled" to "sent"/);
    });

    it("rejects repeated same-status transition", async () => {
      const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
      const invoice = await createInvoiceHelper(app, accessToken, businessId);
      await authed(request(app).patch(`/api/documents/${invoice.id}/status`), accessToken).send({ status: "sent" });

      const res = await authed(
        request(app).patch(`/api/documents/${invoice.id}/status`),
        accessToken
      ).send({ status: "sent" });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Invoice is already in "sent" status/);
    });

    it("rejects transition on quotation document via invoice lifecycle", async () => {
      const documentService = require("../src/services/document.service");
      const { accessToken, businessId, userId } = await verifiedUserWithBusiness(userA);
      const quoteRes = await authed(request(app).post("/api/documents"), accessToken).send({
        businessId,
        type: "quotation",
        customer: { name: "Client A" },
        lines: [{ name: "Consulting", quantity: 1, rate: 500 }],
      });
      const quoteId = quoteRes.body.data.document.id;

      // transitionInvoiceStatus directly rejects quotations
      await expect(
        documentService.transitionInvoiceStatus(userId, quoteId, "sent")
      ).rejects.toThrow(/Invoice lifecycle transitions only apply to invoices/);

      // Endpoint rejects invoice-only statuses on quotations
      const res = await authed(
        request(app).patch(`/api/documents/${quoteId}/status`),
        accessToken
      ).send({ status: "paid" });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Invalid quotation status "paid"/);
    });


    it("rejects transition with invalid/unknown status", async () => {
      const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
      const invoice = await createInvoiceHelper(app, accessToken, businessId);

      const res = await authed(
        request(app).patch(`/api/documents/${invoice.id}/status`),
        accessToken
      ).send({ status: "flying" });

      expect(res.status).toBe(400);
    });

    it("rejects cross-business status update with 404 (no existence leakage)", async () => {
      const alice = await verifiedUserWithBusiness(userA, "Alice Co");
      const bob = await verifiedUserWithBusiness(userB, "Bob Co");
      const aliceInvoice = await createInvoiceHelper(app, alice.accessToken, alice.businessId);

      const res = await authed(
        request(app).patch(`/api/documents/${aliceInvoice.id}/status`),
        bob.accessToken
      ).send({ status: "sent" });

      expect(res.status).toBe(404);
      expect(res.body.message).toBe("Document not found.");
    });
  });

  describe("Immutability & Integrity During Transitions", () => {
    it("confirms number, snapshots, and calculations remain unchanged across transitions", async () => {
      const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
      const invoice = await createInvoiceHelper(app, accessToken, businessId);

      const originalNumber = invoice.number;
      const originalGrandTotal = invoice.grandTotal;
      const originalSubtotal = invoice.subtotal;
      const originalCustomer = invoice.customer;
      const originalLines = invoice.lines;

      const res = await authed(
        request(app).patch(`/api/documents/${invoice.id}/status`),
        accessToken
      ).send({ status: "sent" });

      const updated = res.body.data.document;
      expect(updated.number).toBe(originalNumber);
      expect(updated.grandTotal).toBe(originalGrandTotal);
      expect(updated.subtotal).toBe(originalSubtotal);
      expect(updated.customer.name).toBe(originalCustomer.name);
      expect(updated.lines[0].rate).toBe(originalLines[0].rate);
    });

    it("strictly forbids modifying content or custom timestamps through the status endpoint", async () => {
      const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
      const invoice = await createInvoiceHelper(app, accessToken, businessId);

      // Attempt to sneak in grandTotal or custom sentAt
      const res = await authed(
        request(app).patch(`/api/documents/${invoice.id}/status`),
        accessToken
      ).send({
        status: "sent",
        grandTotal: 10,
        sentAt: "2020-01-01T00:00:00.000Z",
      });

      // Strict validation rejects extra payload fields
      expect(res.status).toBe(400);
    });

    it("verifies issued invoice content remains immutable after status transition", async () => {
      const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
      const invoice = await createInvoiceHelper(app, accessToken, businessId);

      // Transition to sent
      await authed(request(app).patch(`/api/documents/${invoice.id}/status`), accessToken).send({
        status: "sent",
      });

      // Attempt to edit content through PATCH /api/documents/:id
      const editRes = await authed(request(app).patch(`/api/documents/${invoice.id}`), accessToken).send({
        notes: "Trying to edit after sending",
      });

      expect(editRes.status).toBe(400);
      expect(editRes.body.message).toMatch(/Only draft documents can be updated/);
    });
  });

  describe("Concurrency Safety", () => {
    it("prevents race condition when two concurrent requests attempt competing transitions from 'viewed'", async () => {
      const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
      const invoice = await createInvoiceHelper(app, accessToken, businessId);

      // Move to viewed
      await authed(request(app).patch(`/api/documents/${invoice.id}/status`), accessToken).send({ status: "sent" });
      await authed(request(app).patch(`/api/documents/${invoice.id}/status`), accessToken).send({ status: "viewed" });

      // Two simultaneous requests: Request A -> "paid", Request B -> "overdue"
      const [resA, resB] = await Promise.all([
        authed(request(app).patch(`/api/documents/${invoice.id}/status`), accessToken).send({ status: "paid" }),
        authed(request(app).patch(`/api/documents/${invoice.id}/status`), accessToken).send({ status: "overdue" }),
      ]);

      const statuses = [resA.status, resB.status];
      // Exactly one must succeed (200), and the other must be rejected (400 or 409)
      expect(statuses).toContain(200);
      const successCount = statuses.filter((s) => s === 200).length;
      expect(successCount).toBe(1);

      // The losing request must have received a 4xx error
      const failStatus = statuses.find((s) => s !== 200);
      expect([400, 409]).toContain(failStatus);

      // Verify the document in DB matches the winner and was not corrupted or overwritten
      const docInDb = await Document.findById(invoice.id);
      if (resA.status === 200) {
        expect(docInDb.status).toBe("paid");
        expect(docInDb.paidAt).toBeDefined();
      } else {
        expect(docInDb.status).toBe("overdue");
      }
    });

    it("prevents race condition when two concurrent requests attempt the same transition", async () => {
      const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
      const invoice = await createInvoiceHelper(app, accessToken, businessId);

      // Two simultaneous requests: both attempting draft -> sent
      const [res1, res2] = await Promise.all([
        authed(request(app).patch(`/api/documents/${invoice.id}/status`), accessToken).send({ status: "sent" }),
        authed(request(app).patch(`/api/documents/${invoice.id}/status`), accessToken).send({ status: "sent" }),
      ]);

      const statuses = [res1.status, res2.status];
      expect(statuses.filter((s) => s === 200)).toHaveLength(1);
      const failRes = res1.status !== 200 ? res1 : res2;
      expect([400, 409]).toContain(failRes.status);
    });
  });
});


