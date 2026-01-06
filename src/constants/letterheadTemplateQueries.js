const CREATE_LETTERHEAD_TEMPLATES_TABLE = `
  CREATE TABLE IF NOT EXISTS letterhead_templates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    org_id VARCHAR(100) NOT NULL,
    letter_type VARCHAR(100) NOT NULL,
    content TEXT NOT NULL,
    subject VARCHAR(255) NOT NULL,
    company_name VARCHAR(255) NOT NULL,
    company_address TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY ux_org_letter_type (org_id, letter_type)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;

const GET_ALL_TEMPLATES = `
  SELECT id, org_id, letter_type, content, subject, company_name, company_address, created_at, updated_at
  FROM letterhead_templates
  WHERE org_id = ?
  ORDER BY id DESC;
`;

const GET_TEMPLATE_BY_LETTER_TYPE = `
  SELECT id, org_id, letter_type, content, subject, company_name, company_address, created_at, updated_at
  FROM letterhead_templates
  WHERE org_id = ? AND letter_type = ?
  LIMIT 1;
`;

const INSERT_TEMPLATE = `
  INSERT INTO letterhead_templates (org_id, letter_type, content, subject, company_name, company_address)
  VALUES (?, ?, ?, ?, ?, ?);
`;

const UPDATE_TEMPLATE_BY_LETTER_TYPE = `
  UPDATE letterhead_templates
  SET content = ?, subject = ?, company_name = ?, company_address = ?, updated_at = CURRENT_TIMESTAMP
  WHERE org_id = ? AND letter_type = ?;
`;

module.exports = {
  CREATE_LETTERHEAD_TEMPLATES_TABLE,
  GET_ALL_TEMPLATES,
  GET_TEMPLATE_BY_LETTER_TYPE,
  INSERT_TEMPLATE,
  UPDATE_TEMPLATE_BY_LETTER_TYPE,
};
