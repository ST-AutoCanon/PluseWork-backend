const express = require("express");
const {
  contactRequestHandler,
  getContactRequestsHandler,
} = require("../handlers/contact");
console.log("routes line 6");
const router = express.Router();

router.post("/contact", contactRequestHandler);

router.get("/contact", getContactRequestsHandler);

module.exports = router;
