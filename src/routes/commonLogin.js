const express = require("express");
const router = express.Router();

const CommonLoginHandler = require("../handlers/commonLoginHandler");

// ============================================================
// COMMON LOGIN
// ============================================================

router.post(
  "/login",
  CommonLoginHandler.login,
);

router.post(
  "/logout",
  CommonLoginHandler.logout,
);

router.get(
  "/me",
  CommonLoginHandler.me,
);

// ============================================================
// COMMON LOGIN MANAGEMENT
// ============================================================

router.post(
  "/",
  CommonLoginHandler.create,
);

router.put(
  "/:id",
  CommonLoginHandler.update,
);

router.patch(
  "/:id/disable",
  CommonLoginHandler.disable,
);

router.patch(
  "/:id/enable",
  CommonLoginHandler.enable,
);

// ============================================================
// DEVICES
// ============================================================

router.get(
  "/devices",
  CommonLoginHandler.devices,
);
router.get("/", CommonLoginHandler.list);
router.get("/:id", CommonLoginHandler.getById);
module.exports = router;