const adminPool = require("../db/adminPool");
const { getTenantPool } = require("../db/tenantPoolManager");

async function tenantResolver(req, res, next) {
  try {
    const host = req.hostname || req.headers.host || "";
    const subdomain = host.split(".")[0];
    if (!subdomain)
      return res.status(400).json({ message: "Cannot determine subdomain" });

    const [rows] = await adminPool.execute(
      "SELECT id, name, subdomain FROM organizations WHERE subdomain = ?",
      [subdomain]
    );
    const org = rows && rows[0] ? rows[0] : null;
    if (!org)
      return res.status(404).json({ message: "Organization not found" });

    req.org = org;
    const dbName = `tenant_${org.id}`;
    req.tenantDbName = dbName;
    req.tenantPool = await getTenantPool(dbName);
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = tenantResolver;
