module.exports = {
  GET_COMMON_LOGIN_BY_EMAIL: `
    SELECT
      cl.id,
      cl.org_id,
      cl.employee_id,
      cl.name,
      cl.email,
      cl.password_hash,
      cl.is_active,
      cl.location,
      cl.pincode
    FROM common_login cl
    WHERE cl.org_id = ?
      AND LOWER(cl.email) = LOWER(?)
    LIMIT 1;
  `,

  GET_COMMON_LOGIN_BY_EMPLOYEE_ID: `
    SELECT
      cl.id,
      cl.org_id,
      cl.employee_id,
      cl.name,
      cl.email,
      cl.password_hash,
      cl.is_active,
      cl.location,
      cl.pincode
    FROM common_login cl
    WHERE cl.org_id = ?
      AND cl.employee_id = ?
    LIMIT 1;
  `,

INSERT_COMMON_LOGIN: `
  INSERT INTO common_login (
    org_id,
    employee_id,
    name,
    email,
    password_hash,
    location,
    pincode,
    is_active
  )
  VALUES (?, NULL, ?, ?, ?, ?, ?, ?);
`,

  UPDATE_COMMON_LOGIN: `
    UPDATE common_login
    SET
      name = ?,
      email = ?,
      password_hash = ?,
      location = ?,
      pincode = ?,
      is_active = ?
    WHERE id = ?
      AND org_id = ?;
  `,

  UPDATE_COMMON_LOGIN_PASSWORD: `
    UPDATE common_login
    SET password_hash = ?
    WHERE id = ?
      AND org_id = ?;
  `,

  DISABLE_COMMON_LOGIN: `
    UPDATE common_login
    SET is_active = 0
    WHERE id = ?
      AND org_id = ?;
  `,

  ENABLE_COMMON_LOGIN: `
    UPDATE common_login
    SET is_active = 1
    WHERE id = ?
      AND org_id = ?;
  `,

  INSERT_DEVICE: `
    INSERT INTO common_login_devices (
      login_id,
      org_id,
      employee_id,
      device_name,
      device_type,
      browser,
      ip_address,
      location,
      last_login_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW());
  `,

  UPDATE_DEVICE_LOGIN: `
    UPDATE common_login_devices
    SET
      device_name = ?,
      device_type = ?,
      browser = ?,
      ip_address = ?,
      location = ?,
      last_login_at = NOW(),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?;
  `,

  GET_DEVICE_BY_ID: `
    SELECT
      id,
      login_id,
      org_id,
      employee_id,
      device_name,
      device_type,
      browser,
      ip_address,
      location,
      last_login_at,
      created_at,
      updated_at
    FROM common_login_devices
    WHERE id = ?
      AND org_id = ?
    LIMIT 1;
  `,

  GET_DEVICES_BY_LOGIN: `
    SELECT
      id,
      login_id,
      org_id,
      employee_id,
      device_name,
      device_type,
      browser,
      ip_address,
      location,
      last_login_at,
      created_at,
      updated_at
    FROM common_login_devices
    WHERE login_id = ?
      AND org_id = ?
    ORDER BY last_login_at DESC;
  `,

  DELETE_DEVICE: `
    DELETE FROM common_login_devices
    WHERE id = ?
      AND org_id = ?;
  `,

  GET_ORGANIZATION: `
    SELECT
      id,
      name,
      employee_prefix,
      start_date,
      end_date
    FROM organizations
    WHERE id = ?
    LIMIT 1;
  `,
};