
// const db = require('../config');

// const fetchTodayAndYesterdayData = async () => {
//   const query = `
//     SELECT ea.punch_id,
//            ea.employee_id,
//            ea.punch_status,
//            DATE_FORMAT(ea.punchin_time, '%Y-%m-%d %H:%i:%s') AS punchin_time,
//            ea.punchin_device,
//            ea.punchin_location,
//            DATE_FORMAT(ea.punchout_time, '%Y-%m-%d %H:%i:%s') AS punchout_time,
//            ea.punchout_device,
//            ea.punchout_location,
//            ea.punchmode,
//            e.first_name,
//            e.last_name,
//            e.photo_url,
//            CASE 
//              WHEN DATE(ea.punchin_time) = CURDATE() THEN 'Today'
//              WHEN DATE(ea.punchin_time) = CURDATE() - INTERVAL 1 DAY THEN 'Yesterday'
//            END AS record_day
//     FROM emp_attendence ea
//     JOIN employees e ON ea.employee_id = e.employee_id
//     WHERE DATE(ea.punchin_time) IN (CURDATE(), CURDATE() - INTERVAL 1 DAY)
//   `;

//   try {
//     console.log('Executing query:', query);
//     const [rows] = await db.query(query);
//     console.log('Query returned rows:', rows);
//     return rows;
//   } catch (error) {
//     console.error("Error fetching punch data:", error);
//     throw error;
//   }
// };

// module.exports = {
//   fetchTodayAndYesterdayData
// };

const db = require('../config');
const { getTodayAndYesterdayPunchDataQuery } = require('../constants/employeeloginQueries');

const fetchTodayAndYesterdayData = async (org_id) => {
  try {
    console.log('Executing query with org_id:', org_id);
    const [rows] = await db.query(getTodayAndYesterdayPunchDataQuery, [org_id]);
    console.log('Query returned rows:', rows);
    return rows;
  } catch (error) {
    console.error("Error fetching punch data:", error);
    throw error;
  }
};

module.exports = {
  fetchTodayAndYesterdayData
};