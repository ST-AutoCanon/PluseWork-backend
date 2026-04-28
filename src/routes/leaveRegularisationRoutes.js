const express = require("express");
const router = express.Router();

const LeaveRegularisationHandler = require("../handlers/leaveRegularisationHandler");

router.get(
  "/eligible-dates",
  LeaveRegularisationHandler.getEligibleDatesHandler,
);

router.post("/submit", LeaveRegularisationHandler.submitRegularisationHandler);

router.get(
  "/my-requests",
  LeaveRegularisationHandler.getMyRegularisationRequestsHandler,
);

router.get(
  "/team-requests",
  LeaveRegularisationHandler.getRegularisationRequestsHandler,
);

router.put(
  "/:id",
  LeaveRegularisationHandler.updateRegularisationRequestHandler,
);

router.get(
  "/:id",
  LeaveRegularisationHandler.getRegularisationRequestByIdHandler,
);

module.exports = router;
