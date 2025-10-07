const db = require("../config");
const queries = require("../constants/projectQueries");

const addProject = async (projectData) => {
  // projectData must include org_id as last element (may be null)
  const [result] = await db.execute(queries.INSERT_PROJECT, projectData);
  return result.insertId;
};

const addSTSOwner = async (stsOwnerData) => {
  await db.execute(queries.INSERT_STS_OWNER, stsOwnerData);
};

const addMilestone = async (milestoneData) => {
  const [result] = await db.execute(queries.INSERT_MILESTONE, milestoneData);
  return result.insertId;
};

const addFinancialDetails = async (financialData) => {
  await db.execute(queries.INSERT_FINANCIAL_DETAILS, financialData);
};

const getAllProjects = async (orgId = null) => {
  // If orgId provided, use a filtered query; otherwise use full query
  if (orgId !== undefined && orgId !== null && String(orgId).trim() !== "") {
    const sql = queries.GET_ALL_PROJECTS + " WHERE p.org_id = ?;";
    const [rows] = await db.execute(sql, [orgId]);
    return rows;
  } else {
    const [rows] = await db.query(queries.GET_ALL_PROJECTS);
    return rows;
  }
};

const getEmployeeProjects = async (employeeId, orgId = null) => {
  // employeeId must be JSON string like "\"E123\""
  const jsonEmployeeId = `"${employeeId}"`;

  // If orgId provided, use query with org filter
  if (orgId !== undefined && orgId !== null && String(orgId).trim() !== "") {
    const [rows] = await db.execute(queries.GET_EMPLOYEE_PROJECTS_BY_ORG, [
      jsonEmployeeId,
      orgId,
    ]);
    return rows;
  } else {
    const [rows] = await db.query(queries.GET_EMPLOYEE_PROJECTS, [
      jsonEmployeeId,
    ]);
    return rows;
  }
};

const getProjectById = async (id) => {
  const [rows] = await db.query(queries.GET_PROJECT_BY_ID, [id]);

  if (rows.length === 0) {
    return null;
  }

  let project = {
    ...rows[0],
    project_category: [],
    milestones: [],
    financialDetails: [],
    employee_list: [],
    key_considerations: [],
    attachment_url: [],
  };

  const parseJSONField = (field) => {
    if (typeof field === "string") {
      try {
        return JSON.parse(field);
      } catch (error) {
        console.warn("Invalid JSON format for field:", field);
        return [];
      }
    }
    return field || [];
  };

  project.project_category = parseJSONField(rows[0].project_category);
  project.employee_list = parseJSONField(rows[0].employee_list);
  project.key_considerations = parseJSONField(rows[0].key_considerations);
  project.milestones = parseJSONField(rows[0].milestones);
  project.financialDetails = parseJSONField(rows[0].financial_details);
  project.attachment_url = parseJSONField(rows[0].attachment_url);
  project.project_amount = parseFloat(project.project_amount) || 0;
  project.tds_percentage = parseFloat(project.tds_percentage) || 0;
  project.tds_amount = parseFloat(project.tds_amount) || 0;
  project.gst_percentage = parseFloat(project.gst_percentage) || 0;
  project.gst_amount = parseFloat(project.gst_amount) || 0;
  project.total_amount = parseFloat(project.total_amount) || 0;
  return project;
};

const updateProject = async (id, projectData) => {
  await db.execute(queries.UPDATE_PROJECT, projectData);
};

const updateSTSOwner = async (id, stsOwnerData) => {
  await db.execute(queries.UPDATE_STS_OWNER, stsOwnerData);
};

const updateMilestone = async (id, milestoneData) => {
  await db.execute(queries.UPDATE_MILESTONE, milestoneData);
};

const updateFinancialDetails = async (params) => {
  console.log("⏩ updateFinancialDetails params:", params);
  await db.execute(queries.UPDATE_FINANCIAL_DETAILS, params);
};

const searchEmployees = async (search, orgId) => {
  try {
    // start with base query (we'll append filters)
    let baseSql = queries.GET_ALL_EMPLOYEES;
    const params = [];

    // If a search term exists, use SEARCH_EMPLOYEES (same base structure but we will add WHERE terms)
    // The SEARCH_EMPLOYEES template is identical to GET_ALL_EMPLOYEES in this setup; we still handle search below.
    if (search && String(search).trim() !== "") {
      baseSql = queries.SEARCH_EMPLOYEES;
      const term = `%${String(search).trim()}%`;
      // append search filter
      baseSql += ` AND (CONCAT(e.first_name, ' ', e.last_name) LIKE ? OR e.employee_id LIKE ? OR d.name LIKE ?)`;
      params.push(term, term, term);
    }

    // Append org filter if provided
    if (orgId !== undefined && orgId !== null && String(orgId).trim() !== "") {
      baseSql += ` AND e.Org_id = ?`;
      params.push(orgId);
    }

    // final ordering
    baseSql += ` ORDER BY e.employee_id DESC`;

    const [rows] = await db.execute(baseSql, params);
    return rows;
  } catch (error) {
    console.error("Error fetching employees from database:", error);
    throw new Error("Error fetching employees from database");
  }
};

const updateFinancialDetailsForInvoice = async (data) => {
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

  const cleanParams = params.map((v) => (v === "" || v === "null" ? null : v));

  cleanParams.forEach((v, i) => {
    if (v === undefined) {
      console.error(`⚠️ cleanParams[${i}] is undefined!`);
    }
  });

  try {
    const [result] = await db.execute(
      queries.UPDATE_FINANCIAL_DETAILS_FOR_INVOICE,
      cleanParams
    );
    console.log("Update result:", result);
  } catch (err) {
    console.error("Error updating financial details:", err);
    throw err;
  }
};

const getFinancialDetailByMilestoneAndMonthYear = async (
  milestoneId,
  monthYear
) => {
  const [rows] = await db.execute(
    queries.GET_FINANCIAL_BY_MILESTONE_AND_MONTH_YEAR,
    [milestoneId, monthYear]
  );
  return rows.length > 0 ? rows[0] : null;
};

const upsertFinancialDetails = async (data) => {
  await db.execute(queries.UPSERT_FINANCIAL_DETAILS, data);
};

const updateFinancialDetailsById = async ({
  financial_id,
  m_actual_amount,
  m_tds_percentage,
  m_tds_amount,
  m_gst_percentage,
  m_gst_amount,
  m_total_amount,
  status = "Received",
  completed_date = new Date().toISOString().split("T")[0],
}) => {
  const params = [
    m_actual_amount,
    m_tds_percentage,
    m_tds_amount,
    m_gst_percentage,
    m_gst_amount,
    m_total_amount,
    status,
    completed_date,
    financial_id,
  ];
  await db.execute(queries.UPDATE_FINANCIAL_BY_ID, params);
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
