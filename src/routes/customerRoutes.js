const express = require("express");
const router = express.Router();
const customerHandler = require("../handlers/customerHandler");

router.post("/customers", customerHandler.createCustomer);
router.get("/customers", customerHandler.getCustomers);
router.get("/customers/:id", customerHandler.getCustomerById);
router.put("/customers/:id", customerHandler.updateCustomer);

module.exports = router;
