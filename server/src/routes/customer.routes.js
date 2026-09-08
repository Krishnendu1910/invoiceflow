const express = require("express");
const controller = require("../controllers/customer.controller");
const { authenticate, requireVerified } = require("../middleware/authenticate");
const { requireBusinessAccess } = require("../middleware/businessAccess");
const { validateBody, validateQuery, validateParams } = require("../middleware/validate");
const { createCustomer, updateCustomer, listCustomers, idParam } = require("../utils/validation/customerSchemas");

const router = express.Router();

router.use(authenticate, requireVerified);

router.get("/", requireBusinessAccess("query"), validateQuery(listCustomers), controller.list);
router.post("/", requireBusinessAccess("body"), validateBody(createCustomer), controller.create);
router.get("/:id", validateParams(idParam), controller.getById);
router.patch("/:id", validateParams(idParam), validateBody(updateCustomer), controller.update);
router.post("/:id/archive", validateParams(idParam), controller.archive);
router.post("/:id/restore", validateParams(idParam), controller.restore);

module.exports = router;
