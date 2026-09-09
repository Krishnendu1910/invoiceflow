const mongoose = require("mongoose");

// A basic, reusable audit trail for settings changes. Deliberately generic
// (businessId/actor/section/field/before/after) so future settings, team,
// and security features can write to the same collection instead of each
// inventing their own audit shape.
const settingsAuditLogSchema = new mongoose.Schema(
  {
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    section: {
      type: String,
      required: true,
    },
    // Dot path of the changed field within its section, e.g. "tax.gstin".
    field: {
      type: String,
      required: true,
    },
    // Mixed on purpose: settings values vary in shape (string, number,
    // boolean, array, object) across sections. Sensitive values (e.g. bank
    // account number) are redacted before being written — see
    // services/auditLog.service.js — so this never holds raw secrets.
    previousValue: mongoose.Schema.Types.Mixed,
    newValue: mongoose.Schema.Types.Mixed,
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

settingsAuditLogSchema.index({ businessId: 1, createdAt: -1 });

module.exports = mongoose.model("SettingsAuditLog", settingsAuditLogSchema);
