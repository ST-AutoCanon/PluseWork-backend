const db = require("../config");
const queries = require("../constants/letterheadQuery");

// Helper function to generate the next letterhead code
const generateLetterheadCode = async (connection) => {
  try {
    // Lock the table to prevent concurrent reads
    await connection.query("LOCK TABLES letterhead READ");

    const [rows] = await connection.query(
      "SELECT letterhead_code FROM letterhead WHERE letterhead_code LIKE 'LHT-%' ORDER BY CAST(SUBSTRING(letterhead_code, 5) AS UNSIGNED) DESC LIMIT 1"
    );

    let nextCode = "LHT-00001"; // Default first code

    if (rows.length > 0 && rows[0].letterhead_code) {
      const lastCode = rows[0].letterhead_code; // e.g., "LHT-00036"
      const numberPart = parseInt(lastCode.split("-")[1], 10); // Extract the number (e.g., 36)
      const nextNumber = numberPart + 1;
      nextCode = `LHT-${nextNumber.toString().padStart(5, "0")}`; // Format as LHT-00037
    }

    return nextCode;
  } catch (error) {
    console.error("Error generating letterhead code:", error);
    throw new Error("Error generating letterhead code: " + error.message);
  } finally {
    // Unlock the table
    await connection.query("UNLOCK TABLES");
  }
};

const insertLetterhead = async (letterheadData, retries = 3) => {
  let connection;
  try {
    // Start a transaction
    connection = await db.getConnection();
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

    // Generate letterhead code within the transaction
    const letterhead_code = await generateLetterheadCode(connection);

    const values = [
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

    // Commit the transaction
    await connection.commit();
    return result;
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    if (error.code === "ER_DUP_ENTRY" && retries > 0) {
      console.warn(
        `Duplicate entry detected for ${
          letterheadData.letterhead_code || "generated code"
        }. Retrying (${retries} attempts left)`
      );
      return insertLetterhead(letterheadData, retries - 1);
    }
    console.error("Error inserting letterhead:", error);
    throw new Error("Error inserting letterhead: " + error.message);
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

const getAllLetterheads = async () => {
  try {
    const [rows] = await db.query(queries.GET_ALL_LETTERHEADS);
    return rows;
  } catch (error) {
    console.error("Error fetching letterheads:", error);
    throw new Error("Error fetching letterheads");
  }
};

const updateLetterheadById = async (letterheadData, id) => {
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
    ];

    const [result] = await db.query(queries.UPDATE_LETTERHEAD_BY_ID, values);
    return result;
  } catch (error) {
    console.error("Error updating letterhead:", error);
    throw new Error("Error updating letterhead");
  }
};

const getLetterheadById = async (id) => {
  try {
    const [rows] = await db.query(queries.GET_LETTERHEAD_BY_ID, [id]);
    return rows[0];
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
