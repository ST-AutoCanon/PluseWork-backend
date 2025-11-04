const fs = require("fs");
const util = require("util");
const chrono = require("chrono-node");

const transcriptionService = require("../services/transcriptionService");
const meetingService = require("../services/meetingService");
const reminderService = require("../services/reminderService");
const notificationService = require("../services/notificationService");
const employeeService = require("../services/employeeService");
const { rewriteText, extractMeetingFields } = require("../services/aiService");

// Helper to format Date to MySQL DATETIME string
function toMySQLDateTime(date) {
  const pad = (n) => n.toString().padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    ` ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(
      date.getSeconds()
    )}`
  );
}

/**
 * POST /api/meetings/voice-dialog (Unchanged)
 */
async function handleVoiceDialog(req, res) {
  try {
    const step = parseInt(req.body.step, 10);
    if (![1, 2, 3, 4, 5, 6, 7].includes(step)) {
      return res.status(400).json({ success: false, message: "Invalid step." });
    }

    if (!req.file || !req.file.path) {
      return res
        .status(400)
        .json({ success: false, message: "No audio file provided." });
    }

    const audioPath = req.file.path;
    let transcript;
    try {
      transcript = await transcriptionService.transcribeWithWhisper(audioPath);
      try {
        transcript = await rewriteText(transcript);
      } catch (err) {
        console.warn("rewriteText failed:", err);
      }
    } catch (err) {
      console.error("[handleVoiceDialog] Whisper error:", err);
      await util
        .promisify(fs.unlink)(audioPath)
        .catch(() => {});
      return res
        .status(500)
        .json({ success: false, message: "Transcription failed." });
    }

    await util
      .promisify(fs.unlink)(audioPath)
      .catch(() => {});

    return res.json({ success: true, text: transcript });
  } catch (err) {
    console.error("[handleVoiceDialog] Error:", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
}

/**
 * POST /api/meetings/voice-final
 */
async function handleVoiceFinal(req, res) {
  try {
    const {
      client_company,
      contact_person,
      description,
      action_points,
      assigned_to: spokenAssignee,
      purpose_key_points,
      follow_up_date,
    } = req.body;
    const created_by = (req.headers["x-employee-id"] || "").trim();

    if (
      !created_by ||
      !client_company ||
      !contact_person ||
      !description ||
      !action_points ||
      !spokenAssignee ||
      !purpose_key_points ||
      !follow_up_date
    ) {
      return res
        .status(400)
        .json({ success: false, message: "Missing required fields." });
    }

    // Parse and normalize follow_up_date as local date
    let jsDate = new Date(follow_up_date + "T00:00:00");
    if (isNaN(jsDate)) {
      const chronoDate = chrono.parseDate(follow_up_date);
      if (!chronoDate) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid follow_up_date." });
      }
      jsDate = chronoDate;
    }

    const mysqlDateTime = toMySQLDateTime(jsDate);

    // Resolve spoken assignee
    const matches = await employeeService.searchEmployees(spokenAssignee);
    if (!matches.length) {
      return res.status(400).json({
        success: false,
        message: `No employee found for "${spokenAssignee}"`,
      });
    }
    const assigned_to = matches[0].employee_id;

    // Prepare meeting data with proper MySQL datetime
    const meetingData = {
      client_company,
      contact_name: contact_person,
      purpose: purpose_key_points,
      description,
      action_points,
      assigned_to,
      key_points: purpose_key_points,
      follow_up_date: mysqlDateTime, // use formatted string
    };

    // Insert into DB
    let record;
    try {
      record = await meetingService.createMeeting({
        ...meetingData,
        created_by,
      });
    } catch (dbErr) {
      console.error("[handleVoiceFinal] DB error:", dbErr);
      return res
        .status(500)
        .json({ success: false, message: "Database insertion failed." });
    }

    // Notify assignment
    try {
      await notificationService.sendAssignmentNotification(record);
    } catch (notifErr) {
      console.error(
        "[handleVoiceFinal] Assignment notification error:",
        notifErr
      );
    }

    // Schedule follow-up reminder
    try {
      reminderService.scheduleReminder(record);
    } catch (schedErr) {
      console.error("[handleVoiceFinal] Reminder scheduling error:", schedErr);
    }

    return res.json({ success: true, record });
  } catch (err) {
    console.error("[handleVoiceFinal] Unexpected Error:", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
}

/**
 * GET /api/meetings
 */
async function handleGetMeetingsByCreator(req, res) {
  const created_by = (req.headers["x-employee-id"] || "").trim();
  if (!created_by) {
    return res
      .status(400)
      .json({ success: false, message: "Missing x-employee-id header." });
  }
  try {
    const meetings = await meetingService.getMeetingsByCreator(created_by);
    return res.json({ success: true, meetings });
  } catch (err) {
    console.error("[handleGetMeetingsByCreator] Error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch user’s notes." });
  }
}

/**
 * POST /api/meetings/scan-final
 * Body: { ocr_text: string }
 */
async function handleScanFinal(req, res) {
  try {
    const { ocr_text } = req.body;
    const created_by = (req.headers["x-employee-id"] || "").trim();
    if (!created_by || !ocr_text) {
      return res
        .status(400)
        .json({ success: false, message: "Missing fields" });
    }

    // 1) Extract structured fields:
    let fields;
    try {
      fields = await extractMeetingFields(ocr_text);
    } catch (err) {
      console.error("[handleScanFinal] Extraction error:", err);
      return res.status(500).json({ success: false, message: err.message });
    }

    // 2) Parse & normalize follow_up_date
    let jsDate = new Date(fields.follow_up_date + "T00:00:00");
    if (isNaN(jsDate)) {
      const chronoDate = chrono.parseDate(fields.follow_up_date);
      if (!chronoDate) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid follow_up_date" });
      }
      jsDate = chronoDate;
    }
    const mysqlDateTime = toMySQLDateTime(jsDate);

    // 3) Resolve assignee
    const matches = await employeeService.searchEmployees(fields.assigned_to);
    if (!matches.length) {
      return res.status(400).json({
        success: false,
        message: `Unknown assignee: "${fields.assigned_to}"`,
      });
    }
    const assigned_to = matches[0].employee_id;

    // 4) Prepare & insert
    const meetingData = {
      client_company: fields.client_company,
      contact_name: fields.contact_person,
      purpose: fields.purpose,
      description: fields.description,
      action_points: fields.key_points,
      assigned_to,
      key_points: fields.key_points,
      follow_up_date: mysqlDateTime,
    };

    const record = await meetingService.createMeeting({
      ...meetingData,
      created_by,
    });

    // 5) Notify & schedule
    notificationService
      .sendAssignmentNotification(record)
      .catch((e) => console.error("[handleScanFinal] notification error", e));
    reminderService.scheduleReminder(record);

    return res.json({ success: true, record });
  } catch (err) {
    console.error("[handleScanFinal] Unexpected Error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

module.exports = {
  handleVoiceDialog,
  handleVoiceFinal,
  handleGetMeetingsByCreator,
  handleScanFinal,
};
