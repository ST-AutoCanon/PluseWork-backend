const { getTenantPool, sanitizeDbName } = require("../db/tenantPoolManager");
const queries = require("../constants/salaryCalculationPeriodQueries");

async function getTenantPoolForOrg(orgId) {
  if (!orgId) throw new Error("orgId required");

  const numericOrgId = String(orgId).replace(/^tenant_/, "");
  const dbName = sanitizeDbName(`tenant_${numericOrgId}`);

  return getTenantPool(dbName);
}

class SalaryCalculationPeriodService {
  static async addPeriod(orgId, cutoffDate) {
    const pool = await getTenantPoolForOrg(orgId);

    let cutoffNum;
    if (typeof cutoffDate === "string") {
      cutoffNum = parseInt(cutoffDate.trim(), 10);
    } else if (typeof cutoffDate === "number") {
      cutoffNum = Math.trunc(cutoffDate);
    } else {
      throw new Error("cutoff_date must be a number or numeric string");
    }

    if (isNaN(cutoffNum) || cutoffNum < 1 || cutoffNum > 31) {
      throw new Error("Cutoff date must be between 1 and 31");
    }

    await pool.execute(queries.ADD_SALARY_PERIOD, [orgId, cutoffNum]);

    const [rows] = await pool.execute(queries.GET_ALL_SALARY_PERIODS, [orgId]);

    return {
      success: true,
      data: rows[0],
      message: "Salary period saved successfully",
    };
  }

  static async getAllPeriods(orgId) {
    const pool = await getTenantPoolForOrg(orgId);

    const [rows] = await pool.execute(queries.GET_ALL_SALARY_PERIODS, [orgId]);

    return {
      success: true,
      data: rows,
      message: "Periods fetched successfully",
    };
  }

  static async updatePeriod(orgId, id, cutoffDate) {
    const pool = await getTenantPoolForOrg(orgId);

    let cutoffNum;
    if (typeof cutoffDate === "string") {
      cutoffNum = parseInt(cutoffDate.trim(), 10);
    } else if (typeof cutoffDate === "number") {
      cutoffNum = Math.trunc(cutoffDate);
    } else {
      throw new Error("cutoff_date must be a number or numeric string");
    }

    if (isNaN(cutoffNum) || cutoffNum < 1 || cutoffNum > 31) {
      throw new Error("Cutoff date must be between 1 and 31");
    }

    const [result] = await pool.execute(queries.UPDATE_SALARY_PERIOD, [
      cutoffNum,
      id,
      orgId,
    ]);

    if (result.affectedRows === 0) {
      throw new Error("Period not found or you don't have permission");
    }

    const [rows] = await pool.execute(queries.GET_SALARY_PERIOD_BY_ID, [
      id,
      orgId,
    ]);

    return {
      success: true,
      data: rows[0] || null,
      message: "Period updated successfully",
    };
  }
}

module.exports = SalaryCalculationPeriodService;
