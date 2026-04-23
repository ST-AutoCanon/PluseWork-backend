// const letterheadService = require("../services/letterheadService");
// const path = require("path");
// const fs = require("fs");

// const getOrgId = (req) => {
//   if (req.params.orgId) return req.params.orgId;
//   return (
//     req.headers.org_id ||
//     req.headers["org-id"] ||
//     req.headers["x-org-id"] ||
//     null
//   );
// };

// // const addLetterheadHandler = async (req, res) => {
// //   const orgId = getOrgId(req);
// //   if (!orgId) {
// //     return res.status(400).json({ error: "org_id is required" });
// //   }

// //   try {
// //     const {
// //       letterhead_code,
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
// //       place,
// //       company_name,
// //       company_address,
// //       company_address_line2,
// //       gstin_number,
// //       cin_number,
// //     } = req.body;

// //     if (!letter_type || !body) {
// //       return res.status(400).json({ error: "Required fields missing" });
// //     }

// //     const files = req.files || {};
// //     let attachment = null;
// //     if (files.letterhead_file) {
// //       attachment = files.letterhead_file[0].filename;
// //     }

// //     const letterheadData = {
// //       letterhead_code,
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
// //     };

// //     const result = await letterheadService.insertLetterhead(
// //       orgId,
// //       letterheadData
// //     );
// //     res.status(201).json({
// //       message: "Letterhead created successfully",
// //       id: result.insertId,
// //       letterhead_code: result.letterhead_code,
// //     });
// //   } catch (error) {
// //     console.error("Error in addLetterheadHandler:", error);
// //     res
// //       .status(500)
// //       .json({ error: "Failed to create letterhead", details: error.message });
// //   }
// // };
// const addLetterheadHandler = async (req, res) => {
//   const orgId = getOrgId(req);
//   if (!orgId) return res.status(400).json({ error: "org_id is required" });

//   try {
//     const { 
//       letter_type, 
//       template_name, 
//       subject, 
//       body,
//       ...dynamicFields   // ← This captures ALL other fields like contact_number, date_of_birth, etc.
//     } = req.body;

//     if (!letter_type || !body) {
//       return res.status(400).json({ error: "letter_type and body are required" });
//     }

//     const files = req.files || {};
//     const attachment = files.letterhead_file ? files.letterhead_file[0].filename : null;

//     const letterheadData = {
//       template_name,
//       letter_type,
//       subject,
//       body,
//       attachment,
//       ...dynamicFields   // ← Pass all dynamic fields
//     };

//     const result = await letterheadService.insertLetterhead(orgId, letterheadData);

//     res.status(201).json({ 
//       message: "Letter saved successfully", 
//       id: result.insertId 
//     });
//   } catch (error) {
//     console.error("Add letterhead error:", error);
//     res.status(500).json({ error: "Failed to save letter" });
//   }
// };
// const getAllLetterheadsHandler = async (req, res) => {
//   const orgId = getOrgId(req);
//   if (!orgId) return res.status(400).json({ error: "org_id is required" });

//   try {
//     const letterheads = await letterheadService.getAllLetterheads(orgId);
//     res.status(200).json({ success: true, data: letterheads });
//   } catch (error) {
//     console.error("Error:", error);
//     res.status(500).json({ error: "Failed to fetch letterheads" });
//   }
// };

// const updateLetterheadHandler = async (req, res) => {
//   const orgId = getOrgId(req);
//   if (!orgId) {
//     return res.status(400).json({ error: "org_id is required" });
//   }

//   const { id } = req.params;
//   if (!id) {
//     return res.status(400).json({ error: "letterhead id is required" });
//   }

//   try {
//     const { 
//       letter_type, 
//       template_name, 
//       subject, 
//       body,
//       ...dynamicFields   // Capture all other fields dynamically
//     } = req.body;

//     if (!letter_type || !body) {
//       return res.status(400).json({ error: "letter_type and body are required" });
//     }

//     const files = req.files || {};
//     const attachment = files.letterhead_file ? files.letterhead_file[0].filename : null;

//     const letterheadData = {
//       template_name: template_name?.trim(),
//       letter_type,
//       subject: subject?.trim() || null,
//       body,
//       attachment,
//       ...dynamicFields   // ← This is the key: send everything else
//     };

//     const result = await letterheadService.updateLetterheadById(orgId, letterheadData, id);
    
//     if (result && result.affectedRows > 0) {
//       res.status(200).json({
//         message: "Letter updated successfully",
//         id: parseInt(id),
//       });
//     } else {
//       res.status(404).json({ error: "Letterhead not found or no changes made" });
//     }
//   } catch (error) {
//     console.error("Error in updateLetterheadHandler:", error);
//     res.status(500).json({ error: "Failed to update letter", details: error.message });
//   }
// };

// const getLetterheadByIdHandler = async (req, res) => {
//   const orgId = getOrgId(req);
//   if (!orgId) return res.status(400).json({ error: "org_id is required" });
// };

// module.exports = {
//   addLetterheadHandler,
//   getAllLetterheadsHandler,
//   updateLetterheadHandler,
//   getLetterheadByIdHandler,
// };

const letterheadService = require("../services/letterheadService");

const getOrgId = (req) => {
  if (req.params.orgId) return req.params.orgId;

  return (
    req.headers.org_id ||
    req.headers["org-id"] ||
    req.headers["x-org-id"] ||
    null
  );
};



/* ================================
   ADD LETTERHEAD
================================ */

const addLetterheadHandler = async (req, res) => {

  const orgId = getOrgId(req);

  if (!orgId) {
    return res.status(400).json({
      error: "org_id is required"
    });
  }

  try {

    const {
      letter_type,
      template_name,
      subject,
      body,
      ...dynamicFields
    } = req.body;

    if (!letter_type || !body) {
      return res.status(400).json({
        error: "letter_type and body are required"
      });
    }

    const files = req.files || {};

    const attachment =
      files.letterhead_file
        ? files.letterhead_file[0].filename
        : null;

    const letterheadData = {

      template_name,
      letter_type,
      subject,
      body,
      attachment,

      // ✅ store JSON
      dynamic_fields: JSON.stringify(dynamicFields)

    };

    const result =
      await letterheadService.insertLetterhead(
        orgId,
        letterheadData
      );

    res.status(201).json({

      message: "Letter saved successfully",
      id: result.insertId,
      letterhead_code: result.letterhead_code

    });

  }

  catch (error) {

    console.error(
      "Add letterhead error:",
      error
    );

    res.status(500).json({
      error: "Failed to save letter"
    });

  }

};




/* ================================
   GET ALL LETTERHEADS
================================ */

const getAllLetterheadsHandler = async (req, res) => {
  const orgId = getOrgId(req);
  if (!orgId) {
    return res.status(400).json({ error: "org_id is required" });
  }

  try {
    const letterheads = await letterheadService.getAllLetterheads(orgId);
    
    res.status(200).json({
      success: true,
      data: letterheads   // service already formats it now
    });
  } catch (error) {
    console.error("Error in getAllLetterheadsHandler:", error);
    res.status(500).json({ 
      error: "Failed to fetch letterheads",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};




/* ================================
   UPDATE LETTERHEAD
================================ */

const updateLetterheadHandler =
async (req, res) => {

  const orgId = getOrgId(req);

  if (!orgId) {

    return res.status(400).json({
      error: "org_id is required"
    });

  }



  const { id } = req.params;

  if (!id) {

    return res.status(400).json({
      error: "letterhead id is required"
    });

  }



  try {

    const {

      letter_type,
      template_name,
      subject,
      body,
      ...dynamicFields

    } = req.body;



    if (!letter_type || !body) {

      return res.status(400).json({
        error: "letter_type and body are required"
      });

    }



    const files = req.files || {};

    const attachment =
      files.letterhead_file
        ? files.letterhead_file[0].filename
        : null;



  const letterheadData = {

  template_name: template_name?.trim(),

  letter_type,

  subject: subject?.trim() || null,

  body,

  attachment,

  // ✅ JSON stringify
  dynamic_fields: JSON.stringify(dynamicFields)

};



    const result =
      await letterheadService
        .updateLetterheadById(
          orgId,
          letterheadData,
          id
        );



    if (result.affectedRows > 0) {

      res.status(200).json({

        message:
          "Letter updated successfully",

        id: parseInt(id)

      });

    }

    else {

      res.status(404).json({

        error:
          "Letterhead not found or no changes made"

      });

    }

  }

  catch (error) {

    console.error(
      "Update error:",
      error
    );

    res.status(500).json({

      error:
        "Failed to update letter",

      details:
        error.message

    });

  }

};




/* ================================
   GET LETTERHEAD BY ID
================================ */

const getLetterheadByIdHandler =
async (req, res) => {

  const orgId = getOrgId(req);

  if (!orgId)
    return res.status(400).json({
      error: "org_id is required"
    });



  const { id } = req.params;

  if (!id)
    return res.status(400).json({
      error: "letterhead id required"
    });



  try {

    const letter =
      await letterheadService
        .getLetterheadById(
          orgId,
          id
        );



    if (!letter) {

      return res.status(404).json({
        error: "Letter not found"
      });

    }



    // Merge dynamic fields

  const formattedData = {

  ...letter,

  ...(letter.dynamic_fields
    ? JSON.parse(letter.dynamic_fields)
    : {})

};



    res.status(200).json({

      success: true,
      data: formattedData

    });

  }

  catch (error) {

    console.error(
      "Fetch by ID error:",
      error
    );

    res.status(500).json({

      error:
        "Failed to fetch letter"

    });

  }

};



module.exports = {

  addLetterheadHandler,
  getAllLetterheadsHandler,
  updateLetterheadHandler,
  getLetterheadByIdHandler

};