const env = require("../../config/env");
const provider = require("./resend.provider");

// Authentication/business logic only ever calls these two functions — the
// choice of email provider (currently Resend) and the HTML templates stay
// isolated in this module and resend.provider.js.

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
  return provider.send({
    to,
    subject: "Verify your InvoiceFlow email address",
    html: verificationEmailHtml(link),
  });
}

async function sendPasswordResetEmail(to, rawToken) {
  const link = `${env.clientUrl}/reset-password?token=${rawToken}`;
  return provider.send({
    to,
    subject: "Reset your InvoiceFlow password",
    html: passwordResetEmailHtml(link),
  });
}

module.exports = { sendVerificationEmail, sendPasswordResetEmail };
