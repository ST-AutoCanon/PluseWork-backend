// routes/visibilityRoutes.js
const express = require("express");
const router = express.Router();
const visibilityHandler = require("../handlers/visibilityHandler");

// Recommended: protect these routes with middleware (admin/supervisor only)
// e.g. router.use(require("../middleware/checkSupervisorOrAdmin"));

// GET current visibility setting
router.get("/project-visibility", visibilityHandler.getProjectVisibility);

// UPDATE visibility setting
router.put("/project-visibility", visibilityHandler.updateProjectVisibility);

module.exports = router;