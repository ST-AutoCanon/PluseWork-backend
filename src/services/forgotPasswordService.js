const db = require("../config");
const { getTenantPoolByOrgId } = require("../db/tenantPoolManager");
const queries = require("../constants/queries");
const ErrorHandler = require("../utils/errorHandler");

const getDbPoolForOrgId = async (orgId) => {
  if (!orgId) return db;
  try {
    return await getTenantPoolByOrgId(orgId);
  } catch (err) {
    console.error("Failed to resolve tenant DB pool for orgId:", orgId, err);
    throw ErrorHandler.generateErrorResponse(
      400,
      "Invalid organization specified.",
    );
  }
};

exports.getEmployeeByEmail = async (email, orgId) => {
  try {
    const pool = await getDbPoolForOrgId(orgId);
    const [rows] = await pool.query(queries.GET_EMPLOYEE_BY_EMAIL, [email]);
    return rows.length ? rows[0] : null;
  } catch (error) {
    console.error("Error retrieving employee by email:", error);
    throw ErrorHandler.generateErrorResponse(
      500,
      "Internal server error while retrieving employee.",
    );
  }
};

exports.saveResetToken = async (email, resetToken, expiryTime, orgId) => {
  try {
    const pool = await getDbPoolForOrgId(orgId);
    await pool.query(queries.SAVE_RESET_TOKEN, [
      email,
      resetToken,
      expiryTime,
      orgId,
    ]);

    // Also store a mapping token -> orgId in the master DB so that the reset flow
    // can identify the correct tenant database later.
    await db.query(queries.SAVE_RESET_TOKEN_MASTER, [resetToken, orgId]);
  } catch (error) {
    console.error("Error saving reset token:", error);
    throw ErrorHandler.generateErrorResponse(
      500,
      "Internal server error while saving reset token.",
    );
  }
};
