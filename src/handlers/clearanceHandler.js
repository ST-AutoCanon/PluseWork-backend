


// src/handlers/clearanceHandler.js (correct version after fix)
const service = require("../services/clearanceService");

exports.getItems = async (req, res) => {
  const orgId = req.headers["x-org-id"];
  const { exitId } = req.params;
  const data = await service.getItems(orgId, exitId);
  res.json({ success: true, data });
};

exports.addItem = async (req, res) => {
  const orgId = req.headers["x-org-id"];
  const createdBy = req.headers["x-employee-id"];
  const id = await service.addItem({ ...req.body, orgId, createdBy });
  res.status(201).json({ success: true, itemId: id });
};

exports.updateStatus = async (req, res) => {
  const orgId = req.headers["x-org-id"];
  await service.updateStatus(orgId, req.params.itemId, req.body.status);
  res.json({ success: true });
};

exports.approveItem = async (req, res) => {
  try {
    const orgId = req.headers["x-org-id"];
    const approverEmployeeId = req.headers["x-employee-id"];
    const { itemId } = req.params;
    const { approved, approvalAs } = req.body;

    if (!orgId || !itemId || approved === undefined || !approverEmployeeId || !approvalAs) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    const success = await service.approveItem(
      orgId,
      itemId,
      approved,
      approverEmployeeId,
      approvalAs
    );

    res.json({ 
      success: true, 
      message: `${approvalAs} approval updated successfully` 
    });
  } catch (err) {
    console.error("Approve item handler error:", err);
    res.status(500).json({ 
      error: err.message || "Failed to update approval" 
    });
  }
};


exports.finalizeExit = async (req, res) => {
  const orgId = req.headers["x-org-id"];
  const { exitId } = req.body;

  try {
    await service.finalizeExit(orgId, exitId);
    res.json({ 
      success: true, 
      message: "Exit finalized and employee marked as Inactive" 
    });
  } catch (err) {
    console.error("[FINALIZE HANDLER ERROR]", err);
    res.status(500).json({ 
      error: err.message || "Failed to finalize exit" 
    });
  }
};

// That's it — no more code in this file