const { OAuth2Client } = require("google-auth-library");
const env = require("./env");

let client = null;

if (env.google.isConfigured) {
  client = new OAuth2Client(env.google.clientId, env.google.clientSecret, env.google.callbackUrl);
}

module.exports = {
  isConfigured: env.google.isConfigured,
  getClient() {
    if (!client) {
      throw new Error("Google OAuth is not configured.");
    }
    return client;
  },
};
