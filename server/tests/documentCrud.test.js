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

async function createCustomerHelper(app, accessToken, businessId, name = "Acme Corp") {
  const res = await authed(request(app).post("/api/customers"), accessToken).send({
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
  return res.body.data.customer;
}

const userA = { name: "Alice Owner", email: "alice@example.com", password: "alice-password-1" };
const userB = { name: "Bob Outsider", email: "bob@example.com", password: "bob-password-1" };

describe("Document CRUD & Service Layer (Phase 5.3)", () => {
  describe("CREATE /api/documents", () => {
    it("creates an invoice with automatic numbering, draft status, snapshots, and server-side calculation", async () => {
      const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
      const customer = await createCustomerHelper(app, accessToken, businessId);

      const payload = {
        businessId,
        type: "invoice",
        customerId: customer.id,
        lines: [
          {
            name: "Cloud Server Hosting",
            quantity: 2,
            rate: 5000,
            discount: { type: "percentage", value: 10 }, // 1000 discount -> 9000 taxable
            tax: { type: "percentage", rate: 18, treatment: "cgst_sgst" }, // 1620 tax
          },
        ],
        notes: "Payment due within 15 days.",
      };

      const res = await authed(request(app).post("/api/documents"), accessToken).send(payload);

      expect(res.status).toBe(201);
      const doc = res.body.data.document;
      expect(doc.type).toBe("invoice");
      expect(doc.status).toBe("draft");
      expect(doc.number).toBe("INV-1");
      expect(doc.businessId).toBe(businessId);
      expect(doc.notes).toBe("Payment due within 15 days.");

      // Customer snapshot preserved
      expect(doc.customer.customerId).toBe(customer.id);
      expect(doc.customer.name).toBe("Acme Corp");
      expect(doc.customer.companyName).toBe("Acme Industrial Ltd");
      expect(doc.customer.tax.gstin).toBe("27AABCU9603R1ZM");
      expect(doc.customer.billingAddress.city).toBe("Mumbai");

      // Business snapshot preserved
      expect(doc.business.name).toBe("Test Co");

      // Server calculations verified
      expect(doc.subtotal).toBe(10000);
      expect(doc.lineDiscountTotal).toBe(1000);
      expect(doc.taxableAmount).toBe(9000);
      expect(doc.taxTotal).toBe(1620);
      expect(doc.grandTotal).toBe(10620);
      expect(doc.lines).toHaveLength(1);
      expect(doc.lines[0].lineTotal).toBe(10620);
    });

    it("creates a quotation with automatic numbering and isolated numbering sequence", async () => {
      const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
      const customer = await createCustomerHelper(app, accessToken, businessId);

      // Create first invoice -> INV-1
      const invRes = await authed(request(app).post("/api/documents"), accessToken).send({
        businessId,
        type: "invoice",
        customerId: customer.id,
        lines: [{ name: "Service A", quantity: 1, rate: 1000 }],
      });
      expect(invRes.body.data.document.number).toBe("INV-1");

      // Create first quotation -> QUO-1 (isolated from invoice sequence)
      const quoRes = await authed(request(app).post("/api/documents"), accessToken).send({
        businessId,
        type: "quotation",
        customerId: customer.id,
        lines: [{ name: "Consulting", quantity: 5, rate: 2000 }],
      });
      expect(quoRes.status).toBe(201);
      expect(quoRes.body.data.document.type).toBe("quotation");
      expect(quoRes.body.data.document.number).toBe("QUO-1");

      // Create second invoice -> INV-2
      const inv2Res = await authed(request(app).post("/api/documents"), accessToken).send({
        businessId,
        type: "invoice",
        customerId: customer.id,
        lines: [{ name: "Service B", quantity: 1, rate: 2000 }],
      });
      expect(inv2Res.body.data.document.number).toBe("INV-2");
    });

    it("creates document with manual customer snapshot when customerId is not provided", async () => {
      const { accessToken, businessId } = await verifiedUserWithBusiness(userA);

      const res = await authed(request(app).post("/api/documents"), accessToken).send({
        businessId,
        type: "invoice",
        customer: {
          name: "Direct Walk-in Client",
          email: "walkin@example.com",
          phone: "+919876543210",
        },
        lines: [{ name: "Hardware Part", quantity: 1, rate: 300 }],
      });

      expect(res.status).toBe(201);
      expect(res.body.data.document.customer.name).toBe("Direct Walk-in Client");
      expect(res.body.data.document.grandTotal).toBe(300);
    });

    it("strictly prevents client-supplied totals from overriding server calculations", async () => {
      const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
      const customer = await createCustomerHelper(app, accessToken, businessId);

      // Attempting to send client-supplied grandTotal: 1
      const res = await authed(request(app).post("/api/documents"), accessToken).send({
        businessId,
        type: "invoice",
        customerId: customer.id,
        lines: [{ name: "Product A", quantity: 1, rate: 5000 }],
        grandTotal: 1, // Client attempting to tamper
      });

      // Zod schema rejects client-supplied calculated field
      expect(res.status).toBe(400);
    });

    it("rejects document creation for unauthorized business", async () => {
      const userAData = await verifiedUserWithBusiness(userA, "Alice Co");
      const userBData = await verifiedUserWithBusiness(userB, "Bob Co");

      const res = await authed(request(app).post("/api/documents"), userBData.accessToken).send({
        businessId: userAData.businessId, // Bob trying to create doc for Alice's business
        type: "invoice",
        customer: { name: "Some Customer" },
        lines: [{ name: "Line", quantity: 1, rate: 100 }],
      });

      expect(res.status).toBe(403);
    });

    it("rejects document creation with nonexistent customerId for the business", async () => {
      const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
      const fakeCustomerId = new mongoose.Types.ObjectId().toString();

      const res = await authed(request(app).post("/api/documents"), accessToken).send({
        businessId,
        type: "invoice",
        customerId: fakeCustomerId,
        lines: [{ name: "Line", quantity: 1, rate: 100 }],
      });

      expect(res.status).toBe(404);
    });

    it("rejects creation with missing required fields (e.g. Empty lines)", async () => {
      const { accessToken, businessId } = await verifiedUserWithBusiness(userA);

      const res = await authed(request(app).post("/api/documents"), accessToken).send({
        businessId,
        type: "invoice",
        customer: { name: "Customer" },
        lines: [],
      });

      expect(res.status).toBe(400);
    });
  });

  describe("READ /api/documents & /api/documents/:id", () => {
    it("gets owned document by ID", async () => {
      const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
      const customer = await createCustomerHelper(app, accessToken, businessId);

      const created = await authed(request(app).post("/api/documents"), accessToken).send({
        businessId,
        type: "invoice",
        customerId: customer.id,
        lines: [{ name: "Consulting", quantity: 2, rate: 1000 }],
      });

      const docId = created.body.data.document.id;
      const res = await authed(request(app).get(`/api/documents/${docId}`), accessToken);

      expect(res.status).toBe(200);
      expect(res.body.data.document.id).toBe(docId);
      expect(res.body.data.document.grandTotal).toBe(2000);
    });

    it("rejects cross-business document read with 404 (no existence leakage)", async () => {
      const alice = await verifiedUserWithBusiness(userA, "Alice Co");
      const bob = await verifiedUserWithBusiness(userB, "Bob Co");
      const customer = await createCustomerHelper(app, alice.accessToken, alice.businessId);

      const created = await authed(request(app).post("/api/documents"), alice.accessToken).send({
        businessId: alice.businessId,
        type: "invoice",
        customerId: customer.id,
        lines: [{ name: "Secret Product", quantity: 1, rate: 5000 }],
      });
      const aliceDocId = created.body.data.document.id;

      // Bob tries to access Alice's document
      const res = await authed(request(app).get(`/api/documents/${aliceDocId}`), bob.accessToken);
      expect(res.status).toBe(404);
      expect(res.body.message).toBe("Document not found.");
    });

    it("lists documents with filtering by type, status, pagination, and search", async () => {
      const { accessToken, businessId } = await verifiedUserWithBusiness(userA);

      // Create 2 invoices and 1 quotation
      await authed(request(app).post("/api/documents"), accessToken).send({
        businessId,
        type: "invoice",
        customer: { name: "Alpha Client", companyName: "Alpha Tech" },
        lines: [{ name: "Service Alpha", quantity: 1, rate: 1000 }],
      });

      await authed(request(app).post("/api/documents"), accessToken).send({
        businessId,
        type: "invoice",
        customer: { name: "Beta Client", companyName: "Beta Corp" },
        lines: [{ name: "Service Beta", quantity: 1, rate: 2000 }],
      });

      await authed(request(app).post("/api/documents"), accessToken).send({
        businessId,
        type: "quotation",
        customer: { name: "Gamma Client", companyName: "Gamma Inc" },
        lines: [{ name: "Service Gamma", quantity: 1, rate: 3000 }],
      });

      // 1. List all for business
      const listAll = await authed(
        request(app).get(`/api/documents?businessId=${businessId}`),
        accessToken
      );
      expect(listAll.status).toBe(200);
      expect(listAll.body.data.documents).toHaveLength(3);
      expect(listAll.body.data.pagination.total).toBe(3);

      // 2. Filter by type: quotation
      const quotes = await authed(
        request(app).get(`/api/documents?businessId=${businessId}&type=quotation`),
        accessToken
      );
      expect(quotes.body.data.documents).toHaveLength(1);
      expect(quotes.body.data.documents[0].type).toBe("quotation");

      // 3. Search by customer name
      const searched = await authed(
        request(app).get(`/api/documents?businessId=${businessId}&search=Alpha`),
        accessToken
      );
      expect(searched.body.data.documents).toHaveLength(1);
      expect(searched.body.data.documents[0].customer.name).toBe("Alpha Client");

      // 4. Pagination
      const page1 = await authed(
        request(app).get(`/api/documents?businessId=${businessId}&page=1&limit=2`),
        accessToken
      );
      expect(page1.body.data.documents).toHaveLength(2);
      expect(page1.body.data.pagination.pages).toBe(2);

      // 5. Safe sorting
      const sorted = await authed(
        request(app).get(`/api/documents?businessId=${businessId}&sort=grandTotal`),
        accessToken
      );
      expect(sorted.body.data.documents[0].grandTotal).toBe(1000);
    });
  });

  describe("UPDATE PATCH /api/documents/:id", () => {
    it("edits a draft document and triggers server-side recalculation", async () => {
      const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
      const customer = await createCustomerHelper(app, accessToken, businessId);

      const created = await authed(request(app).post("/api/documents"), accessToken).send({
        businessId,
        type: "invoice",
        customerId: customer.id,
        lines: [{ name: "Initial Line", quantity: 1, rate: 1000 }],
      });
      const docId = created.body.data.document.id;
      expect(created.body.data.document.grandTotal).toBe(1000);

      // Update lines and overall discount
      const updated = await authed(request(app).patch(`/api/documents/${docId}`), accessToken).send({
        lines: [
          {
            name: "Updated Line",
            quantity: 2,
            rate: 2000, // 4000
            discount: { type: "percentage", value: 10 }, // 400 discount -> 3600
            tax: { type: "percentage", rate: 18, treatment: "cgst_sgst" }, // 648 tax
          },
        ],
        notes: "Updated terms and notes.",
      });

      expect(updated.status).toBe(200);
      const doc = updated.body.data.document;
      expect(doc.notes).toBe("Updated terms and notes.");
      expect(doc.lines[0].name).toBe("Updated Line");
      expect(doc.subtotal).toBe(4000);
      expect(doc.taxableAmount).toBe(3600);
      expect(doc.taxTotal).toBe(648);
      expect(doc.grandTotal).toBe(4248);
    });

    it("strictly rejects altering document number on update", async () => {
      const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
      const customer = await createCustomerHelper(app, accessToken, businessId);

      const created = await authed(request(app).post("/api/documents"), accessToken).send({
        businessId,
        type: "invoice",
        customerId: customer.id,
        lines: [{ name: "Product", quantity: 1, rate: 100 }],
      });
      const docId = created.body.data.document.id;

      const res = await authed(request(app).patch(`/api/documents/${docId}`), accessToken).send({
        number: "INV-HACKED",
      });

      expect(res.status).toBe(400);
    });

    it("strictly rejects altering document type or businessId on update", async () => {
      const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
      const customer = await createCustomerHelper(app, accessToken, businessId);

      const created = await authed(request(app).post("/api/documents"), accessToken).send({
        businessId,
        type: "invoice",
        customerId: customer.id,
        lines: [{ name: "Product", quantity: 1, rate: 100 }],
      });
      const docId = created.body.data.document.id;

      // Attempt to change type to quotation
      const resType = await authed(request(app).patch(`/api/documents/${docId}`), accessToken).send({
        type: "quotation",
      });
      expect(resType.status).toBe(400);

      // Attempt to change businessId
      const fakeBizId = new mongoose.Types.ObjectId().toString();
      const resBiz = await authed(request(app).patch(`/api/documents/${docId}`), accessToken).send({
        businessId: fakeBizId,
      });
      expect(resBiz.status).toBe(400);
    });

    it("rejects editing content of an issued document", async () => {
      const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
      const customer = await createCustomerHelper(app, accessToken, businessId);

      const created = await authed(request(app).post("/api/documents"), accessToken).send({
        businessId,
        type: "invoice",
        customerId: customer.id,
        lines: [{ name: "Product", quantity: 1, rate: 500 }],
      });
      const docId = created.body.data.document.id;

      // Mark document as sent (issued) directly in database
      await Document.updateOne({ _id: docId }, { $set: { status: "sent" } });

      // Attempt to modify content
      const res = await authed(request(app).patch(`/api/documents/${docId}`), accessToken).send({
        notes: "Trying to tamper after issuance",
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Only draft documents can be updated/i);
    });

    it("rejects cross-business document update with 404", async () => {
      const alice = await verifiedUserWithBusiness(userA, "Alice Co");
      const bob = await verifiedUserWithBusiness(userB, "Bob Co");
      const customer = await createCustomerHelper(app, alice.accessToken, alice.businessId);

      const created = await authed(request(app).post("/api/documents"), alice.accessToken).send({
        businessId: alice.businessId,
        type: "invoice",
        customerId: customer.id,
        lines: [{ name: "Original", quantity: 1, rate: 100 }],
      });
      const aliceDocId = created.body.data.document.id;

      // Bob tries to update Alice's document
      const res = await authed(request(app).patch(`/api/documents/${aliceDocId}`), bob.accessToken).send({
        notes: "Bob's tamper attempt",
      });

      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/documents/:id", () => {
    it("deletes a draft document successfully", async () => {
      const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
      const customer = await createCustomerHelper(app, accessToken, businessId);

      const created = await authed(request(app).post("/api/documents"), accessToken).send({
        businessId,
        type: "invoice",
        customerId: customer.id,
        lines: [{ name: "Draft Product", quantity: 1, rate: 100 }],
      });
      const docId = created.body.data.document.id;

      const deleteRes = await authed(request(app).delete(`/api/documents/${docId}`), accessToken);
      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.data.id).toBe(docId);

      // Verify it's gone
      const getRes = await authed(request(app).get(`/api/documents/${docId}`), accessToken);
      expect(getRes.status).toBe(404);
    });

    it("strictly rejects deleting an issued document", async () => {
      const { accessToken, businessId } = await verifiedUserWithBusiness(userA);
      const customer = await createCustomerHelper(app, accessToken, businessId);

      const created = await authed(request(app).post("/api/documents"), accessToken).send({
        businessId,
        type: "invoice",
        customerId: customer.id,
        lines: [{ name: "Issued Item", quantity: 1, rate: 100 }],
      });
      const docId = created.body.data.document.id;

      // Transition to sent (issued)
      await Document.updateOne({ _id: docId }, { $set: { status: "sent" } });

      const res = await authed(request(app).delete(`/api/documents/${docId}`), accessToken);
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Cannot delete an issued document/i);

      // Verify document still exists
      const docInDb = await Document.findById(docId);
      expect(docInDb).not.toBeNull();
    });

    it("rejects cross-business deletion with 404", async () => {
      const alice = await verifiedUserWithBusiness(userA, "Alice Co");
      const bob = await verifiedUserWithBusiness(userB, "Bob Co");
      const customer = await createCustomerHelper(app, alice.accessToken, alice.businessId);

      const created = await authed(request(app).post("/api/documents"), alice.accessToken).send({
        businessId: alice.businessId,
        type: "invoice",
        customerId: customer.id,
        lines: [{ name: "Alice Draft", quantity: 1, rate: 100 }],
      });
      const docId = created.body.data.document.id;

      // Bob tries to delete Alice's draft
      const res = await authed(request(app).delete(`/api/documents/${docId}`), bob.accessToken);
      expect(res.status).toBe(404);

      // Alice's draft still exists
      const docInDb = await Document.findById(docId);
      expect(docInDb).not.toBeNull();
    });
  });
});

