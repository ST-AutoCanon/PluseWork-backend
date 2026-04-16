

// src/handlers/clearanceHandler.js (correct version after fix)
const service = require("../services/clearanceService");

exports.getItems = async (req, res) => {
  const orgId = req.headers["x-org-id"];
  const { exitId } = req.params;
  console.log("\n=== GET ITEMS START ===");
  console.log("[getItems] orgId:", orgId, "exitId:", exitId);
  try {
    const data = await service.getItems(orgId, exitId);
    console.log("[getItems] Found items:", data.length);
    if (data.length > 0) {
      console.log("[getItems] First item sample:", {
        id: data[0].id,
        title: data[0].title,
        item_type: data[0].item_type,
        attached_files: data[0].attached_files
      });
    }
    console.log("=== GET ITEMS END (SUCCESS) ===\n");
    res.json({ success: true, data });
  } catch (err) {
    console.error("[getItems] ERROR:", err);
    console.log("=== GET ITEMS END (ERROR) ===\n");
    res.status(500).json({ error: err.message });
  }
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


// In clearanceHandler.js

exports.finalizeExit = async (req, res) => {
  const orgId = req.headers["x-org-id"];
  const actionBy = req.headers["x-employee-id"];
  const { exitId, overallRating, hrComments } = req.body;

  try {
    if (!exitId) {
      return res.status(400).json({ success: false, error: "exitId is required" });
    }

    await service.finalizeExit(orgId, exitId, overallRating, hrComments, actionBy);

    res.json({ 
      success: true, 
      message: "Exit finalized successfully with HR evaluation" 
    });
  } catch (err) {
    console.error("[FINALIZE HANDLER ERROR]", err);
    res.status(500).json({ 
      error: err.message || "Failed to finalize exit" 
    });
  }
};
// Update Final LWD during clearance stage (HR/Admin only)
exports.updateFinalLwd = async (req, res) => {
  const orgId = req.headers["x-org-id"];
  const actionBy = req.headers["x-employee-id"];   // optional, for audit
  const { exitId, finalLwd } = req.body;

  try {
    if (!exitId || !finalLwd) {
      return res.status(400).json({ 
        success: false, 
        error: "exitId and finalLwd are required" 
      });
    }

    await service.updateFinalLwd(orgId, exitId, finalLwd, actionBy);

    res.json({ 
      success: true, 
      message: "Final Last Working Day updated successfully" 
    });
  } catch (err) {
    console.error("[updateFinalLwd] Error:", err);
    res.status(500).json({ 
      success: false, 
      error: err.message || "Failed to update final LWD" 
    });
  }
};
// That's it — no more code in this file