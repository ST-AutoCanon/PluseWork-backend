const db = require("../config");
const {
  GET_ALL_ORGANIZATIONS,
  GET_SIDEBAR_ACCESS_BY_ORG,
  GET_SIDEBAR_MENU,
  INSERT_ORGANIZATION,
  SELECT_ORG_BY_NAME_OR_SUBDOMAIN,
  SELECT_ORG_BY_NAME_OR_SUBDOMAIN_EXCLUDE_ID,
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
      dob,
      aadhaar_number,
      pan_number,
      phone_number,
      contact_email_id,
      contact_phone_no,
      start_date,
      end_date,
    } = orgData;

    const [existingRows] = await conn.execute(SELECT_ORG_BY_NAME_OR_SUBDOMAIN, [
      Name,
      subdomain,
    ]);

    if (existingRows && existingRows.length > 0) {
      const conflicts = new Set();
      for (const row of existingRows) {
        if (row.Name === Name) conflicts.add("Name");
        if (row.subdomain === subdomain) conflicts.add("subdomain");
      }

      const conflictMsgs = [];
      if (conflicts.has("Name"))
        conflictMsgs.push("Organization Name already exists.");
      if (conflicts.has("subdomain"))
        conflictMsgs.push("Subdomain already exists.");
      const message = conflictMsgs.join(" ");

      const err = new Error(
        message || "Organization with same Name/subdomain exists."
      );
      err.status = 409;
      throw err;
    }

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
          phone_number: phone_number,
          dob: dob,
          role: "Admin",
          aadhaar_number: aadhaar_number,
          pan_number: pan_number,
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
    if (err && err.code === "ER_DUP_ENTRY") {
      const dupErr = new Error("Duplicate entry for Name or subdomain.");
      dupErr.status = 409;
      try {
        await conn.rollback();
      } catch (rerr) {
        console.error("Rollback failed after ER_DUP_ENTRY:", rerr);
      }
      throw dupErr;
    }

    try {
      await conn.rollback();
    } catch (rollbackErr) {
      console.error("Rollback failed:", rollbackErr);
    }

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

    const [existingRows] = await conn.execute(
      SELECT_ORG_BY_NAME_OR_SUBDOMAIN_EXCLUDE_ID,
      [Name, subdomain, id]
    );

    if (existingRows && existingRows.length > 0) {
      const conflicts = new Set();
      for (const row of existingRows) {
        if (row.Name === Name) conflicts.add("Name");
        if (row.subdomain === subdomain) conflicts.add("subdomain");
      }

      const msgs = [];
      if (conflicts.has("Name")) msgs.push("Organization Name already exists.");
      if (conflicts.has("subdomain")) msgs.push("Subdomain already exists.");
      const message =
        msgs.join(" ") || "Organization Name or subdomain conflict.";

      const err = new Error(message);
      err.status = 409;
      throw err;
    }

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
    if (err && err.code === "ER_DUP_ENTRY") {
      const dupErr = new Error("Duplicate entry for Name or subdomain.");
      dupErr.status = 409;
      try {
        await conn.rollback();
      } catch (r) {
        console.error("Rollback failed:", r);
      }
      throw dupErr;
    }

    try {
      await conn.rollback();
    } catch (r) {
      console.error("Rollback failed:", r);
    }
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
