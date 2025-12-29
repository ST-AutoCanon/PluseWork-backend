const masterDb = require("../config");
const { getTenantPoolByOrgId } = require("../db/tenantPoolManager");
const queries = require("../constants/queries");
const ErrorHandler = require("../utils/errorHandler");

exports.verifyResetToken = async (resetToken) => {
  try {
    const [rows] = await masterDb.query(
      `SELECT org_id FROM password_reset_tokens WHERE token = ?`,
      [resetToken]
    );

    if (!rows.length) {
      return null;
    }

    const orgId = rows[0].org_id;

    const tenantDb = await getTenantPoolByOrgId(orgId);

    const [tokenRows] = await tenantDb.query(queries.VERIFY_RESET_TOKEN, [
      resetToken,
    ]);

    if (!tokenRows.length) {
      return null;
    }

    return {
      email: tokenRows[0].email,
      orgId,
    };
  } catch (error) {
    console.error("Error verifying reset token:", error);
    throw ErrorHandler.generateErrorResponse(
      500,
      "Internal server error while verifying reset token."
    );
  }
};

exports.updateEmployeePassword = async (orgId, email, hashedPassword) => {
  try {
    const tenantDb = await getTenantPoolByOrgId(orgId);

    await tenantDb.query(queries.UPDATE_EMPLOYEE_PASSWORD, [
      hashedPassword,
      email,
    ]);

    return true;
  } catch (error) {
    console.error("Error updating employee password:", error);
    throw ErrorHandler.generateErrorResponse(
      500,
      "Internal server error while updating password."
    );
  }
};
