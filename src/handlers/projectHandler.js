const projectService = require("../services/projectService");

function resolveOrgIdFromReq(req) {
  const header =
    req.headers && (req.headers["x-org-id"] || req.headers["x_org_id"]);
  const body = req.body && (req.body.orgId || req.body.org_id);
  const query = req.query && (req.query.orgId || req.query.org_id);
  return header || body || query || null;
}

exports.createProject = async (req, res) => {
  try {
    const orgId = resolveOrgIdFromReq(req);
    if (!orgId) {
      return res
        .status(400)
        .json({ error: "orgId header or body is required" });
    }

    const {
      country,
      state,
      company_name,
      project_name,
      project_poc_name,
      project_poc_contact,
      company_gst,
      company_pan,
      company_address,
      project_category,
      start_date,
      end_date,
      service_mode,
      service_location,
      project_status,
      payment_type,
      description,
    } = req.body;

    const projectCategoryJson =
      typeof project_category === "string"
        ? project_category
        : JSON.stringify(project_category || []);

    const employeeListJson = req.body.employee_list
      ? typeof req.body.employee_list === "string"
        ? req.body.employee_list
        : JSON.stringify(req.body.employee_list)
      : JSON.stringify([]);

    const attachments =
      req.files && req.files.length > 0
        ? req.files.map((file) => file.filename)
        : [];

    const insertValues = [
      country,
      state,
      company_name,
      project_name,
      project_poc_name,
      project_poc_contact,
      company_gst,
      company_pan,
      company_address,
      projectCategoryJson,
      start_date,
      end_date,
      service_mode,
      service_location,
      project_status,
      payment_type,
      description,
      JSON.stringify(attachments),
    ];

    const projectId = await projectService.addProject(orgId, insertValues);

    await projectService.addSTSOwner(orgId, [
      projectId,
      req.body.sts_owner_id,
      req.body.sts_owner,
      req.body.sts_contact,
      employeeListJson,
      req.body.key_considerations,
    ]);

    let milestoneIds = [];
    const { milestones = [] } = req.body;
    const parsedMilestones =
      typeof milestones === "string" ? JSON.parse(milestones) : milestones;
    if (Array.isArray(parsedMilestones)) {
      for (const milestone of parsedMilestones) {
        const milestoneId = await projectService.addMilestone(orgId, [
          projectId,
          milestone.details,
          milestone.start_date,
          milestone.end_date,
          milestone.status,
          milestone.dependency,
          milestone.assigned_to,
        ]);
        milestoneIds.push({ id: milestoneId, details: milestone.details });
      }
    }

    let { financialDetails = [] } = req.body;
    const parsedFinancialDetails =
      typeof financialDetails === "string"
        ? JSON.parse(financialDetails)
        : financialDetails;

    if (Array.isArray(parsedFinancialDetails)) {
      for (const financial of parsedFinancialDetails) {
        const milestone = milestoneIds.find(
          (m) => m.details === financial.milestone_details
        );
        let milestoneId = milestone ? milestone.id : null;
        if (payment_type !== "Monthly Scheduled" && !milestoneId) continue;

        const project_amount = Number(req.body.project_amount) || 0;
        const tds_percentage = Number(req.body.tds_percentage) || 0;
        const tds_amount = Number(req.body.tds_amount) || 0;
        const gst_percentage = Number(req.body.gst_percentage) || 0;
        const gst_amount = Number(req.body.gst_amount) || 0;
        const total_amount = Number(req.body.total_amount) || 0;

        const monthly_fixed_amount = Number(req.body.monthly_fixed_amount) || 0;
        const service_description = req.body.service_description || null;

        const m_actual_percentage = Number(financial.m_actual_percentage) || 0;
        const m_actual_amount = Number(financial.m_actual_amount) || 0;
        const m_tds_percentage = Number(financial.m_tds_percentage) || 0;
        const m_tds_amount = Number(financial.m_tds_amount) || 0;
        const m_gst_percentage = Number(financial.m_gst_percentage) || 0;
        const m_gst_amount = Number(financial.m_gst_amount) || 0;
        const m_total_amount = Number(financial.m_total_amount) || 0;

        const completedDate = financial.completed_date
          ? new Date(financial.completed_date)
              .toISOString()
              .slice(0, 19)
              .replace("T", " ")
          : null;

        if (payment_type === "Monthly Scheduled") {
          await projectService.addFinancialDetails(orgId, [
            projectId,
            milestoneId || null,
            project_amount,
            tds_percentage,
            tds_amount,
            gst_percentage,
            gst_amount,
            total_amount,
            monthly_fixed_amount,
            financial.service_description,
            financial.month_year,
            m_actual_percentage,
            m_actual_amount,
            m_tds_percentage,
            m_tds_amount,
            m_gst_percentage,
            m_gst_amount,
            m_total_amount,
            financial.status || "Pending",
            completedDate,
          ]);
        } else {
          await projectService.addFinancialDetails(orgId, [
            projectId,
            milestoneId,
            project_amount,
            tds_percentage,
            tds_amount,
            gst_percentage,
            gst_amount,
            total_amount,
            monthly_fixed_amount,
            service_description,
            null,
            m_actual_percentage,
            m_actual_amount,
            m_tds_percentage,
            m_tds_amount,
            m_gst_percentage,
            m_gst_amount,
            m_total_amount,
            financial.status || "Pending",
            completedDate,
          ]);
        }
      }
    }

    res
      .status(201)
      .json({ message: "Project created successfully", projectId });
  } catch (error) {
    console.error("Error creating project:", error);
    res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
  }
};

exports.getProjects = async (req, res) => {
  try {
    const orgId = resolveOrgIdFromReq(req);
    const { employeeId } = req.query;
    if (!orgId) {
      return res.status(400).json({ error: "orgId header is required" });
    }

    let projects;
    if (employeeId) {
      projects = await projectService.getEmployeeProjects(employeeId, orgId);
    } else {
      projects = await projectService.getAllProjects(orgId);
    }

    res.status(200).json({ projects });
  } catch (error) {
    console.error("Error fetching projects:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.getEmployeeProjects = async (req, res) => {
  try {
    const { employeeId } = req.query;
    if (!employeeId) {
      return res.status(400).json({ error: "Employee ID is required" });
    }

    const orgId = resolveOrgIdFromReq(req);
    if (!orgId) {
      return res.status(400).json({ error: "orgId header is required" });
    }

    const projects = await projectService.getEmployeeProjects(
      employeeId,
      orgId
    );
    res.status(200).json({ projects });
  } catch (error) {
    console.error("Error fetching employee projects:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.searchEmployees = async (req, res) => {
  try {
    const search = String(req.query.search || "").trim();
    const orgId = resolveOrgIdFromReq(req);

    if (!orgId) {
      return res.status(400).json({
        error:
          "Missing required parameter: orgId (x-org-id header or orgId query)",
      });
    }

    const employees = await projectService.searchEmployees(search, orgId);
    return res.status(200).json({ data: employees });
  } catch (error) {
    console.error("Error fetching employees:", error);
    return res.status(500).json({ error: "Failed to fetch employees" });
  }
};

exports.getProjectById = async (req, res) => {
  try {
    const { id } = req.params;
    const orgId = resolveOrgIdFromReq(req);
    if (!orgId) {
      return res.status(400).json({ error: "orgId header is required" });
    }

    const project = await projectService.getProjectById(orgId, id);

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const userRole = req.session && req.session.userRole;
    if (userRole === "Employee" || userRole === "Team Lead") {
      delete project.project_amount;
      delete project.tds_percentage;
      delete project.tds_amount;
      delete project.gst_percentage;
      delete project.gst_amount;
      delete project.total_amount;
      delete project.financial_details;
      project.financialDetails = [];
    }

    res.status(200).json({ project });
  } catch (error) {
    console.error("Error fetching project:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.updateProject = async (req, res) => {
  try {
    const { id } = req.params;
    const orgId = resolveOrgIdFromReq(req);
    if (!orgId) {
      return res.status(400).json({ error: "orgId header is required" });
    }

    const existingProject = await projectService.getProjectById(orgId, id);
    if (!existingProject) {
      return res.status(404).json({ message: "Project not found" });
    }

    let attachmentsArr = [];
    if (req.files && req.files.length > 0) {
      attachmentsArr = req.files.map((f) => f.filename);
    } else if (req.body.attachment_url) {
      attachmentsArr =
        typeof req.body.attachment_url === "string"
          ? JSON.parse(req.body.attachment_url)
          : req.body.attachment_url;
    } else {
      attachmentsArr = existingProject.attachment_url || [];
    }
    const attachmentsJson = JSON.stringify(attachmentsArr);

    const projectCategoryJson =
      typeof req.body.project_category === "string"
        ? req.body.project_category
        : JSON.stringify(req.body.project_category || []);
    const employeeListJson =
      typeof req.body.employee_list === "string"
        ? req.body.employee_list
        : JSON.stringify(req.body.employee_list || []);

    const formattedStartDate = req.body.start_date
      ? new Date(req.body.start_date).toISOString().split("T")[0]
      : null;
    const formattedEndDate = req.body.end_date
      ? new Date(req.body.end_date).toISOString().split("T")[0]
      : null;

    const updateParams = [
      req.body.country,
      req.body.state,
      req.body.company_name,
      req.body.project_name,
      req.body.project_poc_name,
      req.body.project_poc_contact,
      req.body.company_gst,
      req.body.company_pan,
      req.body.company_address,
      projectCategoryJson,
      formattedStartDate,
      formattedEndDate,
      req.body.service_mode,
      req.body.service_location,
      req.body.project_status,
      req.body.payment_type,
      req.body.description,
      attachmentsJson,
    ];

    await projectService.updateProject(orgId, id, updateParams);

    await projectService.updateSTSOwner(orgId, id, [
      req.body.sts_owner_id,
      req.body.sts_owner,
      req.body.sts_contact,
      employeeListJson,
      req.body.key_considerations,
    ]);

    let parsedMilestones = [];
    if (req.body.milestones) {
      parsedMilestones =
        typeof req.body.milestones === "string"
          ? JSON.parse(req.body.milestones)
          : req.body.milestones;
    }
    if (Array.isArray(parsedMilestones)) {
      for (const m of parsedMilestones) {
        const start = m.start_date
          ? new Date(m.start_date).toISOString().split("T")[0]
          : null;
        const end = m.end_date
          ? new Date(m.end_date).toISOString().split("T")[0]
          : null;
        if (m.id) {
          await projectService.updateMilestone(orgId, m.id, [
            m.details,
            start,
            end,
            m.status,
            m.dependency,
            m.assigned_to,
            m.id,
          ]);
        } else {
          const newMilestoneId = await projectService.addMilestone(orgId, [
            id,
            m.details,
            start,
            end,
            m.status,
            m.dependency,
            m.assigned_to,
          ]);
          m.id = newMilestoneId;
        }
      }
    }

    let parsedFinancial = [];
    if (req.body.financialDetails) {
      parsedFinancial =
        typeof req.body.financialDetails === "string"
          ? JSON.parse(req.body.financialDetails)
          : req.body.financialDetails;
    }

    if (Array.isArray(parsedFinancial) && parsedFinancial.length) {
      if (Array.isArray(parsedMilestones)) {
        parsedFinancial.forEach((f) => {
          if (!f.milestone_id && f.milestone_details) {
            const match = parsedMilestones.find(
              (m) => m.details === f.milestone_details
            );
            if (match) f.milestone_id = match.id;
          }
        });
      }

      for (const fin of parsedFinancial) {
        const financialId = fin.id || null;
        const project_amount = Number(req.body.project_amount) || 0;
        const tds_percentage = Number(req.body.tds_percentage) || 0;
        const tds_amount = Number(req.body.tds_amount) || 0;
        const gst_percentage = Number(req.body.gst_percentage) || 0;
        const gst_amount = Number(req.body.gst_amount) || 0;
        const total_amount = Number(req.body.total_amount) || 0;
        const monthly_fixed_amount =
          fin.monthly_fixed_amount != null && fin.monthly_fixed_amount !== ""
            ? Number(fin.monthly_fixed_amount)
            : Number(req.body.monthly_fixed_amount) || 0;
        const service_description =
          fin.service_description || req.body.service_description || null;
        const m_actual_percentage = Number(fin.m_actual_percentage) || 0;
        const m_actual_amount = Number(fin.m_actual_amount) || 0;
        const m_tds_percentage = Number(fin.m_tds_percentage) || 0;
        const m_tds_amount = Number(fin.m_tds_amount) || 0;
        const m_gst_percentage = Number(fin.m_gst_percentage) || 0;
        const m_gst_amount = Number(fin.m_gst_amount) || 0;
        const m_total_amount = Number(fin.m_total_amount) || 0;
        const statusValue = fin.status || "Pending";
        const completedDate = fin.completed_date
          ? new Date(fin.completed_date)
              .toISOString()
              .slice(0, 19)
              .replace("T", " ")
          : null;

        if (req.body.payment_type === "Monthly Scheduled") {
          const params = [
            financialId,
            id,
            fin.milestone_id || null,
            project_amount,
            tds_percentage,
            tds_amount,
            gst_percentage,
            gst_amount,
            total_amount,
            monthly_fixed_amount,
            fin.service_description,
            fin.month_year,
            m_actual_percentage,
            m_actual_amount,
            m_tds_percentage,
            m_tds_amount,
            m_gst_percentage,
            m_gst_amount,
            m_total_amount,
            statusValue,
            completedDate,
          ];
          await projectService.upsertFinancialDetails(orgId, params);
        } else {
          if (financialId) {
            await projectService.updateFinancialDetails(orgId, [
              project_amount,
              tds_percentage,
              tds_amount,
              gst_percentage,
              gst_amount,
              total_amount,
              monthly_fixed_amount,
              service_description,
              fin.month_year,
              m_actual_percentage,
              m_actual_amount,
              m_tds_percentage,
              m_tds_amount,
              m_gst_percentage,
              m_gst_amount,
              m_total_amount,
              statusValue,
              completedDate,
              fin.milestone_id || null,
              financialId,
            ]);
          } else {
            await projectService.addFinancialDetails(orgId, [
              id,
              fin.milestone_id || null,
              project_amount,
              tds_percentage,
              tds_amount,
              gst_percentage,
              gst_amount,
              total_amount,
              monthly_fixed_amount,
              service_description,
              fin.month_year,
              m_actual_percentage,
              m_actual_amount,
              m_tds_percentage,
              m_tds_amount,
              m_gst_percentage,
              m_gst_amount,
              m_total_amount,
              statusValue,
              completedDate,
            ]);
          }
        }
      }
    }

    return res.status(200).json({ message: "Project updated successfully" });
  } catch (error) {
    console.error("Error updating project:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};
