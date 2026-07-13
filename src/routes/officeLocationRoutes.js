

// // const express = require("express");
// // const router = express.Router();
// // const officeLocationHandler = require("../handlers/officeLocationHandler");

// // router.post("/create", officeLocationHandler.createOfficeLocation);
// // router.get("/list", officeLocationHandler.getAllOfficeLocations);

// // module.exports = router;

// const express = require("express");
// const router = express.Router();
// const officeLocationHandler = require("../handlers/officeLocationHandler");

// router.post("/create", officeLocationHandler.createOfficeLocation);
// router.get("/list", officeLocationHandler.getAllOfficeLocations);
// router.put("/update/:id", officeLocationHandler.updateOfficeLocation);
// router.delete("/delete/:id", officeLocationHandler.deleteOfficeLocation);

// module.exports = router;

const express = require("express");
const router = express.Router();
const officeLocationHandler = require("../handlers/officeLocationHandler");

router.post("/create", officeLocationHandler.createOfficeLocation);
router.get("/list", officeLocationHandler.getAllOfficeLocations);
router.put("/update/:id", officeLocationHandler.updateOfficeLocation);
router.delete("/delete/:id", officeLocationHandler.deleteOfficeLocation);

module.exports = router;