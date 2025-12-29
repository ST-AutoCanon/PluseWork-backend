const reportService = require("../services/reportIndex");
const db = require("../config");

async function getDepartments(req, res) {
  try {
    if (reportService && typeof reportService.getDepartments === "function") {
      const out = await reportService.getDepartments(req);
      if (!out) return res.json([]);
      if (Array.isArray(out)) return res.json(out);
      if (Array.isArray(out.departments)) return res.json(out.departments);
      if (Array.isArray(out.results)) return res.json(out.results);
      if (Array.isArray(out.data)) return res.json(out.data);
      return res.json(out);
    }

    if (!db || typeof db.execute !== "function") {
      console.error(
        "[departmentsHandler] No DB available for departments fallback"
      );
      return res
        .status(501)
        .json({ message: "Departments not implemented on server" });
    }

    const queries = [
      `SELECT id AS department_id, name AS department_name FROM departments ORDER BY name ASC LIMIT 1000`,
      `SELECT department_id, department_name FROM departments ORDER BY department_name ASC LIMIT 1000`,
      `SELECT department_id, department_name FROM department ORDER BY department_name ASC LIMIT 1000`,
      `SELECT id as department_id, department_name as department_name FROM department ORDER BY department_name ASC LIMIT 1000`,
    ];

    let rows = null;
    for (const q of queries) {
      try {
        const [r] = await db.execute(q);
        if (Array.isArray(r)) {
          rows = r;
          break;
        }
      } catch (e) {}
    }

    if (!Array.isArray(rows)) {
      console.warn(
        "[departmentsHandler] Departments fallback returned no rows"
      );
      return res.json([]);
    }

    const out = rows.map((r) => ({
      department_id:
        r.department_id ?? r.id ?? r.dept_id ?? r.departmentId ?? null,
      department_name:
        r.department_name ?? r.name ?? r.departmentName ?? r.department ?? "",
    }));

    return res.json(out);
  } catch (err) {
    console.error(
      "[departmentsHandler] getDepartments error:",
      err && err.stack ? err.stack : err
    );
    return res.status(500).json({ message: "Failed to fetch departments" });
  }
}

module.exports = { getDepartments };
