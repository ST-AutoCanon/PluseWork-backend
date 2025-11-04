

const { getEmployeesBySupervisorService } = require("../services/supervisorEmployeesService");

const getEmployeesBySupervisorHandler = async (req, res) => {
    try {
        const supervisorId = req.headers["x-employee-id"];

        if (!supervisorId) {
            return res.status(400).json({ error: "Supervisor ID is required in headers" });
        }

        const employees = await getEmployeesBySupervisorService(supervisorId);
        res.json({ supervisorId, employees });
    } catch (error) {
        console.error("Handler error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

module.exports = { getEmployeesBySupervisorHandler };
