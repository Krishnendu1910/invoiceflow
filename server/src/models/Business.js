const mongoose = require("mongoose");

// Minimal Business model: only what first-business onboarding and ownership
// checks require. Branding, tax details, numbering, etc. belong to a later
// phase's full business-management feature.
const businessSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },
    // Free-form: the UI may suggest common values, but users can enter a
    // custom business type rather than being restricted to a fixed list.
    type: {
      type: String,
      trim: true,
      maxlength: 50,
      default: "other",
    },
    country: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      minlength: 2,
      maxlength: 2,
      default: "IN",
    },
    currency: {
      code: {
        type: String,
        required: true,
        trim: true,
        uppercase: true,
        default: "INR",
      },
      symbol: {
        type: String,
        required: true,
        trim: true,
        default: "₹",
      },
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Business", businessSchema);
