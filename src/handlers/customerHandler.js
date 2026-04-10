const customerService = require("../services/customerService");

function resolveOrgIdFromReq(req) {
  const header =
    req.headers && (req.headers["x-org-id"] || req.headers["x_org_id"]);
  const body = req.body && (req.body.orgId || req.body.org_id);
  const query = req.query && (req.query.orgId || req.query.org_id);
  return header || body || query || null;
}

exports.createCustomer = async (req, res) => {
  try {
    const orgId = resolveOrgIdFromReq(req);
    if (!orgId) {
      return res
        .status(400)
        .json({ error: "orgId header or body is required" });
    }

    const {
      company_name,
      company_gst,
      company_pan,
      company_address,
      country,
      state,
      project_poc_name,
      project_poc_contact,
    } = req.body;

    if (!company_name) {
      return res.status(400).json({ error: "company_name is required" });
    }

    const customerId = await customerService.createCustomer(orgId, [
      company_name,
      company_gst || null,
      company_pan || null,
      company_address || null,
      country || null,
      state || null,
      project_poc_name || null,
      project_poc_contact || null,
    ]);

    return res.status(201).json({
      message: "Customer created successfully",
      customerId,
    });
  } catch (error) {
    console.error("Error creating customer:", error);
    return res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
  }
};

exports.getCustomers = async (req, res) => {
  try {
    const orgId = resolveOrgIdFromReq(req);
    if (!orgId) {
      return res.status(400).json({ error: "orgId header is required" });
    }

    const customers = await customerService.getCustomers(orgId);
    return res.status(200).json({ customers });
  } catch (error) {
    console.error("Error fetching customers:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.getCustomerById = async (req, res) => {
  try {
    const orgId = resolveOrgIdFromReq(req);
    const { id } = req.params;

    if (!orgId) {
      return res.status(400).json({ error: "orgId header is required" });
    }

    const customer = await customerService.getCustomerById(orgId, id);
    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    return res.status(200).json({ customer });
  } catch (error) {
    console.error("Error fetching customer:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.updateCustomer = async (req, res) => {
  try {
    const orgId = resolveOrgIdFromReq(req);
    const { id } = req.params;

    if (!orgId) {
      return res.status(400).json({ error: "orgId header is required" });
    }

    const existing = await customerService.getCustomerById(orgId, id);
    if (!existing) {
      return res.status(404).json({ message: "Customer not found" });
    }

    const {
      company_name,
      company_gst,
      company_pan,
      company_address,
      country,
      state,
      project_poc_name,
      project_poc_contact,
    } = req.body;

    await customerService.updateCustomer(orgId, id, [
      company_name ?? existing.company_name,
      company_gst ?? existing.company_gst,
      company_pan ?? existing.company_pan,
      company_address ?? existing.company_address,
      country ?? existing.country,
      state ?? existing.state,
      project_poc_name ?? existing.project_poc_name,
      project_poc_contact ?? existing.project_poc_contact,
    ]);

    return res.status(200).json({ message: "Customer updated successfully" });
  } catch (error) {
    console.error("Error updating customer:", error);
    return res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
  }
};
