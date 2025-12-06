const { getAttendanceExcelData } = require("../services/emp_excelsheetService");

const fetchAttendanceExcelData = async (req, res) => {
  try {
    const { from, to, org_id } = req.query;

    if (!from || !to || !org_id) {
      return res
        .status(400)
        .json({
          message: "Missing required query parameters: from, to, or org_id",
        });
    }

    const excelBuffer = await getAttendanceExcelData(from, to, org_id);

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="punch-data-${from}-to-${to}.xlsx"`
    );
    res.send(excelBuffer);
  } catch (error) {
    console.error("Error generating Excel:", error);
    const errorMessage = error.message || "Internal server error";
    res.status(500).json({ message: errorMessage });
  }
};

const getPunchDataJSON = async (req, res) => {
  const { from, to, org_id } = req.query;

  if (!from || !to || !org_id) {
    return res.status(400).json({ message: "Missing required parameters" });
  }

  try {
    const data = await db.execute(YOUR_QUERY_HERE, [
      org_id,
      from,
      to,
      from,
      to,
    ]);
    res.json(data[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching punch data" });
  }
};

module.exports = {
  fetchAttendanceExcelData,
};
