const env = require("../../config/env");

// Development-only email provider.
// Generates the real tokens and links, but prints them directly to the terminal
// instead of dispatching to an external email delivery network like Resend.
// Guaranteed to never operate in production.
async function send({ to, subject, html, type, link }) {
  if (env.isProduction || process.env.NODE_ENV === "production") {
    throw new Error("Development email provider cannot be used in production.");
  }

  const label = type === "password_reset" ? "Password Reset URL" : "Verification URL";

  console.log("\n================================================================================");
  console.log("[email:development] *** DEVELOPMENT ONLY — NO ACTUAL EMAIL SENT ***");
  console.log(`[email:development] Recipient: ${to}`);
  console.log(`[email:development] Subject:   ${subject}`);
  if (link) {
    console.log(`[email:development] ${label}: ${link}`);
  }
  console.log("================================================================================\n");

  return {
    skipped: false,
    mode: "development",
    link,
    to,
    subject,
  };
}

module.exports = { send };

