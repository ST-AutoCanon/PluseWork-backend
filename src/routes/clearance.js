const router = require("express").Router();
const h = require("../handlers/clearanceHandler");
const multer = require('multer');
const path = require('path');
const clearanceService = require("../services/clearanceService");

// ===== MULTER CONFIGURATION =====
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../../exitflowuploads');
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${unique}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /pdf|doc|docx|xls|xlsx|ppt|pptx|txt|png|jpg|jpeg|gif|zip/;
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (allowed.test(ext)) {
      return cb(null, true);
    }
    cb(new Error(`File type not allowed: ${ext}`));
  }
});

// ===== ROUTES =====

// GET all clearance items for an exit request
router.get("/:exitId/items", h.getItems);

// POST - Add new clearance item with file uploads
router.post("/item", upload.array('files', 5), async (req, res) => {
  try {
    console.log("\n=== CLEARANCE/POST START ===");
    console.log("[CLEARANCE/POST] Multer files received:", req.files?.length || 0);
    if (req.files?.length > 0) {
      console.log("[CLEARANCE/POST] Files details:", req.files.map(f => ({name: f.filename, size: f.size})));
    }
    console.log("[CLEARANCE/POST] Body keys:", Object.keys(req.body));
    console.log("[CLEARANCE/POST] Body:", req.body);

    const orgId = req.headers["x-org-id"];
    const createdBy = req.headers["x-employee-id"];
    const { exitId, itemType, title, description, plannedDate, status = 'pending' } = req.body;

    console.log("[CLEARANCE/POST] Headers - orgId:", orgId, "createdBy:", createdBy);
    console.log("[CLEARANCE/POST] Body - exitId:", exitId, "itemType:", itemType, "title:", title);

    if (!orgId || !createdBy || !exitId || !itemType || !title) {
      console.log("[CLEARANCE/POST] VALIDATION FAILED - Missing fields");
      return res.status(400).json({ error: "Missing required fields", received: { orgId, createdBy, exitId, itemType, title } });
    }

    // Build file paths
    const attachedFiles = (req.files || []).map(file => `exitflowuploads/${file.filename}`);
    console.log("[CLEARANCE/POST] File paths to store:", attachedFiles);

    // Call service to add item
    console.log("[CLEARANCE/POST] Calling service.addItem...");
    const itemId = await clearanceService.addItem({
      orgId,
      exitId,
      itemType,
      title,
      description: description || null,
      plannedDate: plannedDate || null,
      status,
      attachedFiles: attachedFiles.length > 0 ? attachedFiles : null,
      createdBy
    });

    console.log("[CLEARANCE/POST] Item created successfully - ID:", itemId, "Files count:", attachedFiles.length);
    console.log("=== CLEARANCE/POST END (SUCCESS) ===\n");

    res.status(201).json({
      success: true,
      itemId,
      filesCount: attachedFiles.length
    });

  } catch (err) {
    console.error("[CLEARANCE/POST] ERROR:", err.message);
    res.status(500).json({ error: err.message || "Failed to add item" });
  }
});

// PUT - Update clearance item with optional files
router.put("/item/:itemId", upload.array('files', 5), async (req, res) => {
  try {
    const { itemId } = req.params;
    const orgId = req.headers["x-org-id"];
    const { exitId, title, description, plannedDate, status, completedDate, filesToDelete = [] } = req.body;

    if (!exitId) {
      return res.status(400).json({ error: "exitId is required" });
    }

    // Get current item
    const allItems = await clearanceService.getItems(orgId, exitId);
    const currentItem = allItems.find(item => item.id === Number(itemId));

    if (!currentItem) {
      return res.status(404).json({ error: "Item not found" });
    }

    // Handle file paths
    let currentFiles = currentItem.attached_files || [];
    if (typeof currentFiles === 'string') {
      try {
        currentFiles = JSON.parse(currentFiles);
      } catch (e) {
        currentFiles = [];
      }
    }

    // Remove deleted files
    currentFiles = currentFiles.filter(filePath => !filesToDelete.includes(filePath));

    // Add new files
    const newFiles = (req.files || []).map(f => `exitflowuploads/${f.filename}`);
    currentFiles.push(...newFiles);

    // Build update data
    const updateData = {
      title: title || currentItem.title,
      description: description !== undefined ? description : currentItem.description,
      planned_date: plannedDate || currentItem.planned_date,
      status: status || currentItem.status,
      actual_completed_date: completedDate || (status === "completed" ? new Date().toISOString().split('T')[0] : currentItem.actual_completed_date),
      attached_files: currentFiles.length > 0 ? JSON.stringify(currentFiles) : null
    };

    await clearanceService.updateItem(orgId, itemId, updateData);

    res.json({
      success: true,
      message: "Item updated successfully",
      attached_files: currentFiles
    });

  } catch (err) {
    console.error("[CLEARANCE/PUT] ERROR:", err.message);
    res.status(500).json({ error: err.message || "Failed to update item" });
  }
});

// PUT - Update item status
router.put("/item/:itemId/status", h.updateStatus);

// PUT - Approve item
router.put("/item/:itemId/approve", h.approveItem);

// POST - Finalize exit clearance
router.post("/finalize", h.finalizeExit);

module.exports = router;