const punchPolicyService = require("../services/punchPolicyService");

function getHeaders(req) {
  return {
    orgId:
      req.headers["x-org-id"] ||
      req.headers["x-orgid"] ||
      req.body?.orgId ||
      req.body?.org_id ||
      null,
    employeeId:
      req.headers["x-employee-id"] ||
      req.headers["x-employeeid"] ||
      req.body?.employeeId ||
      req.body?.employee_id ||
      null,
    role: req.headers["x-role"] || req.body?.role || "",
  };
}

function send(res, result) {
  const status = result?.status || (result?.success ? 200 : 500);
  return res.status(status).json(result);
}

async function listPoliciesHandler(req, res) {
  try {
    const { orgId } = getHeaders(req);
    const search = req.query?.search || req.query?.q || "";

    const result = await punchPolicyService.listPolicies({
      orgId,
      search,
    });
    return send(res, result);
  } catch (err) {
    console.error("[listPoliciesHandler]", err);
    return res.status(500).json({
      success: false,
      status: 500,
      message: err?.message || "Internal server error.",
    });
  }
}

async function getPolicyByIdHandler(req, res) {
  try {
    const { orgId } = getHeaders(req);
    const id = req.params?.id;

    const result = await punchPolicyService.getPolicyById({ orgId, id });
    return send(res, result);
  } catch (err) {
    console.error("[getPolicyByIdHandler]", err);
    return res.status(500).json({
      success: false,
      status: 500,
      message: err?.message || "Internal server error.",
    });
  }
}

async function createPolicyHandler(req, res) {
  try {
    const { orgId, employeeId } = getHeaders(req);
    const payload = req.body || {};

    const result = await punchPolicyService.createPolicy({
      orgId,
      employeeId,
      payload,
    });
    return send(res, result);
  } catch (err) {
    console.error("[createPolicyHandler]", err);
    return res.status(500).json({
      success: false,
      status: 500,
      message: err?.message || "Internal server error.",
    });
  }
}

async function updatePolicyHandler(req, res) {
  try {
    const { orgId, employeeId } = getHeaders(req);
    const id = req.params?.id;
    const payload = req.body || {};

    const result = await punchPolicyService.updatePolicy({
      orgId,
      employeeId,
      id,
      payload,
    });
    return send(res, result);
  } catch (err) {
    console.error("[updatePolicyHandler]", err);
    return res.status(500).json({
      success: false,
      status: 500,
      message: err?.message || "Internal server error.",
    });
  }
}

async function deletePolicyHandler(req, res) {
  try {
    const { orgId, employeeId } = getHeaders(req);
    const id = req.params?.id;

    const result = await punchPolicyService.deletePolicy({
      orgId,
      employeeId,
      id,
    });
    return send(res, result);
  } catch (err) {
    console.error("[deletePolicyHandler]", err);
    return res.status(500).json({
      success: false,
      status: 500,
      message: err?.message || "Internal server error.",
    });
  }
}

async function getDepartmentsHandler(req, res) {
  try {
    const { orgId } = getHeaders(req);
    const result = await punchPolicyService.getDepartments({ orgId });
    return send(res, result);
  } catch (err) {
    console.error("[getDepartmentsHandler]", err);
    return res.status(500).json({
      success: false,
      status: 500,
      message: err?.message || "Internal server error.",
    });
  }
}

async function getEmployeesHandler(req, res) {
  try {
    const { orgId } = getHeaders(req);
    const search = req.query?.search || req.query?.q || "";

    const result = await punchPolicyService.getEmployeesForAssignment({
      orgId,
      search,
    });
    return send(res, result);
  } catch (err) {
    console.error("[getEmployeesHandler]", err);
    return res.status(500).json({
      success: false,
      status: 500,
      message: err?.message || "Internal server error.",
    });
  }
}

module.exports = {
  listPoliciesHandler,
  getPolicyByIdHandler,
  createPolicyHandler,
  updatePolicyHandler,
  deletePolicyHandler,
  getDepartmentsHandler,
  getEmployeesHandler,
};
