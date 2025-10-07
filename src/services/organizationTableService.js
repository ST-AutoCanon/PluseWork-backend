const db = require("../config");
const {
  GET_ALL_ORGANIZATIONS,
  GET_SIDEBAR_ACCESS_BY_ORG,
  GET_SIDEBAR_MENU,
  INSERT_ORGANIZATION,
  UPDATE_ORGANIZATION,
  DELETE_SIDEBAR_ACCESS_BY_ORG,
  INSERT_SIDEBAR_ACCESS,
  DELETE_ORGANIZATION,
} = require("../constants/organizationTableQueries");
const employeeService = require("./employeeService");

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
      Name,
      subdomain,
      no_employees,
      company_address,
      c_pan_no,
      admin_email,
      first_name,
      last_name,
      contact_email_id,
      contact_phone_no,
      start_date,
      end_date,
    } = orgData;

    const [result] = await conn.execute(INSERT_ORGANIZATION, [
      Name,
      subdomain,
      no_employees,
      company_address,
      c_pan_no,
      admin_email,
      contact_email_id,
      contact_phone_no,
      start_date,
      end_date,
    ]);

    const orgId = result.insertId;

    if (sidebarAccess && sidebarAccess.length) {
      const accessValues = sidebarAccess.map(({ sidebar_item_id, role }) => [
        sidebar_item_id,
        role,
        orgId,
      ]);
      await conn.query(INSERT_SIDEBAR_ACCESS, [accessValues]);
    }

    await conn.commit();

    try {
      const adminEmail = admin_email;
      if (adminEmail) {
        const empPayload = {
          first_name: first_name,
          last_name: last_name,
          email: adminEmail,
          phone_number: contact_phone_no,
          dob: "1970-01-01",
          role: "Admin",
          org_id: orgId,
        };

        await employeeService.addFullEmployee(empPayload);
      } else {
        console.warn(
          "[createOrganization] no admin email provided, skipping employee creation"
        );
      }
    } catch (empErr) {
      console.warn(
        "[createOrganization] warning: failed creating admin employee or sending reset email:",
        empErr && (empErr.stack || empErr)
      );
    }

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
      Name,
      subdomain,
      no_employees,
      company_address,
      c_pan_no,
      admin_email,
      contact_email_id,
      contact_phone_no,
      start_date,
      end_date,
    } = orgData;

    await conn.execute(UPDATE_ORGANIZATION, [
      Name,
      subdomain,
      no_employees,
      company_address,
      c_pan_no,
      admin_email,
      contact_email_id,
      contact_phone_no,
      start_date,
      end_date,
      id,
    ]);

    await conn.execute(DELETE_SIDEBAR_ACCESS_BY_ORG, [id]);

    if (sidebarAccess && sidebarAccess.length) {
      const accessValues = sidebarAccess.map(({ sidebar_item_id, role }) => [
        sidebar_item_id,
        role,
        id,
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

const deleteOrganization = async (id) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Delete related sidebar access records
    await conn.execute(DELETE_SIDEBAR_ACCESS_BY_ORG, [id]);

    // Delete the organization
    const [result] = await conn.execute(DELETE_ORGANIZATION, [id]);

    if (result.affectedRows === 0) {
      throw new Error("Organization not found");
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
  deleteOrganization,
};
