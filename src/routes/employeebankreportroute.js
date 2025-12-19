// employeebankreport.route.js
const express = require('express');
const router = express.Router();
const { fetchEmployeeBankDetails } = require('./../handlers/employeebankreport.handler');

// POST /api/compensation/employee-personal-details
// Expects { employeeIds: [id1, id2, ...] } in body
router.post('/employee-personal-details', fetchEmployeeBankDetails);

module.exports = router;