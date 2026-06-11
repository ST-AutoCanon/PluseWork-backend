const {
  addRecruitmentService,
  getRecruitmentCandidatesService,
  getRecruitmentAssessmentsService,
  getRecruitmentCandidateByIdService,
  updateRecruitmentService,
  advanceRecruitmentService,
  deleteRecruitmentService,
  assignInterviewService,
  updateTechnicalFeedbackService,
  updateHrFeedbackService,
  updateManagerFeedbackService,
  convertRecruitmentToEmployeeService,
  parseResumeService,
  getRecruitmentInterviewersService,
  getOrganizationById,
} = require("../services/recruitmentService");

const resolveOrgIdFromReq = (req) => {
  const header =
    req.headers && (req.headers["x-org-id"] || req.headers["x_org_id"]);
  const body = req.body && (req.body.orgId || req.body.org_id);
  const query = req.query && (req.query.orgId || req.query.org_id);
  const userOrg =
    req.user && (req.user.orgId || req.user.Org_id || req.user.org_id);
  return header || body || query || userOrg || null;
};

const addRecruitmentHandler = async (req, res) => {
  try {
    const orgId = resolveOrgIdFromReq(req);
    if (!orgId) return res.status(400).json({ message: "orgId is required" });

    if (!req.body?.name) {
      return res.status(400).json({ message: "Candidate name is required" });
    }

    await addRecruitmentService(req.body, req.file, orgId);
    return res.status(201).json({ message: "Candidate added successfully" });
  } catch (error) {
    console.error("addRecruitmentHandler error:", error);
    return res
      .status(500)
      .json({ message: error.message || "Internal Server Error" });
  }
};

const getRecruitmentHandler = async (req, res) => {
  try {
    const orgId = resolveOrgIdFromReq(req);
    if (!orgId) return res.status(400).json({ message: "orgId is required" });

    const candidates = await getRecruitmentCandidatesService(orgId);
    return res.status(200).json({ data: candidates });
  } catch (error) {
    console.error("getRecruitmentHandler error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

const getRecruitmentByIdHandler = async (req, res) => {
  try {
    const orgId = resolveOrgIdFromReq(req);
    const { id } = req.params;

    if (!orgId) return res.status(400).json({ message: "orgId is required" });

    const candidate = await getRecruitmentCandidateByIdService(id, orgId);
    if (!candidate) {
      return res.status(404).json({ message: "Candidate not found" });
    }

    return res.status(200).json({ data: candidate });
  } catch (error) {
    console.error("getRecruitmentByIdHandler error:", error);
    return res
      .status(500)
      .json({ message: error.message || "Internal Server Error" });
  }
};

const getRecruitmentAssessmentsHandler = async (req, res) => {
  try {
    const orgId = resolveOrgIdFromReq(req);
    const { id } = req.params;

    if (!orgId) return res.status(400).json({ message: "orgId is required" });

    const assessments = await getRecruitmentAssessmentsService(id, orgId);
    return res.status(200).json({ data: assessments });
  } catch (error) {
    console.error("getRecruitmentAssessmentsHandler error:", error);
    return res
      .status(500)
      .json({ message: error.message || "Internal Server Error" });
  }
};

const updateRecruitmentHandler = async (req, res) => {
  try {
    const orgId = resolveOrgIdFromReq(req);
    const { id } = req.params;

    if (!orgId) return res.status(400).json({ message: "orgId is required" });

    await updateRecruitmentService(id, req.body, req.file, orgId);
    return res.status(200).json({ message: "Candidate updated successfully" });
  } catch (error) {
    if (error.code === "NOT_FOUND") {
      return res.status(404).json({ message: error.message });
    }
    console.error("updateRecruitmentHandler error:", error);
    return res
      .status(500)
      .json({ message: error.message || "Internal Server Error" });
  }
};

const advanceRecruitmentHandler = async (req, res) => {
  try {
    const orgId = resolveOrgIdFromReq(req);
    const { id } = req.params;

    if (!orgId) return res.status(400).json({ message: "orgId is required" });

    await advanceRecruitmentService(id, req.body, orgId);
    return res
      .status(200)
      .json({ message: "Candidate stage updated successfully" });
  } catch (error) {
    if (error.code === "NOT_FOUND") {
      return res.status(404).json({ message: error.message });
    }
    console.error("advanceRecruitmentHandler error:", error);
    return res
      .status(500)
      .json({ message: error.message || "Internal Server Error" });
  }
};

const assignInterviewHandler = async (req, res) => {
  try {
    const orgId = resolveOrgIdFromReq(req);
    const { id } = req.params;

    if (!orgId) return res.status(400).json({ message: "orgId is required" });

    await assignInterviewService(id, req.body, orgId);
    return res
      .status(200)
      .json({ message: "Interview scheduled successfully" });
  } catch (error) {
    if (error.code === "NOT_FOUND") {
      return res.status(404).json({ message: error.message });
    }
    console.error("assignInterviewHandler error:", error);
    return res
      .status(500)
      .json({ message: error.message || "Internal Server Error" });
  }
};

const deleteRecruitmentHandler = async (req, res) => {
  try {
    const orgId = resolveOrgIdFromReq(req);
    const { id } = req.params;

    if (!orgId) return res.status(400).json({ message: "orgId is required" });

    await deleteRecruitmentService(id, orgId);
    return res.status(200).json({ message: "Candidate deleted successfully" });
  } catch (error) {
    console.error("deleteRecruitmentHandler error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

const technicalFeedbackHandler = async (req, res) => {
  try {
    const orgId = resolveOrgIdFromReq(req);
    const { id } = req.params;

    if (!orgId) return res.status(400).json({ message: "orgId is required" });

    await updateTechnicalFeedbackService(id, req.body, orgId);
    return res.status(200).json({ message: "Technical assessment saved" });
  } catch (error) {
    console.error("technicalFeedbackHandler error:", error);
    return res
      .status(500)
      .json({ message: error.message || "Internal Server Error" });
  }
};

const hrFeedbackHandler = async (req, res) => {
  try {
    const orgId = resolveOrgIdFromReq(req);
    const { id } = req.params;

    if (!orgId) return res.status(400).json({ message: "orgId is required" });

    await updateHrFeedbackService(id, req.body, orgId);
    return res.status(200).json({ message: "HR assessment saved" });
  } catch (error) {
    console.error("hrFeedbackHandler error:", error);
    return res
      .status(500)
      .json({ message: error.message || "Internal Server Error" });
  }
};

const managerFeedbackHandler = async (req, res) => {
  try {
    const orgId = resolveOrgIdFromReq(req);
    const { id } = req.params;

    if (!orgId) return res.status(400).json({ message: "orgId is required" });

    await updateManagerFeedbackService(id, req.body, orgId);
    return res.status(200).json({ message: "Manager assessment saved" });
  } catch (error) {
    console.error("managerFeedbackHandler error:", error);
    return res
      .status(500)
      .json({ message: error.message || "Internal Server Error" });
  }
};

const convertToEmployeeHandler = async (req, res) => {
  try {
    const orgId = resolveOrgIdFromReq(req);
    const { id } = req.params;

    if (!orgId) return res.status(400).json({ message: "orgId is required" });

    const result = await convertRecruitmentToEmployeeService(id, orgId);
    return res.status(200).json({
      message: "Candidate converted to employee successfully",
      employeeId: result.employeeId,
    });
  } catch (error) {
    if (error.code === "NOT_FOUND") {
      return res.status(404).json({ message: error.message });
    }
    console.error("convertToEmployeeHandler error:", error);
    return res
      .status(500)
      .json({ message: error.message || "Internal Server Error" });
  }
};

const parseResumeHandler = async (req, res) => {
  try {
    const orgId = resolveOrgIdFromReq(req);
    if (!orgId) return res.status(400).json({ message: "orgId is required" });

    if (!req.file) {
      return res.status(400).json({ message: "Resume file is required" });
    }

    const parsed = await parseResumeService(req.file, orgId);
    return res.status(200).json({ data: parsed });
  } catch (error) {
    console.error("parseResumeHandler error:", error);
    return res.status(500).json({
      message: error.message || "Failed to parse resume",
    });
  }
};

const getRecruitmentInterviewersHandler = async (req, res) => {
  try {
    const orgId = resolveOrgIdFromReq(req);
    if (!orgId) return res.status(400).json({ message: "orgId is required" });

    const employees = await getRecruitmentInterviewersService(orgId);
    return res.status(200).json({ data: employees });
  } catch (error) {
    console.error("getRecruitmentInterviewersHandler error:", error);
    return res
      .status(500)
      .json({ message: error.message || "Failed to load interviewers" });
  }
};

const getOrganizationHandler = async (req, res) => {
  try {
    const orgId = resolveOrgIdFromReq(req);
    if (!orgId) return res.status(400).json({ message: "orgId is required" });

    const organization = await getOrganizationById(orgId);
    return res.status(200).json({ data: organization });
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
};

module.exports = {
  addRecruitmentHandler,
  getRecruitmentHandler,
  getRecruitmentByIdHandler,
  getRecruitmentAssessmentsHandler,
  updateRecruitmentHandler,
  advanceRecruitmentHandler,
  assignInterviewHandler,
  deleteRecruitmentHandler,
  technicalFeedbackHandler,
  hrFeedbackHandler,
  managerFeedbackHandler,
  convertToEmployeeHandler,
  parseResumeHandler,
  getRecruitmentInterviewersHandler,
  getOrganizationHandler,
};
