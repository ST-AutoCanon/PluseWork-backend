const queries = require("../constants/letterheadQuery");
const { getTenantPool, sanitizeDbName } = require("../db/tenantPoolManager");

async function getTenantPoolForOrgId(orgId) {
  if (!orgId) {
    const err = new Error("orgId required to get tenant pool");
    err.code = "ORG_REQUIRED";
    throw err;
  }
  const dbName = sanitizeDbName(`tenant_${orgId}`);
  return getTenantPool(dbName);
}

const generateLetterheadCode = async (orgId, connection) => {
  try {
    await connection.query("LOCK TABLES letterhead READ");
    const [rows] = await connection.query(
      "SELECT letterhead_code FROM letterhead WHERE letterhead_code LIKE 'LHT-%' ORDER BY CAST(SUBSTRING(letterhead_code, 5) AS UNSIGNED) DESC LIMIT 1"
    );
    let nextCode = "LHT-00001";
    if (rows.length > 0 && rows[0].letterhead_code) {
      const lastCode = rows[0].letterhead_code;
      const numberPart = parseInt(lastCode.split("-")[1], 10);
      const nextNumber = numberPart + 1;
      nextCode = `LHT-${nextNumber.toString().padStart(5, "0")}`;
    }
    return nextCode;
  } catch (error) {
    console.error("Error generating letterhead code:", error);
    throw new Error("Error generating letterhead code: " + error.message);
  } finally {
    await connection.query("UNLOCK TABLES");
  }
};

const insertLetterhead = async (orgId, letterheadData, retries = 3) => {
  let connection;
  const tenantPool = await getTenantPoolForOrgId(orgId);
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
      company_name,
      company_address,
      company_address_line2,
      gstin_number,
      cin_number,
    } = letterheadData;

    const letterhead_code = await generateLetterheadCode(orgId, connection);

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
      company_name || null,
      company_address || null,
      company_address_line2 || null,
      gstin_number || null,
      cin_number || null,
    ];

    const [result] = await connection.query(queries.INSERT_LETTERHEAD, values);
    await connection.commit();
    return { insertId: result.insertId, letterhead_code };
  } catch (error) {
    if (connection) await connection.rollback();
    if (error.code === "ER_DUP_ENTRY" && retries > 0) {
      console.warn(`Duplicate entry detected. Retrying (${retries} left)`);
      return insertLetterhead(orgId, letterheadData, retries - 1);
    }
    console.error("Error inserting letterhead:", error);
    throw new Error("Error inserting letterhead: " + error.message);
  } finally {
    if (connection) connection.release();
  }
};

const getAllLetterheads = async (orgId) => {
  const tenantPool = await getTenantPoolForOrgId(orgId);
  try {
    const [rows] = await tenantPool.query(queries.GET_ALL_LETTERHEADS, [orgId]);
    return rows;
  } catch (error) {
    console.error("Error fetching letterheads:", error);
    throw new Error("Error fetching letterheads");
  }
};

const updateLetterheadById = async (orgId, letterheadData, id) => {
  const tenantPool = await getTenantPoolForOrgId(orgId);
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
      company_name,
      company_address,
      company_address_line2,
      gstin_number,
      cin_number,
    } = letterheadData;

    const values = [
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
      company_name || null,
      company_address || null,
      company_address_line2 || null,
      gstin_number || null,
      cin_number || null,
      id,
      orgId,
    ];

    const [result] = await tenantPool.query(queries.UPDATE_LETTERHEAD_BY_ID, values);
    return result;
  } catch (error) {
    console.error("Error updating letterhead:", error);
    throw new Error("Error updating letterhead");
  }
};

const getLetterheadById = async (orgId, id) => {
  const tenantPool = await getTenantPoolForOrgId(orgId);
  try {
    const [rows] = await tenantPool.query(queries.GET_LETTERHEAD_BY_ID, [id, orgId]);
    return rows[0] || null;
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