// // const queries = require("../constants/letterheadQuery");
// // const { getTenantPool, sanitizeDbName } = require("../db/tenantPoolManager");

// // async function getTenantPoolForOrgId(orgId) {
// //   if (!orgId) {
// //     const err = new Error("orgId required to get tenant pool");
// //     err.code = "ORG_REQUIRED";
// //     throw err;
// //   }
// //   const dbName = sanitizeDbName(`tenant_${orgId}`);
// //   return getTenantPool(dbName);
// // }

// // const generateLetterheadCode = async (orgId, connection) => {
// //   try {
// //     await connection.query("LOCK TABLES letterhead READ");
// //     const [rows] = await connection.query(
// //       "SELECT letterhead_code FROM letterhead WHERE letterhead_code LIKE 'LHT-%' ORDER BY CAST(SUBSTRING(letterhead_code, 5) AS UNSIGNED) DESC LIMIT 1"
// //     );
// //     let nextCode = "LHT-00001";
// //     if (rows.length > 0 && rows[0].letterhead_code) {
// //       const lastCode = rows[0].letterhead_code;
// //       const numberPart = parseInt(lastCode.split("-")[1], 10);
// //       const nextNumber = numberPart + 1;
// //       nextCode = `LHT-${nextNumber.toString().padStart(5, "0")}`;
// //     }
// //     return nextCode;
// //   } catch (error) {
// //     console.error("Error generating letterhead code:", error);
// //     throw new Error("Error generating letterhead code: " + error.message);
// //   } finally {
// //     await connection.query("UNLOCK TABLES");
// //   }
// // };

// // const insertLetterhead = async (orgId, letterheadData, retries = 3) => {
// //   let connection;
// //   const tenantPool = await getTenantPoolForOrgId(orgId);
// //   try {
// //     connection = await tenantPool.getConnection();
// //     await connection.beginTransaction();

// //     const {
// //       template_name,
// //       letter_type,
// //       subject,
// //       body,
// //       recipient_name,
// //       title,
// //       mobile_number,
// //       email,
// //       address,
// //       date,
// //       signature,
// //       employee_name,
// //       position,
// //       annual_salary,
// //       effective_date,
// //       date_of_appointment,
// //       attachment,
// //       place,
// //       company_name,
// //       company_address,
// //       company_address_line2,
// //       gstin_number,
// //       cin_number,
// //     } = letterheadData;

// //     const letterhead_code = await generateLetterheadCode(orgId, connection);

// //     const values = [
// //       orgId,
// //       letterhead_code,
// //       template_name,
// //       letter_type,
// //       subject,
// //       body,
// //       recipient_name || null,
// //       title || null,
// //       mobile_number || null,
// //       email || null,
// //       address || null,
// //       date || null,
// //       signature || null,
// //       employee_name || null,
// //       position || null,
// //       annual_salary || null,
// //       effective_date || null,
// //       date_of_appointment || null,
// //       attachment || null,
// //       place || null,
// //       company_name || null,
// //       company_address || null,
// //       company_address_line2 || null,
// //       gstin_number || null,
// //       cin_number || null,
// //     ];

// //     const [result] = await connection.query(queries.INSERT_LETTERHEAD, values);
// //     await connection.commit();
// //     return { insertId: result.insertId, letterhead_code };
// //   } catch (error) {
// //     if (connection) await connection.rollback();
// //     if (error.code === "ER_DUP_ENTRY" && retries > 0) {
// //       console.warn(`Duplicate entry detected. Retrying (${retries} left)`);
// //       return insertLetterhead(orgId, letterheadData, retries - 1);
// //     }
// //     console.error("Error inserting letterhead:", error);
// //     throw new Error("Error inserting letterhead: " + error.message);
// //   } finally {
// //     if (connection) connection.release();
// //   }
// // };

// // const getAllLetterheads = async (orgId) => {
// //   const tenantPool = await getTenantPoolForOrgId(orgId);
// //   try {
// //     const [rows] = await tenantPool.query(queries.GET_ALL_LETTERHEADS, [orgId]);
// //     return rows;
// //   } catch (error) {
// //     console.error("Error fetching letterheads:", error);
// //     throw new Error("Error fetching letterheads");
// //   }
// // };

// // const formatDate = (dateValue) => {
// //   if (!dateValue) return null;

// //   const date = new Date(dateValue);

// //   if (isNaN(date.getTime())) return null;

// //   return date.toISOString().split("T")[0]; // YYYY-MM-DD
// // };
// // const updateLetterheadById = async (orgId, letterheadData, id) => {
// //   const tenantPool = await getTenantPoolForOrgId(orgId);

// //   try {
// //     const {
// //       template_name,
// //       letter_type,
// //       subject,
// //       body,
// //       attachment,
// //       ...dynamicFields
// //     } = letterheadData;

// //     // Map contact_number → mobile_number
// //     if (dynamicFields.contact_number) {
// //       dynamicFields.mobile_number = dynamicFields.contact_number;
// //       delete dynamicFields.contact_number;
// //     }
// // // Fix date fields
// // if (dynamicFields.date) {
// //   dynamicFields.date = formatDate(dynamicFields.date);
// // }

// // if (dynamicFields.date_of_appointment) {
// //   dynamicFields.date_of_appointment =
// //     formatDate(dynamicFields.date_of_appointment);
// // }

// // if (dynamicFields.effective_date) {
// //   dynamicFields.effective_date =
// //     formatDate(dynamicFields.effective_date);
// // }
// //     // ✅ Allowed DB columns only
// //     const allowedColumns = [
// //       "recipient_name",
// //       "title",
// //       "mobile_number",
// //       "email",
// //       "address",
// //       "date",
// //       "signature",
// //       "employee_name",
// //       "position",
// //       "annual_salary",
// //       "effective_date",
// //       "date_of_appointment",
// //       "place",
// //       "company_name",
// //       "company_address",
// //       "company_address_line2",
// //       "gstin_number",
// //       "cin_number"
// //     ];

// //     // Filter only valid fields
// //     const filteredDynamicFields = {};
// //     Object.keys(dynamicFields).forEach(key => {
// //       if (allowedColumns.includes(key)) {
// //         filteredDynamicFields[key] = dynamicFields[key];
// //       }
// //     });

// //     const baseFields = {
// //       template_name: template_name || null,
// //       letter_type,
// //       subject: subject || null,
// //       body,
// //       attachment: attachment || null,
// //     };

// //     const updateData = {
// //       ...baseFields,
// //       ...filteredDynamicFields
// //     };

// //     const setClauses = Object.keys(updateData)
// //       .map(key => `${key} = ?`)
// //       .join(", ");

// //     const values = [
// //       ...Object.values(updateData),
// //       id,
// //       orgId
// //     ];

// //     const query = `
// //       UPDATE letterhead 
// //       SET ${setClauses}
// //       WHERE id = ? AND org_id = ?;
// //     `;

// //     console.log("Final Update Query:", query);
// //     console.log("Values:", values);

// //     const [result] = await tenantPool.query(query, values);

// //     return result;

// //   } catch (error) {
// //     console.error("Error updating letterhead:", error);
// //     throw new Error("Error updating letterhead: " + error.message);
// //   }
// // };

// // const getLetterheadById = async (orgId, id) => {
// //   const tenantPool = await getTenantPoolForOrgId(orgId);
// //   try {
// //     const [rows] = await tenantPool.query(queries.GET_LETTERHEAD_BY_ID, [id, orgId]);
// // if (rows.length > 0) {
// //   const data = rows[0];

// //   // Map mobile_number → contact_number
// //   data.contact_number = data.mobile_number;

// //   return data;
// // }

// // return null;  } catch (error) {
// //     console.error("Error fetching letterhead by ID:", error);
// //     throw new Error("Error fetching letterhead by ID");
// //   }
// // };

// // module.exports = {
// //   insertLetterhead,
// //   getAllLetterheads,
// //   updateLetterheadById,
// //   getLetterheadById,
// // };

// const queries = require("../constants/letterheadQuery");
// const { getTenantPool, sanitizeDbName } = require("../db/tenantPoolManager");

// async function getTenantPoolForOrgId(orgId) {
//   if (!orgId) {
//     const err = new Error("orgId required to get tenant pool");
//     err.code = "ORG_REQUIRED";
//     throw err;
//   }

//   const dbName = sanitizeDbName(`tenant_${orgId}`);
//   return getTenantPool(dbName);
// }



// const generateLetterheadCode = async (connection) => {
//   try {

//     await connection.query("LOCK TABLES letterhead_data WRITE");

//     const [rows] = await connection.query(`
//       SELECT letterhead_code 
//       FROM letterhead_data
//       WHERE letterhead_code LIKE 'LHT-%'
//       ORDER BY CAST(SUBSTRING(letterhead_code,5) AS UNSIGNED) DESC
//       LIMIT 1
//     `);

//     let nextCode = "LHT-00001";

//     if (rows.length > 0) {

//       const lastCode = rows[0].letterhead_code;

//       const numberPart =
//         parseInt(lastCode.split("-")[1], 10);

//       const nextNumber =
//         numberPart + 1;

//       nextCode =
//         `LHT-${nextNumber.toString().padStart(5,"0")}`;

//     }

//     return nextCode;

//   } finally {

//     await connection.query("UNLOCK TABLES");

//   }
// };



// // INSERT LETTERHEAD

// const insertLetterhead =
// async (orgId, letterheadData, retries = 3) => {

//   let connection;

//   const tenantPool =
//     await getTenantPoolForOrgId(orgId);

//   try {

//     connection =
//       await tenantPool.getConnection();

//     await connection.beginTransaction();



//     const {
//       template_name,
//       letter_type,
//       subject,
//       body,
//       attachment,
//       ...dynamicFields
//     } = letterheadData;



//     const letterhead_code =
//       await generateLetterheadCode(connection);



//     const dynamic_fields =
//       JSON.stringify(dynamicFields || {});



//     const values = [

//       orgId,
//       letterhead_code,
//       template_name || null,
//       letter_type,
//       subject || null,
//       body || null,
//       attachment || null,
//       dynamic_fields

//     ];



//     const [result] =
//       await connection.query(
//         queries.INSERT_LETTERHEAD,
//         values
//       );



//     await connection.commit();



//     return {

//       insertId: result.insertId,
//       letterhead_code

//     };

//   }

//   catch (error) {

//     if (connection)
//       await connection.rollback();



//     if (
//       error.code === "ER_DUP_ENTRY"
//       && retries > 0
//     ) {

//       return insertLetterhead(
//         orgId,
//         letterheadData,
//         retries - 1
//       );

//     }



//     console.error(
//       "Error inserting letterhead:",
//       error
//     );



//     throw new Error(
//       "Error inserting letterhead: "
//       + error.message
//     );

//   }

//   finally {

//     if (connection)
//       connection.release();

//   }

// };



// // GET ALL LETTERHEADS

// const getAllLetterheads =
// async (orgId) => {

//   const tenantPool =
//     await getTenantPoolForOrgId(orgId);

//   try {

//     const [rows] =
//       await tenantPool.query(
//         queries.GET_ALL_LETTERHEADS,
//         [orgId]
//       );



//     return rows.map(row => ({

//       ...row,

//       dynamic_fields:
//         row.dynamic_fields
//           ? JSON.parse(row.dynamic_fields)
//           : {}

//     }));

//   }

//   catch (error) {

//     console.error(
//       "Error fetching letterheads:",
//       error
//     );

//     throw new Error(
//       "Error fetching letterheads"
//     );

//   }

// };



// // UPDATE LETTERHEAD

// const updateLetterheadById =
// async (orgId, letterheadData, id) => {

//   const tenantPool =
//     await getTenantPoolForOrgId(orgId);

//   try {

//     const {
//       template_name,
//       letter_type,
//       subject,
//       body,
//       attachment,
//       ...dynamicFields
//     } = letterheadData;



//     const dynamic_fields =
//       JSON.stringify(dynamicFields || {});



//     const values = [

//       template_name || null,
//       letter_type,
//       subject || null,
//       body || null,
//       attachment || null,
//       dynamic_fields,
//       id,
//       orgId

//     ];



//     const [result] =
//       await tenantPool.query(
//         queries.UPDATE_LETTERHEAD_BY_ID,
//         values
//       );



//     return result;

//   }

//   catch (error) {

//     console.error(
//       "Error updating letterhead:",
//       error
//     );

//     throw new Error(
//       "Error updating letterhead: "
//       + error.message
//     );

//   }

// };



// // GET LETTERHEAD BY ID

// const getLetterheadById =
// async (orgId, id) => {

//   const tenantPool =
//     await getTenantPoolForOrgId(orgId);

//   try {

//     const [rows] =
//       await tenantPool.query(
//         queries.GET_LETTERHEAD_BY_ID,
//         [id, orgId]
//       );



//     if (rows.length > 0) {

//       const row = rows[0];

//       return {

//         ...row,

//         dynamic_fields:
//           row.dynamic_fields
//             ? JSON.parse(row.dynamic_fields)
//             : {}

//       };

//     }



//     return null;

//   }

//   catch (error) {

//     console.error(
//       "Error fetching letterhead by ID:",
//       error
//     );

//     throw new Error(
//       "Error fetching letterhead by ID"
//     );

//   }

// };



// module.exports = {

//   insertLetterhead,
//   getAllLetterheads,
//   updateLetterheadById,
//   getLetterheadById

// };
const queries = require("../constants/letterheadQuery");
const { getTenantPool, sanitizeDbName } = require("../db/tenantPoolManager");

/* ================================
   GET TENANT POOL
================================ */

async function getTenantPoolForOrgId(orgId) {

  if (!orgId) {

    const err = new Error("orgId required");
    err.code = "ORG_REQUIRED";

    throw err;
  }

  const dbName =
    sanitizeDbName(`tenant_${orgId}`);

  return getTenantPool(dbName);

}



/* ================================
   GENERATE LETTER CODE
================================ */

const generateLetterheadCode =
async (connection) => {

  try {

    await connection.query(
      "LOCK TABLES letterhead_data WRITE"
    );

    const [rows] =
      await connection.query(`

        SELECT letterhead_code

        FROM letterhead_data

        WHERE letterhead_code LIKE 'LHT-%'

        ORDER BY CAST(
          SUBSTRING(letterhead_code,5)
          AS UNSIGNED
        ) DESC

        LIMIT 1

      `);

    let nextCode = "LHT-00001";

    if (rows.length > 0) {

      const lastCode =
        rows[0].letterhead_code;

      const numberPart =
        parseInt(
          lastCode.split("-")[1],
          10
        );

      const nextNumber =
        numberPart + 1;

      nextCode =
        `LHT-${nextNumber
          .toString()
          .padStart(5,"0")}`;

    }

    return nextCode;

  }

  finally {

    await connection.query(
      "UNLOCK TABLES"
    );

  }

};



/* ================================
   INSERT LETTERHEAD
================================ */

const insertLetterhead =
async (orgId, letterheadData, retries = 3) => {

  let connection;

  const tenantPool =
    await getTenantPoolForOrgId(orgId);

  try {

    connection =
      await tenantPool.getConnection();

    await connection.beginTransaction();



    const {

      template_name,
      letter_type,
      subject,
      body,
      attachment,
      dynamic_fields

    } = letterheadData;



    const letterhead_code =
      await generateLetterheadCode(connection);



    // ✅ FIX: ensure proper JSON only once

    let dynamicJson = {};

    if (dynamic_fields) {

      if (typeof dynamic_fields === "string") {

        try {

          dynamicJson =
            JSON.parse(dynamic_fields);

        }

        catch {

          dynamicJson = {};

        }

      }

      else {

        dynamicJson =
          dynamic_fields;

      }

    }



    const values = [

      orgId,
      letterhead_code,
      template_name || null,
      letter_type,
      subject || null,
      body || null,
      attachment || null,

      JSON.stringify(dynamicJson)

    ];



    const [result] =
      await connection.query(
        queries.INSERT_LETTERHEAD,
        values
      );



    await connection.commit();



    return {

      insertId: result.insertId,
      letterhead_code

    };

  }

  catch (error) {

    if (connection)
      await connection.rollback();



    if (
      error.code === "ER_DUP_ENTRY"
      && retries > 0
    ) {

      return insertLetterhead(
        orgId,
        letterheadData,
        retries - 1
      );

    }



    console.error(
      "Insert Error:",
      error
    );

    throw new Error(
      "Insert failed: "
      + error.message
    );

  }

  finally {

    if (connection)
      connection.release();

  }

};



/* ================================
   GET ALL LETTERHEADS
================================ */

/* ================================
   GET ALL LETTERHEADS
================================ */
const getAllLetterheads = async (orgId) => {
  console.log("ORG ID RECEIVED:", orgId);

  if (!orgId) {
    throw new Error("orgId is required");
  }

  try {
    const tenantPool = await getTenantPoolForOrgId(orgId);
    
    const [rows] = await tenantPool.query(
      queries.GET_ALL_LETTERHEADS,
      [orgId]
    );

    console.log("Raw rows fetched:", rows.length);

    // Safely parse dynamic_fields for each row
    return rows.map(row => {
      let parsed = {};
      if (row.dynamic_fields) {
        try {
          parsed = typeof row.dynamic_fields === 'string' 
            ? JSON.parse(row.dynamic_fields) 
            : row.dynamic_fields;
        } catch (parseErr) {
          console.warn(`Failed to parse dynamic_fields for letterhead ${row.id}:`, parseErr.message);
          parsed = {};
        }
      }

      return {
        ...row,
        ...parsed,                    // spread dynamic fields at top level
        dynamic_fields: parsed        // also keep original for safety
      };
    });

  } catch (error) {
    console.error("Fetch All Error FULL:", error.message);
    console.error("Stack:", error.stack);
    throw error;
  }
};



/* ================================
   UPDATE LETTERHEAD
================================ */

const updateLetterheadById =
async (orgId, letterheadData, id) => {

  const tenantPool =
    await getTenantPoolForOrgId(orgId);

  try {

    const {

      template_name,
      letter_type,
      subject,
      body,
      attachment,
      dynamic_fields

    } = letterheadData;



    let dynamicJson = {};

    if (dynamic_fields) {

      if (typeof dynamic_fields === "string") {

        try {

          dynamicJson =
            JSON.parse(dynamic_fields);

        }

        catch {

          dynamicJson = {};

        }

      }

      else {

        dynamicJson =
          dynamic_fields;

      }

    }



    const values = [

      template_name || null,
      letter_type,
      subject || null,
      body || null,
      attachment || null,

      JSON.stringify(dynamicJson),

      id,
      orgId

    ];



    const [result] =
      await tenantPool.query(
        queries.UPDATE_LETTERHEAD_BY_ID,
        values
      );



    return result;

  }

  catch (error) {

    console.error(
      "Update Error:",
      error
    );

    throw new Error(
      "Update failed: "
      + error.message
    );

  }

};



/* ================================
   GET LETTER BY ID
================================ */

const getLetterheadById =
async (orgId, id) => {

  const tenantPool =
    await getTenantPoolForOrgId(orgId);

  try {

    const [rows] =
      await tenantPool.query(
        queries.GET_LETTERHEAD_BY_ID,
        [id, orgId]
      );
console.log("Rows from DB:", rows); 


    if (rows.length === 0)
      return null;



    const row = rows[0];



   let parsedFields = {};

try {

  if (row.dynamic_fields) {

    if (typeof row.dynamic_fields === "object") {

      parsedFields =
        row.dynamic_fields;

    }

    else {

      parsedFields =
        JSON.parse(row.dynamic_fields);

    }

  }

}

catch {

  parsedFields = {};

}

    return {

      ...row,
      dynamic_fields: parsedFields

    };

  }

  catch (error) {

  console.error(
    "Fetch All Error FULL:",
    error.message
  );

  console.error(
    "Stack:",
    error.stack
  );

  throw error; // 👈 IMPORTANT (do not hide error)

}

};



module.exports = {

  insertLetterhead,
  getAllLetterheads,
  updateLetterheadById,
  getLetterheadById

};