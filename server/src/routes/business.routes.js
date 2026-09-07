const express = require("express");
const controller = require("../controllers/business.controller");
const { authenticate, requireVerified } = require("../middleware/authenticate");
const { validateBody } = require("../middleware/validate");
const { createBusiness } = require("../utils/validation/businessSchemas");

const router = express.Router();

router.use(authenticate, requireVerified);

router.get("/", controller.list);
router.post("/", validateBody(createBusiness), controller.create);
router.get("/:id", controller.getById);

module.exports = router;
