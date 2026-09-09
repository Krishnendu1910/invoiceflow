const env = require("../../config/env");
const resendProvider = require("./resend.provider");
const developmentProvider = require("./development.provider");

// Authentication and user flows call sendVerificationEmail or sendPasswordResetEmail.
// Email delivery provider selection is resolved dynamically based on EMAIL_MODE.
function getProvider() {
  if (env.email.mode === "development") {
    if (env.isProduction || process.env.NODE_ENV === "production") {
      throw new Error("Development email delivery cannot be used in production.");
    }
    return developmentProvider;
  }
  return resendProvider;
}

function verificationEmailHtml(link) {
  return `
    <p>Welcome to InvoiceFlow.</p>
    <p>Please verify your email address to activate your account:</p>
    <p><a href="${link}">${link}</a></p>
    <p>This link expires in ${env.tokens.emailVerificationTtlHours} hour(s). If you didn't request this, you can ignore this email.</p>
  `;
}

function passwordResetEmailHtml(link) {
  return `
    <p>We received a request to reset your InvoiceFlow password.</p>
    <p><a href="${link}">${link}</a></p>
    <p>This link expires in ${env.tokens.passwordResetTtlMinutes} minute(s). If you didn't request this, you can ignore this email.</p>
  `;
}

async function sendVerificationEmail(to, rawToken) {
  const link = `${env.clientUrl}/verify-email?token=${rawToken}`;
  const provider = getProvider();
  return provider.send({
    to,
    subject: "Verify your InvoiceFlow email address",
    html: verificationEmailHtml(link),
    type: "verification",
    link,
  });
}

async function sendPasswordResetEmail(to, rawToken) {
  const link = `${env.clientUrl}/reset-password?token=${rawToken}`;
  const provider = getProvider();
  return provider.send({
    to,
    subject: "Reset your InvoiceFlow password",
    html: passwordResetEmailHtml(link),
    type: "password_reset",
    link,
  });
}

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  getProvider,
};
