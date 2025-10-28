// constants/organizationTableQueries.js
const GET_ALL_ORGANIZATIONS = `
SELECT 
  o.id,
  o.Name,
  o.subdomain,
  o.created_at,
  o.no_employees,
  o.company_address,
  o.c_pan_no,
  o.admin_email,
  e.first_name,
  e.last_name,
  e.dob,
  e.phone_number,
  ep.aadhaar_number,
  ep.pan_number,
  o.contact_email_id,
  o.contact_phone_no,
  o.start_date,
  o.end_date,
  o.employee_prefix,
  o.employee_counter
FROM Organizations o
LEFT JOIN employees e
  ON LOWER(o.admin_email) = LOWER(e.email)
LEFT JOIN employee_personal ep
  ON e.employee_id = ep.employee_id;
`;

const SELECT_ORG_BY_NAME_OR_SUBDOMAIN = `
SELECT id, Name, subdomain
FROM Organizations
WHERE Name = ? OR subdomain = ?
`;

const SELECT_ORG_BY_NAME_OR_SUBDOMAIN_EXCLUDE_ID = `
SELECT id, Name, subdomain
FROM Organizations
WHERE (Name = ? OR subdomain = ?) AND id != ?
`;

const INSERT_ORGANIZATION = `
INSERT INTO Organizations
  (Name, subdomain, created_at, no_employees, company_address, c_pan_no, admin_email, contact_email_id, contact_phone_no, start_date, end_date, employee_prefix, employee_counter)
VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

const SELECT_ORG_BY_ID = `
SELECT id, Name, subdomain, employee_prefix, employee_counter, no_employees
FROM Organizations
WHERE id = ?
`;

const UPDATE_ORGANIZATION = `
UPDATE Organizations SET
  Name = ?, subdomain = ?, no_employees = ?, company_address = ?, c_pan_no = ?,
  admin_email = ?, contact_email_id = ?, contact_phone_no = ?, start_date = ?, end_date = ?, employee_prefix = ?
WHERE id = ?
`;

const DELETE_ORGANIZATION = `
DELETE FROM Organizations WHERE id = ?
`;

const GET_SIDEBAR_ACCESS_BY_ORG = `
  SELECT 
    a.sidebar_item_id,
    b.label,
    b.path,
    b.icon,
    a.role
  FROM sidebar_menu_access a
  JOIN sidebar_menu b ON a.sidebar_item_id = b.id
  WHERE a.org_id = ?
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

module.exports = {
  GET_ALL_ORGANIZATIONS,
  SELECT_ORG_BY_NAME_OR_SUBDOMAIN,
  SELECT_ORG_BY_NAME_OR_SUBDOMAIN_EXCLUDE_ID,
  INSERT_ORGANIZATION,
  SELECT_ORG_BY_ID,
  UPDATE_ORGANIZATION,
  DELETE_ORGANIZATION,
  GET_SIDEBAR_ACCESS_BY_ORG,
  DELETE_SIDEBAR_ACCESS_BY_ORG,
  INSERT_SIDEBAR_ACCESS,
  GET_SIDEBAR_MENU,
};
