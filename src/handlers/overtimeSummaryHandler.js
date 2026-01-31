// const {
//   getOvertimeSummaryService,
// } = require("../services/overtimeSummaryService");

// const getOvertimeSummaryHandler = async (req, res) => {
//   try {
//     const supervisorId = req.headers["x-employee-id"];

//     if (!supervisorId) {
//       return res
//         .status(400)
//         .json({ error: "Supervisor ID is required in x-employee-id header" });
//     }

//     const summary = await getOvertimeSummaryService(supervisorId);

//     return res.status(200).json({
//       success: true,
//       data: summary,
//     });
//   } catch (error) {
//     console.error("Error fetching overtime summary:", error);
//     return res.status(500).json({
//       success: false,
//       error: "Internal Server Error",
//     });
//   }
// };

// module.exports = { getOvertimeSummaryHandler };
const { getOvertimeSummaryService } = require("../services/overtimeSummaryService");

const getOrgIdFromHeaders = (req) => {
  return (
    req.headers["x-org-id"] ||
    req.headers["x-orgid"] ||
    req.headers["org-id"] ||
    req.headers.org_id ||
    null
  );
};

const getOvertimeSummaryHandler = async (req, res) => {
  try {
    // ───────────────────────────────────────────────────────────────
    // Add detailed incoming request log (helps 90% of these cases)
    // ───────────────────────────────────────────────────────────────
    console.log("[DEBUG-OVERTIME] Request received", {
      url: req.originalUrl,
      supervisorParam: req.params.supervisorId,        // will be "STS-000004"
      headers: {
        employeeId: req.headers["x-employee-id"],
        orgId:      req.headers["x-org-id"],
        orgIdAlt1:  req.headers["x-orgid"],
        orgIdAlt2:  req.headers["org-id"],
      }
    });

    // Accept supervisor id from header or URL param (header preferred)
    const supervisorId = req.headers["x-employee-id"] || req.params.supervisorId;
    const orgId = getOrgIdFromHeaders(req);

    if (!supervisorId) {
      console.warn("[DEBUG-OVERTIME] Missing x-employee-id header");
      return res.status(400).json({
        success: false,
        error: "Supervisor ID is required (header: x-employee-id)",
      });
    }

    if (!orgId) {
      console.warn("[DEBUG-OVERTIME] Missing organization ID header");
      return res.status(400).json({
        success: false,
        error: "Organization ID is required (header: x-org-id preferred)",
      });
    }

    console.log(`[DEBUG-OVERTIME] Service call → sup:${supervisorId} | org:${orgId}`);

    const summary = await getOvertimeSummaryService(supervisorId, orgId);

    console.log(`[DEBUG-OVERTIME] Service returned ${Array.isArray(summary) ? summary.length : 'non-array'} items`);

    return res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (error) {
    // ───────────────────────────────────────────────────────────────
    // Much better error visibility – this is the most important part
    // ───────────────────────────────────────────────────────────────
    console.error("[ERROR-OVERTIME] Handler caught exception:");
    console.error("Message:", error.message);
    console.error("Stack:", error.stack);
    if (error.code)     console.error("DB Error code:", error.code);
    if (error.sql)      console.error("SQL that failed:", error.sql);
    if (error.sqlState) console.error("SQL state:", error.sqlState);

    if (error.message && error.message.includes("Tenant database not found")) {
      return res.status(404).json({
        success: false,
        error: "Organization or tenant database not found",
      });
    }

    return res.status(500).json({
      success: false,
      error: "Internal Server Error",
    });
  }
};

module.exports = { getOvertimeSummaryHandler };