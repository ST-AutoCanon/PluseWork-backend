const INSERT_MEETING = `
  INSERT INTO meeting_notes
    (client_company,
     contact_name,
     purpose,
     description,
     action_points,
     assigned_to,
     key_points,
     follow_up_date,
     created_by)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
`;

const SELECT_MEETING_BY_ID = `
  SELECT
    id,
    client_company,
    contact_name,
    purpose,
    description,
    action_points,
    assigned_to,
    follow_up_date,
    created_by,
    created_at
  FROM meeting_notes
  WHERE id = ?;
`;

const SELECT_MEETINGS_BY_USER = `
  SELECT
    id,
    client_company,
    contact_name,
    purpose,
    description,
    action_points,
    assigned_to,
    key_points,
    follow_up_date,
    created_by,
    created_at
  FROM meeting_notes
  WHERE created_by = ? OR assigned_to = ?
  ORDER BY follow_up_date DESC;
`;

const SELECT_UPCOMING_MEETINGS = `
  SELECT
    id,
    client_company,
    contact_name,
    purpose,
    description,
    action_points,
    assigned_to,
    follow_up_date,
    created_by,
    created_at
  FROM meeting_notes
  WHERE follow_up_date >= NOW()
  ORDER BY follow_up_date ASC;
`;

module.exports = {
  INSERT_MEETING,
  SELECT_MEETING_BY_ID,
  SELECT_MEETINGS_BY_USER,
  SELECT_UPCOMING_MEETINGS,
};
