 CREATE TABLE IF NOT EXISTS employees (
  employee_id VARCHAR(20) PRIMARY KEY,
  first_name VARCHAR(50),
  last_name VARCHAR(50),
  email VARCHAR(100),
  password VARCHAR(255),
  phone_number VARCHAR(15),
  dob DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  org_id INT UNSIGNED,
  status ENUM('Active','Inactive') DEFAULT 'Active',
  suffix INT
);

CREATE TABLE IF NOT EXISTS employee_personal (
  employee_id VARCHAR(20) PRIMARY KEY,
  address TEXT,
  father_name VARCHAR(50),
  mother_name VARCHAR(50),
  gender ENUM('Male','Female','Other'),
  marital_status ENUM('Married','Unmarried'),
  spouse_name VARCHAR(50),
  marriage_date DATE,
  aadhaar_number VARCHAR(16),
  aadhaar_doc_url VARCHAR(255),
  pan_number VARCHAR(10),
  pan_doc_url VARCHAR(255),
  passport_number VARCHAR(20),
  voter_id VARCHAR(20),
  photo_url VARCHAR(255),
  insurance_doc VARCHAR(500),
  alternate_email VARCHAR(255),
  alternate_number VARCHAR(20),
  blood_group VARCHAR(5),
  emergency_name VARCHAR(255),
  emergency_number VARCHAR(20),
  father_dob DATE,
  father_gov_doc_url VARCHAR(512),
  mother_dob DATE,
  mother_gov_doc_url VARCHAR(512),
  spouse_dob DATE,
  spouse_gov_doc_url VARCHAR(512),
  child1_name VARCHAR(255),
  child1_dob DATE,
  child1_gov_doc_url VARCHAR(512),
  child2_name VARCHAR(255),
  child2_dob DATE,
  child2_gov_doc_url VARCHAR(512),
  child3_name VARCHAR(255),
  child3_dob DATE,
  child3_gov_doc_url VARCHAR(512),
  passport_doc_url VARCHAR(512),
  voter_id_doc_url VARCHAR(512),
  driving_license_number VARCHAR(255),
  driving_license_doc_url VARCHAR(512),
  uan_number VARCHAR(30),
  pf_number VARCHAR(30),
  esi_number VARCHAR(30)
);

CREATE TABLE IF NOT EXISTS employee_professional (
  employee_id VARCHAR(20) PRIMARY KEY,
  domain VARCHAR(10),
  employee_type VARCHAR(50),
  role VARCHAR(50),
  department_id INT,
  position VARCHAR(100),
  supervisor_id VARCHAR(20),
  salary DECIMAL(10,2),
  resume_url VARCHAR(500),
  joining_date DATE
);

CREATE TABLE IF NOT EXISTS employee_education (
  employee_id VARCHAR(20) PRIMARY KEY,
  tenth_institution VARCHAR(255),
  tenth_year YEAR,
  tenth_board VARCHAR(100),
  tenth_score DECIMAL(5,2),
  tenth_cert_url TEXT,
  twelfth_institution VARCHAR(255),
  twelfth_year YEAR,
  twelfth_board VARCHAR(100),
  twelfth_score DECIMAL(5,2),
  twelfth_cert_url TEXT,
  ug_institution VARCHAR(255),
  ug_year YEAR,
  ug_board VARCHAR(100),
  ug_score DECIMAL(5,2),
  ug_cert_url TEXT,
  pg_institution VARCHAR(255),
  pg_year YEAR,
  pg_board VARCHAR(100),
  pg_score DECIMAL(5,2),
  pg_cert_url TEXT
);

CREATE TABLE IF NOT EXISTS employee_documents (
  document_id INT AUTO_INCREMENT PRIMARY KEY,
  employee_id VARCHAR(20),
  other_doc_url VARCHAR(500)
);

CREATE TABLE IF NOT EXISTS employee_bank_details (
  bank_id INT AUTO_INCREMENT PRIMARY KEY,
  employee_id VARCHAR(10),
  employee_name VARCHAR(100),
  bank_name VARCHAR(100),
  account_number VARCHAR(20),
  ifsc_code VARCHAR(20),
  branch_name VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS employee_additional_certs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employee_id VARCHAR(20),
  cert_name VARCHAR(255),
  institution VARCHAR(255),
  year VARCHAR(10),
  file_urls TEXT,
  created_at DATETIME,
  updated_at DATETIME
);

CREATE TABLE IF NOT EXISTS password_resets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(100),
  token VARCHAR(255),
  expiry_time DATETIME,
  Org_id VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS sidebar_menu_access (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sidebar_item_id INT,
  role VARCHAR(50),
  org_id INT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS add_project (
  id INT AUTO_INCREMENT PRIMARY KEY,
  org_id INT UNSIGNED,
  company_name VARCHAR(255),
  project_name VARCHAR(255),
  project_poc_name VARCHAR(255),
  project_poc_contact VARCHAR(50),
  payment_type VARCHAR(50),
  company_gst VARCHAR(50),
  company_pan VARCHAR(50),
  company_address TEXT,
  country VARCHAR(50),
  state VARCHAR(50),
  project_category JSON,
  start_date DATE,
  end_date DATE,
  service_mode VARCHAR(50),
  service_location VARCHAR(255),
  project_status VARCHAR(50),
  description TEXT,
  attachment_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sts_owners (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT,
  sts_owner VARCHAR(255),
  sts_contact VARCHAR(50),
  employee_list VARCHAR(255),
  key_considerations TEXT,
  sts_owner_id VARCHAR(10)
);

CREATE TABLE IF NOT EXISTS milestones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT,
  milestone_details TEXT,
  start_date DATE,
  end_date DATE,
  current_status VARCHAR(255),
  dependency VARCHAR(255),
  assigned_to VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS financial_details (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT,
  milestone_id INT,
  project_amount DECIMAL(12,2),
  tds_percentage DECIMAL(5,2),
  tds_amount DECIMAL(12,2),
  gst_percentage DECIMAL(5,2),
  gst_amount DECIMAL(12,2),
  total_amount DECIMAL(12,2),
  m_actual_percentage DECIMAL(5,2),
  m_actual_amount DECIMAL(12,2),
  m_tds_percentage DECIMAL(5,2),
  m_tds_amount DECIMAL(12,2),
  m_gst_percentage DECIMAL(5,2),
  m_gst_amount DECIMAL(12,2),
  m_total_amount DECIMAL(12,2),
  status ENUM('Pending','Received'),
  completed_date DATE,
  monthly_fixed_amount DECIMAL(12,2),
  service_description TEXT,
  month_year VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS departments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255),
  icon VARCHAR(255),
  Org_id VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS assets (
  asset_id VARCHAR(50) PRIMARY KEY,
  org_id INT UNSIGNED,
  asset_name VARCHAR(100),
  configuration TEXT,
  valuation_date DATE,
  assigned_to TEXT,
  document_path VARCHAR(255),
  created_at DATE,
  category VARCHAR(50),
  sub_category VARCHAR(255),
  status ENUM('In Use','Not Using','Decommissioned','Returned'),
  count INT,
  asset_code VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS chat_rooms (
  room_id INT AUTO_INCREMENT PRIMARY KEY,
  room_name VARCHAR(100),
  created_by VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_group TINYINT(1)
);

CREATE TABLE IF NOT EXISTS download_details (
  id INT AUTO_INCREMENT PRIMARY KEY,
  org_id INT UNSIGNED,
  invoice_type ENUM('tax','proforma','quotation'),
  invoice_number VARCHAR(50),
  to_name VARCHAR(255),
  address TEXT,
  contact VARCHAR(100),
  company_gst VARCHAR(50),
  state VARCHAR(100),
  invoice_date DATE,
  reference_date DATE,
  reference_id VARCHAR(100),
  place_of_supply VARCHAR(100),
  with_seal TINYINT(1),
  line_items JSON,
  sub_total DECIMAL(10,2),
  gst DECIMAL(5,2),
  gst_amount DECIMAL(10,2),
  advance DECIMAL(10,2),
  total_excluding_tax DECIMAL(10,2),
  total_including_tax DECIMAL(10,2),
  terms TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS invoice_numbers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  org_id INT UNSIGNED,
  invoice_type VARCHAR(50),
  financial_year VARCHAR(50),
  sequence INT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS invoices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  projectId INT,
  invoiceType VARCHAR(50),
  invoiceDate DATE,
  invoiceNo VARCHAR(50),
  referenceId VARCHAR(50),
  referenceDate DATE,
  workDescription TEXT,
  subTotal DECIMAL(10,2),
  advance DECIMAL(10,2),
  totalExcludingTax DECIMAL(10,2),
  totalIncludingTax DECIMAL(10,2),
  terms TEXT,
  lineItems TEXT,
  gst DECIMAL(10,2),
  gstAmount DECIMAL(10,2),
  totalAmount DECIMAL(10,2),
  createdAt TIMESTAMP,
  updatedAt TIMESTAMP,
  gstPayment VARCHAR(50),
  milestoneId INT,
  status VARCHAR(20)
);
