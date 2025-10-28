// handlers/contactRequest.js  (or wherever your handler lives)
const {
  createContactRequestService,
  getContactRequestsService,
} = require("../services/contact");
const { sendNotificationEmail } = require("../services/email");

const contactRequestHandler = async (req, res) => {
  try {
    const {
      name = "",
      email = "",
      organization = "",
      phone = "",
      message = "",
      preferredDate = "",
    } = req.body || {};

    if (!name || !name.toString().trim()) {
      return res.status(400).json({ message: "Name is required" });
    }
    if (!email || !email.toString().trim()) {
      return res.status(400).json({ message: "Email is required" });
    }
    if (!message || !message.toString().trim()) {
      return res.status(400).json({
        message: "Please tell us what you'd like to see in the demo.",
      });
    }

    const payloadToSave = {
      name: name.toString().trim(),
      email: email.toString().trim(),
      organization: organization.toString().trim(),
      phone: phone.toString().trim(),
      message: message.toString().trim(),
      preferredDate: preferredDate ? preferredDate.toString().trim() : null,
      ip: req.ip || null,
      userAgent: req.headers["user-agent"] || null,
    };

    console.info("[Contact] Creating contact request", {
      name: payloadToSave.name,
      email: payloadToSave.email,
      ip: payloadToSave.ip,
      userAgent: payloadToSave.userAgent,
    });

    const created = await createContactRequestService(payloadToSave);

    // Log DB insert result (insertId / affectedRows)
    console.info("[Contact] Contact request saved", {
      insertId: created.insertId,
      affectedRows: created.affectedRows,
    });

    // Try sending notification email; log detailed outcome
    try {
      console.info("[Contact] Sending notification email (start)", {
        to: process.env.COMPANY_NOTIFY_EMAIL,
        subject: `Demo Request from ${payloadToSave.name}`,
      });

      const mailInfo = await sendNotificationEmail({
        payload: payloadToSave,
      });

      // mailInfo is what nodemailer returns (messageId, response, etc.)
      console.info("[Contact] Notification email sent", {
        messageId: mailInfo && mailInfo.messageId,
        response: mailInfo && mailInfo.response,
      });
    } catch (mailErr) {
      // Log full mail error details (but do NOT log secrets)
      console.error("[Contact] Failed to send notification email:", {
        message: mailErr && mailErr.message,
        code: mailErr && mailErr.original && mailErr.original.code,
        response: mailErr && mailErr.original && mailErr.original.response,
        responseCode:
          mailErr && mailErr.original && mailErr.original.responseCode,
        command: mailErr && mailErr.original && mailErr.original.command,
      });

      // In development, also print stack for more context
      if (process.env.NODE_ENV !== "production") {
        console.error(mailErr);
      }
    }

    return res.status(201).json({
      message: "Demo request submitted successfully",
      requestId: created.insertId || null,
    });
  } catch (error) {
    console.error("contactRequestHandler error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

const getContactRequestsHandler = async (req, res) => {
  try {
    const orgId = req.query.orgId || null;
    const requests = await getContactRequestsService({ orgId });
    return res.status(200).json({ requests });
  } catch (err) {
    console.error("getContactRequestsHandler error:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

module.exports = { contactRequestHandler, getContactRequestsHandler };
