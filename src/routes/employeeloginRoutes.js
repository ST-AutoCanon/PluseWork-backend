



const express = require('express');
const router = express.Router();
const { getTodayAndYesterdayPunchData } = require('../handlers/employeeloginHandler');

router.get('/today-yesterday-punches', getTodayAndYesterdayPunchData);

module.exports = router;