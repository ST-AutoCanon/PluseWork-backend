// const getTodayAndYesterdayPunchDataQuery = `
//   SELECT *,
//     CASE 
//       WHEN DATE(punchin_time) = CURDATE() THEN 'Today'
//       WHEN DATE(punchin_time) = CURDATE() - INTERVAL 1 DAY THEN 'Yesterday'
//     END AS record_day
//   FROM emp_attendence
//   WHERE DATE(punchin_time) IN (CURDATE(), CURDATE() - INTERVAL 1 DAY);
// `;

// module.exports = {
//   getTodayAndYesterdayPunchDataQuery
// };

// const getTodayAndYesterdayPunchDataQuery = `
//   SELECT ea.*, 
//          e.first_name, 
//          e.last_name, 
//          e.photo_url,
//          CASE 
//            WHEN DATE(ea.punchin_time) = CURDATE() THEN 'Today'
//            WHEN DATE(ea.punchin_time) = CURDATE() - INTERVAL 1 DAY THEN 'Yesterday'
//          END AS record_day
//   FROM emp_attendence ea
//   JOIN employees e ON ea.employee_id = e.employee_id
//   WHERE DATE(ea.punchin_time) IN (CURDATE(), CURDATE() - INTERVAL 1 DAY);
// `;

// module.exports = {
//   getTodayAndYesterdayPunchDataQuery
// };


// const getTodayAndYesterdayPunchDataQuery = `
//   SELECT ea.punch_id,
//          ea.employee_id,
//          ea.punch_status,
//          DATE_FORMAT(ea.punchin_time, '%Y-%m-%d %H:%i:%s') AS punchin_time,
//          ea.punchin_device,
//          ea.punchin_location,
//          DATE_FORMAT(ea.punchout_time, '%Y-%m-%d %H:%i:%s') AS punchout_time,
//          ea.punchout_device,
//          ea.punchout_location,
//          ea.punchmode,
//          e.first_name,
//          e.last_name,
//          e.photo_url,
//          CASE 
//            WHEN DATE(ea.punchin_time) = CURDATE() THEN 'Today'
//            WHEN DATE(ea.punchin_time) = CURDATE() - INTERVAL 1 DAY THEN 'Yesterday'
//          END AS record_day
//   FROM emp_attendence ea
//   JOIN employees e ON ea.employee_id = e.employee_id
//   WHERE DATE(ea.punchin_time) IN (CURDATE(), CURDATE() - INTERVAL 1 DAY);
// `;

// module.exports = {
//   getTodayAndYesterdayPunchDataQuery
// };

const getTodayAndYesterdayPunchDataQuery = `
  SELECT ea.punch_id,
         ea.employee_id,
         ea.punch_status,
         DATE_FORMAT(ea.punchin_time, '%Y-%m-%d %H:%i:%s') AS punchin_time,
         ea.punchin_device,
         ea.punchin_location,
         DATE_FORMAT(ea.punchout_time, '%Y-%m-%d %H:%i:%s') AS punchout_time,
         ea.punchout_device,
         ea.punchout_location,
         ea.punchmode,
         e.first_name,
         e.last_name,
         e.photo_url,
         CASE 
           WHEN DATE(ea.punchin_time) = CURDATE() THEN 'Today'
           WHEN DATE(ea.punchin_time) = CURDATE() - INTERVAL 1 DAY THEN 'Yesterday'
         END AS record_day
  FROM emp_attendence ea
  JOIN employees e ON ea.employee_id = e.employee_id
  WHERE DATE(ea.punchin_time) IN (CURDATE(), CURDATE() - INTERVAL 1 DAY)
  AND e.org_id = ?;
`;

module.exports = {
  getTodayAndYesterdayPunchDataQuery
};