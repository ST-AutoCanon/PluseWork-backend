// services/resetPasswordService.js
const db = require("../config");
const queries = require("../constants/queries");
const ErrorHandler = require("../utils/errorHandler");

exports.verifyResetToken = async (resetToken) => {
  try {
    const [rows] = await db.query(queries.VERIFY_RESET_TOKEN, [resetToken]);

    if (!rows.length) {
      // Return null so the caller can handle a 400/404 appropriately.
      return null;
    }

    const { email, expiry_time } = rows[0];

    if (new Date(expiry_time) < new Date()) {
      // token expired -> return null (caller treats as invalid/expired)
      return null;
    }

    return email;
  } catch (error) {
    console.error("Error verifying reset token:", error);
    // throw a proper error object so upper layers can map to 500
    throw ErrorHandler.generateErrorResponse(
      500,
      "Internal server error while verifying reset token."
    );
  }
};

exports.updateEmployeePassword = async (employeeEmail, hashedPassword) => {
  try {
    // Ensure we only ever pass strings into the DB query
    if (!employeeEmail || typeof employeeEmail !== "string") {
      throw ErrorHandler.generateErrorResponse(
        400,
        "Invalid email when updating password."
      );
    }

    await db.query(queries.UPDATE_EMPLOYEE_PASSWORD, [
      hashedPassword,
      employeeEmail,
    ]);
    return ErrorHandler.generateSuccessResponse(
      "Password updated successfully."
    );
  } catch (error) {
    console.error("Error updating employee password:", error);
    // wrap into ErrorHandler so caller can choose response
    throw ErrorHandler.generateErrorResponse(
      500,
      "Internal server error while updating password."
    );
  }
};
