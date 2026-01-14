const {
  getEmployeePersonalDetails,
} = require("../services/employeebankreport.service");

const getOrgIdFromHeaders = (req) => {
  return (
    req.headers["x-org-id"] ||
    req.headers["org-id"] ||
    req.headers.org_id ||
    null
  );
};

const fetchEmployeeBankDetails = async (req, res) => {
  const orgId = getOrgIdFromHeaders(req);

  if (!orgId) {
    return res.status(400).json({
      success: false,
      error: "org_id header is required (x-org-id, org-id, or org_id)",
    });
  }

  const { employeeIds } = req.body;

  if (!employeeIds || !Array.isArray(employeeIds) || employeeIds.length === 0) {
    return res.status(400).json({
      success: false,
      error: "employeeIds must be a non-empty array",
    });
  }

  try {
    const details = await getEmployeePersonalDetails(orgId, employeeIds);

    const detailsMap = details.reduce((map, detail) => {
      map[detail.employee_id] = {
        pan_number: detail.pan_number || "N/A",
        uan_number: detail.uan_number || "N/A",
      };
      return map;
    }, {});

    return res.status(200).json({
      success: true,
      data: detailsMap,
    });
  } catch (error) {
    console.error("Error fetching employee bank/personal details:", error);

    if (error.message.includes("orgId")) {
      return res.status(400).json({ success: false, error: "Invalid orgId" });
    }

    return res.status(500).json({
      success: false,
      error: "Failed to fetch employee details",
    });
  }
};

module.exports = {
  fetchEmployeeBankDetails,
};
