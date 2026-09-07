const jwt = require("jsonwebtoken");
const env = require("../config/env");
const RefreshSession = require("../models/RefreshSession");
const { generateRawToken, hashToken } = require("../utils/secureToken");

function signAccessToken(user) {
  return jwt.sign({ sub: user._id.toString() }, env.jwt.accessSecret, {
    expiresIn: env.jwt.accessExpiresIn,
  });
}

function verifyAccessToken(token) {
  return jwt.verify(token, env.jwt.accessSecret);
}

function refreshExpiryDate() {
  return new Date(Date.now() + env.refreshToken.ttlDays * 24 * 60 * 60 * 1000);
}

// Creates a new refresh session and returns the raw token (to be set in a
// cookie). Only the hash is persisted.
async function createRefreshSession(userId, { userAgent, ip } = {}) {
  const rawToken = generateRawToken();

  const session = await RefreshSession.create({
    user: userId,
    tokenHash: hashToken(rawToken),
    expiresAt: refreshExpiryDate(),
    userAgent: userAgent || null,
    ip: ip || null,
  });

  return { rawToken, session };
}

const REUSE_DETECTED = "REUSE_DETECTED";
const INVALID = "INVALID";

// Looks up a refresh session by its raw token. Distinguishes between "no
// such token" and "token was already rotated/revoked" (replay) so the
// caller can react to replay by revoking the whole session family.
async function findSessionByRawToken(rawToken) {
  const tokenHash = hashToken(rawToken);
  const session = await RefreshSession.findOne({ tokenHash });

  if (!session) {
    return { status: INVALID, session: null };
  }

  if (session.revokedAt || session.expiresAt.getTime() <= Date.now()) {
    return { status: REUSE_DETECTED, session };
  }

  return { status: "VALID", session };
}

async function revokeSession(session) {
  session.revokedAt = new Date();
  await session.save();
}

async function revokeAllSessionsForUser(userId) {
  await RefreshSession.updateMany(
    { user: userId, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
}

module.exports = {
  signAccessToken,
  verifyAccessToken,
  createRefreshSession,
  findSessionByRawToken,
  revokeSession,
  revokeAllSessionsForUser,
  REUSE_DETECTED,
  INVALID,
};
