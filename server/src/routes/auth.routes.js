const express = require("express");
const controller = require("../controllers/auth.controller");
const { authenticate } = require("../middleware/authenticate");
const { validateBody } = require("../middleware/validate");
const schemas = require("../utils/validation/authSchemas");
const {
  loginLimiter,
  registerLimiter,
  emailActionLimiter,
  resetPasswordLimiter,
} = require("../middleware/rateLimit");

const router = express.Router();

router.get("/config", controller.config);

router.post("/register", registerLimiter, validateBody(schemas.register), controller.register);
router.post("/login", loginLimiter, validateBody(schemas.login), controller.login);
router.post("/refresh", controller.refresh);
router.post("/logout", controller.logout);
router.post("/logout-all", authenticate, controller.logoutAll);
router.get("/me", authenticate, controller.me);

router.post("/verify-email", validateBody(schemas.verifyEmail), controller.verifyEmail);
router.post(
  "/resend-verification",
  emailActionLimiter,
  validateBody(schemas.resendVerification),
  controller.resendVerification
);

router.post(
  "/forgot-password",
  emailActionLimiter,
  validateBody(schemas.forgotPassword),
  controller.forgotPassword
);
router.post(
  "/reset-password",
  resetPasswordLimiter,
  validateBody(schemas.resetPassword),
  controller.resetPassword
);

router.delete("/account", authenticate, validateBody(schemas.deleteAccount), controller.deleteAccount);

router.get("/google", controller.googleStart);
router.get("/google/callback", controller.googleCallback);

module.exports = router;
