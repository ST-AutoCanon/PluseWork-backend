

const {
  getTenantPoolByOrgId,
} = require("../db/tenantPoolManager");

const {
  getTodayAndYesterdayPunchDataQuery,
} = require("../constants/employeeloginQueries");

const fetchTodayAndYesterdayData = async (org_id) => {
  try {
    const tenantDb = await getTenantPoolByOrgId(org_id);

    const [rows] = await tenantDb.query(
      getTodayAndYesterdayPunchDataQuery,
      [org_id]
    );

    return rows;
  } catch (error) {
    console.error("Error fetching punch data:", error);
    throw error;
  }
};

module.exports = {
  fetchTodayAndYesterdayData,
};
