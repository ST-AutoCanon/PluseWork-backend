// handlers/invoiceHandler.js
const invoiceService = require("../services/invoiceService");

const resolveOrgIdFromReq = (req) => {
  return (
    req.headers["x-org-id"] ||
    req.headers["x_org_id"] ||
    req.body?.orgId ||
    req.query?.orgId ||
    null
  );
};

const getInvoices = async (req, res) => {
  const orgId = resolveOrgIdFromReq(req);
  const { projectId } = req.query;
  if (!projectId) {
    return res.status(400).json({ error: "projectId is required" });
  }
  if (!orgId) {
    return res.status(400).json({ error: "orgId header is required" });
  }

  try {
    const invoices = await invoiceService.getInvoicesByProject(
      orgId,
      projectId
    );
    res.json({ invoices });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createInvoice = async (req, res) => {
  const orgId = resolveOrgIdFromReq(req);
  const invoiceData = req.body;

  if (!orgId) {
    return res.status(400).json({ error: "orgId header is required" });
  }

  if (!invoiceData.projectId || !invoiceData.invoiceDate) {
    return res
      .status(400)
      .json({ error: "projectId and invoiceDate are required" });
  }

  try {
    const invoice = await invoiceService.createInvoice(invoiceData, orgId);
    res.status(201).json(invoice);
  } catch (error) {
    console.error("createInvoice error", error);
    res.status(500).json({ error: error.message });
  }
};

const updateInvoice = async (req, res) => {
  const orgId = resolveOrgIdFromReq(req);
  if (!orgId)
    return res.status(400).json({ error: "orgId header is required" });

  try {
    const updatedInvoice = await invoiceService.updateInvoice(
      orgId,
      req.params.id,
      req.body
    );
    res.json(updatedInvoice);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const updateInvoiceExtra = async (req, res) => {
  const orgId = resolveOrgIdFromReq(req);
  if (!orgId)
    return res.status(400).json({ error: "orgId header is required" });

  try {
    const invoiceData = req.body;

    const updatedInvoice = await invoiceService.updateInvoiceExtra(
      orgId,
      req.params.id,
      invoiceData
    );

    res.json(updatedInvoice);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const generateTemplateInvoice = async (req, res) => {
  // template generation uses master sequence but accepts orgId for acronym lookup
  const orgId = resolveOrgIdFromReq(req);
  const { invoiceType } = req.query;
  if (!invoiceType) {
    return res.status(400).json({ error: "invoiceType is required" });
  }
  try {
    const invoiceNo = await invoiceService.generateTemplateInvoiceNo(
      invoiceType,
      orgId
    );
    res.json({ invoiceNo });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateInvoiceSequence = async (req, res) => {
  const { invoiceType } = req.params;
  if (!invoiceType) {
    return res.status(400).json({ error: "invoiceType is required" });
  }

  try {
    const orgId = resolveOrgIdFromReq(req);
    const result = await invoiceService.updateSequence(invoiceType, orgId);
    res.json({ message: "Sequence updated successfully", ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const recordDownloadDetails = async (req, res, next) => {
  try {
    const orgId = resolveOrgIdFromReq(req);
    if (!orgId) {
      return res.status(400).json({ error: "orgId header is required" });
    }

    const { invoiceType, invoiceNumber, downloadDetails } = req.body;
    if (!invoiceType || !invoiceNumber || !downloadDetails) {
      return res.status(400).json({
        error: "invoiceType, invoiceNumber and downloadDetails are required",
      });
    }

    const record = await invoiceService.recordDownloadDetails(
      invoiceType,
      invoiceNumber,
      downloadDetails,
      orgId
    );

    res.status(201).json({ success: true, id: record.id });
  } catch (err) {
    next(err);
  }
};

const getDownloadDetails = async (req, res, next) => {
  try {
    const orgId = resolveOrgIdFromReq(req);
    if (!orgId) {
      return res.status(400).json({ error: "orgId header is required" });
    }
    const downloadDetails = await invoiceService.getAllDownloadDetails(orgId);
    res.json({ downloadDetails });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getInvoices,
  createInvoice,
  updateInvoice,
  generateTemplateInvoice,
  updateInvoiceSequence,
  updateInvoiceExtra,
  recordDownloadDetails,
  getDownloadDetails,
};
