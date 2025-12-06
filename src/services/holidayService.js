const db = require("../config");
const queries = require("../constants/queries");

const getHolidays = async (orgId) => {
  if (!orgId) throw new Error("orgId is required");
  try {
    const [rows] = await db.execute(queries.GET_HOLIDAYS, [orgId]);
    return rows;
  } catch (error) {
    throw error;
  }
};

const insertHolidays = async (rows, orgId) => {
  if (!orgId) throw new Error("orgId is required");
  if (!Array.isArray(rows) || rows.length === 0) return 0;

  const values = rows.map((r) => [orgId, r.date, r.occasion, r.type]);

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [result] = await connection.query(queries.INSERT_HOLIDAYS_UPSERT, [
      values,
    ]);

    await connection.commit();
    connection.release();

    return result && typeof result.affectedRows === "number"
      ? result.affectedRows
      : rows.length;
  } catch (err) {
    try {
      await connection.rollback();
    } catch (e) {}
    connection.release();
    throw err;
  }
};

module.exports = { getHolidays, insertHolidays };
