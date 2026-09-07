const mongoose = require("mongoose");

const EMAIL_TOKEN_PURPOSES = ["email_verification", "password_reset"];

const emailTokenSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    purpose: {
      type: String,
      enum: EMAIL_TOKEN_PURPOSES,
      required: true,
    },
    // SHA-256 hash of the raw token emailed to the user. Never store the raw value.
    tokenHash: {
      type: String,
      required: true,
      unique: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    usedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

emailTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

emailTokenSchema.methods.isValid = function isValid() {
  return !this.usedAt && this.expiresAt.getTime() > Date.now();
};

module.exports = mongoose.model("EmailToken", emailTokenSchema);
module.exports.EMAIL_TOKEN_PURPOSES = EMAIL_TOKEN_PURPOSES;
