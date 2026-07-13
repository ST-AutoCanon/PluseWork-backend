// // Queries related to attendance and login-hours configuration

// const GET_LOGIN_HOURS_CONFIG = `
//     SELECT *
//     FROM login_hours_config
//     WHERE org_id = ?
//     LIMIT 1
// `;

// const UPSERT_LOGIN_HOURS_CONFIG = `
//     INSERT INTO login_hours_config (
//         org_id,
//         punch_in_start,
//         punch_out_start,
//         buffer_minutes,
//         late_login_enabled,
//         late_streak_days,
//         auto_mark_late,
//         escalation_mode,
//         action_roles,
//         required_daily_minutes,
//         deficit_detection_enabled,
//         allowed_late_streaks,
//         streak_period
//     ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
//     ON DUPLICATE KEY UPDATE
//         punch_in_start = VALUES(punch_in_start),
//         punch_out_start = VALUES(punch_out_start),
//         buffer_minutes = VALUES(buffer_minutes),
//         late_login_enabled = VALUES(late_login_enabled),
//         late_streak_days = VALUES(late_streak_days),
//         auto_mark_late = VALUES(auto_mark_late),
//         escalation_mode = VALUES(escalation_mode),
//         action_roles = VALUES(action_roles),
//         required_daily_minutes = VALUES(required_daily_minutes),
//         deficit_detection_enabled = VALUES(deficit_detection_enabled),
//         allowed_late_streaks = VALUES(allowed_late_streaks),
//         streak_period = VALUES(streak_period),
//         updated_at = CURRENT_TIMESTAMP
// `;

// const EMP_ATTENDANCE_QUERIES = {
//   GET_EMPLOYEE_ATTENDANCE: `
//       SELECT 
//         punch_id, 
//         employee_id, 
//         punch_status, 
//         punchin_time, 
//         punchin_device, 
//         punchin_location, 
//         punchout_time, 
//         punchout_device, 
//         punchout_location, 
//         punchmode
//       FROM emp_attendence
//       WHERE employee_id = ?
//       ORDER BY punchin_time DESC
//     `,

//   ADD_PUNCH_IN: `
//   INSERT INTO emp_attendence 
//   (employee_id, punch_status, punchin_time, punchin_device, punchin_location, punchmode) 
//   VALUES (?, 'Punch In', NOW(), ?, ?, ?)
// `,
//   UPDATE_PUNCH_OUT: `
//   UPDATE emp_attendence 
//   SET 
//     punch_status = 'Punch Out',
//     punchout_time = NOW(), 
//     punchout_device = ?, 
//     punchout_location = ?, 
//     punchmode = ?
//   WHERE employee_id = ? AND punch_status = 'Punch In'
//   ORDER BY punchin_time DESC
//   LIMIT 1
// `,
//   GET_TODAY_ATTENDANCE: `
//       SELECT 
//         employee_id, 
//         COUNT(*) AS total_punches,
//         SUM(CASE WHEN punch_status = 'Punch In' THEN 1 ELSE 0 END) AS total_punch_ins,
//         SUM(CASE WHEN punch_status = 'Punch Out' THEN 1 ELSE 0 END) AS total_punch_outs
//       FROM emp_attendence
//       WHERE DATE(punchin_time) = CURDATE()
//       GROUP BY employee_id
//     `,

//   GET_LAST_PUNCH_STATUS: `
//       SELECT punch_status 
//       FROM emp_attendence 
//       WHERE employee_id = ? 
//       ORDER BY punchin_time DESC 
//       LIMIT 1
//     `,

//   GET_LATEST_PUNCH_IN: `
//   SELECT * FROM emp_attendence
//   WHERE employee_id = ? AND punchout_time IS NULL
//   ORDER BY punchin_time DESC
//   LIMIT 1;
// `,

//   GET_LATEST_PUNCH_OUT: `
//   SELECT * FROM emp_attendence
//   WHERE employee_id = ? AND punchout_time IS NOT NULL
//   ORDER BY punchout_time DESC
//   LIMIT 1;
// `,
//   GET_TODAY_PUNCH_RECORDS: `
//   SELECT punch_status, punchin_time, punchout_time
//   FROM emp_attendence
//   WHERE employee_id = ? 
//   AND DATE(punchin_time) = CURDATE();
// `,

//   GET_ATTENDANCE_STATS: `
// WITH RECURSIVE month_days AS (
//     SELECT DATE(CONCAT(YEAR(NOW()), '-', MONTH(NOW()), '-01')) AS work_date
//     UNION ALL
//     SELECT DATE_ADD(work_date, INTERVAL 1 DAY)
//     FROM month_days
//     WHERE work_date < LAST_DAY(NOW()) 
// ),
// all_saturdays AS (
//     SELECT work_date, ROW_NUMBER() OVER (ORDER BY work_date) AS sat_position
//     FROM month_days
//     WHERE WEEKDAY(work_date) = 5
// ),
// saturday_list AS (
//     SELECT all_saturdays.work_date AS holiday_date
//     FROM all_saturdays
//     JOIN (
//         SELECT SUBSTRING_INDEX(SUBSTRING_INDEX(saturdays, ',', numbers.n), ',', -1) AS selected_sat
//         FROM saturday_holidays
//         JOIN (SELECT 1 n UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5) numbers
//         ON CHAR_LENGTH(saturdays) - CHAR_LENGTH(REPLACE(saturdays, ',', '')) >= numbers.n - 1
//         WHERE month_year = DATE_FORMAT(NOW(), '%m-%Y')
//     ) subquery
//     ON all_saturdays.sat_position = subquery.selected_sat
// ),
// working_days AS (
//     SELECT work_date
//     FROM month_days
//     WHERE 
//         WEEKDAY(work_date) != 6  
//         AND work_date NOT IN (SELECT holiday_date FROM saturday_list) 
//         AND work_date NOT IN (
//             SELECT date FROM holidays
//             WHERE MONTH(date) = MONTH(NOW()) 
//             AND YEAR(date) = YEAR(NOW())  
//         )
// ),
// leave_days AS (
//     WITH RECURSIVE expanded_leaves AS (
//         SELECT start_date AS leave_date, end_date
//         FROM leavequeries
//         WHERE status = 'approved'
//         AND employee_id = ?
//       AND start_date <= LAST_DAY(NOW())  
//         AND end_date >= DATE_FORMAT(NOW(), '%Y-%m-01')

//         UNION ALL

//         SELECT DATE_ADD(leave_date, INTERVAL 1 DAY), end_date
//         FROM expanded_leaves
//         WHERE leave_date < end_date
//     )
//     SELECT DISTINCT leave_date
//         FROM expanded_leaves
// WHERE leave_date IN (SELECT work_date FROM working_days)
// ),
// regularisation_days AS (
//     SELECT DISTINCT STR_TO_DATE(
//         TRIM(BOTH '"' FROM JSON_UNQUOTE(JSON_EXTRACT(lrr.selected_dates, CONCAT('$[', seq, ']')))),
//         '%Y-%m-%d'
//     ) AS regularisation_date
//     FROM leave_regularisation_requests lrr
//     JOIN (
//         SELECT 0 AS seq UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
//         UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9
//         UNION ALL SELECT 10 UNION ALL SELECT 11 UNION ALL SELECT 12 UNION ALL SELECT 13 UNION ALL SELECT 14
//     ) nums ON TRUE
//     WHERE lrr.employee_id = ?
//     AND lrr.status = 'Approved'
//     AND lrr.regularisation_type IN ('missed_apply_leave', 'missed_punch_in')
//     AND JSON_UNQUOTE(JSON_EXTRACT(lrr.selected_dates, CONCAT('$[', seq, ']'))) IS NOT NULL
//     AND MONTH(STR_TO_DATE(
//         TRIM(BOTH '"' FROM JSON_UNQUOTE(JSON_EXTRACT(lrr.selected_dates, CONCAT('$[', seq, ']')))),
//         '%Y-%m-%d'
//     )) = MONTH(NOW())
//     AND YEAR(STR_TO_DATE(
//         TRIM(BOTH '"' FROM JSON_UNQUOTE(JSON_EXTRACT(lrr.selected_dates, CONCAT('$[', seq, ']')))),
//         '%Y-%m-%d'
//     )) = YEAR(NOW())
// ),
// present_days AS (
//     SELECT DISTINCT DATE(punchin_time) AS punch_date FROM emp_attendence
//     WHERE employee_id = ?
//     AND punch_status = 'Punch In'
//     AND MONTH(punchin_time) = MONTH(NOW()) 
//     AND YEAR(punchin_time) = YEAR(NOW())

//     UNION 

//     SELECT DISTINCT DATE(punchout_time) AS punch_date FROM emp_attendence
//     WHERE employee_id = ?
//     AND punch_status = 'Punch Out'
//     AND MONTH(punchout_time) = MONTH(NOW()) 
//     AND YEAR(punchout_time) = YEAR(NOW())
// ),
// past_working_days AS (
//     SELECT work_date FROM working_days WHERE work_date <= CURDATE()
// )
// SELECT 
//     (SELECT COUNT(*) FROM working_days) AS total_working_days,  
//     (SELECT COUNT(*) FROM leave_days) AS leave_count,           
//     (SELECT COUNT(*) FROM past_working_days 
//         WHERE work_date IN (
//             SELECT punch_date FROM present_days
//             UNION
//             SELECT regularisation_date FROM regularisation_days
//         )
//         AND work_date NOT IN (SELECT leave_date FROM leave_days)) AS present_count,  
//     (SELECT COUNT(*) FROM past_working_days 
//         WHERE work_date NOT IN (
//             SELECT punch_date FROM present_days
//             UNION
//             SELECT regularisation_date FROM regularisation_days
//         )  
//         AND work_date NOT IN (SELECT leave_date FROM leave_days)) AS absent_count;
// `,

//   WORK_HOURS_QUERY1: `
//     SELECT view, data 
//     FROM emp_work_hours 
//     WHERE employee_id = ?
// `,
//   workHourSummaryQuery: `


// WITH RECURSIVE Days AS (
//     SELECT DATE_SUB(CURRENT_DATE(), INTERVAL 6 DAY) AS work_date
//     UNION ALL
//     SELECT DATE_ADD(work_date, INTERVAL 1 DAY)
//     FROM Days
//     WHERE work_date < CURRENT_DATE()
// ),
// DailyData AS (
//     SELECT 
//         DATE(punchin_time) AS work_date,

//         MIN(punchin_time) AS first_punchin,

//         MAX(punchout_time) AS last_punchout,

//         SUM(TIMESTAMPDIFF(SECOND, punchin_time, punchout_time) / 3600) AS total_hours

//     FROM emp_attendence
//     WHERE employee_id = ?
//         AND punch_status = 'Punch Out'
//         AND punchin_time >= DATE_SUB(CURRENT_DATE(), INTERVAL 6 DAY)

//     GROUP BY work_date
// ),
// FinalDailyData AS (
//     SELECT 
//         d.work_date,

//         dd.first_punchin,

//         dd.last_punchout,

//         COALESCE(dd.total_hours,0) AS total_hours

//     FROM Days d
//     LEFT JOIN DailyData dd ON d.work_date = dd.work_date
// ),
//  Weeks AS (
//     -- Start from week 1
//     SELECT 1 AS week_number
//     UNION ALL
//     -- Generate up to 6 weeks dynamically for the current month
//     SELECT week_number + 1
//     FROM Weeks
//     WHERE week_number < 
//         TIMESTAMPDIFF(WEEK, DATE_SUB(CURRENT_DATE(), INTERVAL DAY(CURRENT_DATE()) - 1 DAY), LAST_DAY(CURRENT_DATE())) + 1
// ),
// CurrentMonthDays AS (
//     SELECT DATE_SUB(CURRENT_DATE(), INTERVAL DAY(CURRENT_DATE()) - 1 DAY) AS work_date
//     UNION ALL
//     SELECT DATE_ADD(work_date, INTERVAL 1 DAY)
//     FROM CurrentMonthDays
//     WHERE work_date < CURRENT_DATE()
// ),
// CurrentMonthData AS (
//     SELECT
//         DATE(punchin_time) AS work_date,

//          MIN(punchin_time) AS first_punchin,   -- ✅ ADD
//         MAX(punchout_time) AS last_punchout,  -- ✅ ADD
//         SUM(TIMESTAMPDIFF(SECOND, punchin_time, punchout_time) / 3600) AS total_hours
//     FROM emp_attendence
//     WHERE employee_id = ?
//         AND punch_status = 'Punch Out'
//         AND punchin_time >= DATE_SUB(CURRENT_DATE(), INTERVAL DAY(CURRENT_DATE()) - 1 DAY)
//     GROUP BY work_date
// ),
// FinalWeeklyData AS (
//     SELECT 
//         cmd.work_date,
//         DAY(cmd.work_date) AS day_of_month,

//          cmd_data.first_punchin,   -- ✅ ADD
//         cmd_data.last_punchout,
//         COALESCE(cmd_data.total_hours, 0) AS total_hours
//     FROM CurrentMonthDays cmd
//     LEFT JOIN CurrentMonthData cmd_data 
//         ON cmd.work_date = cmd_data.work_date
// ),
// PreviousMonthDays AS (
//     SELECT DATE_SUB(DATE_SUB(CURRENT_DATE(), INTERVAL DAY(CURRENT_DATE())-1 DAY), INTERVAL 1 MONTH) AS work_date
//     UNION ALL
//     SELECT DATE_ADD(work_date, INTERVAL 1 DAY)
//     FROM PreviousMonthDays
//     WHERE work_date < LAST_DAY(DATE_SUB(CURRENT_DATE(), INTERVAL 1 MONTH))
// ),
// PreviousMonthData AS (
//     SELECT
//         DATE(punchin_time) AS work_date,
//           MIN(punchin_time) AS first_punchin,   -- ✅ ADD
//         MAX(punchout_time) AS last_punchout,  -- ✅ ADD
//         SUM(TIMESTAMPDIFF(SECOND, punchin_time, punchout_time) / 3600) AS total_hours
//     FROM emp_attendence
//     WHERE employee_id = ?
//         AND punchin_time BETWEEN
//             DATE_SUB(DATE_SUB(CURRENT_DATE(), INTERVAL DAY(CURRENT_DATE()) - 1 DAY), INTERVAL 1 MONTH)
//             AND LAST_DAY(DATE_SUB(CURRENT_DATE(), INTERVAL 1 MONTH))
//     GROUP BY work_date
// ),
// FinalMonthlyData AS (
//     SELECT 
//         pmd.work_date, 
//         DAY(pmd.work_date) AS day_of_month, 
//          pmd_prev.first_punchin,   -- ✅ ADD
//         pmd_prev.last_punchout, 
//         COALESCE(pmd_prev.total_hours, 0) AS total_hours
//     FROM PreviousMonthDays pmd
//     LEFT JOIN PreviousMonthData pmd_prev ON pmd.work_date = pmd_prev.work_date
// )
// SELECT 'Daily' AS view, JSON_OBJECT(
//     'labels', (SELECT JSON_ARRAYAGG(work_date) FROM FinalDailyData),
//     'values', (SELECT JSON_ARRAYAGG(total_hours) FROM FinalDailyData),
//     'firstPunchIn', (SELECT JSON_ARRAYAGG(first_punchin) FROM FinalDailyData),
//     'lastPunchOut', (SELECT JSON_ARRAYAGG(last_punchout) FROM FinalDailyData)
// ) AS data

// UNION ALL
// SELECT 'Weekly' AS view, JSON_OBJECT(
//     'labels', (SELECT JSON_ARRAYAGG(day_of_month) FROM FinalWeeklyData),
//     'values', (SELECT JSON_ARRAYAGG(total_hours) FROM FinalWeeklyData),

//     'firstPunchIn', (SELECT JSON_ARRAYAGG(first_punchin) FROM FinalWeeklyData),   -- ✅ ADD
//     'lastPunchOut', (SELECT JSON_ARRAYAGG(last_punchout) FROM FinalWeeklyData)    -- ✅ ADD
// ) AS data
// UNION ALL
// SELECT 'Monthly' AS view, JSON_OBJECT(
//     'labels', (SELECT JSON_ARRAYAGG(day_of_month) FROM FinalMonthlyData),
//     'values', (SELECT JSON_ARRAYAGG(total_hours) FROM FinalMonthlyData),

//     'firstPunchIn', (SELECT JSON_ARRAYAGG(first_punchin) FROM FinalMonthlyData),   -- ✅ ADD
//     'lastPunchOut', (SELECT JSON_ARRAYAGG(last_punchout) FROM FinalMonthlyData)    -- ✅ ADD
// ) AS data;

// `,
// };

// module.exports = {
//   GET_LOGIN_HOURS_CONFIG,
//   UPSERT_LOGIN_HOURS_CONFIG,
//   ...EMP_ATTENDANCE_QUERIES,
// };

const GET_LOGIN_HOURS_CONFIG = `
    SELECT *
    FROM login_hours_config
    WHERE org_id = ?
    LIMIT 1
`;

const UPSERT_LOGIN_HOURS_CONFIG = `
    INSERT INTO login_hours_config (
        org_id,
        punch_in_start,
        punch_out_start,
        buffer_minutes,
        late_login_enabled,
        late_streak_days,
        auto_mark_late,
        escalation_mode,
        action_roles,
        required_daily_minutes,
        deficit_detection_enabled,
        allowed_late_streaks,
        streak_period
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON DUPLICATE KEY UPDATE
        punch_in_start = VALUES(punch_in_start),
        punch_out_start = VALUES(punch_out_start),
        buffer_minutes = VALUES(buffer_minutes),
        late_login_enabled = VALUES(late_login_enabled),
        late_streak_days = VALUES(late_streak_days),
        auto_mark_late = VALUES(auto_mark_late),
        escalation_mode = VALUES(escalation_mode),
        action_roles = VALUES(action_roles),
        required_daily_minutes = VALUES(required_daily_minutes),
        deficit_detection_enabled = VALUES(deficit_detection_enabled),
        allowed_late_streaks = VALUES(allowed_late_streaks),
        streak_period = VALUES(streak_period),
        updated_at = CURRENT_TIMESTAMP
`;

const EMP_ATTENDANCE_QUERIES = {
  GET_EMPLOYEE_ATTENDANCE: `
      SELECT 
        punch_id, 
        employee_id, 
        punch_status, 
        punchin_time, 
        punchin_device, 
        punchin_location, 
        punchout_time, 
        punchout_device, 
        punchout_location, 
        punchmode
      FROM emp_attendence
      WHERE employee_id = ?
      ORDER BY punchin_time DESC
    `,

  ADD_PUNCH_IN: `
    INSERT INTO emp_attendence 
    (employee_id, punch_status, punchin_time, punchin_device, punchin_location, punchmode) 
    VALUES (?, 'Punch In', NOW(), ?, ?, ?)
  `,

  UPDATE_PUNCH_OUT: `
    UPDATE emp_attendence 
    SET 
      punch_status = 'Punch Out',
      punchout_time = NOW(), 
      punchout_device = ?, 
      punchout_location = ?, 
      punchmode = ?
    WHERE employee_id = ? AND punch_status = 'Punch In'
    ORDER BY punchin_time DESC
    LIMIT 1
  `,

  GET_TODAY_ATTENDANCE: `
      SELECT 
        employee_id, 
        COUNT(*) AS total_punches,
        SUM(CASE WHEN punch_status = 'Punch In' THEN 1 ELSE 0 END) AS total_punch_ins,
        SUM(CASE WHEN punch_status = 'Punch Out' THEN 1 ELSE 0 END) AS total_punch_outs
      FROM emp_attendence
      WHERE DATE(punchin_time) = CURDATE()
      GROUP BY employee_id
    `,

  GET_LAST_PUNCH_STATUS: `
      SELECT punch_status 
      FROM emp_attendence 
      WHERE employee_id = ? 
      ORDER BY punchin_time DESC 
      LIMIT 1
    `,

  GET_LATEST_PUNCH_IN: `
    SELECT * FROM emp_attendence
    WHERE employee_id = ? AND punchout_time IS NULL
    ORDER BY punchin_time DESC
    LIMIT 1
  `,

  GET_LATEST_PUNCH_OUT: `
    SELECT * FROM emp_attendence
    WHERE employee_id = ? AND punchout_time IS NOT NULL
    ORDER BY punchout_time DESC
    LIMIT 1
  `,

  GET_EMPLOYEE_ASSIGNED_OFFICES: `
    SELECT
      ol.id,
      ol.office_name,
      ol.address,
      ol.latitude,
      ol.longitude,
      ol.radius,
      ol.status
    FROM office_location_employees ole
    INNER JOIN office_locations ol
      ON ole.office_location_id = ol.id
    WHERE ole.employee_id = ?
      AND ol.status = 'Active'
  `,

  GET_TODAY_PUNCH_RECORDS: `
    SELECT punch_status, punchin_time, punchout_time
    FROM emp_attendence
    WHERE employee_id = ? 
    AND DATE(punchin_time) = CURDATE()
  `,

  GET_ATTENDANCE_STATS: `
WITH RECURSIVE month_days AS (
    SELECT DATE(CONCAT(YEAR(NOW()), '-', MONTH(NOW()), '-01')) AS work_date
    UNION ALL
    SELECT DATE_ADD(work_date, INTERVAL 1 DAY)
    FROM month_days
    WHERE work_date < LAST_DAY(NOW()) 
),
all_saturdays AS (
    SELECT work_date, ROW_NUMBER() OVER (ORDER BY work_date) AS sat_position
    FROM month_days
    WHERE WEEKDAY(work_date) = 5
),
saturday_list AS (
    SELECT all_saturdays.work_date AS holiday_date
    FROM all_saturdays
    JOIN (
        SELECT SUBSTRING_INDEX(SUBSTRING_INDEX(saturdays, ',', numbers.n), ',', -1) AS selected_sat
        FROM saturday_holidays
        JOIN (SELECT 1 n UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5) numbers
        ON CHAR_LENGTH(saturdays) - CHAR_LENGTH(REPLACE(saturdays, ',', '')) >= numbers.n - 1
        WHERE month_year = DATE_FORMAT(NOW(), '%m-%Y')
    ) subquery
    ON all_saturdays.sat_position = subquery.selected_sat
),
working_days AS (
    SELECT work_date
    FROM month_days
    WHERE 
        WEEKDAY(work_date) != 6  
        AND work_date NOT IN (SELECT holiday_date FROM saturday_list) 
        AND work_date NOT IN (
            SELECT date FROM holidays
            WHERE MONTH(date) = MONTH(NOW()) 
            AND YEAR(date) = YEAR(NOW())  
        )
),
leave_days AS (
    WITH RECURSIVE expanded_leaves AS (
        SELECT start_date AS leave_date, end_date
        FROM leavequeries
        WHERE status = 'approved'
        AND employee_id = ?
        AND start_date <= LAST_DAY(NOW())  
        AND end_date >= DATE_FORMAT(NOW(), '%Y-%m-01')

        UNION ALL

        SELECT DATE_ADD(leave_date, INTERVAL 1 DAY), end_date
        FROM expanded_leaves
        WHERE leave_date < end_date
    )
    SELECT DISTINCT leave_date
    FROM expanded_leaves
    WHERE leave_date IN (SELECT work_date FROM working_days)
),
regularisation_days AS (
    SELECT DISTINCT STR_TO_DATE(
        TRIM(BOTH '"' FROM JSON_UNQUOTE(JSON_EXTRACT(lrr.selected_dates, CONCAT('$[', seq, ']')))),
        '%Y-%m-%d'
    ) AS regularisation_date
    FROM leave_regularisation_requests lrr
    JOIN (
        SELECT 0 AS seq UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
        UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9
        UNION ALL SELECT 10 UNION ALL SELECT 11 UNION ALL SELECT 12 UNION ALL SELECT 13 UNION ALL SELECT 14
    ) nums ON TRUE
    WHERE lrr.employee_id = ?
    AND lrr.status = 'Approved'
    AND lrr.regularisation_type IN ('missed_apply_leave', 'missed_punch_in')
    AND JSON_UNQUOTE(JSON_EXTRACT(lrr.selected_dates, CONCAT('$[', seq, ']'))) IS NOT NULL
    AND MONTH(STR_TO_DATE(
        TRIM(BOTH '"' FROM JSON_UNQUOTE(JSON_EXTRACT(lrr.selected_dates, CONCAT('$[', seq, ']')))),
        '%Y-%m-%d'
    )) = MONTH(NOW())
    AND YEAR(STR_TO_DATE(
        TRIM(BOTH '"' FROM JSON_UNQUOTE(JSON_EXTRACT(lrr.selected_dates, CONCAT('$[', seq, ']')))),
        '%Y-%m-%d'
    )) = YEAR(NOW())
),
present_days AS (
    SELECT DISTINCT DATE(punchin_time) AS punch_date FROM emp_attendence
    WHERE employee_id = ?
    AND punch_status = 'Punch In'
    AND MONTH(punchin_time) = MONTH(NOW()) 
    AND YEAR(punchin_time) = YEAR(NOW())

    UNION 

    SELECT DISTINCT DATE(punchout_time) AS punch_date FROM emp_attendence
    WHERE employee_id = ?
    AND punch_status = 'Punch Out'
    AND MONTH(punchout_time) = MONTH(NOW()) 
    AND YEAR(punchout_time) = YEAR(NOW())
),
past_working_days AS (
    SELECT work_date FROM working_days WHERE work_date <= CURDATE()
)
SELECT 
    (SELECT COUNT(*) FROM working_days) AS total_working_days,  
    (SELECT COUNT(*) FROM leave_days) AS leave_count,           
    (SELECT COUNT(*) FROM past_working_days 
        WHERE work_date IN (
            SELECT punch_date FROM present_days
            UNION
            SELECT regularisation_date FROM regularisation_days
        )
        AND work_date NOT IN (SELECT leave_date FROM leave_days)) AS present_count,  
    (SELECT COUNT(*) FROM past_working_days 
        WHERE work_date NOT IN (
            SELECT punch_date FROM present_days
            UNION
            SELECT regularisation_date FROM regularisation_days
        )  
        AND work_date NOT IN (SELECT leave_date FROM leave_days)) AS absent_count;
`,

  WORK_HOURS_QUERY1: `
    SELECT view, data 
    FROM emp_work_hours 
    WHERE employee_id = ?
  `,

  workHourSummaryQuery: `
WITH RECURSIVE Days AS (
    SELECT DATE_SUB(CURRENT_DATE(), INTERVAL 6 DAY) AS work_date
    UNION ALL
    SELECT DATE_ADD(work_date, INTERVAL 1 DAY)
    FROM Days
    WHERE work_date < CURRENT_DATE()
),
DailyData AS (
    SELECT 
        DATE(punchin_time) AS work_date,
        MIN(punchin_time) AS first_punchin,
        MAX(punchout_time) AS last_punchout,
        SUM(TIMESTAMPDIFF(SECOND, punchin_time, punchout_time) / 3600) AS total_hours
    FROM emp_attendence
    WHERE employee_id = ?
        AND punch_status = 'Punch Out'
        AND punchin_time >= DATE_SUB(CURRENT_DATE(), INTERVAL 6 DAY)
    GROUP BY work_date
),
FinalDailyData AS (
    SELECT 
        d.work_date,
        dd.first_punchin,
        dd.last_punchout,
        COALESCE(dd.total_hours,0) AS total_hours
    FROM Days d
    LEFT JOIN DailyData dd ON d.work_date = dd.work_date
),
Weeks AS (
    SELECT 1 AS week_number
    UNION ALL
    SELECT week_number + 1
    FROM Weeks
    WHERE week_number < 
        TIMESTAMPDIFF(WEEK, DATE_SUB(CURRENT_DATE(), INTERVAL DAY(CURRENT_DATE()) - 1 DAY), LAST_DAY(CURRENT_DATE())) + 1
),
CurrentMonthDays AS (
    SELECT DATE_SUB(CURRENT_DATE(), INTERVAL DAY(CURRENT_DATE()) - 1 DAY) AS work_date
    UNION ALL
    SELECT DATE_ADD(work_date, INTERVAL 1 DAY)
    FROM CurrentMonthDays
    WHERE work_date < CURRENT_DATE()
),
CurrentMonthData AS (
    SELECT
        DATE(punchin_time) AS work_date,
        MIN(punchin_time) AS first_punchin,
        MAX(punchout_time) AS last_punchout,
        SUM(TIMESTAMPDIFF(SECOND, punchin_time, punchout_time) / 3600) AS total_hours
    FROM emp_attendence
    WHERE employee_id = ?
        AND punch_status = 'Punch Out'
        AND punchin_time >= DATE_SUB(CURRENT_DATE(), INTERVAL DAY(CURRENT_DATE()) - 1 DAY)
    GROUP BY work_date
),
FinalWeeklyData AS (
    SELECT 
        cmd.work_date,
        DAY(cmd.work_date) AS day_of_month,
        cmd_data.first_punchin,
        cmd_data.last_punchout,
        COALESCE(cmd_data.total_hours, 0) AS total_hours
    FROM CurrentMonthDays cmd
    LEFT JOIN CurrentMonthData cmd_data 
        ON cmd.work_date = cmd_data.work_date
),
PreviousMonthDays AS (
    SELECT DATE_SUB(DATE_SUB(CURRENT_DATE(), INTERVAL DAY(CURRENT_DATE())-1 DAY), INTERVAL 1 MONTH) AS work_date
    UNION ALL
    SELECT DATE_ADD(work_date, INTERVAL 1 DAY)
    FROM PreviousMonthDays
    WHERE work_date < LAST_DAY(DATE_SUB(CURRENT_DATE(), INTERVAL 1 MONTH))
),
PreviousMonthData AS (
    SELECT
        DATE(punchin_time) AS work_date,
        MIN(punchin_time) AS first_punchin,
        MAX(punchout_time) AS last_punchout,
        SUM(TIMESTAMPDIFF(SECOND, punchin_time, punchout_time) / 3600) AS total_hours
    FROM emp_attendence
    WHERE employee_id = ?
        AND punchin_time BETWEEN
            DATE_SUB(DATE_SUB(CURRENT_DATE(), INTERVAL DAY(CURRENT_DATE()) - 1 DAY), INTERVAL 1 MONTH)
            AND LAST_DAY(DATE_SUB(CURRENT_DATE(), INTERVAL 1 MONTH))
    GROUP BY work_date
),
FinalMonthlyData AS (
    SELECT 
        pmd.work_date, 
        DAY(pmd.work_date) AS day_of_month, 
        pmd_prev.first_punchin,
        pmd_prev.last_punchout, 
        COALESCE(pmd_prev.total_hours, 0) AS total_hours
    FROM PreviousMonthDays pmd
    LEFT JOIN PreviousMonthData pmd_prev ON pmd.work_date = pmd_prev.work_date
)
SELECT 'Daily' AS view, JSON_OBJECT(
    'labels', (SELECT JSON_ARRAYAGG(work_date) FROM FinalDailyData),
    'values', (SELECT JSON_ARRAYAGG(total_hours) FROM FinalDailyData),
    'firstPunchIn', (SELECT JSON_ARRAYAGG(first_punchin) FROM FinalDailyData),
    'lastPunchOut', (SELECT JSON_ARRAYAGG(last_punchout) FROM FinalDailyData)
) AS data

UNION ALL
SELECT 'Weekly' AS view, JSON_OBJECT(
    'labels', (SELECT JSON_ARRAYAGG(day_of_month) FROM FinalWeeklyData),
    'values', (SELECT JSON_ARRAYAGG(total_hours) FROM FinalWeeklyData),
    'firstPunchIn', (SELECT JSON_ARRAYAGG(first_punchin) FROM FinalWeeklyData),
    'lastPunchOut', (SELECT JSON_ARRAYAGG(last_punchout) FROM FinalWeeklyData)
) AS data

UNION ALL
SELECT 'Monthly' AS view, JSON_OBJECT(
    'labels', (SELECT JSON_ARRAYAGG(day_of_month) FROM FinalMonthlyData),
    'values', (SELECT JSON_ARRAYAGG(total_hours) FROM FinalMonthlyData),
    'firstPunchIn', (SELECT JSON_ARRAYAGG(first_punchin) FROM FinalMonthlyData),
    'lastPunchOut', (SELECT JSON_ARRAYAGG(last_punchout) FROM FinalMonthlyData)
) AS data;
`,
};

module.exports = {
  GET_LOGIN_HOURS_CONFIG,
  UPSERT_LOGIN_HOURS_CONFIG,
  ...EMP_ATTENDANCE_QUERIES,
};