

const GET_EMPLOYEES_BY_SUPERVISOR = `
  SELECT 
    sup.employee_id AS supervisor_id,
    CONCAT(supEmp.first_name, ' ', supEmp.last_name) AS supervisor_name,
    emp.employee_id AS employee_id,
    CONCAT(emp.first_name, ' ', emp.last_name) AS employee_name,
    epersonal.photo_url,
    emp.status
FROM employee_professional ep
JOIN employees emp 
    ON ep.employee_id = emp.employee_id
JOIN employee_professional sup
    ON ep.supervisor_id = sup.employee_id
JOIN employees supEmp
    ON sup.employee_id = supEmp.employee_id
LEFT JOIN employee_personal epersonal
    ON emp.employee_id = epersonal.employee_id
WHERE ep.supervisor_id = ?
    AND emp.status = 'Active';
`;
module.exports = { GET_EMPLOYEES_BY_SUPERVISOR };