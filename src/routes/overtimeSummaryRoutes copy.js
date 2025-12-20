const express = require("express");
const { getOvertimeSummaryHandler } = require("../handlers/overtimeSummaryHandler");

const router = express.Router();

/**
 * @route GET /api/overtime-summary
 * @desc Get overtime summary for a supervisor
 * @header x-employee-id: supervisorId
 */
router.get("/:supervisorId", getOvertimeSummaryHandler);
module.exports = router;
