const {
  saveResetToken,
  getEmployeeByEmail,
} = require("../services/forgotPasswordService");
const ErrorHandler = require("../utils/errorHandler");
const { sendForgotPasswordEmail } = require("../utils/brevoMailer");

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== "string") {
      const badReq = ErrorHandler.generateErrorResponse(400, "Invalid email");
      return res.status(400).json(badReq);
    }

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

    const mailOpts = {
      frontendUrl: process.env.FRONTEND_URL || undefined,
      supportEmail: process.env.SUPPORT_EMAIL || undefined,
      resetTtlHours: Number(process.env.RESET_TOKEN_TTL_HOURS) || 72,
      platformName: process.env.PLATFORM_NAME || undefined,
    };

    let sendResult;
    try {
      sendResult = await sendForgotPasswordEmail(email, userName, mailOpts);
    } catch (mailErr) {
      console.error(
        "Failed to send forgot-password email via mailer:",
        mailErr
      );
      const mailErrorResponse = ErrorHandler.generateErrorResponse(
        502,
        "Failed to send reset email. Please try again later."
      );
      return res.status(502).json(mailErrorResponse);
    }

    if (!sendResult || !sendResult.resetToken || !sendResult.tokenExpiry) {
      console.error("Mailer did not return reset token info:", sendResult);
      const mailErrorResponse = ErrorHandler.generateErrorResponse(
        502,
        "Failed to prepare reset email. Please try again later."
      );
      return res.status(502).json(mailErrorResponse);
    }

    try {
      await saveResetToken(
        email,
        sendResult.resetToken,
        sendResult.tokenExpiry
      );
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

    if (err && err.statusCode) {
      return res.status(err.statusCode).json(err);
    }

    const serverError = ErrorHandler.generateErrorResponse(
      500,
      "An internal error occurred. Please try again later."
    );
    return res.status(500).json(serverError);
  }
};