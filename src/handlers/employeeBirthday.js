
const {
  fetchEmployeeBirthday,
} = require("../services/employeeBirthday");

const getEmployeeBirthday = async (req, res) => {
  try {
    const { email } = req.params;

    if (!email) {
      return res.status(400).json({
        message: "Email is required.",
      });
    }

    const result = await fetchEmployeeBirthday(req, email);

    return res.status(200).json(result);
  } catch (error) {
    console.error(
      "Error fetching birthday/work anniversary:",
      error
    );

    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

module.exports = {
  getEmployeeBirthday,
};