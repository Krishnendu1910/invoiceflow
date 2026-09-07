const { Resend } = require("resend");
const env = require("../../config/env");

let client = null;

if (env.email.isConfigured) {
  client = new Resend(env.email.resendApiKey);
}

// Isolated Resend transport. Nothing outside this file should import the
// `resend` package directly — swapping providers later means writing a new
// file with this same `send` signature.
async function send({ to, subject, html }) {
  if (!client) {
    console.warn(`[email] RESEND_API_KEY/EMAIL_FROM not configured — skipping email to ${to} ("${subject}").`);
    return { skipped: true };
  }

  const { data, error } = await client.emails.send({
    from: env.email.from,
    to,
    subject,
    html,
  });

  if (error) {
    throw new Error(`Failed to send email: ${error.message || "unknown error"}`);
  }

  return { skipped: false, id: data?.id };
}

module.exports = { send };
