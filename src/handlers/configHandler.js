const { fetchConfig, saveConfig } = require("../services/configService");
const attendanceService = require("../services/attendanceService");

const getOrgIdFromHeaders = (req) => {
  return (
    req.headers["x-org-id"] ||
    req.headers["x_org_id"] ||
    req.headers["org-id"] ||
    req.headers["orgid"] ||
    null
  );
};

const getConfig = async (req, res) => {
  try {
    const orgId = getOrgIdFromHeaders(req);
    if (!orgId) {
      return res.status(400).json({
        success: false,
        message: "Missing required header: x-org-id",
      });
    }

    const data = await fetchConfig(orgId);

    // Merge in login_hours_config values for attendance-related keys
    try {
      const loginCfg = await attendanceService.getLoginHoursConfig(orgId);
      if (loginCfg) {
        data.attendance_punch_in_start =
          loginCfg.punch_in_start ?? data.attendance_punch_in_start;
        data.attendance_punch_out_start =
          loginCfg.punch_out_start ?? data.attendance_punch_out_start;
        data.attendance_punch_buffer_minutes =
          loginCfg.buffer_minutes ??
          loginCfg.bufferMinutes ??
          data.attendance_punch_buffer_minutes;
        data.late_login_enabled =
          loginCfg.late_login_enabled ??
          loginCfg.lateLoginEnabled ??
          data.late_login_enabled;
        data.late_login_streak_days =
          loginCfg.late_streak_days ??
          loginCfg.lateStreakDays ??
          data.late_login_streak_days;
        data.auto_mark_late =
          loginCfg.auto_mark_late ??
          loginCfg.autoMarkLate ??
          data.auto_mark_late;
        data.late_escalation_mode =
          loginCfg.escalation_mode ??
          loginCfg.escalationMode ??
          data.late_escalation_mode;
        data.late_action_roles =
          loginCfg.action_roles ?? data.late_action_roles;
        data.required_daily_minutes =
          loginCfg.required_daily_minutes ??
          loginCfg.requiredDailyMinutes ??
          data.required_daily_minutes;
      }
    } catch (e) {
      // ignore errors and fallback to config table values
    }

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("GET /config error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch config",
      error: error.message,
    });
  }
};

const updateConfig = async (req, res) => {
  try {
    const orgId = getOrgIdFromHeaders(req);
    if (!orgId) {
      return res.status(400).json({
        success: false,
        message: "Missing required header: x-org-id",
      });
    }

    const { key, value } = req.body;
    if (!key || value === undefined) {
      return res.status(400).json({
        success: false,
        message: "Both 'key' and 'value' are required in request body",
      });
    }

    // If the key belongs to login-hours config, write into login_hours_config table
    const loginKeys = new Set([
      "attendance_punch_in_start",
      "attendance_punch_out_start",
      "attendance_punch_buffer_minutes",
      "late_login_enabled",
      "late_login_streak_days",
      "auto_mark_late",
      "late_escalation_mode",
      "late_action_roles",
      "required_daily_minutes",
      "deficit_detection_enabled",
      "allowed_late_streaks",
      "streak_period",
    ]);

    if (loginKeys.has(key)) {
      try {
        const existing =
          (await attendanceService.getLoginHoursConfig(orgId)) || {};

        // Map existing db fields to our upsert payload keys
        const payload = {
          punchInStart:
            existing.punch_in_start ??
            existing.punchInStart ??
            (existing.attendance_punch_in_start || ""),
          punchOutStart:
            existing.punch_out_start ??
            existing.punchOutStart ??
            (existing.attendance_punch_out_start || ""),
          bufferMinutes:
            existing.buffer_minutes ??
            existing.bufferMinutes ??
            existing.attendance_punch_buffer_minutes ??
            10,
          lateLoginEnabled:
            existing.late_login_enabled ??
            existing.lateLoginEnabled ??
            (existing.late_login_enabled || existing.late_login_enabled === 0
              ? existing.late_login_enabled
              : undefined),
          lateStreakDays:
            existing.late_streak_days ??
            existing.lateStreakDays ??
            existing.late_login_streak_days ??
            3,
          autoMarkLate:
            existing.auto_mark_late ??
            existing.autoMarkLate ??
            (existing.auto_mark_late || existing.auto_mark_late === 0
              ? existing.auto_mark_late
              : undefined),
          escalationMode:
            existing.escalation_mode ??
            existing.escalationMode ??
            existing.late_escalation_mode ??
            "mail_notify",
          actionRoles:
            existing.action_roles ??
            existing.late_action_roles ??
            existing.actionRoles ??
            null,
          requiredDailyMinutes:
            existing.required_daily_minutes ??
            existing.requiredDailyMinutes ??
            existing.required_daily_minutes ??
            480,
        };

        // Map incoming key -> payload
        if (key === "attendance_punch_in_start")
          payload.punchInStart = value || null;
        if (key === "attendance_punch_out_start")
          payload.punchOutStart = value || null;
        if (key === "attendance_punch_buffer_minutes")
          payload.bufferMinutes = Number(value || 10);
        if (key === "late_login_enabled")
          payload.lateLoginEnabled =
            String(value) === "1" || value === 1 || value === true;
        if (key === "late_login_streak_days")
          payload.lateStreakDays = Number(value || 3);
        if (key === "auto_mark_late")
          payload.autoMarkLate =
            String(value) === "1" || value === 1 || value === true;
        if (key === "late_escalation_mode")
          payload.escalationMode = String(value || "mail_notify");
        if (key === "late_action_roles") payload.actionRoles = value || null;
        if (key === "required_daily_minutes")
          payload.requiredDailyMinutes = Number(value || 480);
        if (key === "deficit_detection_enabled")
          payload.deficitDetectionEnabled =
            String(value) === "1" || value === 1 || value === true;
        if (key === "allowed_late_streaks")
          payload.allowedLateStreaks = Number(value || 2);
        if (key === "streak_period")
          payload.streakPeriod = String(value || "monthly");

        await attendanceService.upsertLoginHoursConfig(orgId, payload);

        return res.json({
          success: true,
          message: "Config updated successfully",
          updated: { [key]: value },
        });
      } catch (err) {
        console.error("Failed to upsert login hours config:", err);
        return res.status(500).json({
          success: false,
          message: "Failed to save login hours config",
        });
      }
    }

    // Fallback to legacy config table for other keys
    await saveConfig(key, value, orgId);

    res.json({
      success: true,
      message: "Config updated successfully",
      updated: { [key]: value },
    });
  } catch (error) {
    console.error("PUT /config error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to save config",
      error: error.message,
    });
  }
};

module.exports = { getConfig, updateConfig };
