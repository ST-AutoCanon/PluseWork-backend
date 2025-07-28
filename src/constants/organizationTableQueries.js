// // // constants/organizationTableQueries.js

// // const GET_ALL_ORGANIZATIONS = `
// //   SELECT 
// //     id, Name, subdomain, created_at, no_employees,
// //     company_address, c_pan_no, admin_email,
// //     contact_email_id, contact_phone_no, start_date, end_date
// //   FROM PULSEWORK.Organizations
// // `;

// // module.exports = {
// //   GET_ALL_ORGANIZATIONS,
// // };

// const GET_ALL_ORGANIZATIONS = `
//   SELECT 
//     id, Name, subdomain, created_at, no_employees,
//     company_address, c_pan_no, admin_email,
//     contact_email_id, contact_phone_no, start_date, end_date
//   FROM PULSEWORK.Organizations
// `;

// const INSERT_ORGANIZATION = `
//   INSERT INTO PULSEWORK.Organizations
//     (Name, subdomain, no_employees, company_address, c_pan_no,
//      admin_email, contact_email_id, contact_phone_no, start_date, end_date)
//   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
// `;

// const UPDATE_ORGANIZATION = `
//   UPDATE PULSEWORK.Organizations
//   SET Name = ?, subdomain = ?, no_employees = ?, company_address = ?,
//       c_pan_no = ?, admin_email = ?, contact_email_id = ?, contact_phone_no = ?,
//       start_date = ?, end_date = ?
//   WHERE id = ?
// `;

// const INSERT_SIDEBAR_ACCESS = `
//   INSERT INTO PULSEWORK.sidebar_menu_access
//     (sidebar_item_id, role, org_id)
//   VALUES (?, ?, ?)
// `;

// const UPDATE_SIDEBAR_ACCESS = `
//   UPDATE PULSEWORK.sidebar_menu_access
//   SET sidebar_item_id = ?, role = ?, org_id = ?
//   WHERE id = ?
// `;

// module.exports = {
//   GET_ALL_ORGANIZATIONS,
//   INSERT_ORGANIZATION,
//   UPDATE_ORGANIZATION,
//   INSERT_SIDEBAR_ACCESS,
//   UPDATE_SIDEBAR_ACCESS,
// };

const GET_ALL_ORGANIZATIONS = `
  SELECT 
    id, Name, subdomain, created_at, no_employees,
    company_address, c_pan_no, admin_email,
    contact_email_id, contact_phone_no, start_date, end_date
  FROM PULSEWORK.Organizations
`;

const INSERT_ORGANIZATION = `
  INSERT INTO PULSEWORK.Organizations 
    (Name, subdomain, created_at, no_employees, company_address, c_pan_no, admin_email, contact_email_id, contact_phone_no, start_date, end_date)
  VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?, ?, ?)
`;

const UPDATE_ORGANIZATION = `
  UPDATE PULSEWORK.Organizations SET
    Name = ?, subdomain = ?, no_employees = ?, company_address = ?, c_pan_no = ?, 
    admin_email = ?, contact_email_id = ?, contact_phone_no = ?, start_date = ?, end_date = ?
  WHERE id = ?
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
  GET_SIDEBAR_ACCESS_BY_ORG,
  INSERT_ORGANIZATION,
  GET_SIDEBAR_MENU,
  UPDATE_ORGANIZATION,
  DELETE_SIDEBAR_ACCESS_BY_ORG,
  INSERT_SIDEBAR_ACCESS,
};
