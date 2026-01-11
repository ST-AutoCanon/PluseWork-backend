const db = require("../config"); // master DB (for org lookup only)
const {
  GET_ASSIGNED_ASSETS_BY_EMPLOYEE,
  SEARCH_EMPLOYEES_BY_NAME,
  INSERT_ASSET,
  GET_ASSETS,
  GET_LAST_ASSET_ID,
  GET_ALL_ASSETS,
  UPDATE_ASSIGNED_TO,
  GET_ASSIGN_DATA,
  UPDATE_RETURN_DATE,
  GET_ASSET_COUNTS,
} = require("../constants/assetsQueries");

const { getTenantPool, sanitizeDbName } = require("../db/tenantPoolManager");

/**
 * Resolve tenant pool for an orgId; throws if orgId missing.
 */
async function getTenantPoolForOrgId(orgId) {
  if (!orgId) {
    const err = new Error("orgId required to get tenant pool");
    err.code = "ORG_REQUIRED";
    throw err;
  }
  const dbName = sanitizeDbName(`tenant_${orgId}`);
  return getTenantPool(dbName);
}

/**
 * Keep master lookup for organization prefix (organization metadata lives in master).
 */
const getOrganizationPrefix = async (orgId) => {
  try {
    const [rows] = await db.execute(
      `SELECT Name, subdomain FROM Organizations WHERE id = ? LIMIT 1`,
      [orgId]
    );

    if (!rows || rows.length === 0) {
      return "STS";
    }

    const { subdomain, Name } = rows[0];

    if (subdomain && String(subdomain).trim().length > 0) {
      const cleaned = String(subdomain)
        .trim()
        .replace(/[^A-Za-z0-9]/g, "")
        .toUpperCase();
      return cleaned.length > 0 ? cleaned : "STS";
    }

    if (Name && String(Name).trim().length > 0) {
      const words = String(Name)
        .trim()
        .replace(/[^A-Za-z0-9\s]/g, "")
        .split(/\s+/)
        .filter(Boolean);

      let acronym = words
        .slice(0, 3)
        .map((w) => w[0])
        .join("")
        .toUpperCase();

      if (acronym.length < 2) {
        acronym = String(Name).trim().slice(0, 3).toUpperCase();
      }
      return acronym;
    }

    return "STS";
  } catch (err) {
    console.error("❌ Error fetching organization for prefix:", err);
    return "STS";
  }
};

/**
 * Get last asset id from tenant DB (uses tenant pool).
 * combinedPrefix example: STS-SYS-LPT
 */
const getLastAssetId = async (orgId, combinedPrefix) => {
  try {
    const likePattern = `${combinedPrefix}-%`;
    const tenantPool = await getTenantPoolForOrgId(orgId);
    const [rows] = await tenantPool.query(GET_LAST_ASSET_ID, [likePattern]);
    if (!rows || rows.length === 0) return `${combinedPrefix}-001`;
    // parse last numeric suffix
    const lastNumber = parseInt(rows[0].asset_id.split("-").pop(), 10);
    return `${combinedPrefix}-${String(lastNumber + 1).padStart(3, "0")}`;
  } catch (error) {
    console.error("❌ Error fetching last asset ID:", error);
    throw new Error("Failed to generate asset ID");
  }
};

/**
 * Compute next asset code (tenant DB).
 * Example returned: ORG-AST-0001
 */
const getLastAssetCode = async (orgId) => {
  try {
    const orgPrefix = await getOrganizationPrefix(orgId);
    const likePattern = `${orgPrefix}-AST-%`;

    const tenantPool = await getTenantPoolForOrgId(orgId);
    const [rows] = await tenantPool.query(
      `
      SELECT asset_code FROM assets
      WHERE asset_code LIKE ? AND org_id = ?
      ORDER BY CAST(SUBSTRING_INDEX(asset_code, '-', -1) AS UNSIGNED) DESC
      LIMIT 1
      `,
      [likePattern, orgId]
    );

    if (!rows || rows.length === 0) {
      return `${orgPrefix}-AST-0001`;
    }

    const lastCode = rows[0].asset_code;
    const lastNum = parseInt(lastCode.split("-").pop(), 10) || 0;
    const nextNum = lastNum + 1;
    return `${orgPrefix}-AST-${String(nextNum).padStart(4, "0")}`;
  } catch (err) {
    console.error("❌ Error computing last asset code:", err);
    return `STS-AST-0001`;
  }
};

/**
 * Insert new asset into tenant DB.
 */
const addAsset = async (orgId, assetData) => {
  try {
    const {
      asset_name,
      configuration,
      valuation_date,
      assigned_to,
      category,
      sub_category,
      status,
      document_path,
    } = assetData;

    const orgPrefix = await getOrganizationPrefix(orgId);

    const categoryPrefixes = {
      Laptop: "SYS-LPT",
      Desktop: "SYS-DEC",
      Server: "SYS-SER",
      Table: "FUR-TBL",
      Chair: "FUR-CHR",
      Drawers: "FUR-DWR",
      Electrical: "EQP-ELE",
      "Non-Electrical": "EQP-NONELE",
      Others: "OTHR",
      cupboard: "FUR-CUPB",
    };

    const categoryPrefix = categoryPrefixes[sub_category] || "OTHR";

    const combinedPrefix = `${orgPrefix}-${categoryPrefix}`;

    const asset_id = await getLastAssetId(orgId, combinedPrefix);

    const asset_code = await getLastAssetCode(orgId);

    const values = [
      orgId,
      asset_id,
      asset_code,
      asset_name || null,
      configuration || null,
      valuation_date || null,
      assigned_to ? JSON.stringify(assigned_to) : null,
      category || null,
      sub_category || null,
      status || "Available",
      document_path || null,
    ];

    const tenantPool = await getTenantPoolForOrgId(orgId);
    const [result] = await tenantPool.query(INSERT_ASSET, values);
    return {
      asset_id,
      insertId: result.insertId,
      asset_code,
      asset_name,
      configuration,
      valuation_date,
      assigned_to,
      category,
      sub_category,
      status,
      document_path,
    };
  } catch (error) {
    console.error("❌ Error inserting asset:", error);
    throw new Error("Failed to add asset");
  }
};

/**
 * Get all assets for tenant.
 */
const getAssets = async (orgId) => {
  try {
    const tenantPool = await getTenantPoolForOrgId(orgId);
    const [rows] = await tenantPool.query(GET_ALL_ASSETS, [orgId]);
    return rows;
  } catch (error) {
    console.error("❌ Database Error:", error);
    throw new Error("Failed to retrieve assets");
  }
};

/**
 * Update assigned_to JSON for an asset (tenant DB).
 * Returns 'not_found'|'updated'|'inserted'
 */
const updateAssignedTo = async (orgId, assetId, assignedTo) => {
  try {
    const tenantPool = await getTenantPoolForOrgId(orgId);

    const [rows] = await tenantPool.query(
      "SELECT assigned_to FROM assets WHERE asset_id = ? AND org_id = ?",
      [assetId, orgId]
    );
    if (rows.length === 0) return "not_found";

    let assignedArray = [];
    if (rows[0].assigned_to) {
      assignedArray = JSON.parse(rows[0].assigned_to);
    }

    const existingIndex = assignedArray.findIndex(
      (entry) =>
        entry.name === assignedTo.name &&
        entry.employeeId === assignedTo.employeeId
    );

    if (existingIndex !== -1) {
      assignedArray[existingIndex] = {
        ...assignedArray[existingIndex],
        returnDate:
          assignedTo.returnDate || assignedArray[existingIndex].returnDate,
        comments: assignedTo.comments || assignedArray[existingIndex].comments,
        status: assignedTo.status || assignedArray[existingIndex].status,
      };
      const updatedJson = JSON.stringify(assignedArray);
      await tenantPool.query(
        "UPDATE assets SET assigned_to = ? WHERE asset_id = ? AND org_id = ?",
        [updatedJson, assetId, orgId]
      );
      return "updated";
    } else {
      assignedArray.push(assignedTo);
      const updatedJson = JSON.stringify(assignedArray);
      await tenantPool.query(
        "UPDATE assets SET assigned_to = ? WHERE asset_id = ? AND org_id = ?",
        [updatedJson, assetId, orgId]
      );
      return "inserted";
    }
  } catch (error) {
    console.error("❌ Database Error:", error);
    throw new Error("Failed to update asset assignment");
  }
};

/**
 * Get assignment data for asset (tenant DB).
 */
const getAssignmentData = async (orgId, assetId) => {
  try {
    const tenantPool = await getTenantPoolForOrgId(orgId);
    const [rows] = await tenantPool.query(GET_ASSIGN_DATA, [assetId, orgId]);
    return rows;
  } catch (error) {
    console.error("Error fetching assignment data:", error);
    throw error;
  }
};

/**
 * Update return date on tenant asset assigned_to JSON.
 */
const updateReturnDate = async (orgId, assetId, employeeName, returnDate) => {
  try {
    const tenantPool = await getTenantPoolForOrgId(orgId);
    const getAssignedToQuery = `SELECT assigned_to FROM assets WHERE asset_id = ? AND org_id = ?`;
    const [rows] = await tenantPool.query(getAssignedToQuery, [assetId, orgId]);
    if (!rows.length) throw new Error("Asset not found");

    let assignedToArray = JSON.parse(rows[0].assigned_to || "[]");
    let updated = false;
    assignedToArray = assignedToArray.map((entry) => {
      if (
        entry.name === employeeName &&
        (entry.returnDate === null || entry.returnDate === "")
      ) {
        entry.returnDate = returnDate;
        updated = true;
      }
      return entry;
    });

    if (!updated)
      throw new Error("Employee record not found or already returned");

    const updateQuery = `UPDATE assets SET assigned_to = ?, status = "Returned" WHERE asset_id = ? AND org_id = ?`;
    await tenantPool.query(updateQuery, [
      JSON.stringify(assignedToArray),
      assetId,
      orgId,
    ]);
  } catch (error) {
    console.error("❌ Database update failed:", error);
    throw new Error("Database update failed");
  }
};

/**
 * Get asset counts grouped by category/subcategory (tenant DB).
 */
const getAssetCounts = async (orgId) => {
  try {
    const tenantPool = await getTenantPoolForOrgId(orgId);
    const [rows] = await tenantPool.query(GET_ASSET_COUNTS, [orgId]);
    return rows;
  } catch (error) {
    console.error("Error fetching asset counts:", error);
    throw error;
  }
};

/**
 * Search employees by name inside tenant DB (tenant employees table).
 * NOTE: the SQL constant currently includes org_id param; we pass orgId as before.
 */
const searchEmployeesByName = async (orgId, searchTerm) => {
  try {
    const tenantPool = await getTenantPoolForOrgId(orgId);
    const [rows] = await tenantPool.query(SEARCH_EMPLOYEES_BY_NAME, [
      `${searchTerm}%`,
      orgId,
    ]);
    return rows;
  } catch (error) {
    console.error("❌ Error searching employees:", error);
    throw new Error("Failed to search employees");
  }
};

/**
 * Fetch assigned assets for an employee (tenant DB).
 */
const fetchAssignedAssetsByEmployee = async (orgId, employeeId) => {
  try {
    const tenantPool = await getTenantPoolForOrgId(orgId);
    const [result] = await tenantPool.query(GET_ASSIGNED_ASSETS_BY_EMPLOYEE, [
      employeeId,
      orgId,
    ]);
    return result;
  } catch (error) {
    console.error("❌ Error fetching assigned assets:", error);
    throw new Error("Failed to fetch assigned assets");
  }
};

module.exports = {
  searchEmployeesByName,
  addAsset,
  getAssets,
  updateAssignedTo,
  getAssignmentData,
  updateReturnDate,
  getAssetCounts,
  fetchAssignedAssetsByEmployee,
};