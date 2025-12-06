const db = require("../config");
const queries = require("../constants/queries");
const ErrorHandler = require("../utils/errorHandler");

exports.getEmployeeByEmail = async (email) => {
  try {
    const [rows] = await db.query(queries.GET_EMPLOYEE_BY_EMAIL, [email]);
    return rows.length ? rows[0] : null;
  } catch (error) {
    console.error("Error retrieving employee by email:", error);
    throw ErrorHandler.generateErrorResponse(
      500,
      "Internal server error while retrieving employee."
    );
  }
};

exports.saveResetToken = async (email, resetToken, expiryTime) => {
  try {
    await db.query(queries.SAVE_RESET_TOKEN, [email, resetToken, expiryTime]);
  } catch (error) {
    console.error("Error saving reset token:", error);
    throw ErrorHandler.generateErrorResponse(
      500,
      "Internal server error while saving reset token."
    );
  }
};
