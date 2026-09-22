const express = require("express");

const router = express.Router();

const handler = require("../handlers/employeeRequestHandler");
const fs = require("fs");
const path = require("path");

router.post(
  "/requests",
  handler.upload.single("attachment"),
  handler.createRequest,
);

router.get("/requests/mine", handler.getMine);

router.get("/requests/pending", handler.getPending);

router.get("/requests/assigned-history", handler.getAssignedHistory);

router.get("/requests/travel-operations", handler.getTravelOperations);

router.get("/requests/salary-advance-context", handler.getSalaryAdvanceContext);

router.get("/requests/travel-context", handler.getTravelContext);

router.get("/guest-houses", handler.getGuestHouses);

router.get("/requests/service-notifications", handler.getServiceNotifications);

router.get(
  "/requests/service-notifications/counts",
  handler.getServiceNotificationCounts,
);

router.get("/requests/service-reminders", handler.getServiceReminders);

router.get("/requests/service-overview", handler.getEmployeeServiceOverview);

router.patch(
  "/requests/service-notifications/:notificationId/read",
  handler.markServiceNotificationRead,
);

router.patch(
  "/requests/service-notifications/read-all",
  handler.markAllServiceNotificationsRead,
);

router.get(
  "/requests/:requestId/attachments/:attachmentId",
  handler.downloadAttachment,
);

router.get("/requests/:requestId", handler.getDetail);

router.post("/requests/:requestId/approve", handler.approve);

router.post("/requests/:requestId/reject", handler.reject);

router.post(
  "/requests/:requestId/book",
  handler.upload.single("e_ticket"),
  handler.bookTravel,
);

router.post(
  "/requests/:requestId/book-draft",
  handler.upload.single("e_ticket"),
  handler.saveTravelBookingDraft,
);

router.post("/requests/:requestId/complete", handler.complete);

router.post("/requests/:requestId/cancel", handler.cancel);

router.post("/requests/:requestId/asset-process", handler.processAsset);

router.get("/requests/:requestId/asset-candidates", handler.getAssetCandidates);

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

module.exports = router;
