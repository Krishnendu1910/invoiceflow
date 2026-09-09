const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const businessSettingsService = require("../services/businessSettings.service");

// Ownership is now verified by the requireBusinessOwner middleware before
// any handler runs. The middleware attaches the verified Business document
// to req.business and the verified businessId to req.businessId.
// The service still calls getOwnedBusinessOrThrow as defense-in-depth.

const getSettings = asyncHandler(async (req, res) => {
  const settings = await businessSettingsService.getSettings(req.user._id, req.params.id);
  return sendSuccess(res, { data: { settings } });
});

function sectionUpdateHandler(updateFn) {
  return asyncHandler(async (req, res) => {
    const settings = await updateFn(req.user._id, req.params.id, req.body);
    return sendSuccess(res, { message: "Settings updated.", data: { settings } });
  });
}

module.exports = {
  getSettings,
  updateProfile: sectionUpdateHandler(businessSettingsService.updateProfile),
  updateBranding: sectionUpdateHandler(businessSettingsService.updateBranding),
  updateTax: sectionUpdateHandler(businessSettingsService.updateTax),
  updateNumbering: sectionUpdateHandler(businessSettingsService.updateNumbering),
  updatePayments: sectionUpdateHandler(businessSettingsService.updatePayments),
  updateFiscalYear: sectionUpdateHandler(businessSettingsService.updateFiscalYear),
  updateDocumentDefaults: sectionUpdateHandler(businessSettingsService.updateDocumentDefaults),
};
