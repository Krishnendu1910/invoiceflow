const mongoose = require("mongoose");
const testDb = require("./testDb");
const { Document, INVOICE_STATUSES, QUOTATION_STATUSES } = require("../src/models/Document");

beforeAll(async () => {
  await testDb.connect();
});

afterAll(async () => {
  await testDb.disconnect();
});

afterEach(async () => {
  await testDb.clear();
});

function sampleSnapshots() {
  return {
    customer: {
      name: "Acme Corp",
      companyName: "Acme Corporation Pvt Ltd",
      email: "billing@acme.com",
      phone: "+919876543210",
      tax: {
        gstRegistered: true,
        gstin: "27AABCU9603R1ZM",
        pan: "AABCU9603R",
      },
      billingAddress: {
        line1: "123 Business Park",
        city: "Mumbai",
        state: "Maharashtra",
        postalCode: "400001",
        country: "IN",
      },
      shippingAddress: {
        line1: "123 Business Park",
        city: "Mumbai",
        state: "Maharashtra",
        postalCode: "400001",
        country: "IN",
      },
    },
    business: {
      name: "My SaaS Company",
      identity: {
        legalName: "My SaaS Solutions LLP",
        tradeName: "InvoiceFlow",
      },
      contact: {
        email: "support@mysaas.com",
        phone: "+919123456780",
        address: {
          line1: "456 Tech Boulevard",
          city: "Bengaluru",
          state: "Karnataka",
          postalCode: "560001",
          country: "IN",
        },
      },
      tax: {
        registrationStatus: "registered",
        gstin: "29AABCS1429B1ZB",
        treatment: "cgst_sgst",
      },
      branding: {
        color: "#4f46e5",
        headerText: "Thank you for your business!",
      },
    },
    lines: [
      {
        name: "Cloud Subscription",
        description: "Annual plan",
        quantity: 1,
        rate: 10000,
        grossAmount: 10000,
        discount: { type: "percentage", value: 10, amount: 1000 },
        taxableAmount: 9000,
        tax: {
          type: "percentage",
          rate: 18,
          amount: 1620,
          treatment: "cgst_sgst",
          cgst: { rate: 9, amount: 810 },
          sgst: { rate: 9, amount: 810 },
        },
        lineTotal: 10620,
      },
    ],
  };
}

describe("Document Model & Schema (Phase 5.1)", () => {
  describe("Type and Status Validation", () => {
    it("creates an invoice with valid invoice statuses", async () => {
      const businessId = new mongoose.Types.ObjectId();
      const snapshots = sampleSnapshots();

      for (const status of INVOICE_STATUSES) {
        const doc = await Document.create({
          businessId,
          type: "invoice",
          number: `INV-${status}`,
          status,
          dueDate: new Date(Date.now() + 86400000 * 15),
          ...snapshots,
          subtotal: 10000,
          taxableAmount: 9000,
          taxTotal: 1620,
          grandTotal: 10620,
        });

        expect(doc.type).toBe("invoice");
        expect(doc.status).toBe(status);
        expect(doc._id).toBeDefined();
      }
    });

    it("creates a quotation with valid quotation statuses", async () => {
      const businessId = new mongoose.Types.ObjectId();
      const snapshots = sampleSnapshots();

      for (const status of QUOTATION_STATUSES) {
        const doc = await Document.create({
          businessId,
          type: "quotation",
          number: `QUO-${status}`,
          status,
          expiryDate: new Date(Date.now() + 86400000 * 30),
          ...snapshots,
          subtotal: 10000,
          taxableAmount: 9000,
          taxTotal: 1620,
          grandTotal: 10620,
        });

        expect(doc.type).toBe("quotation");
        expect(doc.status).toBe(status);
        expect(doc._id).toBeDefined();
      }
    });

    it("rejects invoice with quotation-only status on save and updateOne", async () => {
      const businessId = new mongoose.Types.ObjectId();
      const snapshots = sampleSnapshots();

      // On creation
      const doc = new Document({
        businessId,
        type: "invoice",
        number: "INV-INVALID-STATUS",
        status: "accepted", // valid for quotation, invalid for invoice
        ...snapshots,
      });

      await expect(doc.validate()).rejects.toThrow(/Status "accepted" is not valid for document type/);

      // On query update
      const validDoc = await Document.create({
        businessId,
        type: "invoice",
        number: "INV-VALID",
        status: "draft",
        ...snapshots,
      });

      await expect(
        Document.updateOne({ _id: validDoc._id }, { status: "accepted" }, { runValidators: true })
      ).rejects.toThrow(/Status "accepted" is not valid for document type/);
    });

    it("rejects quotation with invoice-only status on save and updateOne", async () => {
      const businessId = new mongoose.Types.ObjectId();
      const snapshots = sampleSnapshots();

      // On creation
      const doc = new Document({
        businessId,
        type: "quotation",
        number: "QUO-INVALID-STATUS",
        status: "paid", // valid for invoice, invalid for quotation
        ...snapshots,
      });

      await expect(doc.validate()).rejects.toThrow(/Status "paid" is not valid for document type/);

      // On query update
      const validQuote = await Document.create({
        businessId,
        type: "quotation",
        number: "QUO-VALID",
        status: "draft",
        ...snapshots,
      });

      await expect(
        Document.updateOne({ _id: validQuote._id }, { status: "paid" }, { runValidators: true })
      ).rejects.toThrow(/Status "paid" is not valid for document type/);
    });

    it("allows legitimate status transitions on update queries with runValidators: true", async () => {
      const businessId = new mongoose.Types.ObjectId();
      const snapshots = sampleSnapshots();

      const doc = await Document.create({
        businessId,
        type: "invoice",
        number: "INV-LEGIT-UPDATE",
        status: "draft",
        ...snapshots,
      });

      // Update from draft -> sent without passing type in update payload
      await Document.updateOne({ _id: doc._id }, { status: "sent" }, { runValidators: true });

      const updated = await Document.findById(doc._id);
      expect(updated.status).toBe("sent");

      // Update from sent -> paid
      await Document.updateOne({ _id: doc._id }, { status: "paid" }, { runValidators: true });
      const paidDoc = await Document.findById(doc._id);
      expect(paidDoc.status).toBe("paid");
    });
  });

  describe("Required Fields & Validation", () => {
    it("fails validation when required fields are missing", async () => {
      const doc = new Document({});
      let err;
      try {
        await doc.validate();
      } catch (e) {
        err = e;
      }

      expect(err).toBeDefined();
      expect(err.errors.businessId).toBeDefined();
      expect(err.errors.type).toBeDefined();
      expect(err.errors.number).toBeDefined();
      expect(err.errors.status).toBeDefined();
      expect(err.errors.customer).toBeDefined();
      expect(err.errors.business).toBeDefined();
    });

    it("fails validation when customer.name or business.name is missing", async () => {
      const doc = new Document({
        businessId: new mongoose.Types.ObjectId(),
        type: "invoice",
        number: "INV-1",
        status: "draft",
        customer: { email: "test@example.com" },
        business: { contact: { email: "biz@example.com" } },
      });

      let err;
      try {
        await doc.validate();
      } catch (e) {
        err = e;
      }

      expect(err).toBeDefined();
      expect(err.errors["customer.name"]).toBeDefined();
      expect(err.errors["business.name"]).toBeDefined();
    });
  });

  describe("Number Immutability Across All Operations", () => {
    it("prevents changing document number via save() on existing document", async () => {
      const businessId = new mongoose.Types.ObjectId();
      const doc = await Document.create({
        businessId,
        type: "invoice",
        number: "INV-IMMUTABLE-SAVE",
        status: "draft",
        ...sampleSnapshots(),
      });

      doc.number = "INV-CHANGED";
      await expect(doc.save()).rejects.toThrow("Document number is immutable once issued.");
    });

    it("prevents changing document number via updateOne (direct and $set)", async () => {
      const businessId = new mongoose.Types.ObjectId();
      const doc = await Document.create({
        businessId,
        type: "invoice",
        number: "INV-IMMUTABLE-UPDATEONE",
        status: "draft",
        ...sampleSnapshots(),
      });

      // Direct form
      await expect(
        Document.updateOne({ _id: doc._id }, { number: "INV-HACKED-1" })
      ).rejects.toThrow("Document number is immutable once issued.");

      // $set form
      await expect(
        Document.updateOne({ _id: doc._id }, { $set: { number: "INV-HACKED-2" } })
      ).rejects.toThrow("Document number is immutable once issued.");
    });

    it("prevents changing document number via findOneAndUpdate", async () => {
      const businessId = new mongoose.Types.ObjectId();
      const doc = await Document.create({
        businessId,
        type: "invoice",
        number: "INV-IMMUTABLE-FOAU",
        status: "draft",
        ...sampleSnapshots(),
      });

      await expect(
        Document.findOneAndUpdate({ _id: doc._id }, { $set: { number: "INV-FOAU-HACKED" } })
      ).rejects.toThrow("Document number is immutable once issued.");
    });

    it("prevents changing document number via updateMany", async () => {
      const businessId = new mongoose.Types.ObjectId();
      await Document.create({
        businessId,
        type: "invoice",
        number: "INV-IMMUTABLE-UPDATEMANY",
        status: "draft",
        ...sampleSnapshots(),
      });

      await expect(
        Document.updateMany({ businessId }, { $set: { number: "INV-MANY-HACKED" } })
      ).rejects.toThrow("Document number is immutable once issued.");
    });
  });

  describe("Snapshot Immutability for Issued Documents", () => {
    it("prevents modifying customer, business, lines, and totals on issued documents via updateOne", async () => {
      const businessId = new mongoose.Types.ObjectId();
      const doc = await Document.create({
        businessId,
        type: "invoice",
        number: "INV-ISSUED-1",
        status: "sent", // Issued status!
        ...sampleSnapshots(),
      });

      // Attempting to overwrite customer name via updateOne
      await expect(
        Document.updateOne({ _id: doc._id }, { $set: { "customer.name": "Different Corp" } })
      ).rejects.toThrow("Cannot modify content or snapshots of an issued document.");

      // Attempting to overwrite business branding via updateOne
      await expect(
        Document.updateOne({ _id: doc._id }, { $set: { "business.name": "Different Biz" } })
      ).rejects.toThrow("Cannot modify content or snapshots of an issued document.");

      // Attempting to overwrite lines via updateOne
      await expect(
        Document.updateOne({ _id: doc._id }, { $set: { lines: [] } })
      ).rejects.toThrow("Cannot modify content or snapshots of an issued document.");

      // Attempting to overwrite totals via updateOne
      await expect(
        Document.updateOne({ _id: doc._id }, { $set: { grandTotal: 0 } })
      ).rejects.toThrow("Cannot modify content or snapshots of an issued document.");
    });

    it("prevents modifying protected snapshot/calculation fields on issued documents via updateMany", async () => {
      const businessId = new mongoose.Types.ObjectId();
      await Document.create({
        businessId,
        type: "invoice",
        number: "INV-ISSUED-MANY",
        status: "sent",
        ...sampleSnapshots(),
      });

      await expect(
        Document.updateMany({ businessId }, { $set: { "customer.name": "Batch Overwrite" } })
      ).rejects.toThrow("Cannot modify content or snapshots of an issued document.");

      await expect(
        Document.updateMany({ businessId }, { $set: { grandTotal: 500 } })
      ).rejects.toThrow("Cannot modify content or snapshots of an issued document.");
    });

    it("prevents modifying protected snapshot/calculation fields on issued documents via findOneAndUpdate", async () => {
      const businessId = new mongoose.Types.ObjectId();
      const doc = await Document.create({
        businessId,
        type: "invoice",
        number: "INV-ISSUED-FOAU",
        status: "sent",
        ...sampleSnapshots(),
      });

      await expect(
        Document.findOneAndUpdate({ _id: doc._id }, { $set: { "customer.name": "FOAU Overwrite" } })
      ).rejects.toThrow("Cannot modify content or snapshots of an issued document.");

      await expect(
        Document.findOneAndUpdate({ _id: doc._id }, { $set: { subtotal: 50000 } })
      ).rejects.toThrow("Cannot modify content or snapshots of an issued document.");
    });

    it("prevents modifying snapshots on issued documents via save()", async () => {
      const businessId = new mongoose.Types.ObjectId();
      const doc = await Document.create({
        businessId,
        type: "invoice",
        number: "INV-ISSUED-SAVE",
        status: "sent",
        ...sampleSnapshots(),
      });

      doc.customer.name = "Tampered Corp";
      await expect(doc.save()).rejects.toThrow("Cannot modify customer on an issued document.");
    });

    it("allows editing snapshots on draft documents", async () => {
      const businessId = new mongoose.Types.ObjectId();
      const doc = await Document.create({
        businessId,
        type: "invoice",
        number: "INV-DRAFT-EDITABLE",
        status: "draft", // Draft is editable!
        ...sampleSnapshots(),
      });

      await Document.updateOne(
        { _id: doc._id },
        { $set: { "customer.name": "Updated Acme Corp" } }
      );

      const reloaded = await Document.findById(doc._id);
      expect(reloaded.customer.name).toBe("Updated Acme Corp");
    });
  });

  describe("Number Uniqueness & Business Isolation", () => {
    it("enforces uniqueness of number per document type within a business", async () => {
      const businessId = new mongoose.Types.ObjectId();
      const snapshots = sampleSnapshots();

      await Document.create({
        businessId,
        type: "invoice",
        number: "INV-DUP",
        status: "draft",
        ...snapshots,
      });

      // Same number, same business, same type -> Duplicate Key Error
      await expect(
        Document.create({
          businessId,
          type: "invoice",
          number: "INV-DUP",
          status: "sent",
          ...snapshots,
        })
      ).rejects.toThrow(/duplicate key/i);

      // Same number, same business, DIFFERENT type (quotation) -> Allowed!
      const quote = await Document.create({
        businessId,
        type: "quotation",
        number: "INV-DUP",
        status: "draft",
        ...snapshots,
      });
      expect(quote._id).toBeDefined();

      // Same number, same type, DIFFERENT business -> Allowed!
      const otherBizId = new mongoose.Types.ObjectId();
      const otherBizDoc = await Document.create({
        businessId: otherBizId,
        type: "invoice",
        number: "INV-DUP",
        status: "draft",
        ...snapshots,
      });
      expect(otherBizDoc._id).toBeDefined();
    });

    it("strictly isolates documents by businessId", async () => {
      const bizA = new mongoose.Types.ObjectId();
      const bizB = new mongoose.Types.ObjectId();
      const snapshots = sampleSnapshots();

      await Document.create({
        businessId: bizA,
        type: "invoice",
        number: "INV-A1",
        status: "draft",
        ...snapshots,
      });

      await Document.create({
        businessId: bizB,
        type: "invoice",
        number: "INV-B1",
        status: "draft",
        ...snapshots,
      });

      const docsA = await Document.find({ businessId: bizA });
      expect(docsA).toHaveLength(1);
      expect(docsA[0].number).toBe("INV-A1");

      const docsB = await Document.find({ businessId: bizB });
      expect(docsB).toHaveLength(1);
      expect(docsB[0].number).toBe("INV-B1");
    });
  });

  describe("Number Allocation Compatibility with numbering.service", () => {
    it("allocates a real number via allocateNextNumber, creates Document, and prevents altering it", async () => {
      const Business = require("../src/models/Business");
      const numberingService = require("../src/services/numbering.service");

      const business = await Business.create({
        ownerId: new mongoose.Types.ObjectId(),
        name: "Numbering Integration Co",
      });

      // 1. Allocate real number from numbering service
      const allocated = await numberingService.allocateNextNumber(business._id, "invoice");
      expect(allocated.number).toBe(1);
      expect(allocated.formattedNumber).toBe("INV-1");

      // 2. Assigns to Document upon creation
      const doc = await Document.create({
        businessId: business._id,
        type: "invoice",
        number: allocated.formattedNumber,
        status: "draft",
        ...sampleSnapshots(),
      });

      // 3. Verifies Document stores it
      expect(doc.number).toBe("INV-1");
      const stored = await Document.findById(doc._id);
      expect(stored.number).toBe("INV-1");

      // 4. Verifies updates cannot alter it across save, updateOne, findOneAndUpdate, updateMany
      stored.number = "INV-TAMPERED";
      await expect(stored.save()).rejects.toThrow("Document number is immutable once issued.");

      await expect(
        Document.updateOne({ _id: doc._id }, { number: "INV-TAMPERED" })
      ).rejects.toThrow("Document number is immutable once issued.");

      await expect(
        Document.findOneAndUpdate({ _id: doc._id }, { $set: { number: "INV-TAMPERED" } })
      ).rejects.toThrow("Document number is immutable once issued.");

      await expect(
        Document.updateMany({ _id: doc._id }, { $set: { number: "INV-TAMPERED" } })
      ).rejects.toThrow("Document number is immutable once issued.");
    });
  });
});

