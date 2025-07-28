// // const GET_EMP_ATTENDANCE_BY_DATE_RANGE = `
// // SELECT 
// //     ea.employee_id,
// //     CONCAT(e.first_name, ' ', e.last_name) AS employee_name,
// //     DATE(ea.punchin_time) AS attendance_date,

// //     MIN(ea.punchin_time) AS first_punchin,
// //     MAX(ea.punchout_time) AS last_punchout,

// //     SEC_TO_TIME(SUM(TIMESTAMPDIFF(SECOND, ea.punchin_time, ea.punchout_time))) AS total_work_hours,

// //     (
// //         SELECT punchin_location 
// //         FROM emp_attendence 
// //         WHERE employee_id = ea.employee_id 
// //           AND DATE(punchin_time) = DATE(MIN(ea.punchin_time))
// //         ORDER BY punchin_time ASC 
// //         LIMIT 1
// //     ) AS first_punchin_location,

// //     (
// //         SELECT punchout_location 
// //         FROM emp_attendence 
// //         WHERE employee_id = ea.employee_id 
// //           AND DATE(punchout_time) = DATE(MAX(ea.punchout_time))
// //         ORDER BY punchout_time DESC 
// //         LIMIT 1
// //     ) AS last_punchout_location

// // FROM emp_attendence ea
// // JOIN employees e ON ea.employee_id = e.employee_id

// // WHERE (DATE(ea.punchin_time) BETWEEN ? AND ?)
// //    OR (DATE(ea.punchout_time) BETWEEN ? AND ?)

// // GROUP BY ea.employee_id, DATE(ea.punchin_time)
// // ORDER BY ea.employee_id, attendance_date;
// // `;

// // module.exports = {
// //   GET_EMP_ATTENDANCE_BY_DATE_RANGE,
// // };


// // // const GET_EMP_ATTENDANCE_BY_DATE_RANGE = `
// // // SELECT 
// // //     ea.employee_id,
// // //     CONCAT(e.first_name, ' ', e.last_name) AS employee_name,
// // //     DATE(ea.punchin_time) AS attendance_date,
// // //     MIN(ea.punchin_time) AS first_punchin,
// // //     MAX(ea.punchout_time) AS last_punchout,
// // //     SEC_TO_TIME(SUM(TIMESTAMPDIFF(SECOND, ea.punchin_time, ea.punchout_time))) AS total_work_hours,
// // //     (
// // //         SELECT punchin_location 
// // //         FROM emp_attendence 
// // //         WHERE employee_id = ea.employee_id 
// // //           AND DATE(punchin_time) = DATE(MIN(ea.punchin_time))
// // //         ORDER BY punchin_time ASC 
// // //         LIMIT 1
// // //     ) AS first_punchin_location,
// // //     (
// // //         SELECT punchout_location 
// // //         FROM emp_attendence 
// // //         WHERE employee_id = ea.employee_id 
// // //           AND DATE(punchout_time) = DATE(MAX(ea.punchout_time))
// // //         ORDER BY punchout_time DESC 
// // //         LIMIT 1
// // //     ) AS last_punchout_location
// // // FROM emp_attendence ea
// // // JOIN employees e ON ea.employee_id = e.employee_id
// // // WHERE (DATE(ea.punchin_time) BETWEEN ? AND ?)
// // //    OR (DATE(ea.punchout_time) BETWEEN ? AND ?)
// // // GROUP BY ea.employee_id, DATE(ea.punchin_time)
// // // ORDER BY ea.employee_id, attendance_date;
// // // `;

// // // module.exports = {
// // //   GET_EMP_ATTENDANCE_BY_DATE_RANGE,
// // // };

// // // const GET_EMP_ATTENDANCE_BY_DATE_RANGE = `
// // // SELECT 
// // //     ea.employee_id,
// // //     CONCAT(e.first_name, ' ', e.last_name) AS employee_name,
// // //     DATE(ea.punchin_time) AS attendance_date,
// // //     MIN(ea.punchin_time) AS first_punchin,
// // //     MAX(ea.punchout_time) AS last_punchout,
// // //     SEC_TO_TIME(SUM(TIMESTAMPDIFF(SECOND, ea.punchin_time, ea.punchout_time))) AS total_work_hours,
// // //     (
// // //         SELECT punchin_location 
// // //         FROM emp_attendence 
// // //         WHERE employee_id = ea.employee_id 
// // //           AND DATE(punchin_time) = DATE(MIN(ea.punchin_time))
// // //         ORDER BY punchin_time ASC 
// // //         LIMIT 1
// // //     ) AS first_punchin_location,
// // //     (
// // //         SELECT punchout_location 
// // //         FROM emp_attendence 
// // //         WHERE employee_id = ea.employee_id 
// // //           AND DATE(punchout_time) = DATE(MAX(ea.punchout_time))
// // //         ORDER BY punchout_time DESC 
// // //         LIMIT 1
// // //     ) AS last_punchout_location
// // // FROM emp_attendence ea
// // // JOIN employees e ON ea.employee_id = e.employee_id
// // // WHERE DATE(ea.punchin_time) BETWEEN ? AND ?
// // //   AND ea.punchout_time IS NOT NULL
// // //   AND DATE(ea.punchout_time) = DATE(ea.punchin_time)
// // // GROUP BY ea.employee_id, DATE(ea.punchin_time)
// // // HAVING COUNT(ea.punchout_time) > 0
// // // ORDER BY ea.employee_id, attendance_date;
// // // `;

// // // module.exports = {
// // //   GET_EMP_ATTENDANCE_BY_DATE_RANGE,
// // // };

// // const GET_EMP_ATTENDANCE_BY_DATE_RANGE = `
// // SELECT 
// //     ea.employee_id,
// //     CONCAT(e.first_name, ' ', e.last_name) AS employee_name,
// //     MIN(ea.punchin_time) AS first_punchin,
// //     MAX(ea.punchout_time) AS last_punchout,
// //     SEC_TO_TIME(SUM(TIMESTAMPDIFF(SECOND, ea.punchin_time, ea.punchout_time))) AS total_work_hours,
// //     (
// //         SELECT punchin_location 
// //         FROM emp_attendence 
// //         WHERE employee_id = ea.employee_id 
// //           AND DATE(punchin_time) = DATE(MIN(ea.punchin_time))
// //         ORDER BY punchin_time ASC 
// //         LIMIT 1
// //     ) AS first_punchin_location,
// //     (
// //         SELECT punchout_location 
// //         FROM emp_attendence 
// //         WHERE employee_id = ea.employee_id 
// //           AND DATE(punchout_time) = DATE(MAX(ea.punchout_time))
// //         ORDER BY punchout_time DESC 
// //         LIMIT 1
// //     ) AS last_punchout_location
// // FROM emp_attendence ea
// // JOIN employees e ON ea.employee_id = e.employee_id
// // WHERE DATE(ea.punchin_time) BETWEEN ? AND ?
// //   AND ea.punchout_time IS NOT NULL
// //   AND DATE(ea.punchout_time) = DATE(ea.punchin_time)
// // GROUP BY ea.employee_id, DATE(ea.punchin_time)
// // HAVING COUNT(ea.punchout_time) > 0
// // ORDER BY ea.employee_id;
// // `;

// // module.exports = {
// //   GET_EMP_ATTENDANCE_BY_DATE_RANGE,
// // };


// // const GET_EMP_ATTENDANCE_BY_DATE_RANGE = `
// // SELECT 
// //     ea.employee_id,
// //     CONCAT(e.first_name, ' ', e.last_name) AS employee_name,
// //     MIN(ea.punchin_time) AS first_punchin,
// //     MAX(ea.punchout_time) AS last_punchout,
// //     SEC_TO_TIME(SUM(TIMESTAMPDIFF(SECOND, ea.punchin_time, ea.punchout_time))) AS total_work_hours,
// //     (
// //         SELECT punchin_location 
// //         FROM emp_attendence 
// //         WHERE employee_id = ea.employee_id 
// //           AND DATE(punchin_time) = DATE(MIN(ea.punchin_time))
// //         ORDER BY punchin_time ASC 
// //         LIMIT 1
// //     ) AS first_punchin_location,
// //     (
// //         SELECT punchout_location 
// //         FROM emp_attendence 
// //         WHERE employee_id = ea.employee_id 
// //           AND DATE(punchout_time) = DATE(MAX(ea.punchout_time))
// //         ORDER BY punchout_time DESC 
// //         LIMIT 1
// //     ) AS last_punchout_location
// // FROM emp_attendence ea
// // JOIN employees e ON ea.employee_id = e.employee_id
// // WHERE DATE(ea.punchin_time) BETWEEN ? AND ?
// //   AND ea.punchout_time IS NOT NULL
// //   AND DATE(ea.punchout_time) = DATE(ea.punchin_time)
// //   AND e.org_id = ?
// // GROUP BY ea.employee_id, DATE(ea.punchin_time)
// // HAVING COUNT(ea.punchout_time) > 0
// // ORDER BY ea.employee_id;
// // `;

// // module.exports = {
// //   GET_EMP_ATTENDANCE_BY_DATE_RANGE,
// // };

// // emp_excelsheetQueries.js

// const GET_EMP_ATTENDANCE_BY_DATE_RANGE = `
//   SELECT 
//     employee_id,
//     CONCAT(first_name, ' ', last_name) AS employee_name,
//     MIN(punchin_time) AS first_punchin,
//     MAX(punchout_time) AS last_punchout,
//     SEC_TO_TIME(SUM(TIMESTAMPDIFF(SECOND, punchin_time, punchout_time))) AS total_work_hours,
//     MIN(punchin_location) AS first_punchin_location,
//     MAX(punchout_location) AS last_punchout_location
//   FROM punches
//   WHERE punchin_time BETWEEN ? AND ?
//     AND org_id = ?
//   GROUP BY employee_id, first_name, last_name
// `;

// module.exports = {
//   GET_EMP_ATTENDANCE_BY_DATE_RANGE,
// };

const GET_EMP_ATTENDANCE_BY_DATE_RANGE = `
SELECT 
    ea.employee_id,
    CONCAT(e.first_name, ' ', e.last_name) AS employee_name,
    DATE(ea.punchin_time) AS attendance_date,
    MIN(ea.punchin_time) AS first_punchin,
    MAX(ea.punchout_time) AS last_punchout,
    SEC_TO_TIME(SUM(TIMESTAMPDIFF(SECOND, ea.punchin_time, ea.punchout_time))) AS total_work_hours,
    (
        SELECT punchin_location 
        FROM emp_attendence 
        WHERE employee_id = ea.employee_id 
          AND DATE(punchin_time) = DATE(MIN(ea.punchin_time))
        ORDER BY punchin_time ASC 
        LIMIT 1
    ) AS first_punchin_location,
    (
        SELECT punchout_location 
        FROM emp_attendence 
        WHERE employee_id = ea.employee_id 
          AND DATE(punchout_time) = DATE(MAX(ea.punchout_time))
        ORDER BY punchout_time DESC 
        LIMIT 1
    ) AS last_punchout_location
FROM emp_attendence ea
JOIN employees e ON ea.employee_id = e.employee_id AND e.Org_id = ?
WHERE (DATE(ea.punchin_time) BETWEEN ? AND ?)
   OR (DATE(ea.punchout_time) BETWEEN ? AND ?)
GROUP BY ea.employee_id, DATE(ea.punchin_time)
ORDER BY ea.employee_id, attendance_date;
`;

module.exports = {
  GET_EMP_ATTENDANCE_BY_DATE_RANGE,
};