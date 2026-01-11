module.exports = {
  GET_ADMIN_BY_EMAIL: `
    SELECT
      au.id AS admin_id,
      au.email,
      au.password_hash AS password,
      au.name,
      au.role_id,
      ur.name AS role_name
    FROM admin_users au
    LEFT JOIN user_roles ur ON au.role_id = ur.id
    WHERE au.email = ?
    LIMIT 1;
  `,

  GET_USER_BY_EMAIL: `
    SELECT
      pr.role,
      e.employee_id,
      e.org_id,
      CONCAT(e.first_name, ' ', e.last_name) AS name,
      p.gender,
      e.email,
      e.password,
      pr.position,
      pr.department_id,
      e.status,
      d.name AS department
    FROM employees e
    LEFT JOIN employee_personal p
      ON e.employee_id = p.employee_id
    LEFT JOIN employee_professional pr
      ON e.employee_id = pr.employee_id
    LEFT JOIN departments d
      ON pr.department_id = d.id
    WHERE e.email = ?;
  `,

  GET_END_DATE: `SELECT id, name, start_date, end_date FROM organizations WHERE id = ?`,

  GET_ORG_ID_NAME_LIST: `
    SELECT id, name
    FROM organizations
    ORDER BY name
  `,

  SELECT_ORG_ID_BY_PREFIX: `
    SELECT id
    FROM organizations
    WHERE UPPER(employee_prefix) = ?
    LIMIT 1
  `,

  GET_SIDEBAR_ACCESS_BY_ROLE: `
    SELECT sidebar_item_id
    FROM sidebar_menu_access
    WHERE org_id = ? AND role = ?
    ORDER BY sidebar_item_id
  `,

  GET_SIDEBAR_MENU_BY_IDS: `
    SELECT id, label, path, icon
    FROM sidebar_menu
    WHERE id IN (?)
  `,

  GET_EMPLOYEE_COUNT_BY_DEPARTMENT: `
    SELECT
      d.name AS department_name,
      COUNT(CASE WHEN p.gender = 'Male' THEN 1 END) AS men,
      COUNT(CASE WHEN p.gender = 'Female' THEN 1 END) AS women
    FROM employee_professional pr
    LEFT JOIN departments d
      ON pr.department_id = d.id
    LEFT JOIN employee_personal p
      ON pr.employee_id = p.employee_id
    JOIN employees e ON pr.employee_id = e.employee_id
    WHERE e.org_id = ?
    GROUP BY d.name;
  `,

  GET_ATTENDANCE_STATUS_COUNT: `
  SELECT
    (SELECT COUNT(*) FROM employees WHERE org_id = ?) AS totalEmployees,
    (SELECT COUNT(DISTINCT a.employee_id)
     FROM emp_attendence a
     JOIN employees e2 ON a.employee_id = e2.employee_id
     WHERE DATE(a.punchin_time) = CURDATE()
       AND a.punchin_time IS NOT NULL
       AND e2.org_id = ?) AS present,
    (SELECT COUNT(*)
     FROM leavequeries lq
     JOIN employees le ON lq.employee_id = le.employee_id
     WHERE DATE(lq.start_date) = CURDATE()
       AND lq.status = 'Approved'
       AND le.org_id = ?) AS approved_leave;
`,

  GET_EMPLOYEE_LOGIN_DATA_COUNT: `WITH FirstPunch AS (
    SELECT 
        a.employee_id, 
        MIN(a.punchin_time) AS first_punchin_time,
        DATE(a.punchin_time) AS punchin_date
    FROM emp_attendence a
    JOIN employees e ON a.employee_id = e.employee_id
    WHERE a.punchin_time >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH)
      AND e.org_id = ?
    GROUP BY a.employee_id, DATE(a.punchin_time)
),
HourlyData AS (
    SELECT 
        CONCAT(
            LPAD(HOUR(fp.first_punchin_time), 2, '0'), ':00 - ', 
            LPAD(HOUR(fp.first_punchin_time) + 1, 2, '0'), ':00'
        ) AS punchin_label,
        WEEK(fp.first_punchin_time, 3) AS punchin_week_in_month,
        MONTH(fp.first_punchin_time) AS punchin_month,
        COUNT(CASE WHEN DATE(fp.first_punchin_time) = CURDATE() THEN 1 END) AS daily_count,
        COUNT(*) AS total_count
    FROM FirstPunch fp
    GROUP BY punchin_label, punchin_week_in_month, punchin_month
)
SELECT 
    punchin_label,
    daily_count,
    SUM(total_count) OVER (PARTITION BY punchin_week_in_month, punchin_month) AS weekly_count,
    SUM(total_count) OVER (PARTITION BY punchin_month) AS monthly_count
FROM HourlyData
ORDER BY STR_TO_DATE(SUBSTRING_INDEX(punchin_label, ' ', 1), '%H');
`,

  GET_EMPLOYEE_SALARY_RANGE: `
    SELECT
      CASE
        WHEN pr.salary < 30000 THEN '<30k'
        WHEN pr.salary BETWEEN 30000 AND 50000 THEN '30k-50k'
        WHEN pr.salary BETWEEN 50001 AND 70000 THEN '50k-70k'
        WHEN pr.salary BETWEEN 70001 AND 90000 THEN '70k+'
        ELSE '90k+'
      END AS salary_range,
      COUNT(*) AS count
    FROM employee_professional pr
    JOIN employees e ON pr.employee_id = e.employee_id
    WHERE e.org_id = ?
    GROUP BY salary_range
    ORDER BY FIELD(salary_range, '<30k', '30k-50k', '50k-70k', '70k+', '90k+');
  `,

  GET_EMPLOYEE_PAYROLL: `
    SELECT
      SUM(CASE WHEN card_label = 'Previous Month Credit' THEN card_value ELSE 0 END) AS total_previous_month_credit,
      SUM(CASE WHEN card_label = 'Previous Month Expenses' THEN card_value ELSE 0 END) AS total_previous_month_expenses,
      SUM(CASE WHEN card_label = 'Previous Month Salary' THEN card_value ELSE 0 END) AS total_previous_month_salary
    FROM employee_payrolldata pd
    JOIN employees e ON pd.employee_id = e.employee_id
    WHERE e.org_id = ?
      AND card_label IN ('Previous Month Credit', 'Previous Month Expenses', 'Previous Month Salary');
  `,

  GET_LEAVE_QUERIES_IN_DASHBOARD: `
    SELECT
      leave_type AS 'Leave Type',
      start_date AS 'Start Date',
      end_date AS 'End Date',
      H_F_day AS 'Half/Full Day',
      reason AS 'Reason',
      status AS 'Status',
      comments AS 'Comments'
    FROM leavequeries
    WHERE employee_id = ?
    ORDER BY created_at DESC
    LIMIT 5;
  `,

  GET_REIMBURSEMENT_STATS: `
    SELECT
      SUM(CASE WHEN status = 'Approved'
               AND MONTH(approved_date) = MONTH(CURRENT_DATE)
               AND YEAR(approved_date) = YEAR(CURRENT_DATE) THEN 1 ELSE 0 END) AS current_approved,
      SUM(CASE WHEN status = 'Pending'
               AND MONTH(created_at) = MONTH(CURRENT_DATE)
               AND YEAR(created_at) = YEAR(CURRENT_DATE) THEN 1 ELSE 0 END) AS current_pending,
      SUM(CASE WHEN status = 'Rejected'
               AND MONTH(created_at) = MONTH(CURRENT_DATE)
               AND YEAR(created_at) = YEAR(CURRENT_DATE) THEN 1 ELSE 0 END) AS current_rejected,
      COUNT(CASE WHEN MONTH(created_at) = MONTH(CURRENT_DATE)
                 AND YEAR(created_at) = YEAR(CURRENT_DATE) THEN 1 END) AS current_submitted,
      SUM(CASE WHEN status = 'Approved'
               AND MONTH(approved_date) = MONTH(CURRENT_DATE - INTERVAL 1 MONTH)
               AND YEAR(approved_date) = YEAR(CURRENT_DATE - INTERVAL 1 MONTH) THEN 1 ELSE 0 END) AS prev_approved,
      SUM(CASE WHEN status = 'Pending'
               AND MONTH(created_at) = MONTH(CURRENT_DATE - INTERVAL 1 MONTH)
               AND YEAR(created_at) = YEAR(CURRENT_DATE - INTERVAL 1 MONTH) THEN 1 ELSE 0 END) AS prev_pending,
      SUM(CASE WHEN status = 'Rejected'
               AND MONTH(created_at) = MONTH(CURRENT_DATE - INTERVAL 1 MONTH)
               AND YEAR(created_at) = YEAR(CURRENT_DATE - INTERVAL 1 MONTH) THEN 1 ELSE 0 END) AS prev_rejected,
      COUNT(CASE WHEN MONTH(created_at) = MONTH(CURRENT_DATE - INTERVAL 1 MONTH)
                 AND YEAR(created_at) = YEAR(CURRENT_DATE - INTERVAL 1 MONTH) THEN 1 END) AS prev_submitted
    FROM reimbursement
    WHERE employee_id = ?;
  `,
  GET_SIDEBAR_MENU: `SELECT sm.label, sm.path, sm.icon
FROM sidebar_menu sm
JOIN sidebar_menu_access sma ON sm.id = sma.sidebar_item_id
WHERE sma.role = ? AND sma.org_id = ?`,
};