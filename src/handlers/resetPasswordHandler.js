const bcrypt = require("bcrypt");
const {
  verifyResetToken,
  updateEmployeePassword,
} = require("../services/resetPasswordService");
const ErrorHandler = require("../utils/errorHandler");

exports.resetPassword = async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;

    const employeeEmail = await verifyResetToken(resetToken);

    if (!employeeEmail) {
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

    const errorResponse = ErrorHandler.generateErrorResponse(
      500,
      "An error occurred while resetting your password."
    );
    res.status(500).json(errorResponse);
  }
};
