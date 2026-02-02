// const service = require("../services/clearanceService");

// exports.getItems = async (req, res) => {
//   const orgId = req.headers["x-org-id"];
//   const { exitId } = req.params;
//   const data = await service.getItems(orgId, exitId);
//   res.json({ success: true, data });
// };

// exports.addItem = async (req, res) => {
//   const orgId = req.headers["x-org-id"];
//   const createdBy = req.headers["x-employee-id"];
//   const id = await service.addItem({ ...req.body, orgId, createdBy });
//   res.status(201).json({ success: true, itemId: id });
// };

// exports.updateStatus = async (req, res) => {
//   const orgId = req.headers["x-org-id"];
//   await service.updateStatus(orgId, req.params.itemId, req.body.status);
//   res.json({ success: true });
// };


// // exports.approveItem = async (req, res) => {
// //   try {
// //     const orgId = req.headers["x-org-id"];
// //     const approverEmployeeId = req.headers["x-employee-id"]; // who is clicking
// //     const { itemId } = req.params;
// //     const { approved } = req.body;

// //     if (!orgId || !itemId || approved === undefined || !approverEmployeeId) {
// //       return res.status(400).json({ error: "Missing required parameters" });
// //     }

// //     const success = await service.approveItem(orgId, itemId, approved, approverEmployeeId);

// //     if (!success) {
// //       return res.status(404).json({ error: "Item not found or already fully approved" });
// //     }

// //     res.json({ success: true, message: "Approval updated" });
// //   } catch (err) {
// //     console.error("Approve item handler error:", err);
// //     res.status(500).json({ error: err.message || "Failed to update approval" });
// //   }
// // };


// router.put("/item/:itemId", upload.array('files', 5), async (req, res) => {
//   try {
//     const { itemId } = req.params;
//     const orgId = req.headers["x-org-id"];
//     const updatedBy = req.headers["x-employee-id"];

//     const {
//       exitId,
//       title,
//       description,
//       plannedDate,
//       status,
//       completedDate,
//       filesToDelete = []
//     } = req.body;

//     if (!exitId) {
//       return res.status(400).json({ error: "exitId is required" });
//     }

//     const allItems = await clearanceService.getItems(orgId, exitId);
//     const currentItem = allItems.find(item => item.id === Number(itemId));

//     if (!currentItem) {
//       return res.status(404).json({ error: "Item not found" });
//     }

//     let currentFiles = currentItem.attached_files || [];
//     if (typeof currentFiles === 'string') currentFiles = JSON.parse(currentFiles);

//     currentFiles = currentFiles.filter(path => !filesToDelete.includes(path));

//     const newFiles = req.files?.map(f => `exitflowuploads/${f.filename}`) || [];
//     currentFiles.push(...newFiles);

//     const updateData = {
//       title: title || currentItem.title,
//       description: description !== undefined ? description : currentItem.description,
//       planned_date: plannedDate || currentItem.planned_date,
//       status: status || currentItem.status,
//       actual_completed_date: completedDate || 
//         (status === "completed" ? new Date().toISOString().split('T')[0] : currentItem.actual_completed_date),
//       attached_files: currentFiles.length > 0 ? JSON.stringify(currentFiles) : null,
//       updated_by: updatedBy,
//       updated_at: new Date()
//     };

//     // This is the clean way — no direct pool here
//     await clearanceService.updateItem(orgId, itemId, updateData);

//     res.json({
//       success: true,
//       message: "KT item updated successfully",
//       attached_files: currentFiles
//     });

//   } catch (err) {
//     console.error("[UPDATE KT ERROR]", err);
//     res.status(500).json({ error: err.message || "Failed to update KT" });
//   }
// });
// // NEW: PUT route for editing/updating item
// router.put("/item/:itemId", upload.array('files', 5), async (req, res) => {
//   try {
//     const { itemId } = req.params;
//     const orgId = req.headers["x-org-id"];
//     const updatedBy = req.headers["x-employee-id"];

//     const {
//       exitId,
//       title,
//       description,
//       plannedDate,
//       status,
//       completedDate,
//       filesToDelete = []
//     } = req.body;

//     if (!exitId) {
//       return res.status(400).json({ error: "exitId is required" });
//     }

//     // Get all items and find the one to update
//     const allItems = await clearanceService.getItems(orgId, exitId);
//     const currentItem = allItems.find(item => item.id === Number(itemId));

//     if (!currentItem) {
//       return res.status(404).json({ error: "Item not found" });
//     }

//     let currentFiles = currentItem.attached_files || [];
//     if (typeof currentFiles === 'string') currentFiles = JSON.parse(currentFiles);

//     currentFiles = currentFiles.filter(path => !filesToDelete.includes(path));

//     const newFiles = req.files?.map(f => `exitflowuploads/${f.filename}`) || [];
//     currentFiles.push(...newFiles);

//     const updateData = {
//       title: title || currentItem.title,
//       description: description !== undefined ? description : currentItem.description,
//       planned_date: plannedDate || currentItem.planned_date,
//       status: status || currentItem.status,
//       actual_completed_date: completedDate || 
//         (status === "completed" ? new Date().toISOString().split('T')[0] : currentItem.actual_completed_date),
//       attached_files: currentFiles.length > 0 ? JSON.stringify(currentFiles) : null,
//       updated_by: updatedBy,
//       updated_at: new Date()
//     };

//     // Use service update (recommended)
//     await clearanceService.updateItem(orgId, itemId, updateData);

//     // Alternative: if you don't have updateItem yet, you can use direct query here
//     // but only AFTER importing getTenantPoolByOrgId at the top of this file

//     res.json({
//       success: true,
//       message: "KT item updated successfully",
//       attached_files: currentFiles
//     });
//   } catch (err) {
//     console.error("[UPDATE KT ERROR]", err);
//     res.status(500).json({ error: err.message || "Failed to update KT" });
//   }
// });
// exports.finalizeExit = async (req, res) => {
//   console.log("[FINALIZE] Request received", req.body, req.headers);
//   const orgId = req.headers["x-org-id"];
//   const exitId = req.body.exitId;
//   console.log("[FINALIZE] Params:", { orgId, exitId });
//   try {
//     await service.finalizeExit(orgId, exitId);
//     console.log("[FINALIZE] Success for exitId:", exitId);
//     res.json({ success: true, message: "Exit finalized" });
//   } catch (err) {
//     console.error("[FINALIZE] Error:", err);
//     res.status(500).json({ error: err.message || "Finalize failed" });
//   }
// };


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
  console.log("[FINALIZE] Request received", req.body, req.headers);
  const orgId = req.headers["x-org-id"];
  const exitId = req.body.exitId;
  console.log("[FINALIZE] Params:", { orgId, exitId });
  try {
    await service.finalizeExit(orgId, exitId);
    console.log("[FINALIZE] Success for exitId:", exitId);
    res.json({ success: true, message: "Exit finalized" });
  } catch (err) {
    console.error("[FINALIZE] Error:", err);
    res.status(500).json({ error: err.message || "Finalize failed" });
  }
};

// That's it — no more code in this file