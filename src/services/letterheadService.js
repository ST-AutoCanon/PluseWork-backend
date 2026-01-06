const queries = require("../constants/letterheadQuery");

const generateLetterheadCode = async (connection, orgId) => {
  try {
    await connection.query("LOCK TABLES letterhead WRITE");

    const [rows] = await connection.query(
      "SELECT letterhead_code FROM letterhead WHERE letterhead_code LIKE 'LHT-%' AND org_id = ? ORDER BY CAST(SUBSTRING_INDEX(letterhead_code, '-', -1) AS UNSIGNED) DESC LIMIT 1",
      [orgId]
    );

    let nextCode = "LHT-00001";

    if (rows && rows.length > 0 && rows[0].letterhead_code) {
      const lastCode = rows[0].letterhead_code;
      const parts = lastCode.split("-");
      const numberPart = parseInt(parts[1] || parts[parts.length - 1], 10) || 0;
      const nextNumber = numberPart + 1;
      nextCode = `LHT-${nextNumber.toString().padStart(5, "0")}`;
    }

    return nextCode;
  } catch (error) {
    console.error("Error generating letterhead code:", error);
    throw new Error("Error generating letterhead code: " + error.message);
  } finally {
    try {
      await connection.query("UNLOCK TABLES");
    } catch (e) {}
  }
};

const insertLetterhead = async (
  tenantPool,
  orgId,
  letterheadData,
  retries = 3
) => {
  let connection;
  try {
    connection = await tenantPool.getConnection();
    await connection.beginTransaction();

    const {
      template_name,
      letter_type,
      subject,
      body,
      recipient_name,
      title,
      mobile_number,
      email,
      address,
      date,
      signature,
      employee_name,
      position,
      annual_salary,
      effective_date,
      date_of_appointment,
      attachment,
      place,
    } = letterheadData;

    const letterhead_code = await generateLetterheadCode(connection, orgId);

    const values = [
      orgId,
      letterhead_code,
      template_name,
      letter_type,
      subject,
      body,
      recipient_name || null,
      title || null,
      mobile_number || null,
      email || null,
      address || null,
      date || null,
      signature || null,
      employee_name || null,
      position || null,
      annual_salary || null,
      effective_date || null,
      date_of_appointment || null,
      attachment || null,
      place || null,
    ];

    const [result] = await connection.query(queries.INSERT_LETTERHEAD, values);

    await connection.commit();
    return result;
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rb) {}
    }
    if (error && error.code === "ER_DUP_ENTRY" && retries > 0) {
      console.warn(`Duplicate letterhead code, retrying (${retries - 1} left)`);
      return insertLetterhead(tenantPool, orgId, letterheadData, retries - 1);
    }
    console.error("Error inserting letterhead:", error);
    throw new Error("Error inserting letterhead: " + (error.message || error));
  } finally {
    if (connection) {
      try {
        connection.release();
      } catch (e) {}
    }
  }
};

const getAllLetterheads = async (tenantPool, orgId) => {
  try {
    const [rows] = await tenantPool.query(queries.GET_ALL_LETTERHEADS, [orgId]);
    return rows;
  } catch (error) {
    console.error("Error fetching letterheads:", error);
    throw new Error("Error fetching letterheads");
  }
};

const updateLetterheadById = async (tenantPool, orgId, letterheadData, id) => {
  try {
    const {
      letterhead_code,
      template_name,
      letter_type,
      subject,
      body,
      recipient_name,
      title,
      mobile_number,
      email,
      address,
      date,
      signature,
      employee_name,
      position,
      annual_salary,
      effective_date,
      date_of_appointment,
      attachment,
      place,
    } = letterheadData;

    const values = [
      letterhead_code || null,
      template_name,
      letter_type,
      subject,
      body,
      recipient_name || null,
      title || null,
      mobile_number || null,
      email || null,
      address || null,
      date || null,
      signature || null,
      employee_name || null,
      position || null,
      annual_salary || null,
      effective_date || null,
      date_of_appointment || null,
      attachment || null,
      place || null,
      id,
      orgId,
    ];

    const [result] = await tenantPool.query(
      queries.UPDATE_LETTERHEAD_BY_ID,
      values
    );
    return result;
  } catch (error) {
    console.error("Error updating letterhead:", error);
    throw new Error("Error updating letterhead");
  }
};

const getLetterheadById = async (tenantPool, orgId, id) => {
  try {
    const [rows] = await tenantPool.query(queries.GET_LETTERHEAD_BY_ID, [
      id,
      orgId,
    ]);
    return rows && rows[0] ? rows[0] : null;
  } catch (error) {
    console.error("Error fetching letterhead by ID:", error);
    throw new Error("Error fetching letterhead by ID");
  }
};

module.exports = {
  insertLetterhead,
  getAllLetterheads,
  updateLetterheadById,
  getLetterheadById,
};
