const crypto = require("crypto");
const {
  saveResetToken,
  getEmployeeByEmail,
} = require("../services/forgotPasswordService");
const ErrorHandler = require("../utils/errorHandler");
const {
  sendForgotPasswordEmail,
  sendWithRetries,
} = require("../utils/brevoMailer");

if (!process.env.BREVO_SENDER_EMAIL) {
  console.warn(
    "[forgotPasswordHandler] WARNING: BREVO_SENDER_EMAIL is not set.",
  );
}

const extractOrgId = (req) =>
  req.headers["x-org-id"] ||
  req.headers["x-orgid"] ||
  req.headers["org-id"] ||
  req.headers["orgid"] ||
  req.headers["x_org_id"] ||
  req.query?.orgId ||
  req.query?.org_id ||
  req.body?.orgId ||
  req.body?.org_id ||
  (req.user && (req.user.orgId || req.user.Org_id || req.user.org_id)) ||
  null;

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const orgId = extractOrgId(req);

    if (!email || typeof email !== "string") {
      const badReq = ErrorHandler.generateErrorResponse(400, "Invalid email");
      return res.status(400).json(badReq);
    }

    const employee = await getEmployeeByEmail(email, orgId);
    if (!employee) {
      console.warn("No active user found for:", email, "orgId:", orgId);
      const notFound = ErrorHandler.generateErrorResponse(
        404,
        "No active account found with that email.",
      );
      return res.status(404).json(notFound);
    }

    const userName =
      `${employee.first_name || ""} ${employee.last_name || ""}`.trim() ||
      "User";

    if (!orgId) {
      const badReq = ErrorHandler.generateErrorResponse(
        400,
        "Missing orgId header (x-org-id / org-id / orgid / x_org_id) or orgId in query/body.",
      );
      return res.status(400).json(badReq);
    }

    const mailOpts = {
      frontendUrl: process.env.FRONTEND_URL || undefined,
      supportEmail: process.env.SUPPORT_EMAIL || undefined,
      resetTtlHours: Number(process.env.RESET_TOKEN_TTL_HOURS) || 72,
      platformName: process.env.PLATFORM_NAME || undefined,
    };

    let sendResult;
    let tokenSaved = false;

    try {
      if (String(orgId) === "1") {
        // For orgId=1 we use the legacy forgot-password email template
        const resetToken = crypto.randomBytes(32).toString("hex");
        const tokenExpiry = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days

        try {
          await saveResetToken(email, resetToken, tokenExpiry, orgId);
          tokenSaved = true;
        } catch (saveErr) {
          console.error("Failed to save reset token for orgId=1:", saveErr);
          throw ErrorHandler.generateErrorResponse(
            500,
            "An error occurred while storing reset information. Please contact support.",
          );
        }

        const resetLink = `${process.env.FRONTEND_URL}/ResetPassword?token=${resetToken}`;
        const senderEmail =
          process.env.BREVO_SENDER_EMAIL || process.env.SENDGRID_SENDER_EMAIL;
        const senderName = "SUKALPA TECH SOLUTIONS";

        const text = `Hi ${userName},

We received a request to reset the password for your account associated with this email address.

To reset your password, please click the link below:
${resetLink}

This link will expire in 3 days for your security.

If you did not request a password reset, you can safely ignore this email — no changes have been made to your account.

Thank you,
SUKALPA TECH SOLUTIONS
https://sukalpatechsolutions.com
info@sukalpatechsolutions.com`;

        const html = `
        <div style="font-family: Arial, sans-serif; font-size: 15px; color: #333;">
          <p>Hi <strong>${userName}</strong>,</p>
          <p>We received a request to reset the password for your account associated with this email address.</p>
          <p style="margin: 20px 0;">
            <a href="${resetLink}" style="padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">Reset Password</a>
          </p>
          <p>This link will expire in <strong>3 days</strong> for your security.</p>
          <p>If you did not request a password reset, you can safely ignore this email — no changes have been made to your account.</p>
          <br/>
          <p>Thank you,<br/><strong>SUKALPA TECH SOLUTIONS</strong></p>
          <p><a href="https://sukalpatechsolutions.com">https://sukalpatechsolutions.com</a> | <a href="mailto:info@sukalpatechsolutions.com">info@sukalpatechsolutions.com</a></p>
        </div>
      `;

        if (!senderEmail) {
          throw ErrorHandler.generateErrorResponse(
            502,
            "Email sender is not configured. Please contact support.",
          );
        }

        try {
          await sendWithRetries({
            sender: {
              email: senderEmail,
              name: senderName,
            },
            to: [
              {
                email,
                name: userName,
              },
            ],
            subject: "Reset Your Password",
            textContent: text,
            htmlContent: html,
          });
        } catch (sendErr) {
          console.error("Failed to send reset email for orgId=1:", sendErr);
          throw ErrorHandler.generateErrorResponse(
            502,
            "Failed to send reset email. Please try again later.",
          );
        }

        sendResult = { resetToken, tokenExpiry };
      } else {
        sendResult = await sendForgotPasswordEmail(email, userName, mailOpts);
      }
    } catch (mailErr) {
      console.error(
        "Failed to send forgot-password email via mailer:",
        mailErr,
      );
      const mailErrorResponse = ErrorHandler.generateErrorResponse(
        502,
        "Failed to send reset email. Please try again later.",
      );
      return res.status(502).json(mailErrorResponse);
    }

    if (!sendResult || !sendResult.resetToken || !sendResult.tokenExpiry) {
      console.error("Mailer did not return reset token info:", sendResult);
      const mailErrorResponse = ErrorHandler.generateErrorResponse(
        502,
        "Failed to prepare reset email. Please try again later.",
      );
      return res.status(502).json(mailErrorResponse);
    }

    if (!tokenSaved) {
      try {
        await saveResetToken(
          email,
          sendResult.resetToken,
          sendResult.tokenExpiry,
          orgId,
        );
      } catch (saveErr) {
        console.error(
          "Failed to save reset token after sending email:",
          saveErr,
        );
        const serverError = ErrorHandler.generateErrorResponse(
          500,
          "An error occurred while storing reset information. Please contact support.",
        );
        return res.status(500).json(serverError);
      }
    }

    const successResponse = ErrorHandler.generateSuccessResponse(
      200,
      "Password reset link has been sent to your email.",
    );
    return res.status(200).json(successResponse);
  } catch (err) {
    console.error("Forgot password error:", err);

    if (err && err.statusCode) {
      return res.status(err.statusCode).json(err);
    }

    const serverError = ErrorHandler.generateErrorResponse(
      500,
      "An internal error occurred. Please try again later.",
    );
    return res.status(500).json(serverError);
  }
};
