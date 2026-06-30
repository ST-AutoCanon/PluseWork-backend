

const checkIfTableExists = (tableName) => `
  SELECT COUNT(*) AS count FROM information_schema.tables 
  WHERE table_schema = DATABASE() AND table_name = '${tableName}';
`;


const SALARY_COLUMNS = [
  'employee_id',
  'full_name',
  'annual_ctc',
  'basic_salary',
  'hra',
  'lta',
  'other_allowances',
  'incentives',
  'overtime',
  'statutory_bonus',
  'bonus',

  'employer_pf',
  'gratuity',

  'insurance_employer',
  'esic_employer',

  'advance_recovery',

  'employee_pf',
  'esic_employee',

  'professional_tax',
  'tds',

  'insurance_employee',

  'lop_days',
  'lop_deduction',

  'gross_salary',
  'final_ctc',
  'net_salary',

  'payslip_generated',
  'status',
  'payslip_generation'
];


const MONETARY_COLUMNS = [
  'annual_ctc', 'basic_salary', 'hra', 'lta', 'other_allowances', 'incentives',
  'overtime', 'statutory_bonus', 'bonus', 'advance_recovery', 'employee_pf',
  'employer_pf', 'esic', 'gratuity', 'professional_tax', 'tds', 'insurance',
  'lop_deduction', 'gross_salary', 'net_salary','insurance_employer',
'esic_employer',
'insurance_employee',
'esic_employee',
'final_ctc'
];

const createTableQuery = (tableName) => {
  const columnDefinitions = [
    '`id` INT AUTO_INCREMENT PRIMARY KEY',
    '`employee_id` VARCHAR(50) UNIQUE NOT NULL',
    '`full_name` VARCHAR(100) DEFAULT NULL',
    '`annual_ctc` DECIMAL(15,2) DEFAULT 0.00',
    '`basic_salary` DECIMAL(15,2) DEFAULT 0.00',
    '`hra` DECIMAL(15,2) DEFAULT 0.00',
    '`lta` DECIMAL(15,2) DEFAULT 0.00',
    '`other_allowances` DECIMAL(15,2) DEFAULT 0.00',
    '`incentives` DECIMAL(15,2) DEFAULT 0.00',
    '`overtime` DECIMAL(15,2) DEFAULT 0.00',
    '`statutory_bonus` DECIMAL(15,2) DEFAULT 0.00',
    '`bonus` DECIMAL(15,2) DEFAULT 0.00',
    '`advance_recovery` DECIMAL(15,2) DEFAULT 0.00',
    '`employee_pf` DECIMAL(15,2) DEFAULT 0.00',
    '`employer_pf` DECIMAL(15,2) DEFAULT 0.00',
    '`esic_employee` DECIMAL(15,2) DEFAULT 0.00',
     '`esic_employer` DECIMAL(15,2) DEFAULT 0.00',
    '`gratuity` DECIMAL(15,2) DEFAULT 0.00',
    '`professional_tax` DECIMAL(15,2) DEFAULT 0.00',
    '`tds` DECIMAL(12,2) DEFAULT 0.00',
    '`insurance_employee` DECIMAL(12,2) DEFAULT 0.00',
    '`insurance_employer` DECIMAL(12,2) DEFAULT 0.00',
    '`final_ctc` DECIMAL(15,2) DEFAULT 0.00',
    '`lop_days` INT DEFAULT 0',
    '`lop_deduction` DECIMAL(12,2) DEFAULT 0.00',
    '`gross_salary` DECIMAL(15,2) DEFAULT 0.00',
    '`net_salary` DECIMAL(15,2) DEFAULT 0.00',
    '`payslip_generated` INT NOT NULL DEFAULT 0',
    '`status` VARCHAR(20) DEFAULT "Approved"',
    '`payslip_generation` VARCHAR(20) DEFAULT "disabled"',
    '`created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
  ].join(',\n  ');

  return `
    CREATE TABLE IF NOT EXISTS \`${tableName}\` (
      ${columnDefinitions}
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
  `.trim();
};
const insertSalaryData = (tableName, rows) => {
  if (rows.length === 0) return { query: '', values: [] };

  const columnsStr = SALARY_COLUMNS.map(col => `\`${col}\``).join(', ');
  const placeholders = SALARY_COLUMNS.map(() => '?').join(', ');
  const valueSets = Array(rows.length).fill(`(${placeholders})`).join(', ');
  
  const updateClause = SALARY_COLUMNS.slice(1)  
    .map(col => `\`${col}\` = VALUES(\`${col}\`)`)
    .join(', ');
  
  const query = `INSERT INTO \`${tableName}\` (${columnsStr}) VALUES ${valueSets} ON DUPLICATE KEY UPDATE ${updateClause}`;

  const values = rows.flatMap(row => SALARY_COLUMNS.map(col => row[col] ?? null));

  return { query, values };
};

const getApprovedIdsQuery = (tableName) => `
  SELECT DISTINCT employee_id 
  FROM \`${tableName}\` 
  WHERE status = 'Approved';
`;

module.exports = {
  checkIfTableExists,
  createTableQuery,
  insertSalaryData,
  SALARY_COLUMNS,
  MONETARY_COLUMNS,
  getApprovedIdsQuery,
};