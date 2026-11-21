const db = require("../config");
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
  GET_ASSET_CATEGORIES,
  GET_ASSET_ACCESSORIES,
} = require("../constants/assetsQueries");

const { getTenantPool, sanitizeDbName } = require("../db/tenantPoolManager");

async function getTenantPoolForOrgId(orgId) {
  if (!orgId) {
    const err = new Error("orgId required to get tenant pool");
    err.code = "ORG_REQUIRED";
    throw err;
  }
  const dbName = sanitizeDbName(`tenant_${orgId}`);
  return getTenantPool(dbName);
}

const getOrganizationPrefix = async (orgId) => {
  try {
    const [rows] = await db.execute(
      `SELECT Name, subdomain FROM Organizations WHERE id = ? LIMIT 1`,
      [orgId],
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

const getLastAssetId = async (orgId, combinedPrefix) => {
  try {
    const likePattern = `${combinedPrefix}-%`;
    const tenantPool = await getTenantPoolForOrgId(orgId);
    const [rows] = await tenantPool.query(GET_LAST_ASSET_ID, [likePattern]);
    if (!rows || rows.length === 0) return `${combinedPrefix}-001`;
    const lastNumber = parseInt(rows[0].asset_id.split("-").pop(), 10);
    return `${combinedPrefix}-${String(lastNumber + 1).padStart(3, "0")}`;
  } catch (error) {
    console.error("❌ Error fetching last asset ID:", error);
    throw new Error("Failed to generate asset ID");
  }
};

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
      [likePattern, orgId],
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

const validateAccessoryIds = async (
  connection,
  orgId,
  categoryId,
  subcategoryId,
  accessoryIds,
  includeInactive = false,
  categoryName,
  subcategoryName
) => {
  if (accessoryIds.length === 0) return;

  const [categoryRows] = await connection.query(
    `
      SELECT c.category_name, s.subcategory_name
      FROM asset_categories c
      LEFT JOIN asset_subcategories s
        ON s.category_id = c.category_id
        AND s.org_id = c.org_id
        AND s.subcategory_id = ?
      WHERE c.org_id = ? AND c.category_id = ?
      LIMIT 1
    `,
    [subcategoryId || null, orgId, categoryId]
  );
  const category = categoryRows[0];
  if (
    !category ||
    category.category_name !== categoryName ||
    (subcategoryId
      ? category.subcategory_name !== subcategoryName
      : Boolean(subcategoryName))
  ) {
    const error = new Error("Selected accessories do not match this asset");
    error.code = "INVALID_ACCESSORIES";
    throw error;
  }

  const placeholders = accessoryIds.map(() => "?").join(", ");
  const [rows] = await connection.query(
    `
      SELECT accessory_id
      FROM asset_accessories
      WHERE org_id = ?
        AND category_id = ?
        AND subcategory_id <=> ?
        ${includeInactive ? "" : "AND status = 'Active'"}
        AND accessory_id IN (${placeholders})
    `,
    [orgId, categoryId, subcategoryId || null, ...accessoryIds]
  );
  if (rows.length !== accessoryIds.length) {
    const error = new Error("One or more selected accessories are invalid");
    error.code = "INVALID_ACCESSORIES";
    throw error;
  }
};

const replaceAssetAccessories = async (
  connection,
  orgId,
  assetId,
  accessoryIds
) => {
  await connection.query(
    "DELETE FROM asset_assigned_accessories WHERE org_id = ? AND asset_id = ?",
    [orgId, assetId]
  );

  if (accessoryIds.length === 0) return;

  const placeholders = accessoryIds.map(() => "(?, ?, ?, 1)").join(", ");
  const values = accessoryIds.flatMap((accessoryId) => [
    orgId,
    assetId,
    accessoryId,
  ]);
  await connection.query(
    `INSERT INTO asset_assigned_accessories
      (org_id, asset_id, accessory_id, quantity)
     VALUES ${placeholders}`,
    values
  );
};

const addAsset = async (orgId, assetData) => {
  let connection;
  let transactionStarted = false;
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
      category_id,
      subcategory_id,
      accessory_ids = [],
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
    connection = await tenantPool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;
    const [result] = await connection.query(INSERT_ASSET, values);

    if (accessory_ids.length > 0) {
      await validateAccessoryIds(
        connection,
        orgId,
        category_id,
        subcategory_id,
        accessory_ids,
        false,
        category,
        sub_category
      );
      await replaceAssetAccessories(
        connection,
        orgId,
        asset_id,
        accessory_ids
      );
    }

    await connection.commit();
    transactionStarted = false;
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
    if (transactionStarted) await connection.rollback();
    console.error("❌ Error inserting asset:", error);
    if (error.code === "INVALID_ACCESSORIES") throw error;
    throw new Error("Failed to add asset");
  } finally {
    if (connection) connection.release();
  }
};

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

const getAssetCategories = async (orgId) => {
  try {
    const tenantPool = await getTenantPoolForOrgId(orgId);
    const [rows] = await tenantPool.query(GET_ASSET_CATEGORIES, [orgId]);
    const categoriesById = new Map();

    for (const row of rows) {
      if (!categoriesById.has(row.category_id)) {
        categoriesById.set(row.category_id, {
          category_id: row.category_id,
          category_name: row.category_name,
          subcategories: [],
        });
      }

      if (row.subcategory_id !== null) {
        categoriesById.get(row.category_id).subcategories.push({
          subcategory_id: row.subcategory_id,
          subcategory_name: row.subcategory_name,
        });
      }
    }

    return Array.from(categoriesById.values());
  } catch (error) {
    console.error("Error fetching asset categories:", error);
    throw new Error("Failed to retrieve asset categories");
  }
};

const getAssetAccessories = async (
  orgId,
  categoryId,
  subcategoryId,
  assetId = null
) => {
  try {
    const tenantPool = await getTenantPoolForOrgId(orgId);
    const [rows] = await tenantPool.query(GET_ASSET_ACCESSORIES, [
      assetId,
      orgId,
      categoryId,
      subcategoryId,
    ]);
    return rows.map((row) => ({
      ...row,
      is_selected: Number(row.is_selected) === 1,
      quantity: row.quantity || 1,
    }));
  } catch (error) {
    console.error("Error fetching asset accessories:", error);
    throw new Error("Failed to retrieve asset accessories");
  }
};

const updateAssignedTo = async (
  orgId,
  assetId,
  assignedTo,
  accessoryIds
) => {
  let connection;
  let transactionStarted = false;
  try {
    const tenantPool = await getTenantPoolForOrgId(orgId);
    connection = await tenantPool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;

    const [rows] = await connection.query(
      "SELECT assigned_to FROM assets WHERE asset_id = ? AND org_id = ?",
      [assetId, orgId],
    );
    if (rows.length === 0) {
      await connection.rollback();
      transactionStarted = false;
      return "not_found";
    }

    let assignedArray = [];
    if (rows[0].assigned_to) {
      assignedArray = JSON.parse(rows[0].assigned_to);
    }

    const existingIndex = assignedArray.findIndex(
      (entry) =>
        entry.name === assignedTo.name &&
        entry.employeeId === assignedTo.employeeId,
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
      await connection.query(
        "UPDATE assets SET assigned_to = ?, status = CASE WHEN ? = 'Assigned' THEN 'In Use' ELSE status END WHERE asset_id = ? AND org_id = ?",
        [updatedJson, assignedTo.status, assetId, orgId],
      );
    } else {
      assignedArray.push(assignedTo);
      const updatedJson = JSON.stringify(assignedArray);
      await connection.query(
        "UPDATE assets SET assigned_to = ?, status = CASE WHEN ? = 'Assigned' THEN 'In Use' ELSE status END WHERE asset_id = ? AND org_id = ?",
        [updatedJson, assignedTo.status, assetId, orgId],
      );
    }

    if (accessoryIds !== undefined) {
      const [assetRows] = await connection.query(
        "SELECT category, sub_category FROM assets WHERE asset_id = ? AND org_id = ?",
        [assetId, orgId]
      );
      const asset = assetRows[0];
      const [categoryRows] = await connection.query(
        `
          SELECT c.category_id, s.subcategory_id
          FROM asset_categories c
          LEFT JOIN asset_subcategories s
            ON s.category_id = c.category_id
            AND s.org_id = c.org_id
            AND s.subcategory_name = ?
          WHERE c.org_id = ? AND c.category_name = ?
          LIMIT 1
        `,
        [asset.sub_category, orgId, asset.category]
      );
      const category = categoryRows[0];
      if (
        !category ||
        (asset.sub_category && !category.subcategory_id)
      ) {
        const error = new Error("Asset category is not configured");
        error.code = "INVALID_ACCESSORIES";
        throw error;
      }
      await validateAccessoryIds(
        connection,
        orgId,
        category.category_id,
        category.subcategory_id,
        accessoryIds,
        true,
        asset.category,
        asset.sub_category
      );
      await replaceAssetAccessories(
        connection,
        orgId,
        assetId,
        accessoryIds
      );
    }

    await connection.commit();
    transactionStarted = false;
    return existingIndex !== -1 ? "updated" : "inserted";
  } catch (error) {
    if (transactionStarted) await connection.rollback();
    console.error("❌ Database Error:", error);
    if (error.code === "INVALID_ACCESSORIES") throw error;
    throw new Error("Failed to update asset assignment");
  } finally {
    if (connection) connection.release();
  }
};

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
  getAssetCategories,
  getAssetAccessories,
  updateAssignedTo,
  getAssignmentData,
  updateReturnDate,
  getAssetCounts,
  fetchAssignedAssetsByEmployee,
};
