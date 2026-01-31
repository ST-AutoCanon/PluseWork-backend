// const express = require("express");
// const {
//   getOvertimeSummaryHandler,
// } = require("../handlers/overtimeSummaryHandler");

// const router = express.Router();

// router.get("/:supervisorId", getOvertimeSummaryHandler);
// module.exports = router;
const express = require("express");
const {
  getOvertimeSummaryHandler,
} = require("../handlers/overtimeSummaryHandler");

const router = express.Router();

router.get("/:supervisorId", getOvertimeSummaryHandler);
module.exports = router;