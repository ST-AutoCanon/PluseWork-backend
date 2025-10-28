const holidayService = require("../services/holidayService");
const XLSX = require("xlsx");

const getOrgIdFromHeaders = (req) => {
  return (
    req.headers["x-org-id"] ||
    req.headers["x_org_id"] ||
    req.headers["org-id"] ||
    req.headers["orgid"] ||
    null
  );
};

const getHolidays = async (req, res) => {
  try {
    const orgId = getOrgIdFromHeaders(req);
    if (!orgId) {
      return res
        .status(400)
        .json({ message: "Missing required header: x-org-id" });
    }

    const holidays = await holidayService.getHolidays(orgId);
    res.json(holidays);
  } catch (error) {
    console.error("getHolidays error:", error);
    res.status(500).json({
      message: "Error fetching holidays",
      error: error.message || error,
    });
  }
};

const downloadTemplate = async (req, res) => {
  try {
    const csv =
      ["date", "occasion", "type"].join(",") +
      "\n" +
      ["2025-01-26", "Republic Day", "Company"].join(",") +
      "\n";
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="holiday_template.csv"`
    );
    res.status(200).send(csv);
  } catch (err) {
    console.error("downloadTemplate error:", err);
    res.status(500).json({
      message: "Failed to prepare template",
      error: err.message || err,
    });
  }
};

const uploadHolidays = async (req, res) => {
  try {
    const orgId = getOrgIdFromHeaders(req);
    if (!orgId) {
      return res
        .status(400)
        .json({ message: "Missing required header: x-org-id" });
    }

    if (!req.file || !req.file.buffer) {
      return res
        .status(400)
        .json({ message: "No file uploaded. Field name must be 'file'." });
    }

    const buffer = req.file.buffer;
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
    if (!workbook || workbook.SheetNames.length === 0) {
      return res.status(400).json({ message: "Uploaded file has no sheets." });
    }

    // --- new robust parsing for dates (drop-in) ---
    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    // ask SheetJS to format date cells as strings "yyyy-mm-dd"
    const rows = XLSX.utils.sheet_to_json(sheet, {
      defval: "",
      raw: false,
      dateNF: "yyyy-mm-dd", // instruct formatting for date cells
    });

    if (!rows || rows.length === 0) {
      return res
        .status(400)
        .json({ message: "Uploaded file contains no data rows." });
    }

    const incomingHeaders = Object.keys(rows[0]).map((h) =>
      String(h).trim().toLowerCase()
    );
    const REQUIRED = ["date", "occasion", "type"];
    const setIncoming = new Set(incomingHeaders);
    const setReq = new Set(REQUIRED);

    if (
      setIncoming.size !== setReq.size ||
      !REQUIRED.every((h) => setIncoming.has(h))
    ) {
      return res.status(400).json({
        message: `Invalid columns. Required (case-insensitive, any order): ${REQUIRED.join(
          ", "
        )}. Found: ${incomingHeaders.join(", ")}`,
      });
    }

    const ALLOWED_TYPES = new Set(["company", "optional"]);
    const invalidRows = [];
    const normalized = [];

    /**
     * Normalize a date-string or Excel serial into YYYY-MM-DD (string).
     * Prefer the already formatted string from sheet_to_json (dateNF).
     */
    const normalizeDateToYMD = (raw) => {
      // If it's already a YYYY-MM-DD string, accept it
      if (typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) {
        return raw.trim();
      }

      // If it's string like DD/MM/YYYY or MM/DD/YYYY -> try DD/MM/YYYY first
      if (typeof raw === "string") {
        const s = raw.trim();
        // dd/mm/yyyy or d/m/yyyy
        const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
        if (dmy) {
          const dd = String(dmy[1]).padStart(2, "0");
          const mm = String(dmy[2]).padStart(2, "0");
          const yyyy = dmy[3];
          // Heuristic: if mm > 12 then it's dd/mm; otherwise ambiguous — assume dd/mm (common)
          // But we assume user uses dd/mm in many locales. If you prefer mm/dd, adjust here.
          return `${yyyy}-${mm}-${dd}`;
        }

        // ISO-like string: try Date parsing but construct local YYYY-MM-DD from that Date
        const attempt = new Date(s);
        if (!isNaN(attempt.getTime())) {
          const Y = attempt.getFullYear();
          const M = String(attempt.getMonth() + 1).padStart(2, "0");
          const D = String(attempt.getDate()).padStart(2, "0");
          return `${Y}-${M}-${D}`;
        }
      }

      // If it's a number (Excel serial) - parse with SheetJS helper
      if (typeof raw === "number") {
        try {
          const parsed = XLSX.SSF.parse_date_code(raw);
          if (parsed && parsed.y) {
            const Y = parsed.y;
            const M = String(parsed.m).padStart(2, "0");
            const D = String(parsed.d).padStart(2, "0");
            return `${Y}-${M}-${D}`;
          }
        } catch (e) {
          // fall through
        }
      }

      // if it's a native Date object (rare because we asked raw:false, but just in case)
      if (raw instanceof Date && !isNaN(raw.getTime())) {
        const Y = raw.getFullYear();
        const M = String(raw.getMonth() + 1).padStart(2, "0");
        const D = String(raw.getDate()).padStart(2, "0");
        return `${Y}-${M}-${D}`;
      }

      return null;
    };

    // iterate rows and validate
    rows.forEach((rawRow, idx) => {
      // map keys to lowercase
      const row = {};
      Object.entries(rawRow).forEach(([k, v]) => {
        row[String(k).trim().toLowerCase()] = v;
      });

      const dateRaw = row.date;
      const normalizedDate = normalizeDateToYMD(dateRaw);
      const occasionVal = String(row.occasion ?? "").trim();
      const typeRaw = String(row.type ?? "")
        .trim()
        .toLowerCase();

      const rowErrors = [];
      if (!normalizedDate) rowErrors.push("invalid date");
      if (!occasionVal) rowErrors.push("empty occasion");
      if (!ALLOWED_TYPES.has(typeRaw))
        rowErrors.push("type must be Company or Optional");

      if (rowErrors.length > 0) {
        invalidRows.push({ rowNumber: idx + 2, errors: rowErrors, raw: row });
      } else {
        normalized.push({
          date: normalizedDate, // already YYYY-MM-DD string, no timezone math
          occasion: occasionVal,
          type: typeRaw === "company" ? "Company" : "Optional",
        });
      }
    });

    if (invalidRows.length > 0) {
      const sample = invalidRows
        .slice(0, 10)
        .map((r) => ({ row: r.rowNumber, errors: r.errors }));
      return res.status(400).json({
        message: "Validation failed",
        details: sample,
        totalInvalid: invalidRows.length,
      });
    }

    // proceed to insert normalized (strings YYYY-MM-DD)
    const insertedCount = await holidayService.insertHolidays(
      normalized,
      orgId
    );
    return res
      .status(200)
      .json({ message: "Upload successful", affectedRows: insertedCount });
  } catch (err) {
    console.error("uploadHolidays error:", err);
    return res.status(500).json({
      message: "Failed to process uploaded file",
      error: err.message || err,
    });
  }
};

module.exports = { getHolidays, downloadTemplate, uploadHolidays };
