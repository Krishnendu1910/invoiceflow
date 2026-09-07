const crypto = require("crypto");
const env = require("../config/env");
const googleConfig = require("../config/google");

const SCOPES = ["openid", "email", "profile"];

function generateState() {
  return crypto.randomBytes(24).toString("hex");
}

function getAuthUrl(state) {
  return googleConfig.getClient().generateAuthUrl({
    access_type: "online",
    scope: SCOPES,
    state,
    prompt: "select_account",
  });
}

// Exchanges an authorization code for a verified Google profile. Throws if
// the code is invalid or the ID token's email is not verified by Google.
async function getVerifiedProfile(code) {
  const client = googleConfig.getClient();
  const { tokens } = await client.getToken(code);

  const ticket = await client.verifyIdToken({
    idToken: tokens.id_token,
    audience: env.google.clientId,
  });

  const payload = ticket.getPayload();

  if (!payload || !payload.email || !payload.email_verified) {
    throw new Error("Google account email is not verified.");
  }

  return {
    googleId: payload.sub,
    email: payload.email,
    name: payload.name || payload.email,
  };
}

module.exports = { isConfigured: googleConfig.isConfigured, generateState, getAuthUrl, getVerifiedProfile };
