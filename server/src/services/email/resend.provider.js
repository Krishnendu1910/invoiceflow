const { Resend } = require("resend");
const env = require("../../config/env");
const ApiError = require("../../utils/ApiError");

let client = null;

function getClient() {
  if (!client && env.email.resendApiKey) {
    client = new Resend(env.email.resendApiKey);
  }
  return client;
}

// Isolated Resend transport. Nothing outside this file should import the
// `resend` package directly — swapping providers later means writing a new
// file with this same `send` signature.
async function send({ to, subject, html }) {
  const resendClient = getClient();

  if (!resendClient || !env.email.from) {
    if (env.isProduction || process.env.NODE_ENV === "production") {
      throw new ApiError(500, "Email service is not configured.");
    }
    console.warn(`[email:resend] RESEND_API_KEY/EMAIL_FROM not configured — skipping email to ${to} ("${subject}").`);
    return { skipped: true, mode: "resend" };
  }

  try {
    const { data, error } = await resendClient.emails.send({
      from: env.email.from,
      to,
      subject,
      html,
    });

    if (error) {
      // Log the provider error server-side for troubleshooting without exposing
      // raw provider internals, domain restrictions, or account details to the user.
      console.error("[email:resend] Provider error:", error.message || error);
      throw new ApiError(502, "Unable to send email at this time. Please try again later.");
    }

    return { skipped: false, id: data?.id, mode: "resend" };
  } catch (err) {
    if (err instanceof ApiError) throw err;
    console.error("[email:resend] Exception during send:", err.message || err);
    throw new ApiError(502, "Unable to send email at this time. Please try again later.");
  }
}

module.exports = { send, getClient };
