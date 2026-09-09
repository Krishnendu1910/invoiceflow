const mongoose = require("mongoose");
const businessService = require("./business.service");
const auditLogService = require("./auditLog.service");
const numberingService = require("./numbering.service");
const ApiError = require("../utils/ApiError");

// Public shape of the full settings resource. Deliberately separate from
// business.service's toPublicBusiness (used by the lightweight business
// list/switcher) so that endpoint doesn't have to pay for — or expose —
// every settings field on every app load.
function toPublicSettings(business) {
  return {
    id: business._id.toString(),
    name: business.name,
    type: business.type,
    country: business.country,
    currency: business.currency,
    identity: business.identity,
    contact: business.contact,
    branding: business.branding,
    tax: business.tax,
    numbering: business.numbering,
    payments: business.payments,
    fiscalYear: business.fiscalYear,
    documentDefaults: business.documentDefaults,
    updatedAt: business.updatedAt,
  };
}

async function getSettings(userId, businessId) {
  const business = await businessService.getOwnedBusinessOrThrow(userId, businessId);
  return toPublicSettings(business);
}

// Applies a partial update to one settings section, records an audit entry
// per changed field, and returns the fresh public settings. `merge` decides
// how `data` is applied to the business document — sections differ in
// whether nested objects should be shallow-merged or replaced wholesale,
// matching each field's validation. `snapshot` picks out exactly the part
// of the document this section's audit trail should cover (e.g. "profile"
// spans top-level name/type/country plus identity and contact).
//
// Atomicity: the business mutation and audit-log write run in the same
// MongoDB transaction. If either operation fails, the transaction is aborted
// so the business change cannot commit without its corresponding audit entry.
// Transactions require a MongoDB replica set in both production and tests.
async function updateSection({ userId, businessId, section, data, merge, snapshot }) {
  // Verify ownership before opening the transaction.
  await businessService.getOwnedBusinessOrThrow(userId, businessId);

  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      // Re-read inside the transaction so the mutation operates on the
      // current persisted document and participates in the same session.
      const business = await require("../models/Business").findOne({
        _id: businessId,
        ownerId: userId,
        isDeleted: false,
      }).session(session);

      if (!business) {
        throw new ApiError(404, "Business not found.");
      }

      const before = JSON.parse(JSON.stringify(snapshot(business)));

      merge(business, data);
      await business.save({ session });

      const after = JSON.parse(JSON.stringify(snapshot(business)));

      await auditLogService.recordSectionChanges({
        businessId: business._id,
        actorId: userId,
        section,
        before,
        after,
        session,
      });

      result = toPublicSettings(business);
    });

    return result;
  } finally {
    await session.endSession();
  }
}
function updateProfile(userId, businessId, data) {
  const { identity, contact, ...topLevel } = data;

  return updateSection({
    userId,
    businessId,
    section: "profile",
    data,
    snapshot: (business) => ({
      name: business.name,
      type: business.type,
      country: business.country,
      identity: business.identity,
      contact: business.contact,
    }),
    merge: (business) => {
      Object.assign(business, topLevel);
      if (identity) Object.assign(business.identity, identity);
      if (contact) {
        const { address, ...rest } = contact;
        Object.assign(business.contact, rest);
        if (address) business.contact.address = address;
      }
    },
  });
}

function updateBranding(userId, businessId, data) {
  return updateSection({
    userId,
    businessId,
    section: "branding",
    data,
    snapshot: (business) => business.branding,
    merge: (business) => {
      if (data.logo) Object.assign(business.branding.logo, data.logo);
      const { logo, ...rest } = data;
      Object.assign(business.branding, rest);
    },
  });
}

function updateTax(userId, businessId, data) {
  return updateSection({
    userId,
    businessId,
    section: "tax",
    data,
    snapshot: (business) => business.tax,
    merge: (business) => Object.assign(business.tax, data),
  });
}

async function updateNumbering(userId, businessId, data) {
  // Guard: once a series has allocated at least one number, changing
  // startingNumber would risk numbering moving backward or colliding with
  // previously issued document numbers. Prefix and resetPolicy changes are
  // always safe — prefix is cosmetic and resetPolicy opens a new period
  // counter rather than rewinding an existing one.
  for (const docType of ["invoice", "quotation"]) {
    const seriesData = data[docType];
    if (seriesData?.startingNumber !== undefined) {
      const allocated = await numberingService.hasAllocations(businessId, docType);
      if (allocated) {
        throw new ApiError(
          409,
          `Cannot change the starting number for ${docType}s because numbers have already been allocated. Change the prefix instead.`
        );
      }
    }
  }

  return updateSection({
    userId,
    businessId,
    section: "numbering",
    data,
    snapshot: (business) => business.numbering,
    merge: (business) => {
      if (data.invoice) Object.assign(business.numbering.invoice, data.invoice);
      if (data.quotation) Object.assign(business.numbering.quotation, data.quotation);
    },
  });
}

function updatePayments(userId, businessId, data) {
  return updateSection({
    userId,
    businessId,
    section: "payments",
    data,
    snapshot: (business) => business.payments,
    merge: (business) => {
      if (data.upi) Object.assign(business.payments.upi, data.upi);
      if (data.bank) Object.assign(business.payments.bank, data.bank);
      if (data.defaultTerms) Object.assign(business.payments.defaultTerms, data.defaultTerms);
      const { upi, bank, defaultTerms, ...rest } = data;
      Object.assign(business.payments, rest);
    },
  });
}

function updateFiscalYear(userId, businessId, data) {
  return updateSection({
    userId,
    businessId,
    section: "fiscalYear",
    data,
    snapshot: (business) => business.fiscalYear,
    merge: (business) => Object.assign(business.fiscalYear, data),
  });
}

function updateDocumentDefaults(userId, businessId, data) {
  const { currency, ...documentData } = data;

  return updateSection({
    userId,
    businessId,
    section: "documents",
    data,
    snapshot: (business) => ({ currency: business.currency, documentDefaults: business.documentDefaults }),
    merge: (business) => {
      if (currency) business.currency = currency;
      if (documentData.discount) Object.assign(business.documentDefaults.discount, documentData.discount);
      const { discount, ...rest } = documentData;
      Object.assign(business.documentDefaults, rest);
    },
  });
}

module.exports = {
  toPublicSettings,
  getSettings,
  updateProfile,
  updateBranding,
  updateTax,
  updateNumbering,
  updatePayments,
  updateFiscalYear,
  updateDocumentDefaults,
};
