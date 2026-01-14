const { getTenantPool, sanitizeDbName } = require("../db/tenantPoolManager");
const queries = require("../constants/queries");

async function getTenantPoolForOrgId(orgId) {
  if (!orgId) {
    const err = new Error("orgId required to get tenant pool");
    err.code = "ORG_REQUIRED";
    throw err;
  }
  const dbName = sanitizeDbName(`tenant_${orgId}`);
  return getTenantPool(dbName);
}

const getHolidays = async (orgId) => {
  if (!orgId) throw new Error("orgId is required");
  try {
    const tenantPool = await getTenantPoolForOrgId(orgId);
    const [rows] = await tenantPool.query(queries.GET_HOLIDAYS, [orgId]);
    return rows;
  } catch (error) {
    console.error("❌ getHolidays error:", error);
    throw error;
  }
};

const insertHolidays = async (rows, orgId) => {
  if (!orgId) throw new Error("orgId is required");
  if (!Array.isArray(rows) || rows.length === 0) return 0;

  const values = rows.map((r) => [orgId, r.date, r.occasion, r.type]);

  const tenantPool = await getTenantPoolForOrgId(orgId);
  const conn = await tenantPool.getConnection();
  try {
    await conn.beginTransaction();

    const [result] = await conn.query(queries.INSERT_HOLIDAYS_UPSERT, [values]);

    await conn.commit();
    return result && typeof result.affectedRows === "number"
      ? result.affectedRows
      : rows.length;
  } catch (err) {
    try {
      await conn.rollback();
    } catch (e) {
      console.warn("rollback failed:", e);
    }
    console.error("❌ insertHolidays error:", err);
    throw err;
  } finally {
    try {
      conn.release();
    } catch (e) {}
  }
};

module.exports = { getHolidays, insertHolidays };
