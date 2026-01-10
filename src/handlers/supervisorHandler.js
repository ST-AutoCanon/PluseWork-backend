

const supervisorService = require("../services/supervisorService");

// Consistent orgId extraction (same as every other module)
const getOrgIdFromHeaders = (req) => {
  return (
    req.headers["x-org-id"] ||
    req.headers["x_org_id"] ||
    req.headers["org-id"] ||
    req.headers["orgid"] ||
    null
  );
};

// Optional: extract supervisorId flexibly (from param or header)
const getSupervisorId = (req) => {
  return req.params.supervisorId || req.headers["x-employee-id"];
};

const getEmployeesWithUpdates = async (req, res) => {
  try {
    const orgId = getOrgIdFromHeaders(req);
    if (!orgId) {
      return res.status(400).json({ error: "Missing required header: x-org-id" });
    }

    const supervisorId = getSupervisorId(req);
    if (!supervisorId) {
      return res.status(400).json({ error: "Supervisor ID is required" });
    }

    const employees = await supervisorService.getEmployeesUnderSupervisor(
      supervisorId,
      orgId
    );

    const employeesWithUpdates = await Promise.all(
      employees.map(async (emp) => {
        const interactions = await supervisorService.getEmployeeInteractions(
          emp.employee_id,
          orgId
        );

        const weeklyUpdates = {};
        interactions.forEach((row) => {
          if (!weeklyUpdates[row.week_id]) {
            weeklyUpdates[row.week_id] = { tasks: [], comments: [] };
          }

          if (row.sender_role === "employee") {
            weeklyUpdates[row.week_id].tasks.push({
              id: row.interaction_id,
              title: "Task",
              description: row.message_text,
              supervisor_reply: row.supervisor_reply || "",
            });
          } else {
            weeklyUpdates[row.week_id].comments.push({
              id: row.interaction_id,
              author: "Supervisor",
              text: row.message_text,
            });
          }
        });

        return {
          id: emp.employee_id,
          name: emp.name,
          position: emp.position,
          weeklyUpdates: Object.keys(weeklyUpdates)
            .sort((a, b) => b.localeCompare(a)) // optional: newest week first
            .map((weekId) => ({
              week: weekId,
              tasks: weeklyUpdates[weekId].tasks,
              comments: weeklyUpdates[weekId].comments,
            })),
        };
      })
    );

    res.json(employeesWithUpdates);
  } catch (err) {
    console.error("Error fetching employees with updates:", err);
    res.status(500).json({ error: "Failed to fetch employees" });
  }
};

const addComment = async (req, res) => {
  try {
    const orgId = getOrgIdFromHeaders(req);
    if (!orgId) {
      return res.status(400).json({ error: "Missing required header: x-org-id" });
    }

    const { interaction_id, supervisor_comment } = req.body;

    if (!interaction_id || !supervisor_comment) {
      return res.status(400).json({
        error: "interaction_id and supervisor_comment are required",
      });
    }

    const result = await supervisorService.updateSupervisorReplyById(
      interaction_id,
      supervisor_comment,
      orgId
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Interaction not found" });
    }

    res.json({
      success: true,
      message: "Supervisor comment saved successfully",
    });
  } catch (err) {
    console.error("Error saving supervisor comment:", err);
    res.status(500).json({ error: "Failed to save comment" });
  }
};

module.exports = {
  getEmployeesWithUpdates,
  addComment,
};