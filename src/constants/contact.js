module.exports = {
  INSERT_CONTACT_REQUEST: `INSERT INTO contact_requests
      (name, email, organization, phone, message, preferred_date, ip, user_agent, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,

  GET_CONTACT_REQUESTS: `SELECT id, name, email, organization, phone, message, preferred_date, ip, user_agent, created_at
     FROM contact_requests
     ORDER BY created_at DESC`,
};
