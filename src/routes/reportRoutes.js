const express = require("express");
const router = express.Router();

const reports = require("../handlers/reportsHandlerIndex");

function ensureHandler(fn, name) {
  if (typeof fn === "function") return fn;
  return (req, res) => {
    console.error(
      `[reportRoutes] Handler "${name}" is not available. Returning 501.`
    );
    return res
      .status(501)
      .json({ message: `Handler "${name}" not implemented on server` });
  };
}

router.get(
  "/attendance",
  ensureHandler(reports.downloadAttendanceReport, "downloadAttendanceReport")
);
router.get(
  "/leaves",
  ensureHandler(reports.downloadLeavesReport, "downloadLeavesReport")
);
router.get(
  "/reimbursements",
  ensureHandler(
    reports.downloadReimbursementsReport,
    "downloadReimbursementsReport"
  )
);

router.get(
  "/employees",
  ensureHandler(reports.downloadEmployeesReport, "downloadEmployeesReport")
);

router.get(
  "/vendors",
  ensureHandler(reports.downloadVendorsReport, "downloadVendorsReport")
);
router.get(
  "/assets",
  ensureHandler(reports.downloadAssetsReport, "downloadAssetsReport")
);
router.get(
  "/tasks/supervisor",
  ensureHandler(
    reports.downloadTasksSupervisorReport,
    "downloadTasksSupervisorReport"
  )
);
router.get(
  "/tasks/employee",
  ensureHandler(
    reports.downloadTasksEmployeeReport,
    "downloadTasksEmployeeReport"
  )
);

router.get(
  "/departments",
  ensureHandler(reports.getDepartments, "getDepartments")
);
router.get(
  "/search-employees",
  ensureHandler(reports.searchEmployees, "searchEmployees")
);

router.get("/ping", (req, res) => res.json({ ok: true }));

module.exports = router;
