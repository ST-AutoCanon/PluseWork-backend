const INSERT_LETTER = `
  INSERT INTO letters (
    letter_id, letter_type, recipient_name, address, date, subject,
    employee_name, position, effective_date, signature, content, pdf_path
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
`;

const UPDATE_LETTER_BY_ID = `
  UPDATE letters SET
    letter_type = ?, recipient_name = ?, address = ?, date = ?, subject = ?,
    employee_name = ?, position = ?, effective_date = ?, signature = ?, content = ?, pdf_path = ?
  WHERE letter_id = ?;
`;

const GET_ALL_LETTERS = `
  SELECT * FROM letters;
`;

const GET_LETTER_BY_ID = `
  SELECT * FROM letters WHERE letter_id = ?;
`;

const GET_LATEST_LETTER_ID = `
  SELECT letter_id FROM letters 
  WHERE letter_id LIKE 'STSLHT%'
  ORDER BY CAST(SUBSTRING(letter_id, 7) AS UNSIGNED) DESC 
  LIMIT 1;
`;

module.exports = {
  INSERT_LETTER,
  UPDATE_LETTER_BY_ID,
  GET_ALL_LETTERS,
  GET_LETTER_BY_ID,
  GET_LATEST_LETTER_ID,
};
