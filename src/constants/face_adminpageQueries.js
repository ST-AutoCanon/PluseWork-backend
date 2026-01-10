


module.exports = {
  GET_ALL_FACES: "SELECT * FROM face_data",

  GET_LAST_PUNCH:
    "SELECT * FROM emp_attendence WHERE employee_id = ? ORDER BY punch_id DESC LIMIT 1",

  INSERT_PUNCH_IN: `
    INSERT INTO emp_attendence 
    (employee_id, punch_status, punchin_time, punchin_device, punchin_location, punchmode)
    VALUES (?, 'Punch In', ?, ?, ?, 'Manual')
  `,

  UPDATE_PUNCH_OUT: `
    UPDATE emp_attendence
    SET 
      punch_status = 'Punch Out',
      punchout_time = ?,
      punchout_device = ?,
      punchout_location = ?,
      punchmode = 'Manual'
    WHERE punch_id = ?
  `,
};