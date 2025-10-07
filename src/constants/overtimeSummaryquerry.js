// constants/overtimeSummaryQuery.js

const OVERTIME_SUMMARY_QUERY = `
SELECT 
    sup.employee_id AS supervisor_id,
    CONCAT(supEmp.first_name, ' ', supEmp.last_name) AS supervisor_name,
    emp.employee_id AS employee_id,
    CONCAT(emp.first_name, ' ', emp.last_name) AS employee_name,
    GROUP_CONCAT(DISTINCT ap.project_name ORDER BY ap.project_name SEPARATOR ', ') AS project_names
FROM employee_professional ep
JOIN employees emp 
    ON ep.employee_id = emp.employee_id
JOIN employee_professional sup
    ON ep.supervisor_id = sup.employee_id
JOIN employees supEmp
    ON sup.employee_id = supEmp.employee_id
LEFT JOIN sts_owners so 
    ON JSON_CONTAINS(so.employee_list, CONCAT('"', emp.employee_id, '"'))
LEFT JOIN add_project ap 
    ON so.project_id = ap.id
WHERE ep.supervisor_id = ?
GROUP BY emp.employee_id, sup.employee_id;
`;

module.exports = { OVERTIME_SUMMARY_QUERY };
