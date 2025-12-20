// employeebankreport.handler.js
const { getEmployeePersonalDetails } = require('./../services/employeebankreport.service');

async function fetchEmployeeBankDetails(req, res) {
  try {
    const { employeeIds } = req.body; // Expect array of employee IDs in request body
    if (!employeeIds || !Array.isArray(employeeIds)) {
      return res.status(400).json({ error: 'Invalid or missing employeeIds array' });
    }
    const details = await getEmployeePersonalDetails(employeeIds);
    const detailsMap = details.reduce((map, detail) => {
      map[detail.employee_id] = {
        pan_number: detail.pan_number || 'N/A',
        uan_number: detail.uan_number || 'N/A'
      };
      return map;
    }, {});
    res.json({ success: true, data: detailsMap });
  } catch (error) {
    console.error('Error fetching employee personal details:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { fetchEmployeeBankDetails };