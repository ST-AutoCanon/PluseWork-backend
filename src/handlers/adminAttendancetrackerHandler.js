/////////////////////////
/////////////////////
//////////////

const adminAttendencetrackerService = require("../services/adminAttendancetrackerService");

const getMissingPunchInEmployeesHandler = async (req, res) => {
  try {
    const missingPunchInEmployees = await adminAttendencetrackerService.getMissingPunchInEmployees();
    res.status(200).json({ success: true, data: missingPunchInEmployees });
  } catch (error) {
    console.error("Error in getMissingPunchInEmployeesHandler:", error);
    res.status(500).json({ success: false, message: "Error fetching missing punch-in employees" });
  }
};

const getEmployeesWithPunchInNotPunchedOutHandler = async (req, res) => {
  try {
    const employeesWithPunchInNotPunchedOut = await adminAttendencetrackerService.getEmployeesWithPunchInNotPunchedOut();
    res.status(200).json({ success: true, data: employeesWithPunchInNotPunchedOut });
  } catch (error) {
    console.error("Error in getEmployeesWithPunchInNotPunchedOutHandler:", error);
    res.status(500).json({ success: false, message: "Error fetching employees with punch-in but not punched out" });
  }
};
const getEmployeesWorkedLessThan8HoursHandler = async (req, res) => {
  try {
    const employees = await adminAttendencetrackerService.getEmployeesWorkedLessThan8Hours();
    res.status(200).json({ success: true, data: employees });
  } catch (error) {
    console.error("Error in getEmployeesWorkedLessThan8HoursHandler:", error);
    res.status(500).json({ success: false, message: "Error fetching employees who worked less than 8 hours" });
  }
};

const getEmployeesWorked8To10HoursHandler = async (req, res) => {
  try {
    const employees = await adminAttendencetrackerService.getEmployeesWorked8To10Hours();
    res.status(200).json({ success: true, data: employees });
  } catch (error) {
    console.error("Error in getEmployeesWorked8To10HoursHandler:", error);
    res.status(500).json({ success: false, message: "Error fetching employees who worked 8 to 10 hours" });
  }
};


const moment = require('moment'); // Add this


const getApprovedLeavesCurrentMonthHandler = async (req, res) => {
  try {
    const approvedLeaves = await adminAttendencetrackerService.getApprovedLeavesCurrentMonth();

    const startOfMonth = moment().startOf('month');
    const endOfMonth = moment().endOf('month');

    const expandedLeaveRows = [];

    approvedLeaves.forEach((leave) => {
      const leaveStart = moment(leave.start_date);
      const leaveEnd = moment(leave.end_date);

      // Determine actual overlapping range with current month
      const actualStart = moment.max(leaveStart, startOfMonth);
      const actualEnd = moment.min(leaveEnd, endOfMonth);

      if (actualStart.isAfter(actualEnd)) return; // Skip if no overlap

      for (
        let date = actualStart.clone();
        date.isSameOrBefore(actualEnd);
        date.add(1, 'day')
      ) {
        expandedLeaveRows.push({
          employee_id: leave.employee_id,
          employee_name: leave.employee_name || '', // Add if available
          leave_date: date.format('YYYY-MM-DD'),
          leave_type: leave.leave_type,
          leave_status: leave.status,
          original_start_date: moment(leave.start_date).format('YYYY-MM-DD'),
          original_end_date: moment(leave.end_date).format('YYYY-MM-DD')
        });
      }
    });

    res.status(200).json({ success: true, data: expandedLeaveRows });
  } catch (error) {
    console.error("Error in getApprovedLeavesCurrentMonthHandler:", error);
    res.status(500).json({ success: false, message: "Error fetching approved leaves for the current month" });
  }
};



module.exports = {
  getMissingPunchInEmployeesHandler,
  getEmployeesWithPunchInNotPunchedOutHandler,
  getEmployeesWorkedLessThan8HoursHandler,
  getEmployeesWorked8To10HoursHandler,
  getApprovedLeavesCurrentMonthHandler, // ✅ Exported

};
