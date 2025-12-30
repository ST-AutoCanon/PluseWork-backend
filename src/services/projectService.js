// services/projectService.js
const db = require("../config"); // master DB (fallback/global)
const queries = require("../constants/projectQueries");
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
 * Insert project into tenant DB.
 * projectData should be an array of values (same order as INSERT_PROJECT) excluding orgId;
 * this function appends orgId internally to match the SQL.
 */
const addProject = async (orgId, projectData) => {
  try {
    const tenantPool = await getTenantPoolForOrgId(orgId);
    // ensure orgId appended (INSERT_PROJECT expects org_id as last param)
    const values = Array.isArray(projectData) ? [...projectData] : [];
    // If caller already included orgId as last value, don't append twice
    if (String(values[values.length - 1]) !== String(orgId)) {
      values.push(orgId);
    }
    const [result] = await tenantPool.query(queries.INSERT_PROJECT, values);
    return result.insertId;
  } catch (err) {
    console.error("❌ addProject error:", err);
    throw err;
  }
};

const addSTSOwner = async (orgId, stsOwnerData) => {
  try {
    const tenantPool = await getTenantPoolForOrgId(orgId);
    await tenantPool.query(queries.INSERT_STS_OWNER, stsOwnerData);
  } catch (err) {
    console.error("❌ addSTSOwner error:", err);
    throw err;
  }
};

const addMilestone = async (orgId, milestoneData) => {
  try {
    const tenantPool = await getTenantPoolForOrgId(orgId);
    const [result] = await tenantPool.query(
      queries.INSERT_MILESTONE,
      milestoneData
    );
    return result.insertId;
  } catch (err) {
    console.error("❌ addMilestone error:", err);
    throw err;
  }
};

const addFinancialDetails = async (orgId, financialData) => {
  try {
    const tenantPool = await getTenantPoolForOrgId(orgId);
    await tenantPool.query(queries.INSERT_FINANCIAL_DETAILS, financialData);
  } catch (err) {
    console.error("❌ addFinancialDetails error:", err);
    throw err;
  }
};

/**
 * Get all projects.
 * If orgId provided -> tenant DB; otherwise fallback to master db (global).
 */
const getAllProjects = async (orgId = null) => {
  try {
    if (orgId !== undefined && orgId !== null && String(orgId).trim() !== "") {
      const tenantPool = await getTenantPoolForOrgId(orgId);
      const sql = queries.GET_ALL_PROJECTS + " WHERE p.org_id = ?;";
      const [rows] = await tenantPool.query(sql, [orgId]);
      return rows;
    } else {
      const [rows] = await db.query(queries.GET_ALL_PROJECTS);
      return rows;
    }
  } catch (err) {
    console.error("❌ getAllProjects error:", err);
    throw err;
  }
};

/**
 * Get projects for an employee.
 * If orgId provided -> tenant DB; otherwise fallback to master DB.
 */
const getEmployeeProjects = async (employeeId, orgId = null) => {
  try {
    const jsonEmployeeId = `"${employeeId}"`;
    if (orgId !== undefined && orgId !== null && String(orgId).trim() !== "") {
      const tenantPool = await getTenantPoolForOrgId(orgId);
      const [rows] = await tenantPool.query(
        queries.GET_EMPLOYEE_PROJECTS_BY_ORG,
        [jsonEmployeeId, orgId]
      );
      return rows;
    } else {
      const [rows] = await db.query(queries.GET_EMPLOYEE_PROJECTS, [
        jsonEmployeeId,
      ]);
      return rows;
    }
  } catch (err) {
    console.error("❌ getEmployeeProjects error:", err);
    throw err;
  }
};

/**
 * Get project by id (tenant DB). Requires orgId.
 * If orgId is missing, attempt a safe fallback to master DB to preserve prior behaviour.
 */
const getProjectById = async (orgId, id) => {
  try {
    if (orgId && String(orgId).trim() !== "") {
      const tenantPool = await getTenantPoolForOrgId(orgId);
      const [rows] = await tenantPool.query(queries.GET_PROJECT_BY_ID, [id]);
      if (!rows || rows.length === 0) return null;
      const row = rows[0];

      // parse JSON fields
      const parseJSONField = (field) => {
        if (typeof field === "string") {
          try {
            return JSON.parse(field);
          } catch (error) {
            return [];
          }
        }
        return field || [];
      };

      const project = {
        ...row,
        project_category: parseJSONField(row.project_category),
        employee_list: parseJSONField(row.employee_list),
        key_considerations: parseJSONField(row.key_considerations),
        milestones: parseJSONField(row.milestones),
        financial_details: parseJSONField(row.financial_details),
        attachment_url: parseJSONField(row.attachment_url),
        project_amount: parseFloat(row.project_amount) || 0,
        tds_percentage: parseFloat(row.tds_percentage) || 0,
        tds_amount: parseFloat(row.tds_amount) || 0,
        gst_percentage: parseFloat(row.gst_percentage) || 0,
        gst_amount: parseFloat(row.gst_amount) || 0,
        total_amount: parseFloat(row.total_amount) || 0,
      };

      // keep backward-compatible property name
      project.financialDetails = project.financial_details;
      return project;
    } else {
      // fallback to master DB (previous behavior)
      const [rows] = await db.query(queries.GET_PROJECT_BY_ID, [id]);
      if (!rows || rows.length === 0) return null;
      const row = rows[0];

      const parseJSONField = (field) => {
        if (typeof field === "string") {
          try {
            return JSON.parse(field);
          } catch {
            return [];
          }
        }
        return field || [];
      };

      const project = {
        ...row,
        project_category: parseJSONField(row.project_category),
        employee_list: parseJSONField(row.employee_list),
        key_considerations: parseJSONField(row.key_considerations),
        milestones: parseJSONField(row.milestones),
        financial_details: parseJSONField(row.financial_details),
        attachment_url: parseJSONField(row.attachment_url),
        project_amount: parseFloat(row.project_amount) || 0,
        tds_percentage: parseFloat(row.tds_percentage) || 0,
        tds_amount: parseFloat(row.tds_amount) || 0,
        gst_percentage: parseFloat(row.gst_percentage) || 0,
        gst_amount: parseFloat(row.gst_amount) || 0,
        total_amount: parseFloat(row.total_amount) || 0,
      };

      project.financialDetails = project.financial_details;
      return project;
    }
  } catch (err) {
    console.error("❌ getProjectById error:", err);
    throw err;
  }
};

const updateProject = async (orgId, id, projectData) => {
  try {
    if (orgId && String(orgId).trim() !== "") {
      const tenantPool = await getTenantPoolForOrgId(orgId);
      // ensure id is final param (UPDATE_PROJECT expects id as last param)
      const params = Array.isArray(projectData) ? [...projectData] : [];
      // if caller didn't include id, append it
      if (String(params[params.length - 1]) !== String(id)) {
        params.push(id);
      }
      await tenantPool.query(queries.UPDATE_PROJECT, params);
    } else {
      // fallback to master
      const params = Array.isArray(projectData) ? [...projectData] : [];
      if (String(params[params.length - 1]) !== String(id)) {
        params.push(id);
      }
      await db.execute(queries.UPDATE_PROJECT, params);
    }
  } catch (err) {
    console.error("❌ updateProject error:", err);
    throw err;
  }
};

const updateSTSOwner = async (orgId, id, stsOwnerData) => {
  try {
    if (orgId && String(orgId).trim() !== "") {
      const tenantPool = await getTenantPoolForOrgId(orgId);
      const params = Array.isArray(stsOwnerData) ? [...stsOwnerData] : [];
      // ensure id appended
      if (String(params[params.length - 1]) !== String(id)) params.push(id);
      await tenantPool.query(queries.UPDATE_STS_OWNER, params);
    } else {
      const params = Array.isArray(stsOwnerData) ? [...stsOwnerData] : [];
      if (String(params[params.length - 1]) !== String(id)) params.push(id);
      await db.execute(queries.UPDATE_STS_OWNER, params);
    }
  } catch (err) {
    console.error("❌ updateSTSOwner error:", err);
    throw err;
  }
};

const updateMilestone = async (orgId, id, milestoneData) => {
  try {
    if (orgId && String(orgId).trim() !== "") {
      const tenantPool = await getTenantPoolForOrgId(orgId);
      await tenantPool.query(queries.UPDATE_MILESTONE, milestoneData);
    } else {
      await db.execute(queries.UPDATE_MILESTONE, milestoneData);
    }
  } catch (err) {
    console.error("❌ updateMilestone error:", err);
    throw err;
  }
};

const updateFinancialDetails = async (orgId, params) => {
  try {
    if (orgId && String(orgId).trim() !== "") {
      const tenantPool = await getTenantPoolForOrgId(orgId);
      await tenantPool.query(queries.UPDATE_FINANCIAL_DETAILS, params);
    } else {
      await db.execute(queries.UPDATE_FINANCIAL_DETAILS, params);
    }
  } catch (err) {
    console.error("❌ updateFinancialDetails error:", err);
    throw err;
  }
};

const searchEmployees = async (search, orgId) => {
  try {
    let baseSql = queries.GET_ALL_EMPLOYEES;
    const params = [];

    if (search && String(search).trim() !== "") {
      baseSql = queries.SEARCH_EMPLOYEES;
      const term = `%${String(search).trim()}%`;
      baseSql += ` AND (CONCAT(e.first_name, ' ', e.last_name) LIKE ? OR e.employee_id LIKE ? OR d.name LIKE ?)`;
      params.push(term, term, term);
    }

    if (orgId !== undefined && orgId !== null && String(orgId).trim() !== "") {
      // tenant DB employee table lookup
      const tenantPool = await getTenantPoolForOrgId(orgId);
      baseSql += ` AND e.Org_id = ?`;
      params.push(orgId);
      baseSql += ` ORDER BY e.employee_id DESC`;
      const [rows] = await tenantPool.query(baseSql, params);
      return rows;
    } else {
      baseSql += ` ORDER BY e.employee_id DESC`;
      const [rows] = await db.execute(baseSql, params);
      return rows;
    }
  } catch (err) {
    console.error("❌ searchEmployees error:", err);
    throw err;
  }
};

const updateFinancialDetailsForInvoice = async (orgId, data) => {
  try {
    const {
      project_id,
      milestone_id,
      m_actual_amount,
      m_tds_percentage,
      m_tds_amount,
      m_gst_percentage,
      m_gst_amount,
      m_total_amount,
    } = data;

    const status = "Received";
    const completed_date = new Date().toISOString().split("T")[0];

    const params = [
      project_id,
      milestone_id,
      m_actual_amount,
      m_tds_percentage,
      m_tds_amount,
      m_gst_percentage,
      m_gst_amount,
      m_total_amount,
      status,
      completed_date,
    ];

    const cleanParams = params.map((v) =>
      v === "" || v === "null" ? null : v
    );

    if (orgId && String(orgId).trim() !== "") {
      const tenantPool = await getTenantPoolForOrgId(orgId);
      await tenantPool.query(
        queries.UPDATE_FINANCIAL_DETAILS_FOR_INVOICE,
        cleanParams
      );
    } else {
      await db.execute(
        queries.UPDATE_FINANCIAL_DETAILS_FOR_INVOICE,
        cleanParams
      );
    }
  } catch (err) {
    console.error("❌ updateFinancialDetailsForInvoice error:", err);
    throw err;
  }
};

const getFinancialDetailByMilestoneAndMonthYear = async (
  orgId,
  milestoneId,
  monthYear
) => {
  try {
    if (orgId && String(orgId).trim() !== "") {
      const tenantPool = await getTenantPoolForOrgId(orgId);
      const [rows] = await tenantPool.query(
        queries.GET_FINANCIAL_BY_MILESTONE_AND_MONTH_YEAR,
        [milestoneId, monthYear]
      );
      return rows.length > 0 ? rows[0] : null;
    } else {
      const [rows] = await db.execute(
        queries.GET_FINANCIAL_BY_MILESTONE_AND_MONTH_YEAR,
        [milestoneId, monthYear]
      );
      return rows.length > 0 ? rows[0] : null;
    }
  } catch (err) {
    console.error("❌ getFinancialDetailByMilestoneAndMonthYear error:", err);
    throw err;
  }
};

const upsertFinancialDetails = async (orgId, data) => {
  try {
    if (orgId && String(orgId).trim() !== "") {
      const tenantPool = await getTenantPoolForOrgId(orgId);
      await tenantPool.query(queries.UPSERT_FINANCIAL_DETAILS, data);
    } else {
      await db.execute(queries.UPSERT_FINANCIAL_DETAILS, data);
    }
  } catch (err) {
    console.error("❌ upsertFinancialDetails error:", err);
    throw err;
  }
};

const updateFinancialDetailsById = async (orgId, params) => {
  try {
    if (orgId && String(orgId).trim() !== "") {
      const tenantPool = await getTenantPoolForOrgId(orgId);
      await tenantPool.query(queries.UPDATE_FINANCIAL_BY_ID, params);
    } else {
      await db.execute(queries.UPDATE_FINANCIAL_BY_ID, params);
    }
  } catch (err) {
    console.error("❌ updateFinancialDetailsById error:", err);
    throw err;
  }
};

module.exports = {
  addProject,
  addSTSOwner,
  addMilestone,
  addFinancialDetails,
  getAllProjects,
  getEmployeeProjects,
  getProjectById,
  updateProject,
  updateSTSOwner,
  updateMilestone,
  updateFinancialDetails,
  searchEmployees,
  updateFinancialDetailsForInvoice,
  getFinancialDetailByMilestoneAndMonthYear,
  upsertFinancialDetails,
  updateFinancialDetailsById,
};
