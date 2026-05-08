

// const queries = require("../constants/weekTaskQueries");
// const { getTenantPoolByOrgId } = require("../db/tenantPoolManager");

// // exports.createWeekTask = async (orgId, taskData) => {
// //   const db = await getTenantPoolByOrgId(orgId);

// //   // Fetch supervisor_id if not provided
// //   let supervisorId = taskData.supervisor_id;

// //   if (!supervisorId && taskData.employee_id) {
// //     try {
// //       const [rows] = await db.query(
// //         `SELECT supervisor_id FROM employee_professional 
// //          WHERE employee_id = ?`,
// //         [taskData.employee_id]
// //       );
// //       supervisorId = rows[0]?.supervisor_id || null;
// //     } catch (err) {
// //       console.error("Failed to fetch supervisor_id:", err);
// //       supervisorId = null;
// //     }
// //   }

// //   const [result] = await db.query(queries.INSERT_WEEK_TASK, [
// //     taskData.week_id,
// //     taskData.task_date,
// //     taskData.project_id,
// //     taskData.project_name,
// //     taskData.task_name,
// //     taskData.emp_status || "not started",
// //     taskData.emp_comment || null,
// //     taskData.sup_status || "incomplete",
// //     taskData.sup_comment || null,
// //     taskData.sup_review_status || "pending",
// //     taskData.employee_id || null,
// //     supervisorId,                    // ← Added
// //     taskData.star_rating || null,
// //     taskData.parent_task_id || null, // if you use parent_task_id
// //   ]);

// //   return result.insertId;
// // };

// // exports.updateWeekTask = async (orgId, task_id, taskData) => {
// //   const db = await getTenantPoolByOrgId(orgId);

// //   const [result] = await db.query(queries.UPDATE_WEEK_TASK, [
// //     taskData.project_id,
// //     taskData.project_name,
// //     taskData.task_name,
// //     taskData.emp_status,
// //     taskData.emp_comment,
// //     taskData.sup_status,
// //     taskData.sup_comment,
// //     taskData.sup_review_status,
// //     taskData.employee_id || null,
// //     taskData.supervisor_id || null,     // ← Added
// //     taskData.star_rating || null,
// //     taskData.parent_task_id || null,
// //     task_id,
// //   ]);

// //   return result.affectedRows;
// // };


// // weekTaskService.js

// exports.createWeekTask = async (orgId, taskData) => {
//   const db = await getTenantPoolByOrgId(orgId);

//   let supervisorId = taskData.supervisor_id;
//   if (!supervisorId && taskData.employee_id) {
//     try {
//       const [rows] = await db.query(
//         `SELECT supervisor_id FROM employee_professional WHERE employee_id = ?`,
//         [taskData.employee_id]
//       );
//       supervisorId = rows[0]?.supervisor_id || null;
//     } catch (err) {
//       supervisorId = null;
//     }
//   }

//   const [result] = await db.query(queries.INSERT_WEEK_TASK, [
//     taskData.week_id,
//     taskData.task_date,
//     taskData.project_id,
//     taskData.project_name,
//     taskData.task_name,
//     taskData.emp_status || "not started",
//     taskData.emp_comment || null,
//     taskData.sup_status || "incomplete",
//     taskData.sup_comment || null,
//     taskData.sup_review_status || "pending",
//     taskData.employee_id || null,
//     supervisorId,
//     taskData.action_by || null,           // ← Must be here
//     taskData.star_rating || null,
//     taskData.parent_task_id || null,
//   ]);

//   return result.insertId;
// };

// exports.updateWeekTask = async (orgId, task_id, taskData) => {
//   const db = await getTenantPoolByOrgId(orgId);

//   const [result] = await db.query(queries.UPDATE_WEEK_TASK, [
//     taskData.project_id,
//     taskData.project_name,
//     taskData.task_name,
//     taskData.emp_status,
//     taskData.emp_comment,
//     taskData.sup_status,
//     taskData.sup_comment,
//     taskData.sup_review_status,
//     taskData.employee_id || null,
//     taskData.supervisor_id || null,
//     taskData.action_by || null,           // ← Must be here (11th parameter)
//     taskData.star_rating || null,
//     taskData.parent_task_id || null,
//     task_id,
//   ]);

//   return result.affectedRows > 0;
// };
// exports.getWeekTasksByWeek = async (orgId, week_id) => {
//   const db = await getTenantPoolByOrgId(orgId);
//   const [rows] = await db.query(queries.GET_WEEK_TASKS_BY_WEEK, [week_id]);
//   return rows;
// };

// exports.getWeekTasksByEmployee = async (orgId, employee_id) => {
//   const db = await getTenantPoolByOrgId(orgId);
//   const [rows] = await db.query(
//     queries.GET_WEEK_TASKS_BY_EMPLOYEE,
//     [employee_id]
//   );
//   return rows;
// };

// // exports.updateWeekTask = async (orgId, task_id, taskData) => {
// //   const db = await getTenantPoolByOrgId(orgId);

// //   const [result] = await db.query(queries.UPDATE_WEEK_TASK, [
// //     taskData.project_id,
// //     taskData.project_name,
// //     taskData.task_name,
// //     taskData.emp_status,
// //     taskData.emp_comment,
// //     taskData.sup_status,
// //     taskData.sup_comment,
// //     taskData.sup_review_status,
// //     taskData.employee_id || null,
// //     taskData.star_rating || null,
// //     task_id,
// //   ]);

// //   return result.affectedRows;
// // };

// exports.deleteWeekTask = async (orgId, task_id) => {
//   const db = await getTenantPoolByOrgId(orgId);
//   const [result] = await db.query(queries.DELETE_WEEK_TASK, [task_id]);
//   return result.affectedRows;
// };

// weekTaskService.js

const queries = require("../constants/weekTaskQueries");
const { getTenantPoolByOrgId } = require("../db/tenantPoolManager");

exports.createWeekTask = async (orgId, taskData) => {
  const db = await getTenantPoolByOrgId(orgId);

  let supervisorId = taskData.supervisor_id;
  if (!supervisorId && taskData.employee_id) {
    try {
      const [rows] = await db.query(
        `SELECT supervisor_id FROM employee_professional WHERE employee_id = ?`,
        [taskData.employee_id]
      );
      supervisorId = rows[0]?.supervisor_id || null;
    } catch (err) {
      console.error("Failed to fetch supervisor_id:", err);
      supervisorId = null;
    }
  }

  const [result] = await db.query(queries.INSERT_WEEK_TASK, [
    taskData.week_id,
    taskData.task_date,
    taskData.project_id,
    taskData.project_name,
    taskData.task_name,
    taskData.emp_status || "not started",
    taskData.emp_comment || null,
    taskData.sup_status || "incomplete",
    taskData.sup_comment || null,
    taskData.sup_review_status || "pending",
    taskData.employee_id || null,
    supervisorId,
    taskData.action_by || null,        // ← action_by
    taskData.star_rating || null,
    taskData.parent_task_id || null,
  ]);

  return result.insertId;
};

exports.updateWeekTask = async (orgId, task_id, taskData) => {
  try {
    const db = await getTenantPoolByOrgId(orgId);

    const fields = [];
    const values = [];

    const allowedFields = [
      "project_id",
      "project_name",
      "task_name",
      "replacement_task",
      "employee_id",
      "supervisor_id",
      "action_by",
      "emp_status",
      "emp_comment",
      "sup_status",
      "sup_comment",
      "sup_review_status",
      "star_rating",
      "parent_task_id",
    ];

    allowedFields.forEach((field) => {
      if (taskData[field] !== undefined) {
        fields.push(`${field} = ?`);
        values.push(taskData[field]);
      }
    });

    if (fields.length === 0) {
      throw new Error("No fields provided for update");
    }

    values.push(task_id);

    const query = `
      UPDATE weekly_tasks
      SET ${fields.join(", ")}
      WHERE task_id = ?
    `;

    console.log("UPDATE QUERY:", query);
    console.log("UPDATE VALUES:", values);

    const [result] = await db.query(query, values);

    return result.affectedRows > 0;
  } catch (err) {
    console.error("SERVICE ERROR:", err);
    throw err;
  }
};
// Keep other functions as they are...
exports.getWeekTasksByWeek = async (orgId, week_id) => {
  const db = await getTenantPoolByOrgId(orgId);
  const [rows] = await db.query(queries.GET_WEEK_TASKS_BY_WEEK, [week_id]);
  return rows;
};

exports.getWeekTasksByEmployee = async (orgId, employee_id) => {
  const db = await getTenantPoolByOrgId(orgId);
  const [rows] = await db.query(queries.GET_WEEK_TASKS_BY_EMPLOYEE, [employee_id]);
  return rows;
};

exports.deleteWeekTask = async (orgId, task_id) => {
  const db = await getTenantPoolByOrgId(orgId);
  const [result] = await db.query(queries.DELETE_WEEK_TASK, [task_id]);
  return result.affectedRows;
};