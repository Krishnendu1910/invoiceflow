const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    // Absent for accounts that only ever signed in with Google.
    passwordHash: {
      type: String,
      select: false,
      default: null,
    },
    // Presence indicates a linked Google account. No `default` here: the
    // sparse unique index below only excludes documents where the field is
    // truly absent, and an explicit `null` default would count as present,
    // colliding across every account that never links Google.
    googleId: {
      type: String,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    lastActiveBusiness: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      default: null,
    },
  },
  { timestamps: true }
);

userSchema.index({ googleId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("User", userSchema);
