// services/holidayService.js
const db = require("../config");
const queries = require("../constants/queries");

/**
 * Fetch holidays for a given orgId for the current year.
 * @param {number|string} orgId
 */
const getHolidays = async (orgId) => {
  if (!orgId) throw new Error("orgId is required");
  try {
    const [rows] = await db.execute(queries.GET_HOLIDAYS, [orgId]);
    return rows;
  } catch (error) {
    throw error;
  }
};

/**
 * Insert or update multiple holiday rows inside a transaction using a single bulk upsert.
 * rows: [{ date: "YYYY-MM-DD", occasion: "...", type: "Company"|"Optional" }, ...]
 * orgId: organization id to be applied to all rows.
 * Returns the number of affected/inserted rows (as reported by DB).
 */
const insertHolidays = async (rows, orgId) => {
  if (!orgId) throw new Error("orgId is required");
  if (!Array.isArray(rows) || rows.length === 0) return 0;

  // prepare values array for bulk insert: each row must include orgId as first column
  const values = rows.map((r) => [orgId, r.date, r.occasion, r.type]);

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // bulk upsert query from constants
    const [result] = await connection.query(queries.INSERT_HOLIDAYS_UPSERT, [
      values,
    ]);

    await connection.commit();
    connection.release();

    // return affectedRows if available (mysql returns affectedRows)
    return result && typeof result.affectedRows === "number"
      ? result.affectedRows
      : rows.length;
  } catch (err) {
    try {
      await connection.rollback();
    } catch (e) {
      // ignore rollback errors
    }
    connection.release();
    throw err;
  }
};

module.exports = { getHolidays, insertHolidays };
