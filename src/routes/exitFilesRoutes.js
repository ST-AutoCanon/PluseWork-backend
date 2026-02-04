

// routes/exitFilesRoutes.js
const express = require('express');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Dynamically resolve uploads folder
const UPLOADS_FOLDER = path.resolve(process.cwd(), 'exitflowuploads');

// GET file by name
router.get('/:filename', (req, res) => {
  const { filename } = req.params;

  if (!filename) return res.status(400).json({ success: false, error: 'Filename required' });

  const filePath = path.join(UPLOADS_FOLDER, filename);

  // Check if file exists
  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) return res.status(404).json({ success: false, error: 'File not found' });

    res.sendFile(filePath);
  });
});

module.exports = router;
