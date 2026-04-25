const express = require("express");
const router = express.Router();
const invoiceHandler = require("../handlers/invoiceHandler");

router.get("/invoice", invoiceHandler.getInvoices);
router.post("/invoice", invoiceHandler.createInvoice);
router.post("/download-details", invoiceHandler.recordDownloadDetails);
router.get("/download-details", invoiceHandler.getDownloadDetails);
router.get("/download-details/:id", invoiceHandler.getDownloadDetailById);
router.put("/download-details/:id", invoiceHandler.updateDownloadDetails);
router.put("/invoice/:id", invoiceHandler.updateInvoice);
router.put("/invoice-extra/:id", invoiceHandler.updateInvoiceExtra);
router.patch("/invoice/:id/cancel", invoiceHandler.cancelInvoice);
router.get("/invoice/template-number", invoiceHandler.generateTemplateInvoice);
router.put(
  "/invoice/sequence/:invoiceType",
  invoiceHandler.updateInvoiceSequence,
);
router.patch(
  "/download-details/:id/cancel",
  invoiceHandler.cancelDownloadDetails,
);

module.exports = router;
