const argon2 = require("argon2");
const env = require("../config/env");
const User = require("../models/User");
const EmailToken = require("../models/EmailToken");
const RefreshSession = require("../models/RefreshSession");
const Business = require("../models/Business");
const ApiError = require("../utils/ApiError");
const { generateRawToken, hashToken } = require("../utils/secureToken");
const emailService = require("./email/email.service");
const tokenService = require("./token.service");

const ARGON2_OPTIONS = { type: argon2.argon2id };

// Used to keep login response time roughly constant whether or not the
// email exists, so a timing side-channel can't be used to enumerate accounts.
const DUMMY_HASH_PROMISE = argon2.hash("invoiceflow-dummy-password-for-timing-parity", ARGON2_OPTIONS);

function hashPassword(password) {
  return argon2.hash(password, ARGON2_OPTIONS);
}

function toPublicUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    isEmailVerified: user.isEmailVerified,
    hasPassword: Boolean(user.passwordHash),
    hasGoogleLinked: Boolean(user.googleId),
    lastActiveBusiness: user.lastActiveBusiness ? user.lastActiveBusiness.toString() : null,
    createdAt: user.createdAt,
  };
}

async function register({ name, email, password }) {
  const existing = await User.findOne({ email });

  if (existing) {
    throw new ApiError(409, "An account with this email already exists.");
  }

  const passwordHash = await hashPassword(password);

  const user = await User.create({
    name,
    email,
    passwordHash,
    isEmailVerified: false,
  });

  await issueVerificationEmail(user);

  return toPublicUser(user);
}

async function issueVerificationEmail(user) {
  const rawToken = generateRawToken();

  await EmailToken.create({
    user: user._id,
    purpose: "email_verification",
    tokenHash: hashToken(rawToken),
    expiresAt: new Date(Date.now() + env.tokens.emailVerificationTtlHours * 60 * 60 * 1000),
  });

  await emailService.sendVerificationEmail(user.email, rawToken);
}

async function issueSessionTokens(user, meta) {
  const accessToken = tokenService.signAccessToken(user);
  const { rawToken, session } = await tokenService.createRefreshSession(user._id, meta);
  return { accessToken, refreshToken: rawToken, refreshSession: session };
}

async function login({ email, password }, meta) {
  const user = await User.findOne({ email }).select("+passwordHash");

  if (!user || !user.passwordHash) {
    // Run an argon2 verify anyway so timing is similar to the real path.
    await argon2.verify(await DUMMY_HASH_PROMISE, password).catch(() => {});
    throw new ApiError(401, "Invalid email or password.");
  }

  const valid = await argon2.verify(user.passwordHash, password);

  if (!valid) {
    throw new ApiError(401, "Invalid email or password.");
  }

  const tokens = await issueSessionTokens(user, meta);

  return { user: toPublicUser(user), ...tokens };
}

async function refresh(rawRefreshToken, meta) {
  if (!rawRefreshToken) {
    throw new ApiError(401, "Missing refresh token.");
  }

  const { status, session } = await tokenService.findSessionByRawToken(rawRefreshToken);

  if (status === tokenService.REUSE_DETECTED) {
    // The token was already rotated or revoked but is being presented again:
    // treat as a stolen/replayed token and kill every session for this user.
    await tokenService.revokeAllSessionsForUser(session.user);
    throw new ApiError(401, "Refresh token has already been used. All sessions have been revoked.");
  }

  if (status === tokenService.INVALID) {
    throw new ApiError(401, "Invalid refresh token.");
  }

  const user = await User.findById(session.user).select("+passwordHash");

  if (!user) {
    await tokenService.revokeSession(session);
    throw new ApiError(401, "Invalid refresh token.");
  }

  session.lastUsedAt = new Date();
  await tokenService.revokeSession(session);

  const tokens = await issueSessionTokens(user, meta);

  return { user: toPublicUser(user), ...tokens };
}

async function logout(rawRefreshToken) {
  if (!rawRefreshToken) {
    return;
  }

  const { status, session } = await tokenService.findSessionByRawToken(rawRefreshToken);

  if (status === "VALID") {
    await tokenService.revokeSession(session);
  }
}

async function logoutAll(userId) {
  await tokenService.revokeAllSessionsForUser(userId);
}

async function verifyEmail(rawToken) {
  const tokenHash = hashToken(rawToken);
  const record = await EmailToken.findOne({ tokenHash, purpose: "email_verification" });

  if (!record || !record.isValid()) {
    throw new ApiError(400, "Verification link is invalid or has expired.");
  }

  record.usedAt = new Date();
  await record.save();

  await User.findByIdAndUpdate(record.user, { isEmailVerified: true });
}

async function resendVerification(email) {
  const user = await User.findOne({ email });

  // Always respond the same way regardless of whether the account exists
  // or is already verified — callers must not be able to enumerate emails.
  if (!user || user.isEmailVerified) {
    return;
  }

  await issueVerificationEmail(user);
}

async function forgotPassword(email) {
  const user = await User.findOne({ email }).select("+passwordHash");

  if (!user || !user.passwordHash) {
    // No account, or a Google-only account with no password to reset.
    return;
  }

  const rawToken = generateRawToken();

  await EmailToken.create({
    user: user._id,
    purpose: "password_reset",
    tokenHash: hashToken(rawToken),
    expiresAt: new Date(Date.now() + env.tokens.passwordResetTtlMinutes * 60 * 1000),
  });

  await emailService.sendPasswordResetEmail(user.email, rawToken);
}

async function resetPassword(rawToken, newPassword) {
  const tokenHash = hashToken(rawToken);
  const record = await EmailToken.findOne({ tokenHash, purpose: "password_reset" });

  if (!record || !record.isValid()) {
    throw new ApiError(400, "Reset link is invalid or has expired.");
  }

  record.usedAt = new Date();
  await record.save();

  const passwordHash = await hashPassword(newPassword);

  await User.findByIdAndUpdate(record.user, { passwordHash });

  // Password reset revokes all existing sessions.
  await tokenService.revokeAllSessionsForUser(record.user);
}

async function findOrCreateGoogleUser({ googleId, email, name }) {
  let user = await User.findOne({ googleId });

  if (user) {
    return user;
  }

  // Link by verified email instead of creating a duplicate account.
  user = await User.findOne({ email });

  if (user) {
    user.googleId = googleId;
    if (!user.isEmailVerified) {
      user.isEmailVerified = true;
    }
    await user.save();
    return user;
  }

  user = await User.create({
    name,
    email,
    googleId,
    isEmailVerified: true,
  });

  return user;
}

async function deleteAccount(userId, password) {
  const user = await User.findById(userId).select("+passwordHash");

  if (!user) {
    throw new ApiError(404, "Account not found.");
  }

  // Password-holding accounts must confirm the password before a
  // permanent, irreversible deletion. Google-only accounts have no
  // password to confirm and are already re-authenticated via their session.
  if (user.passwordHash) {
    const valid = password && (await argon2.verify(user.passwordHash, password));
    if (!valid) {
      throw new ApiError(401, "Incorrect password. Account was not deleted.");
    }
  }

  await Promise.all([
    RefreshSession.deleteMany({ user: user._id }),
    EmailToken.deleteMany({ user: user._id }),
    Business.deleteMany({ ownerId: user._id }),
  ]);

  await User.findByIdAndDelete(user._id);
}

module.exports = {
  register,
  login,
  refresh,
  logout,
  logoutAll,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
  findOrCreateGoogleUser,
  issueSessionTokens,
  deleteAccount,
  toPublicUser,
};
