// const express = require("express");
// const router = express.Router();
// const taskHandler = require("../handlers/taskhandler");

// router.post("/", taskHandler.createTask);
// router.get("/", taskHandler.getAllTasks);
// router.get("/:id", taskHandler.getTaskById);
// router.put("/:id", taskHandler.updateTask);
// router.delete("/:id", taskHandler.deleteTask);

// module.exports = router;

const express = require("express");
const router = express.Router();
const taskHandler = require("../handlers/taskhandler");

router.post("/", taskHandler.createTask);
router.get("/", taskHandler.getAllTasks);
router.get("/:id", taskHandler.getTaskById);
// router.put("/:id", taskHandler.updateTask);
router.delete("/:id", taskHandler.deleteTask);

module.exports = router;