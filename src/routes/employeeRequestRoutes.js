const express = require("express");

const router = express.Router();

const handler = require("../handlers/employeeRequestHandler");
const fs = require("fs");
const path = require("path");

router.post("/requests", handler.createRequest);

router.get("/requests/mine", handler.getMine);

router.get("/requests/pending", handler.getPending);

router.get("/requests/travel-operations", handler.getTravelOperations);

router.get("/requests/salary-advance-context", handler.getSalaryAdvanceContext);

// ---------------------------------------------------------
// Attachment download
// IMPORTANT: keep this BEFORE /requests/:requestId
// ---------------------------------------------------------

router.get("/requests/attachments/:filename", async (req, res) => {
  try {
    const orgId = req.headers["x-org-id"];

    const filename = req.params.filename;

    if (!orgId) {
      return res.status(400).json({
        message: "orgId is required",
      });
    }

    if (
      filename.includes("..") ||
      filename.includes("/") ||
      filename.includes("\\")
    ) {
      return res.status(400).json({
        message: "Invalid filename",
      });
    }

    const filePath = path.join(
      __dirname,
      "..",
      "..",
      "..",
      "EmployeeRequestUploads",
      String(orgId),
      filename,
    );

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        message: "File not found",
      });
    }

    return res.download(filePath, filename);
  } catch (error) {
    console.error("[employeeRequestRoutes] attachment download error:", error);

    return res.status(500).json({
      message: "Failed to download attachment.",
    });
  }
});

router.get("/requests/:requestId", handler.getDetail);

router.post("/requests/:requestId/approve", handler.approve);

router.post("/requests/:requestId/reject", handler.reject);

router.post(
  "/requests/:requestId/book",
  handler.upload.single("e_ticket"),
  handler.bookTravel,
);

router.post("/requests/:requestId/complete", handler.complete);

router.post("/requests/:requestId/cancel", handler.cancel);
router.get("/guest-houses", handler.getGuestHouses);

module.exports = router;
