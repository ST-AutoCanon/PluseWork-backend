const bcrypt = require("bcrypt");
const {
  verifyResetToken,
  updateEmployeePassword,
} = require("../services/resetPasswordService");
const ErrorHandler = require("../utils/errorHandler");

exports.resetPassword = async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;

    if (!resetToken || !newPassword) {
      return res
        .status(400)
        .json(
          ErrorHandler.generateErrorResponse(
            400,
            "resetToken and newPassword are required.",
          ),
        );
    }

    const result = await verifyResetToken(resetToken);

    if (!result) {
      return res
        .status(400)
        .json(
          ErrorHandler.generateErrorResponse(400, "Invalid or expired token."),
        );
    }

    const { email, orgId } = result;

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await updateEmployeePassword(orgId, email, hashedPassword);

    return res
      .status(200)
      .json(
        ErrorHandler.generateSuccessResponse(
          200,
          "Password reset successful. You can now log in.",
        ),
      );
  } catch (error) {
    console.error("Error resetting password:", error);

    return res
      .status(500)
      .json(
        ErrorHandler.generateErrorResponse(
          500,
          error.message || "An error occurred while resetting your password.",
        ),
      );
  }
};
