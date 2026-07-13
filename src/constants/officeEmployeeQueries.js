// const OFFICE_EMPLOYEE_QUERIES = {
//   GET_ALL_EMPLOYEES: `
//     SELECT
//       employee_id,
//       first_name,
//       middle_name,
//       last_name,
//       email,
//       phone_number,
//       status
//     FROM employees
//     ORDER BY first_name ASC
//   `,

//   GET_OFFICE_LOCATION_BY_ID: `
//     SELECT id, office_name, address, status
//     FROM office_locations
//     WHERE id = ?
//     LIMIT 1
//   `,

//   GET_EMPLOYEE_BY_ID: `
//     SELECT
//       employee_id,
//       first_name,
//       middle_name,
//       last_name,
//       email,
//       phone_number,
//       status
//     FROM employees
//     WHERE employee_id = ?
//     LIMIT 1
//   `,

//   GET_EMPLOYEES_BY_OFFICE_LOCATION: `
//     SELECT
//       e.employee_id,
//       e.first_name,
//       e.middle_name,
//       e.last_name,
//       e.email,
//       e.phone_number,
//       e.status,
//       ole.id AS mapping_id,
//       ole.office_location_id,
//       ole.assigned_at
//     FROM office_location_employees ole
//     INNER JOIN employees e ON e.employee_id = ole.employee_id
//     WHERE ole.office_location_id = ?
//     ORDER BY e.first_name ASC
//   `,

//   CHECK_EMPLOYEE_OFFICE_MAPPING: `
//     SELECT id
//     FROM office_location_employees
//     WHERE office_location_id = ? AND employee_id = ?
//     LIMIT 1
//   `,

//   ASSIGN_EMPLOYEE_TO_OFFICE: `
//     INSERT INTO office_location_employees
//     (office_location_id, employee_id)
//     VALUES (?, ?)
//   `,

//   REMOVE_EMPLOYEE_FROM_OFFICE: `
//     DELETE FROM office_location_employees
//     WHERE office_location_id = ? AND employee_id = ?
//   `,

//   REMOVE_ALL_EMPLOYEES_FROM_OFFICE: `
//     DELETE FROM office_location_employees
//     WHERE office_location_id = ?
//   `,

//   GET_EMPLOYEE_COUNT_BY_OFFICE: `
//     SELECT office_location_id, COUNT(*) AS total_employees
//     FROM office_location_employees
//     WHERE office_location_id = ?
//     GROUP BY office_location_id
//   `,
// };

// module.exports = OFFICE_EMPLOYEE_QUERIES;

// const OFFICE_EMPLOYEE_QUERIES = {
//   GET_ALL_EMPLOYEES: `
//     SELECT
//       employee_id,
//       first_name,
//       middle_name,
//       last_name,
//       email,
//       phone_number,
//       status
//     FROM employees
//     ORDER BY first_name ASC
//   `,

//   GET_OFFICE_LOCATION_BY_ID: `
//     SELECT id, office_name, address, status
//     FROM office_locations
//     WHERE id = ?
//     LIMIT 1
//   `,

//   GET_EMPLOYEE_BY_ID: `
//     SELECT
//       employee_id,
//       first_name,
//       middle_name,
//       last_name,
//       email,
//       phone_number,
//       status
//     FROM employees
//     WHERE employee_id = ?
//     LIMIT 1
//   `,

//   GET_EMPLOYEES_BY_OFFICE_LOCATION: `
//     SELECT
//       e.employee_id,
//       e.first_name,
//       e.middle_name,
//       e.last_name,
//       e.email,
//       e.phone_number,
//       e.status,
//       ole.id AS mapping_id,
//       ole.office_location_id,
//       ole.assigned_at
//     FROM office_location_employees ole
//     INNER JOIN employees e ON e.employee_id = ole.employee_id
//     WHERE ole.office_location_id = ?
//     ORDER BY e.first_name ASC
//   `,

//   CHECK_EMPLOYEE_OFFICE_MAPPING: `
//     SELECT id
//     FROM office_location_employees
//     WHERE office_location_id = ? AND employee_id = ?
//     LIMIT 1
//   `,

//   // NEW: check whether employee already belongs to any other office
//   GET_EMPLOYEE_OTHER_OFFICE_ASSIGNMENTS: `
//     SELECT
//       ole.id AS mapping_id,
//       ole.office_location_id,
//       ole.assigned_at,
//       ol.office_name,
//       ol.address
//     FROM office_location_employees ole
//     INNER JOIN office_locations ol ON ol.id = ole.office_location_id
//     WHERE ole.employee_id = ?
//       AND ole.office_location_id <> ?
//     ORDER BY ole.assigned_at DESC
//   `,

//   // NEW: same check for multiple employeeIds
//   GET_EMPLOYEE_ASSIGNMENTS_BY_EMPLOYEE_IDS: `
//     SELECT
//       ole.employee_id,
//       ole.office_location_id,
//       ole.assigned_at,
//       ol.office_name,
//       ol.address
//     FROM office_location_employees ole
//     INNER JOIN office_locations ol ON ol.id = ole.office_location_id
//     WHERE ole.employee_id IN (?)
//     ORDER BY ole.employee_id, ole.assigned_at DESC
//   `,

//   ASSIGN_EMPLOYEE_TO_OFFICE: `
//     INSERT INTO office_location_employees
//     (office_location_id, employee_id)
//     VALUES (?, ?)
//   `,

//   REMOVE_EMPLOYEE_FROM_OFFICE: `
//     DELETE FROM office_location_employees
//     WHERE office_location_id = ? AND employee_id = ?
//   `,

//   REMOVE_ALL_EMPLOYEES_FROM_OFFICE: `
//     DELETE FROM office_location_employees
//     WHERE office_location_id = ?
//   `,

//   GET_EMPLOYEE_COUNT_BY_OFFICE: `
//     SELECT office_location_id, COUNT(*) AS total_employees
//     FROM office_location_employees
//     WHERE office_location_id = ?
//     GROUP BY office_location_id
//   `,
// };

// module.exports = OFFICE_EMPLOYEE_QUERIES;

const OFFICE_EMPLOYEE_QUERIES = {
  GET_ALL_EMPLOYEES: `
    SELECT
      employee_id,
      first_name,
      middle_name,
      last_name,
      email,
      phone_number,
      status
    FROM employees
    ORDER BY first_name ASC
  `,

  GET_OFFICE_LOCATION_BY_ID: `
    SELECT id, office_name, address, status
    FROM office_locations
    WHERE id = ?
    LIMIT 1
  `,

  GET_EMPLOYEE_BY_ID: `
    SELECT
      employee_id,
      first_name,
      middle_name,
      last_name,
      email,
      phone_number,
      status
    FROM employees
    WHERE employee_id = ?
    LIMIT 1
  `,

  GET_EMPLOYEES_BY_OFFICE_LOCATION: `
    SELECT
      e.employee_id,
      e.first_name,
      e.middle_name,
      e.last_name,
      e.email,
      e.phone_number,
      e.status,
      ole.id AS mapping_id,
      ole.office_location_id,
      ole.assigned_at
    FROM office_location_employees ole
    INNER JOIN employees e ON e.employee_id = ole.employee_id
    WHERE ole.office_location_id = ?
    ORDER BY e.first_name ASC
  `,

  CHECK_EMPLOYEE_OFFICE_MAPPING: `
    SELECT id
    FROM office_location_employees
    WHERE office_location_id = ? AND employee_id = ?
    LIMIT 1
  `,

  GET_EMPLOYEE_OTHER_OFFICE_ASSIGNMENTS: `
    SELECT
      ole.id AS mapping_id,
      ole.office_location_id,
      ole.assigned_at,
      ol.office_name,
      ol.address
    FROM office_location_employees ole
    INNER JOIN office_locations ol ON ol.id = ole.office_location_id
    WHERE ole.employee_id = ?
      AND ole.office_location_id <> ?
    ORDER BY ole.assigned_at DESC
  `,

  GET_EMPLOYEE_ASSIGNMENTS_BY_EMPLOYEE_IDS: `
    SELECT
      ole.employee_id,
      ole.office_location_id,
      ole.assigned_at,
      ol.office_name,
      ol.address
    FROM office_location_employees ole
    INNER JOIN office_locations ol ON ol.id = ole.office_location_id
    WHERE ole.employee_id IN (?)
    ORDER BY ole.employee_id, ole.assigned_at DESC
  `,

  ASSIGN_EMPLOYEE_TO_OFFICE: `
    INSERT INTO office_location_employees
    (office_location_id, employee_id)
    VALUES (?, ?)
  `,

  REMOVE_EMPLOYEE_FROM_OFFICE: `
    DELETE FROM office_location_employees
    WHERE office_location_id = ? AND employee_id = ?
  `,

  REMOVE_ALL_EMPLOYEES_FROM_OFFICE: `
    DELETE FROM office_location_employees
    WHERE office_location_id = ?
  `,

  GET_EMPLOYEE_COUNT_BY_OFFICE: `
    SELECT office_location_id, COUNT(*) AS total_employees
    FROM office_location_employees
    WHERE office_location_id = ?
    GROUP BY office_location_id
  `,
};

module.exports = OFFICE_EMPLOYEE_QUERIES;