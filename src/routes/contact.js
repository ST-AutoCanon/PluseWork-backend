const express = require("express");
const {
  contactRequestHandler,
  getContactRequestsHandler,
} = require("../handlers/contact");
const router = express.Router();

router.post("/contact", contactRequestHandler);

router.get("/contact", getContactRequestsHandler);

module.exports = router;
