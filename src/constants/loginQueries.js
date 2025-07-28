/**
 * SQL Queries for database operations.
 *
 * @module queries
 */

module.exports = {
  // Query to fetch user details by email
GET_USER_BY_EMAIL: `
  SELECT 
    e.role, 
    e.employee_id, 
    CONCAT(e.first_name, ' ', e.last_name) AS name,
    e.gender, 
    e.email, 
    e.password,
    e.position,  
    e.status,   
    e.Org_id,
    d.name AS department 
  FROM 
    employees e
  LEFT JOIN 
    departments d 
  ON 
    e.department_id = d.id
  WHERE 
    e.email = ?;
`
,

  // Query to fetch admin details by employee_id
  GET_ADMIN_DETAILS: `
    SELECT role, employee_id, CONCAT(first_name,' ', last_name) AS name, email, gender 
    FROM employees 
    WHERE employee_id = ?;
  `,

  // Query to fetch admin dashboard statistics
  GET_ADMIN_DASHBOARD: `
  SELECT 
    COUNT(DISTINCT e.employee_id) AS total_employees,
    SUM(CASE WHEN DATE(a.date) = CURDATE() AND a.login_time IS NOT NULL THEN 1 ELSE 0 END) AS present,
    (
      SELECT COUNT(*) 
      FROM leavequeries lq
      WHERE lq.leave_type = 'Sick' 
        AND lq.status = 'Approved' 
        AND DATE(lq.created_at) = CURDATE()
    ) AS sick_leave,
    (
      SELECT COUNT(*) 
      FROM leavequeries lq
      WHERE lq.leave_type = 'Other' 
        AND lq.status = 'Approved' 
        AND DATE(lq.created_at) = CURDATE()
    ) AS other_absence
  FROM employees e
  LEFT JOIN attendance a ON e.employee_id = a.employee_id
  WHERE DATE(a.date) = CURDATE();
`,

  // Query to fetch salary distribution data
  GET_SALARY_DISTRIBUTION: `
    SELECT 
      AVG(salary) AS average_salary, 
      MIN(salary) AS min_salary, 
      MAX(salary) AS max_salary 
    FROM employees;
  `,

  // Query to fetch department-wise employee distribution
  GET_DEPARTMENT_DISTRIBUTION: `
    SELECT 
  d.name AS department_name, 
  COUNT(e.department_id) AS count 
FROM 
  employees e
LEFT JOIN 
  departments d 
ON 
  e.department_id = d.id
GROUP BY 
  e.department_id, d.name;
  `,

  // Query to fetch financial statistics for the previous month
  GET_FINANCIAL_STATS: `
    SELECT 
      SUM(total_expenses) AS previous_month_expenses, 
      SUM(total_salary) AS previous_month_salary, 
      SUM(total_credit) AS previous_month_credit
    FROM financials
    WHERE MONTH(month) = MONTH(CURRENT_DATE - INTERVAL 1 MONTH)
      AND YEAR(month) = YEAR(CURRENT_DATE - INTERVAL 1 MONTH);
  `,

  // Query to fetch current projects
  GET_CURRENT_PROJECTS: `
    SELECT 
      project_name, 
      job_type, 
      department, 
      start_date, 
      end_date, 
      comments 
    FROM projects 
    WHERE CURRENT_DATE BETWEEN start_date AND end_date;
  `,

  // Query to fetch upcoming projects
  GET_UPCOMING_PROJECTS: `
    SELECT 
      project_name, 
      job_type, 
      department, 
      start_date, 
      end_date, 
      comments 
    FROM projects 
    WHERE start_date > CURRENT_DATE;
  `,

  // Query to fetch previous projects
  GET_PREVIOUS_PROJECTS: `
    SELECT 
      project_name, 
      job_type, 
      department, 
      start_date, 
      end_date, 
      comments 
    FROM projects 
    WHERE end_date < CURRENT_DATE;
  `,

  // Query to fetch login data grouped by hourly ranges
  GET_HOURLY_LOGIN_DATA: `
      SELECT 
        CASE 
          WHEN login_time < '09:30:00' THEN '<9:30'
          WHEN login_time BETWEEN '09:30:00' AND '10:00:00' THEN '9:30-10:00'
          WHEN login_time BETWEEN '10:00:00' AND '11:00:00' THEN '10:00-11:00'
          ELSE '>11:00'
        END AS timing, 
        COUNT(*) AS count
      FROM attendance
      WHERE DATE(date) = CURDATE()
      GROUP BY timing;
  `,
  //Query to fetch employee dashboard statistics
  GET_EMPLOYEE_DASHBOARD: `
  SELECT 
    CONCAT(e.first_name, ' ', e.last_name) AS name, e.employee_id, e.gender, e.department_id, e.photo_url,
    e.position,
    e.salary AS salary,
    (SELECT COUNT(*) 
     FROM attendance a 
     WHERE a.employee_id = ? AND DATE(a.date) = CURDATE() AND a.login_time IS NOT NULL) AS attendance_count,
    (SELECT COUNT(*) 
     FROM leavequeries lq 
     WHERE lq.employee_id = ? AND lq.status = 'Approved' AND DATE(lq.created_at) = CURDATE()) AS leave_queries_count,
    (SELECT COUNT(*) 
     FROM leavequeries lq
     WHERE lq.employee_id = ? AND lq.leave_type = 'Sick' AND lq.status = 'Approved' AND DATE(lq.created_at) = CURDATE()) AS sick_leave,
    (SELECT COUNT(*) 
     FROM leavequeries lq
     WHERE lq.employee_id = ? AND lq.leave_type = 'Other' AND lq.status = 'Approved' AND DATE(lq.created_at) = CURDATE()) AS other_absence
  FROM employees e
  WHERE e.employee_id = ?;
`,

  GET_SIDEBAR_MENU: `SELECT sm.label, sm.path, sm.icon
FROM sidebar_menu sm
JOIN sidebar_menu_access sma ON sm.id = sma.sidebar_item_id
WHERE sma.role = ? AND sma.org_id = ?
`,


 
  /////////////////////////////////////////
  GET_EMPLOYEE_COUNT_BY_DEPARTMENT: `
  SELECT 
    d.name AS department_name, 
    COUNT(CASE WHEN e.gender = 'Male' THEN 1 END) AS men,
    COUNT(CASE WHEN e.gender = 'Female' THEN 1 END) AS women
  FROM 
    employees e
  LEFT JOIN 
    departments d 
  ON 
    e.department_id = d.id
  GROUP BY 
    d.name;
`,

  GET_ATTENDANCE_STATUS_COUNT: `
  
SELECT 
    (SELECT COUNT(*) FROM employees) AS totalEmployees,

    -- ✅ Present Employees (Count Each Employee Only Once)
    (SELECT COUNT(DISTINCT employee_id) 
     FROM emp_attendence 
     WHERE DATE(punchin_time) = CURDATE()
        OR DATE(punchout_time) = CURDATE()) AS present,

    -- ✅ Approved Leave Count (No Changes)
    (SELECT COUNT(*) 
     FROM leavequeries 
     WHERE start_date = CURDATE() 
       AND status = 'Approved') AS approved_leave,

    -- ✅ Absent Employees (Total - Present - On Leave)
    ((SELECT COUNT(*) FROM employees) 
     - (SELECT COUNT(DISTINCT employee_id) 
        FROM emp_attendence 
        WHERE DATE(punchin_time) = CURDATE()
           OR DATE(punchout_time) = CURDATE()) 
     - (SELECT COUNT(*) 
        FROM leavequeries 
        WHERE start_date = CURDATE() 
          AND status = 'Approved')) AS absent;

`,

GET_EMPLOYEE_LOGIN_DATA_COUNT:
`WITH FirstPunch AS (
SELECT 
    employee_id, 
    MIN(punchin_time) AS first_punchin_time
FROM emp_attendence
WHERE punchin_time >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) 
GROUP BY employee_id, DATE(punchin_time)  
),
HourlyData AS (
SELECT 
    CONCAT(
        LPAD(HOUR(fp.first_punchin_time), 2, '0'), ':00 - ', 
        LPAD(HOUR(fp.first_punchin_time) + 1, 2, '0'), ':00'
    ) AS punchin_label,
    WEEK(fp.first_punchin_time, 3) AS punchin_week_in_month, -- ✅ Fix weekly calculation
    MONTH(fp.first_punchin_time) AS punchin_month,
    COUNT(CASE WHEN DATE(fp.first_punchin_time) = CURDATE() THEN 1 END) AS daily_count,
    COUNT(*) AS total_count
FROM FirstPunch fp
GROUP BY punchin_label, punchin_week_in_month, punchin_month
)
SELECT 
punchin_label,
daily_count,
SUM(total_count) OVER (PARTITION BY punchin_week_in_month, punchin_month) AS weekly_count, -- ✅ Partition by month and week
SUM(total_count) OVER (PARTITION BY punchin_month) AS monthly_count
FROM HourlyData
ORDER BY STR_TO_DATE(SUBSTRING_INDEX(punchin_label, ' ', 1), '%H');

`,


  GET_EMPLOYEE_SALARY_RANGE:
    `SELECT 
    CASE 
        WHEN salary < 30000 THEN '<30k'
        WHEN salary BETWEEN 30000 AND 50000 THEN '30k-50k'
        WHEN salary BETWEEN 50001 AND 70000 THEN '50k-70k'
        WHEN salary BETWEEN 70001 AND 90000 THEN '70k+'
        ELSE '90k+'
    END AS salary_range,
    COUNT(*) AS count
FROM employees
GROUP BY salary_range
ORDER BY FIELD(salary_range, '<30k', '30k-50k', '50k-70k', '70k+', '90k+');

`
  ,
  GET_EMPLOYEE_BY_DEPARTMENT: `
        SELECT 
            d.name AS department_name, 
            COUNT(CASE WHEN e.gender = 'Male' THEN 1 END) AS men,
            COUNT(CASE WHEN e.gender = 'Female' THEN 1 END) AS women
        FROM 
            employees e
        LEFT JOIN 
            departments d ON e.department_id = d.id
        GROUP BY 
            d.name;
    `,



  GET_EMPLOYEE_PAYROLL:
    `SELECT
  SUM(CASE WHEN card_label = 'Previous Month Credit' THEN card_value ELSE 0 END) AS total_previous_month_credit,
  SUM(CASE WHEN card_label = 'Previous Month Expenses' THEN card_value ELSE 0 END) AS total_previous_month_expenses,
  SUM(CASE WHEN card_label = 'Previous Month Salary' THEN card_value ELSE 0 END) AS total_previous_month_salary
FROM employee_payrolldata
WHERE card_label IN ('Previous Month Credit', 'Previous Month Expenses', 'Previous Month Salary');

`
  ,

};