const mysql = require("mysql2/promise");
require("dotenv").config();

const poolCache = new Map();
const MAX_POOLS = parseInt(process.env.TENANT_POOL_CACHE_MAX || "50", 10);

function sanitizeDbName(name) {
  return String(name).replace(/[^0-9A-Za-z_-]/g, "_");
}

async function createPoolForTenant(dbName) {
  const sanitized = sanitizeDbName(dbName);
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: sanitized,
    waitForConnections: true,
    connectionLimit: parseInt(
      process.env.TENANT_POOL_CONNECTION_LIMIT || "6",
      10
    ),
    queueLimit: 100,
    connectTimeout: parseInt(
      process.env.TENANT_POOL_CONNECT_TIMEOUT || "15000",
      10
    ),
  });
  return pool;
}

function evictIfNeeded() {
  if (poolCache.size <= MAX_POOLS) return;
  const oldestKey = poolCache.keys().next().value;
  const entry = poolCache.get(oldestKey);
  if (entry && entry.pool && typeof entry.pool.end === "function") {
    entry.pool.end().catch(() => {});
  }
  poolCache.delete(oldestKey);
}

async function getTenantPool(dbName) {
  const sanitized = sanitizeDbName(dbName);
  if (poolCache.has(sanitized)) return poolCache.get(sanitized).pool;
  const pool = await createPoolForTenant(sanitized);
  poolCache.set(sanitized, { pool, createdAt: Date.now() });
  evictIfNeeded();
  return pool;
}

async function destroyTenantPool(dbName) {
  const sanitized = sanitizeDbName(dbName);
  const entry = poolCache.get(sanitized);
  if (entry && entry.pool) {
    await entry.pool.end();
    poolCache.delete(sanitized);
  }
}

const masterDb = require("../config");

async function getTenantPoolByOrgId(orgId) {
  const [rows] = await masterDb.query(
    `SELECT db_name FROM organizations WHERE id = ?`,
    [orgId]
  );

  if (!rows.length || !rows[0].db_name) {
    throw new Error(`Tenant database not found for org_id ${orgId}`);
  }

  return getTenantPool(rows[0].db_name);
}

module.exports = {
  getTenantPool,
  getTenantPoolByOrgId,
  destroyTenantPool,
  sanitizeDbName,
};
