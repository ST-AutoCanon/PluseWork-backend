const express = require("express");
const router = express.Router();

const PunchPolicyHandler = require("../handlers/punchPolicyHandler");

/**
 * Punch Policy routes
 * Mount at: app.use("/api/punch-policy", punchPolicyRoutes);
 *
 * Headers required:
 *   x-api-key, x-employee-id, x-org-id, x-role
 *
 * IMPORTANT: static routes must be registered BEFORE /:id
 */

router.get("/departments", PunchPolicyHandler.getDepartmentsHandler);
router.get("/employees", PunchPolicyHandler.getEmployeesHandler);

router.get("/", PunchPolicyHandler.listPoliciesHandler);
router.get("/:id", PunchPolicyHandler.getPolicyByIdHandler);
router.post("/", PunchPolicyHandler.createPolicyHandler);
router.put("/:id", PunchPolicyHandler.updatePolicyHandler);
router.delete("/:id", PunchPolicyHandler.deletePolicyHandler);

module.exports = router;
