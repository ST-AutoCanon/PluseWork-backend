// // // const express = require("express");
// // // const router = express.Router();
// // // const officeEmployeeHandler = require("../handlers/officeEmployeeHandler");

// // // router.get("/employees", officeEmployeeHandler.getAllEmployees);
// // // router.get(
// // //   "/:officeLocationId/employees",
// // //   officeEmployeeHandler.getEmployeesByOfficeLocation
// // // );
// // // router.put(
// // //   "/:officeLocationId/assign-employees",
// // //   officeEmployeeHandler.assignEmployeesToOffice
// // // );
// // // router.put(
// // //   "/:officeLocationId/sync-employees",
// // //   officeEmployeeHandler.syncOfficeEmployees
// // // );
// // // router.delete(
// // //   "/:officeLocationId/remove-employee/:employeeId",
// // //   officeEmployeeHandler.removeEmployeeFromOffice
// // // );

// // // module.exports = router;

// // const express = require("express");
// // const router = express.Router();
// // const officeEmployeeHandler = require("../handlers/officeEmployeeHandler");

// // router.get("/employees", officeEmployeeHandler.getAllEmployees);

// // router.get(
// //   "/:officeLocationId/employees",
// //   officeEmployeeHandler.getEmployeesByOfficeLocation
// // );

// // router.put(
// //   "/:officeLocationId/assign-employees",
// //   officeEmployeeHandler.assignEmployeesToOffice
// // );

// // router.put(
// //   "/:officeLocationId/sync-employees",
// //   officeEmployeeHandler.syncOfficeEmployees
// // );

// // router.delete(
// //   "/:officeLocationId/remove-employee/:employeeId",
// //   officeEmployeeHandler.removeEmployeeFromOffice
// // );

// // module.exports = router;


// const express = require("express");
// const router = express.Router();
// const officeEmployeeHandler = require("../handlers/officeEmployeeHandler");

// router.get("/employees", officeEmployeeHandler.getAllEmployees);

// router.get(
//   "/:officeLocationId/employees",
//   officeEmployeeHandler.getEmployeesByOfficeLocation
// );

// // NEW: pre-check conflicts before assign
// router.post(
//   "/:officeLocationId/check-assignments",
//   officeEmployeeHandler.checkEmployeeAssignments
// );

// router.put(
//   "/:officeLocationId/assign-employees",
//   officeEmployeeHandler.assignEmployeesToOffice
// );

// router.put(
//   "/:officeLocationId/sync-employees",
//   officeEmployeeHandler.syncOfficeEmployees
// );

// router.delete(
//   "/:officeLocationId/remove-employee/:employeeId",
//   officeEmployeeHandler.removeEmployeeFromOffice
// );

// module.exports = router;

const express = require("express");
const router = express.Router();
const officeEmployeeHandler = require("../handlers/officeEmployeeHandler");

router.get("/employees", officeEmployeeHandler.getAllEmployees);

router.get(
  "/:officeLocationId/employees",
  officeEmployeeHandler.getEmployeesByOfficeLocation
);

// check selected employees before assignment
router.post(
  "/:officeLocationId/check-assignments",
  officeEmployeeHandler.checkEmployeeAssignments
);

router.put(
  "/:officeLocationId/assign-employees",
  officeEmployeeHandler.assignEmployeesToOffice
);

router.put(
  "/:officeLocationId/sync-employees",
  officeEmployeeHandler.syncOfficeEmployees
);

router.delete(
  "/:officeLocationId/remove-employee/:employeeId",
  officeEmployeeHandler.removeEmployeeFromOffice
);

module.exports = router;