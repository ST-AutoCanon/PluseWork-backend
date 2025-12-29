const GET_ALL_ORGANIZATIONS = `
SELECT
  id,
  name,
  subdomain,
  created_at,
  no_employees,
  company_address,
  c_pan_no,
  admin_email,
  contact_email_id,
  contact_phone_no,
  DATE_FORMAT(start_date, '%Y-%m-%d') AS start_date,
  DATE_FORMAT(end_date, '%Y-%m-%d') AS end_date,
  employee_prefix,
  employee_counter
FROM organizations;
`;

const SELECT_ORG_BY_NAME_OR_SUBDOMAIN = `
SELECT id, name, subdomain
FROM organizations
WHERE Name = ? OR subdomain = ?
`;

const SELECT_ORG_BY_NAME_OR_SUBDOMAIN_EXCLUDE_ID = `
SELECT id, name, subdomain
FROM organizations
WHERE (Name = ? OR subdomain = ?) AND id != ?
`;

const INSERT_ORGANIZATION = `
INSERT INTO organizations
  (name, subdomain, created_at, no_employees, company_address, c_pan_no, admin_email, contact_email_id, contact_phone_no, start_date, end_date, employee_prefix, employee_counter)
VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

const SELECT_ORG_BY_ID = `
SELECT id, name, subdomain, employee_prefix, employee_counter, no_employees
FROM organizations
WHERE id = ?
`;

const UPDATE_ORGANIZATION = `
UPDATE organizations SET
  name = ?, subdomain = ?, no_employees = ?, company_address = ?, c_pan_no = ?,
  admin_email = ?, contact_email_id = ?, contact_phone_no = ?, start_date = ?, end_date = ?, employee_prefix = ?
WHERE id = ?
`;

const DELETE_ORGANIZATION = `
DELETE FROM organizations WHERE id = ?
`;

const DELETE_ALL_EMPLOYEES = `
DELETE FROM employees WHERE org_id = ?
`;

const DELETE_SIDEBAR_ACCESS_BY_ORG = `
  DELETE FROM sidebar_menu_access WHERE org_id = ?
`;

const INSERT_SIDEBAR_ACCESS = `
  INSERT INTO sidebar_menu_access (sidebar_item_id, role, org_id) VALUES ?
`;

const GET_SIDEBAR_MENU = `
  SELECT id, label, path, icon
  FROM sidebar_menu
`;

const GET_ORGS_ENDING_IN_DAYS = `
  SELECT id, name, admin_email, end_date
  FROM organizations
  WHERE end_date = DATE_ADD(CURDATE(), INTERVAL ? DAY)
`;

const SELECT_EMPLOYEE_ID_BY_EMAIL = `
  SELECT employee_id
  FROM employees
  WHERE email = ?
    AND org_id = ?
    AND status = 'Active'
  LIMIT 1
`;

const CREATE_TENANT_DATABASE_TEMPLATE = `
CREATE DATABASE IF NOT EXISTS \`{db}\`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_general_ci;
`;

const USE_DATABASE_PREFIX = `USE \`{db}\`; `;

const SELECT_ORG_BY_SUBDOMAIN = `
  SELECT id, name, subdomain
  FROM organizations
  WHERE subdomain = ?
  LIMIT 1
`;

module.exports = {
  GET_ALL_ORGANIZATIONS,
  SELECT_ORG_BY_NAME_OR_SUBDOMAIN,
  SELECT_ORG_BY_NAME_OR_SUBDOMAIN_EXCLUDE_ID,
  INSERT_ORGANIZATION,
  SELECT_ORG_BY_ID,
  UPDATE_ORGANIZATION,
  DELETE_ORGANIZATION,
  DELETE_SIDEBAR_ACCESS_BY_ORG,
  INSERT_SIDEBAR_ACCESS,
  GET_SIDEBAR_MENU,
  DELETE_ALL_EMPLOYEES,
  GET_ORGS_ENDING_IN_DAYS,
  SELECT_EMPLOYEE_ID_BY_EMAIL,
  CREATE_TENANT_DATABASE_TEMPLATE,
  USE_DATABASE_PREFIX,
  SELECT_ORG_BY_SUBDOMAIN,
};
