const db = require("../config");
const queries = require("../constants/projectQueries");
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

const addProject = async (orgId, projectData) => {
  try {
    const tenantPool = await getTenantPoolForOrgId(orgId);
    const values = Array.isArray(projectData) ? [...projectData] : [];
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
      milestoneData,
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

const getEmployeeProjects = async (employeeId, orgId = null) => {
  try {
    const jsonEmployeeId = `"${employeeId}"`;
    if (orgId !== undefined && orgId !== null && String(orgId).trim() !== "") {
      const tenantPool = await getTenantPoolForOrgId(orgId);
      const [rows] = await tenantPool.query(
        queries.GET_EMPLOYEE_PROJECTS_BY_ORG,
        [jsonEmployeeId, orgId],
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

const getProjectById = async (orgId, id) => {
  try {
    if (orgId && String(orgId).trim() !== "") {
      const tenantPool = await getTenantPoolForOrgId(orgId);
      const [rows] = await tenantPool.query(queries.GET_PROJECT_BY_ID, [id]);
      if (!rows || rows.length === 0) return null;
      const row = rows[0];

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

      project.financialDetails = project.financial_details;
      return project;
    } else {
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
      const params = Array.isArray(projectData) ? [...projectData] : [];
      if (String(params[params.length - 1]) !== String(id)) {
        params.push(id);
      }
      await tenantPool.query(queries.UPDATE_PROJECT, params);
    } else {
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

const deleteMilestone = async (orgId, id) => {
  try {
    if (orgId && String(orgId).trim() !== "") {
      const tenantPool = await getTenantPoolForOrgId(orgId);
      await tenantPool.query(queries.DELETE_MILESTONE, [id]);
    } else {
      await db.execute(queries.DELETE_MILESTONE, [id]);
    }
  } catch (err) {
    console.error("❌ deleteMilestone error:", err);
    throw err;
  }
};

const deleteFinancialDetailsByMilestone = async (orgId, milestoneId) => {
  try {
    if (orgId && String(orgId).trim() !== "") {
      const tenantPool = await getTenantPoolForOrgId(orgId);
      await tenantPool.query(queries.DELETE_FINANCIAL_DETAILS_BY_MILESTONE, [
        milestoneId,
      ]);
    } else {
      await db.execute(queries.DELETE_FINANCIAL_DETAILS_BY_MILESTONE, [
        milestoneId,
      ]);
    }
  } catch (err) {
    console.error("❌ deleteFinancialDetailsByMilestone error:", err);
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
    const project_id = Number(data.project_id || data.projectId);
    const milestone_id = Number(data.milestone_id || data.milestoneId);
    const m_actual_amount = Number(
      data.m_actual_amount || data.mActualAmount || 0,
    );
    const m_tds_percentage = Number(
      data.m_tds_percentage || data.mTdsPercentage || 0,
    );
    const m_tds_amount = Number(data.m_tds_amount || data.mTdsAmount || 0);
    const m_gst_percentage = Number(
      data.m_gst_percentage || data.mGstPercentage || 0,
    );
    const m_gst_amount = Number(data.m_gst_amount || data.mGstAmount || 0);
    const m_total_amount = Number(
      data.m_total_amount || data.mTotalAmount || 0,
    );

    const status = data.status || "Received";
    const completed_date = data.completed_date
      ? new Date(data.completed_date).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0];

    const searchQuery = `SELECT id FROM financial_details WHERE project_id = ? AND milestone_id = ? AND (month_year IS NULL OR month_year = '') LIMIT 1`;
    const values = [project_id, milestone_id];

    if (orgId && String(orgId).trim() !== "") {
      const tenantPool = await getTenantPoolForOrgId(orgId);
      const [rows] = await tenantPool.query(searchQuery, values);
      if (rows && rows.length > 0) {
        const financialId = rows[0].id;
        await updateFinancialDetailsById(orgId, {
          id: financialId,
          m_actual_amount,
          m_tds_percentage,
          m_tds_amount,
          m_gst_percentage,
          m_gst_amount,
          m_total_amount,
          status,
          completed_date,
        });
      } else {
        await tenantPool.query(
          `INSERT INTO financial_details (project_id, milestone_id, m_actual_amount, m_tds_percentage, m_tds_amount, m_gst_percentage, m_gst_amount, m_total_amount, status, completed_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
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
          ],
        );
      }
    } else {
      const [rows] = await db.execute(searchQuery, values);
      if (rows && rows.length > 0) {
        const financialId = rows[0].id;
        await updateFinancialDetailsById(orgId, {
          id: financialId,
          m_actual_amount,
          m_tds_percentage,
          m_tds_amount,
          m_gst_percentage,
          m_gst_amount,
          m_total_amount,
          status,
          completed_date,
        });
      } else {
        await db.execute(
          `INSERT INTO financial_details (project_id, milestone_id, m_actual_amount, m_tds_percentage, m_tds_amount, m_gst_percentage, m_gst_amount, m_total_amount, status, completed_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
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
          ],
        );
      }
    }
  } catch (err) {
    console.error("❌ updateFinancialDetailsForInvoice error:", err);
    throw err;
  }
};

const getFinancialDetailByMilestoneAndMonthYear = async (
  orgId,
  milestoneId,
  monthYear,
) => {
  try {
    if (orgId && String(orgId).trim() !== "") {
      const tenantPool = await getTenantPoolForOrgId(orgId);
      const [rows] = await tenantPool.query(
        queries.GET_FINANCIAL_BY_MILESTONE_AND_MONTH_YEAR,
        [milestoneId, monthYear],
      );
      return rows.length > 0 ? rows[0] : null;
    } else {
      const [rows] = await db.execute(
        queries.GET_FINANCIAL_BY_MILESTONE_AND_MONTH_YEAR,
        [milestoneId, monthYear],
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
    let values;

    if (Array.isArray(params)) {
      values = params;
    } else if (params && typeof params === "object") {
      const m_actual_amount = Number(
        params.m_actual_amount || params.mActualAmount || 0,
      );
      const m_tds_percentage = Number(
        params.m_tds_percentage || params.mTdsPercentage || 0,
      );
      const m_tds_amount = Number(
        params.m_tds_amount || params.mTdsAmount || 0,
      );
      const m_gst_percentage = Number(
        params.m_gst_percentage || params.mGstPercentage || 0,
      );
      const m_gst_amount = Number(
        params.m_gst_amount || params.mGstAmount || 0,
      );
      const m_total_amount = Number(
        params.m_total_amount || params.mTotalAmount || 0,
      );
      const status = params.status || "Received";
      const completed_date = params.completed_date
        ? new Date(params.completed_date).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0];
      const id = Number(
        params.id || params.financial_id || params.milestone_id || 0,
      );

      if (!id) {
        throw new Error(
          "financial record id is required for updateFinancialDetailsById",
        );
      }

      values = [
        m_actual_amount,
        m_tds_percentage,
        m_tds_amount,
        m_gst_percentage,
        m_gst_amount,
        m_total_amount,
        status,
        completed_date,
        id,
      ];
    } else {
      throw new Error("Invalid params for updateFinancialDetailsById");
    }

    if (orgId && String(orgId).trim() !== "") {
      const tenantPool = await getTenantPoolForOrgId(orgId);
      await tenantPool.query(queries.UPDATE_FINANCIAL_BY_ID, values);
    } else {
      await db.execute(queries.UPDATE_FINANCIAL_BY_ID, values);
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
  deleteMilestone,
  deleteFinancialDetailsByMilestone,
  updateFinancialDetails,
  searchEmployees,
  updateFinancialDetailsForInvoice,
  getFinancialDetailByMilestoneAndMonthYear,
  upsertFinancialDetails,
  updateFinancialDetailsById,
};
