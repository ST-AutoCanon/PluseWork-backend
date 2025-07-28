const express = require("express");
const router = express.Router();
// const LoginHandler = require("../handlers/loginHandler");
// router.post("/login", LoginHandler.login);
// // Route to fetch salary ranges
// router.get('/salary-ranges', LoginHandler.getSalaryRanges);
// // Route for getting attendance status count
// router.get("/attendance-status", LoginHandler.getAttendanceStatusCount);
// // Route for getting login data count (Daily, Weekly, Monthly)
// router.get("/login-data-count", LoginHandler.getEmployeeLoginDataCount);
// // Route for getting employee count by department
// router.get("/employee-count", LoginHandler.getEmployeeCountByDepartment);
// router.get('/employee-count-by-department', LoginHandler.getEmployeeCountByDepartment);
// // Route for fetching total payroll data
// router.get("/total-payroll-data", LoginHandler.getEmployeePayrollData);
// const express = require("express");

const LoginHandler = require("../handlers/loginHandler");
router.post("/login", LoginHandler.login);
router.get("/salary-ranges", LoginHandler.getSalaryRanges);
router.get("/attendance-status", LoginHandler.getAttendanceStatusCount);
router.get("/login-data-count", LoginHandler.getEmployeeLoginDataCount);
router.get("/employee-count", LoginHandler.getEmployeeCountByDepartment);
router.get("/employee-count-by-department", LoginHandler.getEmployeeCountByDepartment);
router.get("/total-payroll-data", LoginHandler.getEmployeePayrollData);
router.get("/sidebar", async (req, res) => {
  try {
    const { role, orgId } = req.query;
    if (!role || !orgId) {
      return res.status(400).json({ error: "Role and orgId are required" });
    }
    const menuItems = await LoginService.fetchSidebarMenu(role, parseInt(orgId));
    res.json(menuItems);
  } catch (error) {
    console.error("Error fetching sidebar menu:", error);
    res.status(500).json({ error: "Failed to fetch sidebar menu" });
  }
});
module.exports = router;
