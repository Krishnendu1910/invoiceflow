const express = require("express");
const controller = require("../controllers/item.controller");
const { authenticate, requireVerified } = require("../middleware/authenticate");
const { requireBusinessAccess } = require("../middleware/businessAccess");
const { validateBody, validateQuery, validateParams } = require("../middleware/validate");
const { createItem, updateItem, listItems, idParam } = require("../utils/validation/itemSchemas");

const router = express.Router();

router.use(authenticate, requireVerified);

router.get("/", requireBusinessAccess("query"), validateQuery(listItems), controller.list);
router.post("/", requireBusinessAccess("body"), validateBody(createItem), controller.create);
router.get("/:id", validateParams(idParam), controller.getById);
router.patch("/:id", validateParams(idParam), validateBody(updateItem), controller.update);
router.post("/:id/archive", validateParams(idParam), controller.archive);
router.post("/:id/restore", validateParams(idParam), controller.restore);

module.exports = router;
