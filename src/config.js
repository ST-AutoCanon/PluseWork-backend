/**
 * Database configuration using MySQL connection pool.
 *
 * @module config
 */
require("dotenv").config();
const mysql = require("mysql2");

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,

  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || "30", 10),
  queueLimit: parseInt(process.env.DB_QUEUE_LIMIT || "1000", 10),
  acquireTimeout: parseInt(process.env.DB_ACQUIRE_TIMEOUT || "60000", 10),
  connectTimeout: parseInt(process.env.DB_CONNECT_TIMEOUT || "30000", 10),

  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
});

module.exports = pool.promise();
