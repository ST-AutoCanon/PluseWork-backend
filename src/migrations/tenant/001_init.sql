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
  org_id VARCHAR(50)
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
  org_id VARCHAR(50)
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

CREATE TABLE IF NOT EXISTS emp_attendence (
  punch_id int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  employee_i varchar(20),
  punch_status enum('Punch In','Punch Out') NOT NULL,
  punchin_time datetime DEFAULT NULL,
  punchin_device varchar(255) DEFAULT NULL,
  punchin_location varchar(255) DEFAULT NULL,
  punchout_time datetime DEFAULT NULL,
  punchout_device varchar(255) DEFAULT NULL,
  punchout_location varchar(255) DEFAULT NULL,
  punchmode enum('Manual','Automatic') NOT NULL DEFAULT 'Manual',
  KEY employee_id (employee_id),
  CONSTRAINT emp_attendence_ibfk_1 FOREIGN KEY (employee_id) REFERENCES employees (employee_id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS leavequeries (
  id int NOT NULL AUTO_INCREMENT,
  employee_id varchar(20) NOT NULL,
  org_id int unsigned DEFAULT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  reason text,
  status enum('Approved','Rejected','pending') NOT NULL DEFAULT 'pending',
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  leave_type varchar(50) DEFAULT NULL,
  comments text,
  H_F_day varchar(30) DEFAULT NULL,
  compensated_days decimal(5,2) DEFAULT '0.00',
  deducted_days decimal(5,2) DEFAULT '0.00',
  loss_of_pay_days decimal(5,2) DEFAULT '0.00',
  preserved_leave_days decimal(5,2) DEFAULT '0.00',
  is_defaulted tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (id),
  KEY idx_leavequeries_employee (employee_id),
  KEY idx_leavequeries_status (status),
  KEY idx_leavequeries_start_date (start_date),
  KEY idx_leavequeries_end_date (end_date)
);

CREATE TABLE IF NOT EXISTS reimbursement (
  id int NOT NULL AUTO_INCREMENT,
  employee_id varchar(10) NOT NULL,
  department_id int DEFAULT NULL,
  project varchar(255) DEFAULT NULL,
  claim_type enum('Transportation','Meals','Telecommunication','Miscellaneous','Stationary') NOT NULL,
  transport_type enum('Outstation','Intercity','Fuel') DEFAULT NULL,
  participants json DEFAULT NULL,
  comments text,
  status enum('pending','approved','rejected') DEFAULT 'pending',
  payment_status varchar(15) NOT NULL DEFAULT 'Pending',
  paid_date date DEFAULT NULL,
  approved_date date DEFAULT NULL,
  approver_id varchar(10) DEFAULT NULL,
  aggregated_total decimal(12,2) DEFAULT NULL,
  approver_name varchar(50) DEFAULT NULL,
  approver_designation varchar(50) DEFAULT NULL,
  approver_comments text,
  created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY department_id (department_id),
  KEY fk_reimbursement_employee (employee_id),
  CONSTRAINT fk_reimbursement_employee FOREIGN KEY (employee_id) REFERENCES employees (employee_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT reimbursement_ibfk_2 FOREIGN KEY (department_id) REFERENCES departments (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reimbursement_lines (
  id bigint NOT NULL AUTO_INCREMENT,
  reimbursement_id int NOT NULL,
  line_index int NOT NULL DEFAULT '0',
  purpose text,
  date date DEFAULT NULL,
  from_date date DEFAULT NULL,
  to_date date DEFAULT NULL,
  travel_from varchar(255) DEFAULT NULL,
  travel_to varchar(255) DEFAULT NULL,
  transport_amount decimal(12,2) DEFAULT '0.00',
  accommodation_fees decimal(12,2) DEFAULT '0.00',
  da decimal(12,2) DEFAULT '0.00',
  total_amount decimal(12,2) DEFAULT '0.00',
  meal_type varchar(60) DEFAULT NULL,
  meals_objective varchar(255) DEFAULT NULL,
  purchasing_item varchar(255) DEFAULT NULL,
  stationairy_item varchar(255) DEFAULT NULL,
  service_provider varchar(255) DEFAULT NULL,
  meta json DEFAULT NULL,
  created_at datetime DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY reimbursement_id (reimbursement_id,line_index),
  CONSTRAINT fk_rl_reimbursement FOREIGN KEY (reimbursement_id) REFERENCES reimbursement (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reimbursement_attachments (
  id bigint NOT NULL AUTO_INCREMENT,
  reimbursement_id int NOT NULL,
  line_id bigint DEFAULT NULL,
  file_name varchar(512) NOT NULL,
  file_path varchar(2048) NOT NULL,
  file_size bigint DEFAULT '0',
  mime_type varchar(128) DEFAULT NULL,
  created_at datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY reimbursement_id (reimbursement_id),
  KEY line_id (line_id),
  CONSTRAINT fk_attach_line FOREIGN KEY (line_id) REFERENCES reimbursement_lines (id) ON DELETE CASCADE,
  CONSTRAINT fk_attach_reim FOREIGN KEY (reimbursement_id) REFERENCES reimbursement (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notifications (
  id bigint unsigned NOT NULL AUTO_INCREMENT,
  user_id varchar(20) NOT NULL,
  meeting_id int DEFAULT NULL,
  policy_id bigint DEFAULT NULL,
  message text NOT NULL,
  triggered_at timestamp NULL DEFAULT NULL,
  is_read tinyint(1) NOT NULL DEFAULT '0',
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_user_id (user_id),
  KEY idx_meeting_id (meeting_id),
  KEY idx_policy_id (policy_id),
  KEY idx_triggered_at (triggered_at),
  KEY idx_is_read (is_read)
);


CREATE TABLE IF NOT EXISTS employee_experience (
  experience_id int NOT NULL AUTO_INCREMENT,
  employee_id varchar(20) NOT NULL,
  company varchar(255) DEFAULT NULL,
  designation varchar(255) DEFAULT NULL,
  start_date date DEFAULT NULL,
  end_date date DEFAULT NULL,
  doc_url text,
  created_at datetime DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (experience_id),
  KEY fk_employee_experience_employee_id (employee_id),
  CONSTRAINT fk_employee_experience_employee_id FOREIGN KEY (employee_id) REFERENCES employees (employee_id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS threads (
  id int NOT NULL AUTO_INCREMENT,
  org_id int unsigned DEFAULT NULL,
  sender_id varchar(10) NOT NULL,
  recipient_id varchar(10) NOT NULL,
  department_id int DEFAULT NULL,
  status enum('open','closed') DEFAULT 'open',
  feedback enum('Very Unsatisfied','Unsatisfied','Satisfied','Very Satisfied') DEFAULT NULL,
  created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  subject varchar(255) DEFAULT NULL,
  latest_message text,
  note text,
  PRIMARY KEY (id),
  KEY fk_threads_employee (sender_id),
   CONSTRAINT fk_threads_employee FOREIGN KEY (sender_id) REFERENCES employees (employee_id) ON DELETE CASCADE ON UPDATE CASCADE
 );

 CREATE TABLE IF NOT EXISTS employee_queries (
  id int NOT NULL AUTO_INCREMENT,
  thread_id int NOT NULL,
  sender_id varchar(10) NOT NULL,
  sender_role varchar(50) NOT NULL,
  message text NOT NULL,
  created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  attachment_url varchar(255) DEFAULT NULL,
  PRIMARY KEY (id),
  KEY thread_id (thread_id),
  CONSTRAINT employee_queries_ibfk_1 FOREIGN KEY (thread_id) REFERENCES threads (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS message_read_status (
  id int NOT NULL AUTO_INCREMENT,
  message_id int NOT NULL,
  recipient_id varchar(10) NOT NULL,
  is_read tinyint(1) DEFAULT '0',
  read_at timestamp NULL DEFAULT NULL,
  PRIMARY KEY (id),
  KEY message_id (message_id),
  CONSTRAINT message_read_status_ibfk_1 FOREIGN KEY (message_id) REFERENCES employee_queries (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS room_members (
  room_id int NOT NULL,
  employee_id varchar(20) NOT NULL,
  joined_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (room_id,employee_id),
  KEY idx_room_members_emp (employee_id),
  CONSTRAINT fk_rm_employee FOREIGN KEY (employee_id) REFERENCES employees (employee_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_rm_room FOREIGN KEY (room_id) REFERENCES chat_rooms (room_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS messages (
  message_id bigint NOT NULL AUTO_INCREMENT,
  room_id int NOT NULL,
  sender_id varchar(20) DEFAULT NULL,
  message_text text NOT NULL,
  type enum('text','file') NOT NULL DEFAULT 'text',
  file_url varchar(255) DEFAULT NULL COMMENT 'If type="file", URL or path here',
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  latitude decimal(9,6) DEFAULT NULL,
  longitude decimal(9,6) DEFAULT NULL,
  address text,
  PRIMARY KEY (message_id),
  KEY idx_messages_room (room_id),
  KEY idx_messages_sender (sender_id),
  CONSTRAINT fk_msg_room FOREIGN KEY (room_id) REFERENCES chat_rooms (room_id) ON DELETE CASCADE,
  CONSTRAINT fk_msg_sender FOREIGN KEY (sender_id) REFERENCES employees (employee_id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS message_reads (
  message_id bigint NOT NULL,
  reader_id varchar(20) NOT NULL,
  read_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (message_id,reader_id),
  KEY reader_id (reader_id),
  CONSTRAINT message_reads_ibfk_1 FOREIGN KEY (message_id) REFERENCES messages (message_id) ON DELETE CASCADE,
  CONSTRAINT message_reads_ibfk_2 FOREIGN KEY (reader_id) REFERENCES employees (employee_id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS templates (
  id bigint NOT NULL AUTO_INCREMENT,
  organization_id int unsigned NOT NULL,
  name varchar(255) NOT NULL,
  template_type varchar(64) DEFAULT 'generic',
  grapes_json longtext,
  html longtext,
  css longtext,
  thumbnail_url varchar(1024) DEFAULT NULL,
  meta longtext,
  version int DEFAULT '1',
  created_by int DEFAULT NULL,
  created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  is_default tinyint(1) DEFAULT '0',
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS template_versions (
  id bigint NOT NULL AUTO_INCREMENT,
  template_id bigint NOT NULL,
  grapes_json longtext,
  html longtext,
  css longtext,
  version_num int DEFAULT NULL,
  created_by int DEFAULT NULL,
  created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY template_id (template_id),
  CONSTRAINT template_versions_ibfk_1 FOREIGN KEY (template_id) REFERENCES templates (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS holidays (
  id int NOT NULL AUTO_INCREMENT,
  org_id int unsigned DEFAULT NULL,
  date date NOT NULL,
  occasion varchar(255) NOT NULL,
  type enum('Optional','Company') DEFAULT NULL,
  PRIMARY KEY (id)
  );

  CREATE TABLE IF NOT EXISTS positions (
  id int NOT NULL AUTO_INCREMENT,
  name varchar(255) DEFAULT NULL,
  department_id int DEFAULT NULL,
  rank tinyint DEFAULT NULL,
  PRIMARY KEY (id),
  KEY department_id (department_id),
  CONSTRAINT positions_ibfk_1 FOREIGN KEY (department_id) REFERENCES departments (id)
);

CREATE TABLE IF NOT EXISTS supervisor_assignments (
  id int NOT NULL AUTO_INCREMENT,
  employee_id varchar(20) NOT NULL,
  supervisor_id varchar(20) NOT NULL,
  start_date date NOT NULL,
  end_date date DEFAULT NULL,
  created_at datetime DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY supervisor_assignments_ibfk_1 (employee_id),
  KEY supervisor_assignments_ibfk_2 (supervisor_id),
  CONSTRAINT supervisor_assignments_ibfk_1 FOREIGN KEY (employee_id) REFERENCES employees (employee_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT supervisor_assignments_ibfk_2 FOREIGN KEY (supervisor_id) REFERENCES employees (employee_id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS leave_policy (
  id int unsigned NOT NULL AUTO_INCREMENT,
  org_id int unsigned DEFAULT NULL,
  period enum('yearly','half','quarter') NOT NULL DEFAULT 'yearly',
  year_start date NOT NULL,
  year_end date NOT NULL,
  leave_settings json DEFAULT NULL,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  emp_lop int NOT NULL DEFAULT '0',
  leave_type varchar(255) DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_leave_policy_period (period),
  KEY idx_leave_policy_year_start (year_start),
  KEY idx_leave_policy_year_end (year_end),
  CONSTRAINT leave_policy_chk_1 CHECK ((year_start <= year_end))
);