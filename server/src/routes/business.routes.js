const express = require("express");
const controller = require("../controllers/business.controller");
const settingsController = require("../controllers/businessSettings.controller");
const { authenticate, requireVerified } = require("../middleware/authenticate");
const { requireBusinessOwner } = require("../middleware/businessAccess");
const { validateBody, validateParams } = require("../middleware/validate");
const { createBusiness } = require("../utils/validation/businessSchemas");
const settingsSchemas = require("../utils/validation/businessSettingsSchemas");

const router = express.Router();

router.use(authenticate, requireVerified);

router.get("/", controller.list);
router.post("/", validateBody(createBusiness), controller.create);
router.get("/:id", controller.getById);

// Business Settings (Phase 4). Each section is its own focused GET/PATCH
// pair so the client only ever submits the section it's actually editing.
//
// Authorization: requireBusinessOwner middleware verifies the authenticated
// user owns the business identified by :id before any controller runs.
// This matches the Customer/Item pattern (requireBusinessAccess) and
// replaces the earlier approach of checking ownership inside the service.
// The service retains its ownership check as defense-in-depth.
const ownerOnly = requireBusinessOwner("id");

router.get("/:id/settings", ownerOnly, settingsController.getSettings);
router.patch(
  "/:id/settings/profile",
  ownerOnly,
  validateBody(settingsSchemas.updateProfile),
  settingsController.updateProfile
);
router.patch(
  "/:id/settings/branding",
  ownerOnly,
  validateBody(settingsSchemas.updateBranding),
  settingsController.updateBranding
);
router.patch(
  "/:id/settings/tax",
  ownerOnly,
  validateBody(settingsSchemas.updateTax),
  settingsController.updateTax
);
router.patch(
  "/:id/settings/numbering",
  ownerOnly,
  validateBody(settingsSchemas.updateNumbering),
  settingsController.updateNumbering
);
router.patch(
  "/:id/settings/payments",
  ownerOnly,
  validateBody(settingsSchemas.updatePayments),
  settingsController.updatePayments
);
router.patch(
  "/:id/settings/fiscal-year",
  ownerOnly,
  validateBody(settingsSchemas.updateFiscalYear),
  settingsController.updateFiscalYear
);
router.patch(
  "/:id/settings/documents",
  ownerOnly,
  validateBody(settingsSchemas.updateDocumentDefaults),
  settingsController.updateDocumentDefaults
);

module.exports = router;
