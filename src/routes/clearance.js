// // const router = require("express").Router();
// // const h = require("../handlers/clearanceHandler");

// // router.get("/:exitId/items", h.getItems);
// // router.post("/item", h.addItem);
// // router.put("/item/:itemId/status", h.updateStatus);
// // router.put("/item/:itemId/approve", h.approveItem);
// // router.post("/finalize", h.finalizeExit);



// // // ... all your existing routes (apply, withdraw, supervisor/action, hr/final-approve, clearance/propose, etc.)

// // // ───────────────────────────────────────────────
// // // NEW: Clearance item creation with file upload support
// // // ───────────────────────────────────────────────

// // const multer = require('multer');
// // const path = require('path');
// // const clearanceService = require("../services/clearanceService");

// // // Multer config: Store in exitflowuploads, unique filenames
// // const storage = multer.diskStorage({
// //   destination: (req, file, cb) => {
// //     // Use relative path from project root
// //     // Assuming routes/exit.js is in src/routes/ or similar
// //     cb(null, path.join(__dirname, '../../exitflowuploads')); // Adjust levels if needed
// //     // If routes/exit.js is directly in backend root → use: path.join(__dirname, '../exitflowuploads')
// //   },
// //   filename: (req, file, cb) => {
// //     const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
// //     const ext = path.extname(file.originalname).toLowerCase();
// //     cb(null, `${uniqueSuffix}${ext}`);
// //   }
// // });

// // const upload = multer({
// //   storage,
// //   limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max per file
// //   fileFilter: (req, file, cb) => {
// //     const allowedTypes = /pdf|doc|docx|png|jpg|jpeg|zip/;
// //     const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
// //     const mimetype = allowedTypes.test(file.mimetype);
// //     if (extname && mimetype) return cb(null, true);
// //     cb(new Error('Only PDF, Word, images, and ZIP allowed!'));
// //   }
// // });

// // // POST /api/clearance/item - Add KT or Asset item with file uploads
// // router.post('/clearance/item', upload.array('files', 5), async (req, res) => {
// //   try {
// //     const orgId = req.headers["x-org-id"];
// //     const createdBy = req.headers["x-employee-id"];
// //     const { exitId, itemType, title, description, plannedDate, status = 'pending' } = req.body;

// //     if (!orgId || !createdBy || !exitId || !itemType || !title) {
// //       return res.status(400).json({ error: "Missing required fields" });
// //     }

// //     // Generate full public URLs
// //     const attachedFiles = req.files?.map(file => {
// //       return `${req.protocol}://${req.get('host')}/exitflowuploads/${file.filename}`;
// //     }) || [];

// //     const itemId = await clearanceService.addItem({
// //       orgId,
// //       exitId,
// //       itemType,
// //       title,
// //       description: description || null,
// //       plannedDate: plannedDate || null,
// //       status,
// //       attachedFiles: attachedFiles.length > 0 ? attachedFiles : null,
// //       createdBy
// //     });

// //     res.status(201).json({ success: true, itemId });
// //   } catch (err) {
// //     console.error("[UPLOAD ERROR]", err);
// //     res.status(500).json({ error: err.message || "Upload failed" });
// //   }
// // });

// // // Keep this at the very end

// // module.exports = router;


// const router = require("express").Router();
// const h = require("../handlers/clearanceHandler");
// const multer = require('multer');
// const path = require('path');
// const clearanceService = require("../services/clearanceService");

// // ───────────────────────────────────────────────
// // Clearance Routes
// // ───────────────────────────────────────────────

// // GET all items for an exit request
// router.get("/:exitId/items", h.getItems);

// // POST new clearance item (KT or Asset) with file uploads - replaces old /item
// router.post("/item", upload.array('files', 5), async (req, res) => {
//   try {
//     const orgId = req.headers["x-org-id"];
//     const createdBy = req.headers["x-employee-id"];
//     const { exitId, itemType, title, description, plannedDate, status = 'pending' } = req.body;

//     if (!orgId || !createdBy || !exitId || !itemType || !title) {
//       return res.status(400).json({ error: "Missing required fields" });
//     }

//     console.log("[CLEARANCE/ITEM] Files received:", req.files?.length || 0);

//     // Generate public URLs
//     const attachedFiles = req.files?.map(file => {
//       const url = `${req.protocol}://${req.get('host')}/exitflowuploads/${file.filename}`;
//       console.log("[CLEARANCE/ITEM] Generated URL:", url);
//       return url;
//     }) || [];

//     const itemId = await clearanceService.addItem({
//       orgId,
//       exitId,
//       itemType,
//       title,
//       description: description || null,
//       plannedDate: plannedDate || null,
//       status,
//       attachedFiles: attachedFiles.length > 0 ? attachedFiles : null,
//       createdBy
//     });

//     res.status(201).json({ success: true, itemId });
//   } catch (err) {
//     console.error("[UPLOAD ERROR]", err);
//     res.status(500).json({ error: err.message || "Upload failed" });
//   }
// });

// // Update status
// router.put("/item/:itemId/status", h.updateStatus);

// // Approve item
// router.put("/item/:itemId/approve", h.approveItem);

// // Finalize exit
// router.post("/finalize", h.finalizeExit);

// // Multer config (moved here so it's shared)
// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     const uploadPath = path.join(__dirname, '../../exitflowuploads');
//     console.log("[MULTER] Destination:", uploadPath);
//     cb(null, uploadPath);
//   },
//   filename: (req, file, cb) => {
//     const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
//     const ext = path.extname(file.originalname).toLowerCase();
//     const filename = `${uniqueSuffix}${ext}`;
//     console.log("[MULTER] Saving file as:", filename);
//     cb(null, filename);
//   }
// });

// const upload = multer({
//   storage,
//   limits: { fileSize: 10 * 1024 * 1024 },
//   fileFilter: (req, file, cb) => {
//     const allowed = /pdf|doc|docx|png|jpg|jpeg|zip/;
//     const extname = allowed.test(path.extname(file.originalname).toLowerCase());
//     const mimetype = allowed.test(file.mimetype);
//     if (extname && mimetype) return cb(null, true);
//     cb(new Error('Only PDF, Word, images, and ZIP allowed!'));
//   }
// });

// module.exports = router;
// clearance.js – top of file

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