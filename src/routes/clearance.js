

const router = require("express").Router();
const h = require("../handlers/clearanceHandler");
const multer = require('multer');
const path = require('path');
const clearanceService = require("../services/clearanceService");

// MULTER SETUP – MUST BE HERE, BEFORE ROUTES
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = 'D:\\Pulse-11\\PluseWork-backend\\exitflowuploads';
    console.log("[MULTER] Using path:", uploadPath);
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
    const allowed = /pdf|doc|docx|png|jpg|jpeg|zip/;
    if (allowed.test(path.extname(file.originalname).toLowerCase()) &&
        allowed.test(file.mimetype)) {
      return cb(null, true);
    }
    cb(new Error('Invalid file type'));
  }
});



// Now your routes
router.get("/:exitId/items", h.getItems);

// ONLY THIS POST for adding item
router.post("/item", upload.array('files', 5), async (req, res) => {
  console.log("╔══════ NEW MULTER POST HANDLER RUNNING ══════╗");
  console.log("Content-Type:", req.headers['content-type']);
  console.log("Body:", req.body);
  console.log("Files:", req.files?.length || 0);

  try {
    const orgId = req.headers["x-org-id"];
    const createdBy = req.headers["x-employee-id"];
    const { exitId, itemType, title, description, plannedDate, status = 'pending' } = req.body;

    if (!orgId || !createdBy || !exitId || !itemType || !title) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const attachedFiles = req.files?.map(file => {
  return `exitflowuploads/${file.filename}`;
}) || [];
// routes



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

    console.log("Item created successfully - ID:", itemId);

    // Return the new item so frontend can update UI immediately
    res.status(201).json({ 
      success: true, 
      itemId,
      message: "Item added with file upload"
    });
  } catch (err) {
    console.error("[CLEARANCE POST ERROR]", err.stack);
    res.status(500).json({ error: err.message || "Failed to add item" });
  }
});
router.get("/exit/download/:filename", (req, res) => {
  const filePath = path.join(
    "D:/Pulse-11/PluseWork-backend/exitflowuploads",
    req.params.filename
  );

  res.setHeader("Content-Disposition", "attachment");
  res.download(filePath);
});
// ADD THIS NOW — the missing PUT route for editing
router.put("/item/:itemId", upload.array('files', 5), async (req, res) => {
  try {
    const { itemId } = req.params;
    const orgId = req.headers["x-org-id"];
    const updatedBy = req.headers["x-employee-id"];

    const {
      exitId,
      title,
      description,
      plannedDate,
      status,
      completedDate,
      filesToDelete = []
    } = req.body;

    if (!exitId) {
      return res.status(400).json({ error: "exitId is required" });
    }

    const allItems = await clearanceService.getItems(orgId, exitId);
    const currentItem = allItems.find(item => item.id === Number(itemId));

    if (!currentItem) {
      return res.status(404).json({ error: "Item not found" });
    }

    let currentFiles = currentItem.attached_files || [];
    if (typeof currentFiles === 'string') currentFiles = JSON.parse(currentFiles);

    currentFiles = currentFiles.filter(path => !filesToDelete.includes(path));

    const newFiles = req.files?.map(f => `exitflowuploads/${f.filename}`) || [];
    currentFiles.push(...newFiles);
const updateData = {
  title: title || currentItem.title,
  description: description !== undefined ? description : currentItem.description,
  planned_date: plannedDate || currentItem.planned_date,
  status: status || currentItem.status,
  actual_completed_date: completedDate || 
    (status === "completed" ? new Date().toISOString().split('T')[0] : currentItem.actual_completed_date),
  attached_files: currentFiles.length > 0 ? JSON.stringify(currentFiles) : null,
  // updated_by: updatedBy,   ← REMOVE or COMMENT THIS LINE
  // updated_at: new Date()   ← optional — MySQL auto-handles this
};

    await clearanceService.updateItem(orgId, itemId, updateData);

    res.json({
      success: true,
      message: "KT item updated successfully",
      attached_files: currentFiles
    });
  } catch (err) {
    console.error("[UPDATE KT ERROR]", err);
    res.status(500).json({ error: err.message || "Failed to update KT" });
  }
});
// Keep other routes: status, approve, finalize
router.put("/item/:itemId/status", h.updateStatus);
router.put("/item/:itemId/approve", h.approveItem);
router.post("/finalize", h.finalizeExit);

module.exports = router;