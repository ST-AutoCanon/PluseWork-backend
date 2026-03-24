const INSERT_OLD_EMPLOYEE_DETAILS = `
 INSERT INTO old_employee_details (
  org_id,
  employee_name,
  employee_id,
  gender,
  designation,
  date_of_joining,
  account_no,
  working_days,
  leaves_taken,
  uin_no,
  pan_number,
  esi_number,
  pf_number,
  basic,
  hra,
  other_allowance,
  pf,
  esi_insurance,
  professional_tax,
  tds,
  gross_earnings,
  total_deductions,
  net_salary,
  month,
  year
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

const GET_ALL_OLD_EMPLOYEE_DETAILS = `
  SELECT 
  *,
  DATE_FORMAT(date_of_joining, '%Y-%m-%d') AS date_of_joining
FROM old_employee_details
WHERE org_id = ?
ORDER BY created_at DESC

`;

const UPDATE_OLD_EMPLOYEE_DETAILS = `
  UPDATE old_employee_details SET
    employee_name = ?,
    gender = ?,
    designation = ?,
    date_of_joining = ?,
    account_no = ?,
    working_days = ?,
    leaves_taken = ?,
    uin_no = ?,
    pan_number = ?,
    esi_number = ?,
    pf_number = ?,
    basic = ?,
    hra = ?,
    other_allowance = ?,
    pf = ?,
    esi_insurance = ?,
    professional_tax = ?,
    tds = ?,
    gross_earnings = ?,
    total_deductions = ?,
    net_salary = ?,
    month = ?,
    year = ?
  WHERE employee_id = ? AND org_id = ?
`;


const GET_EMPLOYEES = `
  SELECT
    e.employee_id,
    CONCAT(
      COALESCE(e.first_name, ''),
      ' ',
      COALESCE(e.last_name, '')
    ) AS employee_name,
    p.gender,
    pr.position AS designation,
    pr.department_id,
    d.name AS department_name,
    
    -- THIS IS THE FIX
    DATE_FORMAT(pr.joining_date, '%Y-%m-%d') AS joining_date,
    
    b.account_number,
    p.uan_number,
    p.pan_number,
    p.esi_number,
    p.pf_number
  FROM employees e
  LEFT JOIN employee_bank_details b 
    ON b.employee_id = e.employee_id
  LEFT JOIN employee_personal p   
    ON p.employee_id = e.employee_id
  LEFT JOIN employee_professional pr 
    ON pr.employee_id = e.employee_id
  LEFT JOIN departments d        
    ON d.id = pr.department_id
  WHERE e.org_id = ?
`;

module.exports = {
  INSERT_OLD_EMPLOYEE_DETAILS,
  GET_ALL_OLD_EMPLOYEE_DETAILS,
  UPDATE_OLD_EMPLOYEE_DETAILS,
  GET_EMPLOYEES,
};
