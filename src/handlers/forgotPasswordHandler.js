const {
  saveResetToken,
  getEmployeeByEmail,
} = require("../services/forgotPasswordService");
const ErrorHandler = require("../utils/errorHandler");
const { sendResetEmail } = require("../utils/brevoMailer");

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    console.log("Forgot password requested for:", email);

    const employee = await getEmployeeByEmail(email);
    if (!employee) {
      console.warn("No active user found for:", email);
      const notFound = ErrorHandler.generateErrorResponse(
        404,
        "No active account found with that email."
      );
      return res.status(404).json(notFound);
    }

    const userName =
      `${employee.first_name || ""} ${employee.last_name || ""}`.trim() ||
      "User";

    let sendResult;
    try {
      sendResult = await sendResetEmail(email, userName);
      console.log("Brevo send result:", {
        email,
        resetToken: sendResult.resetToken ? "[REDACTED]" : undefined,
        tokenExpiry: sendResult.tokenExpiry,
      });
    } catch (mailErr) {
      console.error("Failed to send reset email via Brevo:", mailErr);
      const mailErrorResponse = ErrorHandler.generateErrorResponse(
        502,
        "Failed to send reset email. Please try again later."
      );
      return res.status(502).json(mailErrorResponse);
    }

    try {
      await saveResetToken(
        email,
        sendResult.resetToken,
        sendResult.tokenExpiry
      );
      console.log("Reset token saved for:", email);
    } catch (saveErr) {
      console.error("Failed to save reset token after sending email:", saveErr);
      const serverError = ErrorHandler.generateErrorResponse(
        500,
        "An error occurred while storing reset information. Please contact support."
      );
      return res.status(500).json(serverError);
    }

    const successResponse = ErrorHandler.generateSuccessResponse(200, {
      message: "Password reset link has been sent to your email.",
    });
    return res.status(200).json(successResponse);
  } catch (err) {
    console.error("Forgot password error:", err);

    if (err.statusCode) {
      return res.status(err.statusCode).json(err);
    }

    const serverError = ErrorHandler.generateErrorResponse(
      500,
      "An internal error occurred. Please try again later."
    );
    return res.status(500).json(serverError);
  }
};
