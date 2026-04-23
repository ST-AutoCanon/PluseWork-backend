
const INSERT_LETTERHEAD = `
  INSERT INTO letterhead_data (
    org_id,
    letterhead_code,
    template_name,
    letter_type,
    subject,
    body,
    attachment,
    dynamic_fields
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?);
`;



// UPDATE LETTERHEAD

const UPDATE_LETTERHEAD_BY_ID = `
  UPDATE letterhead_data SET
    template_name = ?,
    letter_type = ?,
    subject = ?,
    body = ?,
    attachment = ?,
    dynamic_fields = ?
  WHERE id = ? 
  AND org_id = ?;
`;



// GET ALL LETTERHEADS

const GET_ALL_LETTERHEADS = `
  SELECT 
    id,
    org_id,
    letterhead_code,
    template_name,
    letter_type,
    subject,
    body,
    attachment,
    dynamic_fields,
    created_at,
    updated_at
  FROM letterhead_data
  WHERE org_id = ?
  ORDER BY id DESC;
`;



// GET LETTERHEAD BY ID

const GET_LETTERHEAD_BY_ID = `
  SELECT 
    id,
    org_id,
    letterhead_code,
    template_name,
    letter_type,
    subject,
    body,
    attachment,
    dynamic_fields,
    created_at,
    updated_at
  FROM letterhead_data
  WHERE id = ? 
  AND org_id = ?
  LIMIT 1;
`;



module.exports = {
  INSERT_LETTERHEAD,
  UPDATE_LETTERHEAD_BY_ID,
  GET_ALL_LETTERHEADS,
  GET_LETTERHEAD_BY_ID,
};