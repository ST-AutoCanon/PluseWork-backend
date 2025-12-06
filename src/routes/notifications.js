const express = require("express");
const {
  getNotifications,
  markRead,
} = require("../handlers/notificationHandler");
const router = express.Router();

router.get("/notifications", getNotifications);
router.put("/notifications/:id/read", markRead);

module.exports = router;
