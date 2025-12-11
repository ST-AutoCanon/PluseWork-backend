// handlers/resetPasswordHandler.js
const bcrypt = require("bcrypt");
const {
  verifyResetToken,
  updateEmployeePassword,
} = require("../services/resetPasswordService");
const ErrorHandler = require("../utils/errorHandler");

exports.resetPassword = async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;

    // basic input validation
    if (!resetToken || !newPassword) {
      return res
        .status(400)
        .json(
          ErrorHandler.generateErrorResponse(
            400,
            "resetToken and newPassword are required."
          )
        );
    }

    const employeeEmail = await verifyResetToken(resetToken);

    // verifyResetToken returns null for not found/expired
    if (!employeeEmail || typeof employeeEmail !== "string") {
      const errorResponse = ErrorHandler.generateErrorResponse(
        400,
        "Invalid or expired token."
      );
      return res.status(400).json(errorResponse);
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await updateEmployeePassword(employeeEmail, hashedPassword);

    const successResponse = ErrorHandler.generateSuccessResponse({
      message:
        "Password reset successful. You can now log in with your new password.",
    });
    res.status(200).json(successResponse);
  } catch (error) {
    console.error("Error resetting password:", error);

    // If the error is our ErrorHandler-style object, try to use its code/message
    if (error && typeof error === "object" && error.code && error.message) {
      const status = error.code >= 400 && error.code < 600 ? error.code : 500;
      return res.status(status).json({
        status: "error",
        code: error.code,
        message: error.message,
      });
    }

    const errorResponse = ErrorHandler.generateErrorResponse(
      500,
      "An error occurred while resetting your password."
    );
    res.status(500).json(errorResponse);
  }
};
