const express = require("express");
const router = express.Router();
const reimbursementHandler = require("../handlers/reimbursementHandler");

const { upload } = reimbursementHandler;

router.get("/reimbursements", reimbursementHandler.getAllReimbursements);
router.get(
  "/reimbursement/:employeeId",
  reimbursementHandler.getReimbursementsByEmployee
);
router.put(
  "/reimbursement/status/:id",
  reimbursementHandler.updateReimbursementStatus
);
router.put(
  "/reimbursement/payment-status/:id",
  reimbursementHandler.updatePaymentStatus
);

router.post(
  "/reimbursement",
  upload.array("attachments", 5),
  reimbursementHandler.createReimbursement
);

router.put(
  "/reimbursement/:id",
  upload.array("attachments", 5),
  reimbursementHandler.updateReimbursement
);

router.delete("/reimbursement/:id", reimbursementHandler.deleteReimbursement);
router.get(
  "/team/:teamLeadId/reimbursements",
  reimbursementHandler.getTeamReimbursements
);
router.get("/projectdrop", reimbursementHandler.getAllProjects);
router.get(
  "/reimbursement/:reimbursementId/attachments",
  reimbursementHandler.getAttachmentsByReimbursementId
);
router.get("/reimbursements/export", reimbursementHandler.exportReimbursements);

router.get(
  "/reimbursement/:orgId/:year/:month/:employeeId/:filename",
  reimbursementHandler.getAttachments
);
router.get("/download/:claimId", reimbursementHandler.generateReimbursementPDF);

module.exports = router;
