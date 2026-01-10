const attendanceService = require("../services/empSessionService");
const db = require("../config");

const extractOrgId = (req) =>
  req.headers["x-org-id"] ||
  req.query.orgId ||
  (req.user && (req.user.orgId || req.user.Org_id || req.user.org_id));

const attendanceHandler = {
  getTodayPunchRecords: async (req, res) => {
    try {
      const { employeeId } = req.params;
      let orgId = extractOrgId(req);

      if (!employeeId) {
        return res.status(400).json({ message: "Employee ID is required" });
      }

      if (!orgId && employeeId) {
        const prefix = employeeId.split('-')[0];
        if (prefix) {
          const [rows] = await db.query('SELECT id FROM organizations WHERE UPPER(employee_prefix) = ?', [prefix.toUpperCase()]);
          if (rows.length > 0) {
            orgId = rows[0].id;
          }
        }
      }

      if (!orgId) {
        return res.status(400).json({ message: "orgId is required" });
      }

      const records = await attendanceService.getTodayPunchRecords(employeeId, orgId);

      return res.status(200).json({
        success: true,
        data: records,
      });
    } catch (error) {
      console.error("Error in getTodayPunchRecords handler:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },
};

module.exports = attendanceHandler;
