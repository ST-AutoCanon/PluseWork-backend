const { getTenantPoolByOrgId } = require("../db/tenantPoolManager");

const { GET_EMPLOYEE_BY_EMAIL } = require("../constants/employeeBirthday");

const getOrgIdFromHeaders = (req) => {
  return (
    req.headers["x-org-id"] ||
    req.headers["x_org_id"] ||
    req.headers["org-id"] ||
    req.headers["orgid"] ||
    null
  );
};

const fetchEmployeeBirthday = async (req, email) => {
  const orgId = getOrgIdFromHeaders(req);

  if (!orgId) {
    throw new Error("Missing x-org-id header");
  }

  const tenantDb = await getTenantPoolByOrgId(orgId);

  const [rows] = await tenantDb.query(GET_EMPLOYEE_BY_EMAIL, [email]);

  return rows.length > 0 ? rows[0] : null;
};

module.exports = { fetchEmployeeBirthday };
