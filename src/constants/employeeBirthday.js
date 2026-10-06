

const GET_TODAYS_BIRTHDAYS_AND_ANNIVERSARIES = `
  SELECT
    e.employee_id,
    e.first_name,
    e.last_name,
    e.dob,
    e.email,
    ep.joining_date,

    CONCAT(
      COALESCE(e.first_name, ''),
      CASE
        WHEN e.first_name IS NOT NULL
             AND e.last_name IS NOT NULL
        THEN ' '
        ELSE ''
      END,
      COALESCE(e.last_name, '')
    ) AS full_name,

    CASE
      WHEN e.dob IS NOT NULL
           AND MONTH(e.dob) = MONTH(CURDATE())
           AND DAY(e.dob) = DAY(CURDATE())
      THEN 1
      ELSE 0
    END AS birthday_today,

    CASE
      WHEN ep.joining_date IS NOT NULL
           AND MONTH(ep.joining_date) = MONTH(CURDATE())
           AND DAY(ep.joining_date) = DAY(CURDATE())
           AND YEAR(ep.joining_date) < YEAR(CURDATE())
      THEN 1
      ELSE 0
    END AS work_anniversary_today,

    CASE
      WHEN ep.joining_date IS NOT NULL
           AND MONTH(ep.joining_date) = MONTH(CURDATE())
           AND DAY(ep.joining_date) = DAY(CURDATE())
           AND YEAR(ep.joining_date) < YEAR(CURDATE())
      THEN TIMESTAMPDIFF(YEAR, ep.joining_date, CURDATE())
      ELSE 0
    END AS completed_years

  FROM employees e

  LEFT JOIN employee_professional ep
    ON ep.employee_id = e.employee_id

  WHERE
    (
      e.dob IS NOT NULL
      AND MONTH(e.dob) = MONTH(CURDATE())
      AND DAY(e.dob) = DAY(CURDATE())
    )
    OR
    (
      ep.joining_date IS NOT NULL
      AND MONTH(ep.joining_date) = MONTH(CURDATE())
      AND DAY(ep.joining_date) = DAY(CURDATE())
      AND YEAR(ep.joining_date) < YEAR(CURDATE())
    )

  ORDER BY
    birthday_today DESC,
    work_anniversary_today DESC,
    full_name ASC
`;

module.exports = {
  GET_TODAYS_BIRTHDAYS_AND_ANNIVERSARIES,
};