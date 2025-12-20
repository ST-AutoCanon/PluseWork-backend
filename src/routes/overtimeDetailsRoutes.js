// src/routes/overtimeDetailsRoutes.js
const express = require('express');
const router = express.Router();
const overtimeController = require('./../handlers/overtimeDeailsHandler'); // Ensure path is correct

// Import all functions explicitly to avoid ReferenceError
const { bulkUpdateOvertime, fetchEmployeeExtraHours, upsertOvertimeRecords } = overtimeController;

// GET /api/compensation/employee-extra-hours - Fetch with statuses
router.get('/employee-extra-hours', fetchEmployeeExtraHours);

// POST /api/compensation/overtime-bulk - Older bulk update (keep for compatibility or remove)
router.post('/overtime-bulk', bulkUpdateOvertime);

// POST /api/compensation/overtime-upsert - New for insert/update
router.post('/overtime-upsert', upsertOvertimeRecords);

module.exports = router;