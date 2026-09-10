const express = require("express");
const controller = require("../controllers/document.controller");
const { authenticate, requireVerified } = require("../middleware/authenticate");
const { requireBusinessAccess } = require("../middleware/businessAccess");
const { validateBody, validateQuery, validateParams } = require("../middleware/validate");
const {
  createDocumentSchema,
  updateDocumentSchema,
  listDocumentsQuerySchema,
  idParam,
} = require("../utils/validation/documentSchemas");

const router = express.Router();

router.use(authenticate, requireVerified);

router.post("/", requireBusinessAccess("body"), validateBody(createDocumentSchema), controller.create);
router.get("/", requireBusinessAccess("query"), validateQuery(listDocumentsQuerySchema), controller.list);
router.get("/:id", validateParams(idParam), controller.getById);
router.patch("/:id", validateParams(idParam), validateBody(updateDocumentSchema), controller.update);
router.delete("/:id", validateParams(idParam), controller.deleteDraft);

module.exports = router;

