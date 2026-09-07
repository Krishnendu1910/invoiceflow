const mongoose = require("mongoose");

const refreshSessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // SHA-256 hash of the opaque refresh token. The raw token is never stored.
    tokenHash: {
      type: String,
      required: true,
      unique: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    lastUsedAt: {
      type: Date,
      default: Date.now,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
    // Safe, non-identifying metadata for the user's "active sessions" view.
    userAgent: {
      type: String,
      default: null,
    },
    ip: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

// MongoDB TTL cleanup: documents are removed automatically shortly after
// expiresAt passes, regardless of revocation status.
refreshSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

refreshSessionSchema.methods.isActive = function isActive() {
  return !this.revokedAt && this.expiresAt.getTime() > Date.now();
};

module.exports = mongoose.model("RefreshSession", refreshSessionSchema);
