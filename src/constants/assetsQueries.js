const INSERT_ASSET = `
INSERT INTO assets (
  org_id,
  asset_id,
  asset_code,
  asset_name,
  configuration,
  valuation_date,
  assigned_to,
  category,
  sub_category,
  status,
  document_path,
  created_at
)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_DATE);
`;

const GET_ALL_ASSETS = `SELECT * FROM assets WHERE org_id = ?;`;

const GET_ASSET_CATEGORIES = `
  SELECT
    c.category_id,
    c.category_name,
    s.subcategory_id,
    s.subcategory_name
  FROM asset_categories c
  LEFT JOIN asset_subcategories s
    ON s.category_id = c.category_id
    AND s.org_id = c.org_id
    AND s.status = 'Active'
  WHERE c.org_id = ?
    AND c.status = 'Active'
  ORDER BY c.category_name, s.subcategory_name;
`;

const GET_ASSET_ACCESSORIES = `
  SELECT
    accessory.accessory_id,
    accessory.accessory_name,
    accessory.status,
    assigned.quantity,
    assigned.accessory_id IS NOT NULL AS is_selected
  FROM asset_accessories accessory
  LEFT JOIN asset_assigned_accessories assigned
    ON assigned.accessory_id = accessory.accessory_id
    AND assigned.org_id = accessory.org_id
    AND assigned.asset_id = ?
  WHERE accessory.org_id = ?
    AND accessory.category_id = ?
    AND accessory.subcategory_id <=> ?
    AND (
      accessory.status = 'Active'
      OR assigned.accessory_id IS NOT NULL
    )
  ORDER BY accessory.accessory_name;
`;

const GET_LAST_ASSET_ID = `
  SELECT asset_id FROM assets WHERE asset_id LIKE ? ORDER BY asset_id DESC LIMIT 1;
`;

const GET_ASSIGN_DATA = `
  SELECT JSON_EXTRACT(assigned_to, '$') AS assignments FROM assets WHERE asset_id = ? AND org_id = ?
`;

const UPDATE_RETURN_DATE = `
  UPDATE assets
  SET assigned_to = ?, status = "Returned"
  WHERE asset_id = ? AND org_id = ?;
`;

const GET_ASSET_COUNTS = `
  SELECT 
    category, 
    sub_category, 
    COUNT(*) AS sub_category_count, 
    SUM(COUNT(*)) OVER (PARTITION BY category) AS category_total, 
    SUM(COUNT(*)) OVER () AS total_assets
  FROM assets 
  WHERE org_id = ?
  GROUP BY category, sub_category
  ORDER BY category, sub_category;
`;

const SEARCH_EMPLOYEES_BY_NAME = `
  SELECT employee_id, CONCAT(first_name, ' ', last_name) AS name
  FROM employees
  WHERE CONCAT(first_name, ' ', last_name) LIKE CONCAT(?, '%') AND org_id = ?
  LIMIT 10;
`;

const GET_ASSIGNED_ASSETS_BY_EMPLOYEE = `
  SELECT 
    a.asset_id,
    a.asset_code,
    a.asset_name,
    jt.employee_id,
    jt.status
  FROM assets a
  JOIN JSON_TABLE(
    CAST(a.assigned_to AS JSON),
    '$[*]' COLUMNS (
      employee_id VARCHAR(20) PATH '$.employeeId',
      status VARCHAR(20) PATH '$.status'
    )
  ) AS jt
  WHERE JSON_VALID(a.assigned_to)
    AND jt.employee_id = ?
    AND a.org_id = ?;
`;

module.exports = {
  INSERT_ASSET,
  GET_LAST_ASSET_ID,
  GET_ALL_ASSETS,
  GET_ASSET_CATEGORIES,
  GET_ASSET_ACCESSORIES,
  GET_ASSIGN_DATA,
  UPDATE_RETURN_DATE,
  GET_ASSET_COUNTS,
  SEARCH_EMPLOYEES_BY_NAME,
  GET_ASSIGNED_ASSETS_BY_EMPLOYEE,
};
