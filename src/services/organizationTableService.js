// // // // services/organizationTableService.js

// // // const db = require("../config"); // assumes db.js is your configured MySQL connection
// // // const { GET_ALL_ORGANIZATIONS } = require("../constants/organizationTableQueries");

// // // const getAllOrganizations = async () => {
// // //   const [rows] = await db.execute(GET_ALL_ORGANIZATIONS);
// // //   return rows;
// // // };

// // // module.exports = {
// // //   getAllOrganizations,
// // // };

// // const db = require("../config"); // assumes db.js is your configured MySQL connection
// // const {
// //   GET_ALL_ORGANIZATIONS,
// //   INSERT_ORGANIZATION,
// //   UPDATE_ORGANIZATION,
// //   INSERT_SIDEBAR_ACCESS,
// //   UPDATE_SIDEBAR_ACCESS,
// // } = require("../constants/organizationTableQueries");

// // const getAllOrganizations = async () => {
// //   const [rows] = await db.execute(GET_ALL_ORGANIZATIONS);
// //   return rows;
// // };

// // const createOrganization = async (orgData) => {
// //   const {
// //     Name, subdomain, no_employees, company_address,
// //     c_pan_no, admin_email, contact_email_id,
// //     contact_phone_no, start_date, end_date,
// //   } = orgData;

// //   const [result] = await db.execute(INSERT_ORGANIZATION, [
// //     Name, subdomain, no_employees, company_address,
// //     c_pan_no, admin_email, contact_email_id,
// //     contact_phone_no, start_date, end_date,
// //   ]);
// //   return result.insertId;
// // };

// // const updateOrganization = async (id, orgData) => {
// //   const {
// //     Name, subdomain, no_employees, company_address,
// //     c_pan_no, admin_email, contact_email_id,
// //     contact_phone_no, start_date, end_date,
// //   } = orgData;

// //   await db.execute(UPDATE_ORGANIZATION, [
// //     Name, subdomain, no_employees, company_address,
// //     c_pan_no, admin_email, contact_email_id,
// //     contact_phone_no, start_date, end_date,
// //     id
// //   ]);
// // };

// // const createSidebarAccess = async (access) => {
// //   const { sidebar_item_id, role, org_id } = access;
// //   const [result] = await db.execute(INSERT_SIDEBAR_ACCESS, [
// //     sidebar_item_id, role, org_id,
// //   ]);
// //   return result.insertId;
// // };

// // const updateSidebarAccess = async (id, access) => {
// //   const { sidebar_item_id, role, org_id } = access;
// //   await db.execute(UPDATE_SIDEBAR_ACCESS, [
// //     sidebar_item_id, role, org_id,
// //     id,
// //   ]);
// // };

// // module.exports = {
// //   getAllOrganizations,
// //   createOrganization,
// //   updateOrganization,
// //   createSidebarAccess,
// //   updateSidebarAccess,
// // };

// const db = require("../config");
// const {
//   GET_ALL_ORGANIZATIONS,
//   INSERT_ORGANIZATION,
//   UPDATE_ORGANIZATION,
//   DELETE_SIDEBAR_ACCESS_BY_ORG,
//   INSERT_SIDEBAR_ACCESS,
// } = require("../constants/organizationTableQueries");

// const getAllOrganizations = async () => {
//   const [rows] = await db.execute(GET_ALL_ORGANIZATIONS);
//   return rows;
// };

// const createOrganization = async (orgData, sidebarAccess) => {
//   const conn = await db.getConnection();
//   try {
//     await conn.beginTransaction();

//     const {
//       Name, subdomain, no_employees, company_address, c_pan_no,
//       admin_email, contact_email_id, contact_phone_no, start_date, end_date
//     } = orgData;

//     const [result] = await conn.execute(INSERT_ORGANIZATION, [
//       Name, subdomain, no_employees, company_address, c_pan_no,
//       admin_email, contact_email_id, contact_phone_no, start_date, end_date
//     ]);

//     const orgId = result.insertId;

//     if (sidebarAccess && sidebarAccess.length) {
//       const accessValues = sidebarAccess.map(({ sidebar_item_id, role }) => [
//         sidebar_item_id, role, orgId
//       ]);
//       await conn.query(INSERT_SIDEBAR_ACCESS, [accessValues]);
//     }

//     await conn.commit();
//     return { orgId };
//   } catch (err) {
//     await conn.rollback();
//     throw err;
//   } finally {
//     conn.release();
//   }
// };

// const { GET_SIDEBAR_ACCESS_BY_ORG } = require("../constants/organizationTableQueries");

// const getSidebarAccessByOrg = async (orgId) => {
//   const [rows] = await db.execute(GET_SIDEBAR_ACCESS_BY_ORG, [orgId]);
//   return rows;
// };

// const updateOrganization = async (id, orgData, sidebarAccess) => {
//   const conn = await db.getConnection();
//   try {
//     await conn.beginTransaction();

//     const {
//       Name, subdomain, no_employees, company_address, c_pan_no,
//       admin_email, contact_email_id, contact_phone_no, start_date, end_date
//     } = orgData;

//     await conn.execute(UPDATE_ORGANIZATION, [
//       Name, subdomain, no_employees, company_address, c_pan_no,
//       admin_email, contact_email_id, contact_phone_no, start_date, end_date, id
//     ]);

//     await conn.execute(DELETE_SIDEBAR_ACCESS_BY_ORG, [id]);

//     if (sidebarAccess && sidebarAccess.length) {
//       const accessValues = sidebarAccess.map(({ sidebar_item_id, role }) => [
//         sidebar_item_id, role, id
//       ]);
//       await conn.query(INSERT_SIDEBAR_ACCESS, [accessValues]);
//     }

//     await conn.commit();
//     return { success: true };
//   } catch (err) {
//     await conn.rollback();
//     throw err;
//   } finally {
//     conn.release();
//   }
// };

// module.exports = {
//   getAllOrganizations,
//   getSidebarAccessByOrg,
//   createOrganization,
//   updateOrganization,
// };


const db = require("../config");
const {
  GET_ALL_ORGANIZATIONS,
  GET_SIDEBAR_ACCESS_BY_ORG,
  GET_SIDEBAR_MENU, // Ensure this is included
  INSERT_ORGANIZATION,
  UPDATE_ORGANIZATION,
  DELETE_SIDEBAR_ACCESS_BY_ORG,
  INSERT_SIDEBAR_ACCESS,
} = require("../constants/organizationTableQueries");

const getAllOrganizations = async () => {
  const [rows] = await db.execute(GET_ALL_ORGANIZATIONS);
  return rows;
};

const getSidebarMenu = async () => {
  const [rows] = await db.execute(GET_SIDEBAR_MENU);
  return rows;
};

const getSidebarAccessByOrg = async (orgId) => {
  const [rows] = await db.execute(GET_SIDEBAR_ACCESS_BY_ORG, [orgId]);
  return rows;
};

const createOrganization = async (orgData, sidebarAccess) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const {
      Name, subdomain, no_employees, company_address, c_pan_no,
      admin_email, contact_email_id, contact_phone_no, start_date, end_date
    } = orgData;

    const [result] = await conn.execute(INSERT_ORGANIZATION, [
      Name, subdomain, no_employees, company_address, c_pan_no,
      admin_email, contact_email_id, contact_phone_no, start_date, end_date
    ]);

    const orgId = result.insertId;

    if (sidebarAccess && sidebarAccess.length) {
      const accessValues = sidebarAccess.map(({ sidebar_item_id, role }) => [
        sidebar_item_id, role, orgId
      ]);
      await conn.query(INSERT_SIDEBAR_ACCESS, [accessValues]);
    }

    await conn.commit();
    return { orgId };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

const updateOrganization = async (id, orgData, sidebarAccess) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const {
      Name, subdomain, no_employees, company_address, c_pan_no,
      admin_email, contact_email_id, contact_phone_no, start_date, end_date
    } = orgData;

    await conn.execute(UPDATE_ORGANIZATION, [
      Name, subdomain, no_employees, company_address, c_pan_no,
      admin_email, contact_email_id, contact_phone_no, start_date, end_date, id
    ]);

    await conn.execute(DELETE_SIDEBAR_ACCESS_BY_ORG, [id]);

    if (sidebarAccess && sidebarAccess.length) {
      const accessValues = sidebarAccess.map(({ sidebar_item_id, role }) => [
        sidebar_item_id, role, id
      ]);
      await conn.query(INSERT_SIDEBAR_ACCESS, [accessValues]);
    }

    await conn.commit();
    return { success: true };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

module.exports = {
  getAllOrganizations,
  getSidebarAccessByOrg,
  getSidebarMenu, // Ensure this is exported
  createOrganization,
  updateOrganization,
};