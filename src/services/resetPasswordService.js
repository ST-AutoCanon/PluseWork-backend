const db = require("../config");
const queries = require("../constants/queries");
const ErrorHandler = require("../utils/errorHandler");

exports.verifyResetToken = async (resetToken) => {
  try {
    const [rows] = await db.query(queries.VERIFY_RESET_TOKEN, [resetToken]);

    if (!rows.length) {
      return ErrorHandler.generateErrorResponse(
        404,
        "Reset token not found in the database."
      );
    }

    const { email, expiry_time } = rows[0];

    if (new Date(expiry_time) < new Date()) {
      return ErrorHandler.generateErrorResponse(
        400,
        "Reset token has expired."
      );
    }

    return email;
  } catch (error) {
    console.error("Error verifying reset token:", error);
    throw ErrorHandler.generateErrorResponse(
      500,
      "Internal server error while verifying reset token."
    );
  }
};

exports.updateEmployeePassword = async (employeeEmail, hashedPassword) => {
  try {
    await db.query(queries.UPDATE_EMPLOYEE_PASSWORD, [
      hashedPassword,
      employeeEmail,
    ]);
    return ErrorHandler.generateSuccessResponse(
      "Password updated successfully."
    );
  } catch (error) {
    console.error("Error updating employee password:", error);
    throw ErrorHandler.generateErrorResponse(
      500,
      "Internal server error while updating password."
    );
  }
};
