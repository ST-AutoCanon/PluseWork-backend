const supervisorService = require("../services/supervisorService");

const getEmployeesWithUpdates = async (req, res) => {
  const { supervisorId } = req.params;

  try {
    const employees = await supervisorService.getEmployeesUnderSupervisor(
      supervisorId
    );

    const employeesWithUpdates = await Promise.all(
      employees.map(async (emp) => {
        const interactions = await supervisorService.getEmployeeInteractions(
          emp.employee_id
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
          weeklyUpdates: Object.keys(weeklyUpdates).map((weekId) => ({
            week: weekId,
            tasks: weeklyUpdates[weekId].tasks,
            comments: weeklyUpdates[weekId].comments,
          })),
        };
      })
    );

    res.json(employeesWithUpdates);
  } catch (err) {
    console.error("Error fetching employees:", err);
    res.status(500).json({ error: "Failed to fetch employees" });
  }
};

const addComment = async (req, res) => {
  const { interaction_id, supervisor_comment } = req.body;

  if (!interaction_id || !supervisor_comment) {
    return res
      .status(400)
      .json({ error: "interaction_id and supervisor_comment are required" });
  }

  try {
    const result = await supervisorService.updateSupervisorReplyById(
      interaction_id,
      supervisor_comment
    );
    res.json({
      success: true,
      message: "Supervisor comment saved successfully",
      result,
    });
  } catch (err) {
    console.error("Error replying to interaction:", err);
    res.status(500).json({ error: "Failed to save comment" });
  }
};

module.exports = {
  getEmployeesWithUpdates,
  addComment,
};
