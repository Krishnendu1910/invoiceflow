const mongoose = require("mongoose");
const {
  Document,
  INVOICE_STATUSES,
  QUOTATION_STATUSES,
  INVOICE_STATUS_TRANSITIONS,
  QUOTATION_STATUS_TRANSITIONS,
} = require("../models/Document");
const Customer = require("../models/Customer");
const ApiError = require("../utils/ApiError");
const escapeRegex = require("../utils/escapeRegex");
const { buildPagination } = require("../utils/listQuery");
const businessService = require("./business.service");
const numberingService = require("./numbering.service");
const { calculateDocument } = require("./calculation/calculationEngine");

const ALLOWED_SORT_FIELDS = ["createdAt", "issueDate", "dueDate", "expiryDate", "grandTotal", "number"];

function toPublicDocument(doc) {
  return {
    id: doc._id.toString(),
    businessId: doc.businessId.toString(),
    type: doc.type,
    number: doc.number,
    status: doc.status,
    issueDate: doc.issueDate,
    dueDate: doc.dueDate || null,
    expiryDate: doc.expiryDate || null,
    sentAt: doc.sentAt || null,
    viewedAt: doc.viewedAt || null,
    paidAt: doc.paidAt || null,
    cancelledAt: doc.cancelledAt || null,
    acceptedAt: doc.acceptedAt || null,
    rejectedAt: doc.rejectedAt || null,
    expiredAt: doc.expiredAt || null,
    pricingMode: doc.pricingMode,
    currency: doc.currency,
    customer: doc.customer,
    business: doc.business,
    lines: doc.lines,
    subtotal: doc.subtotal,
    lineDiscountTotal: doc.lineDiscountTotal,
    overallDiscount: doc.overallDiscount,
    taxableAmount: doc.taxableAmount,
    taxes: doc.taxes,
    taxTotal: doc.taxTotal,
    additionalCharges: doc.additionalCharges,
    additionalChargesTotal: doc.additionalChargesTotal,
    grandTotal: doc.grandTotal,
    notes: doc.notes || "",
    terms: doc.terms || "",
    paymentInfo: doc.paymentInfo || {},
    conversion: doc.conversion
      ? {
          ...(doc.conversion.convertedToInvoiceId && {
            convertedToInvoiceId: doc.conversion.convertedToInvoiceId.toString(),
          }),
          ...(doc.conversion.convertedFromQuotationId && {
            convertedFromQuotationId: doc.conversion.convertedFromQuotationId.toString(),
          }),
          ...((doc.conversion.sourceQuotationId || doc.conversion.convertedFromQuotationId) && {
            sourceQuotationId: (doc.conversion.sourceQuotationId || doc.conversion.convertedFromQuotationId).toString(),
          }),
          convertedAt: doc.conversion.convertedAt || null,
        }
      : {},
    version: doc.version,
    metadata: doc.metadata || {},
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function createBusinessSnapshot(business, overrides = {}) {
  return {
    name: overrides.name || business.name,
    identity: {
      legalName: business.identity?.legalName || "",
      registrationNumber: business.identity?.registrationNumber || "",
      tradeName: business.identity?.tradeName || "",
      description: business.identity?.description || "",
      industry: business.identity?.industry || "",
      ...(overrides.identity || {}),
    },
    contact: {
      email: business.contact?.email || "",
      phone: business.contact?.phone || "",
      website: business.contact?.website || "",
      address: business.contact?.address || {},
      ...(overrides.contact || {}),
    },
    tax: {
      registrationStatus: business.tax?.registrationStatus || "unregistered",
      gstin: business.tax?.gstin || "",
      pan: business.tax?.pan || "",
      defaultMode: business.tax?.defaultMode || "none",
      treatment: business.tax?.treatment || "cgst_sgst",
      ...(overrides.tax || {}),
    },
    branding: {
      logo: business.branding?.logo || { provider: "none" },
      color: business.branding?.color || "",
      headerText: business.branding?.headerText || "",
      footerText: business.branding?.footerText || "",
      paymentTermsText: business.branding?.paymentTermsText || "",
      notesText: business.branding?.notesText || "",
      ...(overrides.branding || {}),
    },
    documentDefaults: {
      template: business.documentDefaults?.template || "standard",
      language: business.documentDefaults?.language || "en",
      ...(overrides.documentDefaults || {}),
    },
  };
}

async function resolveCustomerSnapshot(businessId, customerId, customerInput) {
  if (customerId) {
    const customer = await Customer.findOne({ _id: customerId, businessId });
    if (!customer) {
      throw new ApiError(404, "Customer not found for this business.");
    }
    return {
      customerId: customer._id,
      type: customerInput?.type || customer.type,
      name: customerInput?.name || customer.name,
      companyName: customerInput?.companyName !== undefined ? customerInput.companyName : (customer.companyName || ""),
      email: customerInput?.email !== undefined ? customerInput.email : (customer.email || ""),
      phone: customerInput?.phone !== undefined ? customerInput.phone : (customer.phone || ""),
      tax: {
        gstRegistered: customerInput?.tax?.gstRegistered ?? customer.tax?.gstRegistered ?? false,
        gstin: customerInput?.tax?.gstin ?? customer.tax?.gstin ?? "",
        pan: customerInput?.tax?.pan ?? customer.tax?.pan ?? "",
      },
      billingAddress: customerInput?.billingAddress || customer.billingAddress || null,
      shippingAddress: customerInput?.shippingAddress || customer.shippingAddress || null,
    };
  }

  if (customerInput && customerInput.name) {
    return {
      type: customerInput.type,
      name: customerInput.name,
      companyName: customerInput.companyName || "",
      email: customerInput.email || "",
      phone: customerInput.phone || "",
      tax: customerInput.tax || { gstRegistered: false },
      billingAddress: customerInput.billingAddress || null,
      shippingAddress: customerInput.shippingAddress || null,
    };
  }

  throw new ApiError(400, "Customer details or valid customerId required.");
}

async function getOwnedDocumentOrThrow(userId, documentId) {
  const document = await Document.findById(documentId);
  if (!document) {
    throw new ApiError(404, "Document not found.");
  }

  try {
    await businessService.getOwnedBusinessOrThrow(userId, document.businessId);
  } catch {
    // Prevent leaking whether another business's document exists
    throw new ApiError(404, "Document not found.");
  }

  return document;
}

async function createDocument(userId, businessId, data) {
  const business = await businessService.getOwnedBusinessOrThrow(userId, businessId);

  const customerSnapshot = await resolveCustomerSnapshot(business._id, data.customerId, data.customer);
  const businessSnapshot = createBusinessSnapshot(business, data.business);

  const currency = data.currency || {
    code: business.currency?.code || "INR",
    symbol: business.currency?.symbol || "₹",
    decimals: 2,
  };

  const pricingMode = data.pricingMode || business.tax?.pricingMode || "exclusive";
  const overallDiscount = data.overallDiscount || business.documentDefaults?.discount || { type: "none", value: 0 };
  const additionalCharges = data.additionalCharges || business.documentDefaults?.additionalCharges || [];

  const calculation = calculateDocument({
    lines: data.lines,
    pricingMode,
    overallDiscount,
    additionalCharges,
    currency,
  });

  const allocated = await numberingService.allocateNextNumber(business._id, data.type);

  const notes = data.notes ?? business.branding?.notesText ?? "";
  const terms = data.terms ?? business.branding?.paymentTermsText ?? "";
  const paymentInfo = data.paymentInfo || {
    paymentTerms: business.payments?.defaultTerms || { type: "due_on_receipt" },
    bank: business.payments?.bank || {},
    upi: business.payments?.upi || {},
  };

  const document = await Document.create({
    businessId: business._id,
    type: data.type,
    number: allocated.formattedNumber,
    status: "draft",
    issueDate: data.issueDate || new Date(),
    dueDate: data.dueDate,
    expiryDate: data.expiryDate,
    pricingMode: calculation.pricingMode,
    currency: calculation.currency,
    customer: customerSnapshot,
    business: businessSnapshot,
    lines: calculation.lines,
    subtotal: calculation.subtotal,
    lineDiscountTotal: calculation.lineDiscountTotal,
    overallDiscount: calculation.overallDiscount,
    taxableAmount: calculation.taxableAmount,
    taxes: calculation.taxes,
    taxTotal: calculation.taxTotal,
    additionalCharges: calculation.additionalCharges,
    additionalChargesTotal: calculation.additionalChargesTotal,
    grandTotal: calculation.grandTotal,
    notes,
    terms,
    paymentInfo,
    metadata: data.metadata || {},
  });

  return toPublicDocument(document);
}

async function getDocumentById(userId, documentId) {
  const document = await getOwnedDocumentOrThrow(userId, documentId);
  return toPublicDocument(document);
}

async function listDocuments(userId, businessId, query) {
  await businessService.getOwnedBusinessOrThrow(userId, businessId);

  const filter = { businessId };

  if (query.type) {
    filter.type = query.type;
  }

  if (query.status && query.status !== "all") {
    filter.status = query.status;
  }

  if (query.search) {
    const pattern = new RegExp(escapeRegex(query.search), "i");
    filter.$or = [
      { number: pattern },
      { "customer.name": pattern },
      { "customer.companyName": pattern },
      { "customer.email": pattern },
    ];
  }

  let sort = { createdAt: -1, _id: 1 };
  if (query.sort) {
    const direction = query.sort.startsWith("-") ? -1 : 1;
    const field = query.sort.replace(/^-/, "");
    if (ALLOWED_SORT_FIELDS.includes(field)) {
      sort = { [field]: direction, _id: 1 };
    }
  }

  const page = query.page || 1;
  const limit = query.limit || 20;
  const { skip, limit: limitNum } = buildPagination(page, limit);

  const [documents, total] = await Promise.all([
    Document.find(filter).sort(sort).skip(skip).limit(limitNum),
    Document.countDocuments(filter),
  ]);

  return {
    documents: documents.map(toPublicDocument),
    pagination: {
      page,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum) || 1,
    },
  };
}

async function updateDraftDocument(userId, documentId, data) {
  const document = await getOwnedDocumentOrThrow(userId, documentId);

  if (document.status !== "draft") {
    throw new ApiError(400, "Only draft documents can be updated.");
  }

  // Strictly block modifications to immutable/identity fields
  if (data.type && data.type !== document.type) {
    throw new ApiError(400, "Document type cannot be modified.");
  }
  if (data.businessId && data.businessId.toString() !== document.businessId.toString()) {
    throw new ApiError(400, "businessId cannot be modified.");
  }
  if (data.number && data.number !== document.number) {
    throw new ApiError(400, "Document number cannot be modified.");
  }

  // Update customer snapshot if provided
  if (data.customerId || data.customer) {
    const customerSnapshot = await resolveCustomerSnapshot(
      document.businessId,
      data.customerId || document.customer.customerId,
      data.customer || document.customer
    );
    document.customer = customerSnapshot;
  }

  // Update business snapshot if provided
  if (data.business) {
    document.business = {
      ...document.business.toObject(),
      ...data.business,
      identity: { ...(document.business.identity || {}), ...(data.business.identity || {}) },
      contact: { ...(document.business.contact || {}), ...(data.business.contact || {}) },
      tax: { ...(document.business.tax || {}), ...(data.business.tax || {}) },
      branding: { ...(document.business.branding || {}), ...(data.business.branding || {}) },
      documentDefaults: { ...(document.business.documentDefaults || {}), ...(data.business.documentDefaults || {}) },
    };
  }

  // Recalculate calculation fields server-side if lines/pricing/discounts/charges changed
  const lines = data.lines || document.lines;
  const pricingMode = data.pricingMode || document.pricingMode;
  const overallDiscount = data.overallDiscount !== undefined ? data.overallDiscount : document.overallDiscount;
  const additionalCharges = data.additionalCharges !== undefined ? data.additionalCharges : document.additionalCharges;
  const currency = data.currency || document.currency;

  const calculation = calculateDocument({
    lines,
    pricingMode,
    overallDiscount,
    additionalCharges,
    currency,
  });

  document.pricingMode = calculation.pricingMode;
  document.currency = calculation.currency;
  document.lines = calculation.lines;
  document.subtotal = calculation.subtotal;
  document.lineDiscountTotal = calculation.lineDiscountTotal;
  document.overallDiscount = calculation.overallDiscount;
  document.taxableAmount = calculation.taxableAmount;
  document.taxes = calculation.taxes;
  document.taxTotal = calculation.taxTotal;
  document.additionalCharges = calculation.additionalCharges;
  document.additionalChargesTotal = calculation.additionalChargesTotal;
  document.grandTotal = calculation.grandTotal;

  if (data.issueDate !== undefined) document.issueDate = data.issueDate;
  if (data.dueDate !== undefined) document.dueDate = data.dueDate;
  if (data.expiryDate !== undefined) document.expiryDate = data.expiryDate;
  if (data.notes !== undefined) document.notes = data.notes;
  if (data.terms !== undefined) document.terms = data.terms;
  if (data.paymentInfo !== undefined) document.paymentInfo = data.paymentInfo;
  if (data.metadata !== undefined) document.metadata = data.metadata;

  await document.save();
  return toPublicDocument(document);
}

async function deleteDraftDocument(userId, documentId) {
  const document = await getOwnedDocumentOrThrow(userId, documentId);

  if (document.status !== "draft") {
    throw new ApiError(400, "Cannot delete an issued document.");
  }

  await Document.deleteOne({ _id: document._id });
  return { id: document._id.toString() };
}

async function transitionInvoiceStatus(userId, documentId, targetStatus) {
  const document = await getOwnedDocumentOrThrow(userId, documentId);

  if (document.type !== "invoice") {
    throw new ApiError(400, "Invoice lifecycle transitions only apply to invoices.");
  }

  if (!INVOICE_STATUSES.includes(targetStatus)) {
    throw new ApiError(400, `Invalid invoice status "${targetStatus}".`);
  }

  if (document.status === targetStatus) {
    throw new ApiError(400, `Invoice is already in "${targetStatus}" status.`);
  }

  const allowed = INVOICE_STATUS_TRANSITIONS[document.status] || [];
  if (!allowed.includes(targetStatus)) {
    throw new ApiError(400, `Cannot transition invoice from "${document.status}" to "${targetStatus}".`);
  }

  const updatePayload = {
    $set: {
      status: targetStatus,
    },
  };

  if (targetStatus === "sent" && !document.sentAt) {
    updatePayload.$set.sentAt = new Date();
  } else if (targetStatus === "viewed" && !document.viewedAt) {
    updatePayload.$set.viewedAt = new Date();
  } else if (targetStatus === "paid" && !document.paidAt) {
    updatePayload.$set.paidAt = new Date();
  } else if (targetStatus === "cancelled" && !document.cancelledAt) {
    updatePayload.$set.cancelledAt = new Date();
  }

  const updated = await Document.findOneAndUpdate(
    {
      _id: document._id,
      type: "invoice",
      status: document.status,
    },
    updatePayload,
    { returnDocument: "after", runValidators: true }
  );

  if (!updated) {
    const fresh = await Document.findById(documentId);
    if (!fresh) {
      throw new ApiError(404, "Document not found.");
    }
    if (fresh.status === targetStatus) {
      throw new ApiError(400, `Invoice is already in "${targetStatus}" status.`);
    }
    const freshAllowed = INVOICE_STATUS_TRANSITIONS[fresh.status] || [];
    if (!freshAllowed.includes(targetStatus)) {
      throw new ApiError(400, `Cannot transition invoice from "${fresh.status}" to "${targetStatus}".`);
    }
    throw new ApiError(409, "Concurrent invoice status transition conflict. Please retry.");
  }

  return toPublicDocument(updated);
}

async function transitionQuotationStatus(userId, documentId, targetStatus) {
  const document = await getOwnedDocumentOrThrow(userId, documentId);

  if (document.type !== "quotation") {
    throw new ApiError(400, "Quotation lifecycle transitions only apply to quotations.");
  }

  if (!QUOTATION_STATUSES.includes(targetStatus)) {
    throw new ApiError(400, `Invalid quotation status "${targetStatus}".`);
  }

  if (document.status === targetStatus) {
    throw new ApiError(400, `Quotation is already in "${targetStatus}" status.`);
  }

  const allowed = QUOTATION_STATUS_TRANSITIONS[document.status] || [];
  if (!allowed.includes(targetStatus)) {
    throw new ApiError(400, `Cannot transition quotation from "${document.status}" to "${targetStatus}".`);
  }

  if (targetStatus === "converted") {
    throw new ApiError(400, 'Cannot transition quotation to "converted" via status endpoint. Use the conversion endpoint.');
  }

  const updatePayload = {
    $set: {
      status: targetStatus,
    },
  };

  if (targetStatus === "sent" && !document.sentAt) {
    updatePayload.$set.sentAt = new Date();
  } else if (targetStatus === "viewed" && !document.viewedAt) {
    updatePayload.$set.viewedAt = new Date();
  } else if (targetStatus === "accepted" && !document.acceptedAt) {
    updatePayload.$set.acceptedAt = new Date();
  } else if (targetStatus === "rejected" && !document.rejectedAt) {
    updatePayload.$set.rejectedAt = new Date();
  } else if (targetStatus === "expired" && !document.expiredAt) {
    updatePayload.$set.expiredAt = new Date();
  } else if (targetStatus === "converted" && !document.conversion?.convertedAt) {
    updatePayload.$set["conversion.convertedAt"] = new Date();
  }

  const updated = await Document.findOneAndUpdate(
    {
      _id: document._id,
      type: "quotation",
      status: document.status,
    },
    updatePayload,
    { returnDocument: "after", runValidators: true }
  );

  if (!updated) {
    const fresh = await Document.findById(documentId);
    if (!fresh) {
      throw new ApiError(404, "Document not found.");
    }
    if (fresh.status === targetStatus) {
      throw new ApiError(400, `Quotation is already in "${targetStatus}" status.`);
    }
    const freshAllowed = QUOTATION_STATUS_TRANSITIONS[fresh.status] || [];
    if (!freshAllowed.includes(targetStatus)) {
      throw new ApiError(400, `Cannot transition quotation from "${fresh.status}" to "${targetStatus}".`);
    }
    throw new ApiError(409, "Concurrent quotation status transition conflict. Please retry.");
  }

  return toPublicDocument(updated);
}

async function transitionDocumentStatus(userId, documentId, targetStatus) {
  const document = await getOwnedDocumentOrThrow(userId, documentId);

  if (document.type === "invoice") {
    return transitionInvoiceStatus(userId, documentId, targetStatus);
  }
  if (document.type === "quotation") {
    return transitionQuotationStatus(userId, documentId, targetStatus);
  }

  throw new ApiError(400, "Unsupported document type for status transition.");
}

async function convertQuotationToInvoice(userId, quotationId) {
  const quotation = await getOwnedDocumentOrThrow(userId, quotationId);

  if (quotation.type !== "quotation") {
    throw new ApiError(400, "Only quotation documents can be converted to an invoice.");
  }

  if (quotation.status === "converted" || quotation.conversion?.convertedToInvoiceId) {
    throw new ApiError(400, "Quotation has already been converted.");
  }

  if (quotation.status !== "accepted") {
    throw new ApiError(400, `Only accepted quotations can be converted to invoices. Current status is "${quotation.status}".`);
  }

  const session = await mongoose.startSession();
  let createdInvoice;
  let updatedQuotation;

  try {
    await session.withTransaction(async () => {
      const conversionDate = new Date();
      const newInvoiceId = new mongoose.Types.ObjectId();

      const lockedQuotation = await Document.findOneAndUpdate(
        {
          _id: quotation._id,
          type: "quotation",
          status: "accepted",
          $or: [
            { "conversion.convertedToInvoiceId": { $exists: false } },
            { "conversion.convertedToInvoiceId": null },
          ],
        },
        {
          $set: {
            status: "converted",
            "conversion.convertedToInvoiceId": newInvoiceId,
            "conversion.convertedAt": conversionDate,
          },
        },
        { session, returnDocument: "after" }
      );

      if (!lockedQuotation) {
        const current = await Document.findById(quotationId).session(session);
        if (!current) {
          throw new ApiError(404, "Document not found.");
        }
        if (current.status === "converted" || current.conversion?.convertedToInvoiceId) {
          throw new ApiError(400, "Quotation has already been converted.");
        }
        throw new ApiError(409, "Quotation conversion conflict. Please retry.");
      }

      const allocated = await numberingService.allocateNextNumber(quotation.businessId, "invoice", { session });

      const linesForCalculation = quotation.lines.map((l) => ({
        itemId: l.itemId,
        name: l.name,
        description: l.description,
        hsnSac: l.hsnSac,
        quantity: l.quantity,
        unit: l.unit,
        rate: l.rate,
        discount: l.discount ? { type: l.discount.type, value: l.discount.value } : { type: "none", value: 0 },
        tax: l.tax ? { type: l.tax.type, rate: l.tax.rate, treatment: l.tax.treatment } : { type: "none", rate: 0 },
      }));

      const overallDiscount = quotation.overallDiscount && quotation.overallDiscount.type !== "none"
        ? { type: quotation.overallDiscount.type, value: quotation.overallDiscount.value }
        : { type: "none", value: 0 };

      const additionalCharges = (quotation.additionalCharges || []).map((c) => ({
        name: c.name,
        amount: c.amount,
        tax: c.tax ? { type: c.tax.type, rate: c.tax.rate, treatment: c.tax.treatment } : { type: "none", rate: 0 },
      }));

      const calculation = calculateDocument({
        lines: linesForCalculation,
        pricingMode: quotation.pricingMode,
        overallDiscount,
        additionalCharges,
        currency: quotation.currency,
      });

      const customerSnapshot = JSON.parse(JSON.stringify(quotation.customer));
      const businessSnapshot = JSON.parse(JSON.stringify(quotation.business));

      const [invoiceDoc] = await Document.create(
        [
          {
            _id: newInvoiceId,
            businessId: quotation.businessId,
            type: "invoice",
            number: allocated.formattedNumber,
            status: "draft",
            issueDate: new Date(),
            dueDate: null,
            pricingMode: calculation.pricingMode,
            currency: calculation.currency,
            customer: customerSnapshot,
            business: businessSnapshot,
            lines: calculation.lines,
            subtotal: calculation.subtotal,
            lineDiscountTotal: calculation.lineDiscountTotal,
            overallDiscount: calculation.overallDiscount,
            taxableAmount: calculation.taxableAmount,
            taxes: calculation.taxes,
            taxTotal: calculation.taxTotal,
            additionalCharges: calculation.additionalCharges,
            additionalChargesTotal: calculation.additionalChargesTotal,
            grandTotal: calculation.grandTotal,
            notes: quotation.notes || "",
            terms: quotation.terms || "",
            paymentInfo: quotation.paymentInfo ? JSON.parse(JSON.stringify(quotation.paymentInfo)) : {},
            conversion: {
              convertedFromQuotationId: quotation._id,
              sourceQuotationId: quotation._id,
              convertedAt: conversionDate,
            },
            metadata: {
              convertedFromQuotationNumber: quotation.number,
            },
          },
        ],
        { session }
      );

      createdInvoice = invoiceDoc;
      updatedQuotation = lockedQuotation;
    });
  } finally {
    await session.endSession();
  }

  return {
    invoice: toPublicDocument(createdInvoice),
    quotation: toPublicDocument(updatedQuotation),
  };
}

module.exports = {
  toPublicDocument,
  getOwnedDocumentOrThrow,
  createDocument,
  getDocumentById,
  listDocuments,
  updateDraftDocument,
  deleteDraftDocument,
  transitionInvoiceStatus,
  transitionQuotationStatus,
  transitionDocumentStatus,
  convertQuotationToInvoice,
};



