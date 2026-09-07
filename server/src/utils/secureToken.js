const crypto = require("crypto");

// Opaque, high-entropy tokens for refresh sessions and email tokens.
// Only the SHA-256 hash is ever persisted — the raw value is shown to the
// client exactly once (in a cookie or an email link) and is unrecoverable
// from the database afterwards.

function generateRawToken(bytes = 48) {
  return crypto.randomBytes(bytes).toString("hex");
}

function hashToken(rawToken) {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

module.exports = { generateRawToken, hashToken };
