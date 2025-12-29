const mysql = require("mysql2/promise");
require("dotenv").config();

const ADMIN_USER = process.env.DB_ADMIN_USER || process.env.DB_USER;
const ADMIN_PASS = process.env.DB_ADMIN_PASS || process.env.DB_PASSWORD;
const DB_HOST = process.env.DB_HOST;
const MASTER_DB = process.env.DB_NAME;

const adminPool = mysql.createPool({
  host: DB_HOST,
  user: ADMIN_USER,
  password: ADMIN_PASS,
  database: MASTER_DB,
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 100,
  multipleStatements: true,
  connectTimeout: parseInt(process.env.DB_ADMIN_CONNECT_TIMEOUT || "20000", 10),
});

module.exports = adminPool;
