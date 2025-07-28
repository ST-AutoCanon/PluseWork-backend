
// const attendanceService = require('../services/employeeloginService');

// // Debug log to verify import
// console.log('Imported attendanceService:', attendanceService);

// const getTodayAndYesterdayPunchData = async (req, res) => {
//   try {
//     console.log('[TODAY_YESTERDAY_PUNCHES] Fetching records...');
//     const punchData = await attendanceService.fetchTodayAndYesterdayData();
//     console.log('[TODAY_YESTERDAY_PUNCHES] Response data:', punchData);
//     res.status(200).json({ success: true, data: punchData });
//   } catch (error) {
//     console.error("[TODAY_YESTERDAY_PUNCHES] Error:", error.message);
//     res.status(500).json({ success: false, message: error.message });
//   }
// };

// module.exports = {
//   getTodayAndYesterdayPunchData
// };

const attendanceService = require('../services/employeeloginService');

// Debug log to verify import
console.log('Imported attendanceService:', attendanceService);

const getTodayAndYesterdayPunchData = async (req, res) => {
  try {
    const { org_id } = req.query; // Extract org_id from query parameters
    if (!org_id) {
      return res.status(400).json({ success: false, message: 'org_id is required' });
    }
    console.log('[TODAY_YESTERDAY_PUNCHES] Fetching records for org_id:', org_id);
    const punchData = await attendanceService.fetchTodayAndYesterdayData(org_id);
    console.log('[TODAY_YESTERDAY_PUNCHES] Response data:', punchData);
    res.status(200).json({ success: true, data: punchData });
  } catch (error) {
    console.error("[TODAY_YESTERDAY_PUNCHES] Error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getTodayAndYesterdayPunchData
};