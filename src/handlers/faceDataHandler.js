const {
  saveFaceDataService,
  getFaceDataByEmployeeService,
} = require("../services/faceDataService");

const handleSaveFaceData = async (req, res) => {
  const { employee_id, descriptors } = req.body;

  if (!employee_id || !descriptors) {
    return res
      .status(400)
      .json({ error: "Missing employee_id or descriptors" });
  }

  try {
    await saveFaceDataService(employee_id, descriptors);
    res.status(201).json({ message: "Face data saved successfully" });
  } catch (error) {
    console.error("Error saving face data:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const handleGetFaceData = async (req, res) => {
  const { employee_id } = req.params;

  try {
    const faceData = await getFaceDataByEmployeeService(employee_id);

    if (!faceData) {
      return res
        .status(404)
        .json({ message: "No face data found for this employee" });
    }

    res.json(faceData);
  } catch (error) {
    console.error("Error fetching face data:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = {
  handleSaveFaceData,
  handleGetFaceData,
};
