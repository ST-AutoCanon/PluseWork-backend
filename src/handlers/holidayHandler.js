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
    const wb = XLSX.utils.book_new();
    const aoa = [
      ["date", "occasion", "type"],
      ["2025-01-26", "Republic Day", "Company"],
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);


    ws["!dataValidation"] = [
      {
        sqref: "C2:C1000",
        type: "list",
        allowBlank: false,
        showInputMessage: true,
        showErrorMessage: true,
        formula1: '"Company,Optional"',
      },
    ];

    XLSX.utils.book_append_sheet(wb, ws, "Template");

    // Add a small instructions sheet to make allowed values obvious to users
    const instr = [
      ["INSTRUCTIONS"],
      [
        "The 'type' column (third column) accepts only two values: Company or Optional.",
      ],
      ["Please do not modify the header row. Leave other columns unchanged."],
    ];
    const wsInstr = XLSX.utils.aoa_to_sheet(instr);
    XLSX.utils.book_append_sheet(wb, wsInstr, "INSTRUCTIONS");

    const buf = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="holiday_template.xlsx"`
    );
    res.status(200).send(buf);
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

    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    const rows = XLSX.utils.sheet_to_json(sheet, {
      defval: "",
      raw: false,
      dateNF: "yyyy-mm-dd",
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

    const normalizeDateToYMD = (raw) => {
      if (typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) {
        return raw.trim();
      }

      if (typeof raw === "string") {
        const s = raw.trim();
        const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
        if (dmy) {
          const dd = String(dmy[1]).padStart(2, "0");
          const mm = String(dmy[2]).padStart(2, "0");
          const yyyy = dmy[3];

          return `${yyyy}-${mm}-${dd}`;
        }

        const attempt = new Date(s);
        if (!isNaN(attempt.getTime())) {
          const Y = attempt.getFullYear();
          const M = String(attempt.getMonth() + 1).padStart(2, "0");
          const D = String(attempt.getDate()).padStart(2, "0");
          return `${Y}-${M}-${D}`;
        }
      }

      if (typeof raw === "number") {
        try {
          const parsed = XLSX.SSF.parse_date_code(raw);
          if (parsed && parsed.y) {
            const Y = parsed.y;
            const M = String(parsed.m).padStart(2, "0");
            const D = String(parsed.d).padStart(2, "0");
            return `${Y}-${M}-${D}`;
          }
        } catch (e) {}
      }

      if (raw instanceof Date && !isNaN(raw.getTime())) {
        const Y = raw.getFullYear();
        const M = String(raw.getMonth() + 1).padStart(2, "0");
        const D = String(raw.getDate()).padStart(2, "0");
        return `${Y}-${M}-${D}`;
      }

      return null;
    };

    rows.forEach((rawRow, idx) => {
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
          date: normalizedDate,
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
