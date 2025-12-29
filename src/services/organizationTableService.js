const db = require("../config");
const adminPool = require("../db/adminPool");
const { getTenantPool, sanitizeDbName } = require("../db/tenantPoolManager");
const fs = require("fs");
const path = require("path");

const {
  GET_ALL_ORGANIZATIONS,
  GET_SIDEBAR_MENU,
  SELECT_ORG_BY_NAME_OR_SUBDOMAIN,
  SELECT_ORG_BY_NAME_OR_SUBDOMAIN_EXCLUDE_ID,
  INSERT_ORGANIZATION,
  DELETE_SIDEBAR_ACCESS_BY_ORG,
  DELETE_ORGANIZATION,
  SELECT_ORG_BY_ID,
  UPDATE_ORGANIZATION,
  CREATE_TENANT_DATABASE_TEMPLATE,
  USE_DATABASE_PREFIX,
} = require("../constants/organizationTableQueries");

const empQueries = require("../constants/empDetailsQueries");
const employeeService = require("./employeeService");

async function runTenantMigrations(dbName) {
  const migrationsDir = path.join(__dirname, "..", "migrations", "tenant");
  if (!fs.existsSync(migrationsDir)) return;
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const usePrefix = USE_DATABASE_PREFIX.replace("{db}", dbName);

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    const trimmed = sql.replace(/^\uFEFF/, "").trim();
    if (!trimmed) continue;
    await adminPool.query(`${usePrefix} ${trimmed}`);
  }
}

async function createTenantDatabaseSchemaWithRetries(orgId, attempts = 4) {
  const baseName = `tenant_${orgId}`;
  const dbName = sanitizeDbName(baseName);
  const createSql = CREATE_TENANT_DATABASE_TEMPLATE.replace("{db}", dbName);

  let lastErr = null;
  for (let i = 0; i < attempts; i++) {
    try {
      await adminPool.query(createSql);
      await runTenantMigrations(dbName);
      await adminPool.query(
        USE_DATABASE_PREFIX.replace("{db}", dbName) + " SELECT 1;"
      );
      return dbName;
    } catch (err) {
      lastErr = err;
      console.warn(
        `[tenant-create] attempt ${i + 1}/${attempts} failed:`,
        err && err.message
      );
      const backoff = Math.min(500 * Math.pow(2, i), 15000);
      await new Promise((r) => setTimeout(r, backoff));
    }
  }
  throw lastErr || new Error("createTenantDatabaseSchema failed after retries");
}

const createOrganization = async (orgData, sidebarAccess) => {
  const conn = await db.getConnection();
  let tenantDbName;
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
      employee_prefix,
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
      employee_prefix,
      0,
    ]);

    const orgId = result.insertId;

    await conn.commit();

    try {
      tenantDbName = await createTenantDatabaseSchemaWithRetries(orgId);
    } catch (tenantErr) {
      try {
        await conn.beginTransaction();
        await conn.execute(DELETE_ORGANIZATION, [orgId]);
        await conn
          .execute(DELETE_SIDEBAR_ACCESS_BY_ORG, [orgId])
          .catch(() => {});
        await conn.commit();
      } catch (cleanupErr) {
        console.error("[createOrganization] cleanup failed:", cleanupErr);
      }
      throw new Error(
        `Failed to create tenant schema: ${tenantErr?.message || tenantErr}`
      );
    }

    if (sidebarAccess && sidebarAccess.length) {
      let tenantConn;
      try {
        const tenantPool = await getTenantPool(tenantDbName);
        tenantConn = await tenantPool.getConnection();
        await tenantConn.beginTransaction();

        const accessValues = sidebarAccess.map(({ sidebar_item_id, role }) => [
          sidebar_item_id,
          role,
          orgId,
        ]);
        const insertSql = `INSERT INTO sidebar_menu_access (sidebar_item_id, role, org_id) VALUES ?`;
        await tenantConn.query(insertSql, [accessValues]);

        await tenantConn.commit();
      } catch (e) {
        if (tenantConn) {
          try {
            await tenantConn.rollback();
          } catch (_) {}
        }
        console.error(
          "[createOrganization] failed to populate tenant sidebar access:",
          e
        );

        try {
          await adminPool.query(`DROP DATABASE IF EXISTS \`${tenantDbName}\``);
          await conn.beginTransaction();
          await conn.execute(DELETE_ORGANIZATION, [orgId]);
          await conn
            .execute(DELETE_SIDEBAR_ACCESS_BY_ORG, [orgId])
            .catch(() => {});
          await conn.commit();
        } catch (cleanupErr) {
          console.error(
            "[createOrganization] cleanup after sidebar insert failed:",
            cleanupErr
          );
        }

        throw new Error(
          `Organization created but failed to populate tenant sidebar access: ${
            e?.message || e
          }`
        );
      } finally {
        if (tenantConn)
          try {
            tenantConn.release();
          } catch (_) {}
      }
    }

    if (admin_email) {
      let tenantConn;
      try {
        await conn.beginTransaction();
        const [orgRowsForUpdate] = await conn.execute(
          empQueries.SELECT_ORG_FOR_UPDATE,
          [orgId]
        );
        const orgRow =
          orgRowsForUpdate && orgRowsForUpdate[0] ? orgRowsForUpdate[0] : null;
        if (!orgRow) {
          throw new Error(
            "Organization not found in master while reserving employee id"
          );
        }
        const newCounter = Number(orgRow.employee_counter || 0) + 1;
        await conn.execute(empQueries.UPDATE_ORG_COUNTER, [newCounter, orgId]);
        await conn.commit();

        const suffix = newCounter;
        const suffixStr = String(suffix).padStart(6, "0");
        const prefix = (orgRow.employee_prefix || "").toUpperCase();
        if (!prefix) {
          throw new Error(
            "Organization employee_prefix missing; cannot generate employee_id"
          );
        }
        const employeeId = `${prefix}-${suffixStr}`;

        const tenantPool = await getTenantPool(tenantDbName);
        tenantConn = await tenantPool.getConnection();
        await tenantConn.beginTransaction();

        await employeeService.addFullEmployeeUsingConnection(
          tenantConn,
          {
            org_id: orgId,
            first_name: first_name || null,
            last_name: last_name || null,
            email: admin_email,
            phone_number: phone_number || null,
            dob: dob || null,
            role: "Admin",
            aadhaar_number: aadhaar_number || null,
            pan_number: pan_number || null,
            employee_type: "Permanent",
            domain: "ADMIN",
            position: "Administrator",
          },
          {
            bypassOrgLimit: true,
            skipOrgLookup: true,
            providedEmployeeId: employeeId,
            providedSuffix: suffix,
            providedOrgName: Name,
          }
        );

        await tenantConn.commit();

        try {
          await employeeService.sendResetEmailAndSave(
            admin_email,
            `${first_name || ""} ${last_name || ""}`,
            { role: "Admin", orgName: Name, platformName: "PULSEWORK" },
            tenantConn
          );
        } catch (mailErr) {
          console.warn(
            "[createOrganization] warning: failed to send reset email:",
            mailErr && (mailErr.stack || mailErr)
          );
        }
      } catch (e) {
        if (tenantConn) {
          try {
            await tenantConn.rollback();
          } catch (_) {}
        }
        console.error(
          "[createOrganization] failed to create admin in tenant DB:",
          e
        );

        try {
          await adminPool.query(`DROP DATABASE IF EXISTS \`${tenantDbName}\``);
          await conn.beginTransaction();
          await conn.execute(DELETE_ORGANIZATION, [orgId]);
          await conn
            .execute(DELETE_SIDEBAR_ACCESS_BY_ORG, [orgId])
            .catch(() => {});
          await conn.commit();
        } catch (cleanupErr) {
          console.error(
            "[createOrganization] cleanup failed after admin creation error:",
            cleanupErr
          );
        }

        throw new Error(
          `Organization created but failed to create admin in tenant DB: ${
            e?.message || e
          }`
        );
      } finally {
        if (tenantConn)
          try {
            tenantConn.release();
          } catch (_) {}
      }
    }

    return { orgId, tenantDbName };
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

const getAllOrganizations = async () => {
  const [orgs] = await db.execute(GET_ALL_ORGANIZATIONS);

  if (!orgs.length) return [];

  const results = [];

  for (const org of orgs) {
    const response = { ...org };

    try {
      const tenantDbName = sanitizeDbName(`tenant_${org.id}`);
      const tenantDb = await getTenantPool(tenantDbName);

      const [adminRows] = await tenantDb.query(
        `
        SELECT
          e.first_name,
          e.last_name,
          e.dob,
          e.phone_number,
          ep.aadhaar_number,
          ep.pan_number
        FROM employees e
        LEFT JOIN employee_personal ep
          ON e.employee_id = ep.employee_id
        WHERE LOWER(e.email) = LOWER(?)
        LIMIT 1
        `,
        [org.admin_email]
      );

      if (adminRows.length) {
        Object.assign(response, adminRows[0]);
      }
    } catch (err) {
      console.warn(
        `[getAllOrganizations] tenant fetch skipped for org ${org.id}:`,
        err.message
      );
    }

    results.push(response);
  }

  return results;
};

const getSidebarMenu = async () => {
  const [rows] = await db.execute(GET_SIDEBAR_MENU);
  return rows;
};

const getSidebarAccessByOrg = async (orgId) => {
  const tenantDbName = sanitizeDbName(`tenant_${orgId}`);
  const tenantPool = await getTenantPool(tenantDbName);

  const [accessRows] = await tenantPool.execute(
    `
    SELECT sidebar_item_id, role
    FROM sidebar_menu_access
    WHERE org_id = ?
  `,
    [orgId]
  );

  if (!accessRows.length) return [];

  const sidebarItemIds = accessRows.map((r) => r.sidebar_item_id);

  const [menuRows] = await db.query(
    `
    SELECT id, label, path, icon
    FROM sidebar_menu
    WHERE id IN (?)
  `,
    [sidebarItemIds]
  );

  return accessRows.map((access) => {
    const menu = menuRows.find((m) => m.id === access.sidebar_item_id);
    return {
      sidebar_item_id: access.sidebar_item_id,
      role: access.role,
      label: menu?.label || null,
      path: menu?.path || null,
      icon: menu?.icon || null,
    };
  });
};

const updateOrganization = async (id, orgData, sidebarAccess) => {
  const conn = await db.getConnection();
  let tenantConn = null;
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
      employee_prefix,
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

    const [orgRows] = await conn.execute(SELECT_ORG_BY_ID, [id]);
    const currentOrg = orgRows && orgRows[0] ? orgRows[0] : null;
    if (!currentOrg) {
      throw new Error("Organization not found");
    }
    const oldPrefix = (currentOrg.employee_prefix || "").toUpperCase();
    const newPrefix = (employee_prefix || "").toUpperCase();

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
      newPrefix,
      id,
    ]);

    const tenantDbName = sanitizeDbName(`tenant_${id}`);
    const tenantPool = await getTenantPool(tenantDbName);
    tenantConn = await tenantPool.getConnection();
    await tenantConn.beginTransaction();

    await tenantConn.execute(
      `DELETE FROM sidebar_menu_access WHERE org_id = ?`,
      [id]
    );

    if (sidebarAccess && sidebarAccess.length) {
      const accessValues = sidebarAccess.map(({ sidebar_item_id, role }) => [
        sidebar_item_id,
        role,
        id,
      ]);
      await tenantConn.query(
        `INSERT INTO sidebar_menu_access (sidebar_item_id, role, org_id) VALUES ?`,
        [accessValues]
      );
    }

    if (oldPrefix !== newPrefix) {
      await tenantConn.execute(empQueries.UPDATE_EMPLOYEE_IDS_BY_ORG, [
        newPrefix,
        id,
      ]);
    }

    await tenantConn.commit();

    await conn.commit();
    return { success: true };
  } catch (err) {
    if (tenantConn) {
      try {
        await tenantConn.rollback();
      } catch (trollErr) {
        console.warn("[updateOrganization] tenant rollback failed:", trollErr);
      }
    }
    try {
      await conn.rollback();
    } catch (mrollErr) {
      console.warn("[updateOrganization] master rollback failed:", mrollErr);
    }

    if (err && err.code === "ER_NO_SUCH_TABLE") {
      const e = new Error(
        `Tenant schema problem: ${err.sqlMessage || err.message}`
      );
      e.code = err.code;
      throw e;
    }

    throw err;
  } finally {
    if (tenantConn) {
      try {
        tenantConn.release();
      } catch (e) {
        console.warn("Failed to release tenantConn:", e && e.message);
      }
    }
    try {
      conn.release();
    } catch (e) {
      console.warn("Failed to release master conn:", e && e.message);
    }
  }
};

const deleteOrganization = async (id) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute(DELETE_SIDEBAR_ACCESS_BY_ORG, [id]);
    const tenantDbName = sanitizeDbName(`tenant_${id}`);
    await adminPool.query(`DROP DATABASE IF EXISTS \`${tenantDbName}\``);
    const [result] = await conn.execute(DELETE_ORGANIZATION, [id]);
    if (result.affectedRows === 0) throw new Error("Organization not found");
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
  getSidebarMenu,
  createOrganization,
  updateOrganization,
  deleteOrganization,
};
