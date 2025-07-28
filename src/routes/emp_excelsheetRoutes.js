// // const express = require('express');
// // const router = express.Router();
// // const { fetchAttendanceExcelData } = require('../handlers/emp_excelsheetHandler');

// // router.get('/emp-excelsheet', fetchAttendanceExcelData);

// // // module.exports = router;
// // const express = require('express');
// // const router = express.Router();
// // const { fetchAttendanceExcelData } = require('../handlers/emp_excelsheetHandler');

// // // Match the required endpoint: /api/employeelogin/punches
// // router.get('/employeelogin/punches', fetchAttendanceExcelData);

// // module.exports = router;


// const express = require('express');
// const router = express.Router();
// const { fetchAttendanceExcelData } = require('../handlers/emp_excelsheetHandler');

// router.get('/employeelogin/punches', fetchAttendanceExcelData);
// router.get('/emp-excelsheet', fetchAttendanceExcelData);

// module.exports = router;

const express = require('express');
const router = express.Router();
const { fetchAttendanceExcelData } = require('../handlers/emp_excelsheetHandler');

router.get('/emp-excelsheet', fetchAttendanceExcelData);

module.exports = router;