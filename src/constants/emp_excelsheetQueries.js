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
JOIN employees e ON ea.employee_id = e.employee_id AND e.org_id = ?
WHERE (DATE(ea.punchin_time) BETWEEN ? AND ?)
   OR (DATE(ea.punchout_time) BETWEEN ? AND ?)
GROUP BY ea.employee_id, DATE(ea.punchin_time)
ORDER BY ea.employee_id, attendance_date;
`;

module.exports = {
  GET_EMP_ATTENDANCE_BY_DATE_RANGE,
};
