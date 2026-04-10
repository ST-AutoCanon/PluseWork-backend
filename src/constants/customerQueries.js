module.exports = {
  INSERT_CUSTOMER: `
    INSERT INTO customers
      (company_name, company_gst, company_pan, company_address, country, state, project_poc_name, project_poc_contact)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `,

  GET_ALL_CUSTOMERS: `
    SELECT
      id,
      company_name,
      company_gst,
      company_pan,
      company_address,
      country,
      state,
      project_poc_name,
      project_poc_contact,
      created_at,
      updated_at
    FROM customers
    ORDER BY id DESC
  `,

  GET_CUSTOMER_BY_ID: `
    SELECT
      id,
      company_name,
      company_gst,
      company_pan,
      company_address,
      country,
      state,
      project_poc_name,
      project_poc_contact,
      created_at,
      updated_at
    FROM customers
    WHERE id = ?
    LIMIT 1
  `,

  UPDATE_CUSTOMER: `
    UPDATE customers
    SET
      company_name = ?,
      company_gst = ?,
      company_pan = ?,
      company_address = ?,
      country = ?,
      state = ?,
      project_poc_name = ?,
      project_poc_contact = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `,
};
