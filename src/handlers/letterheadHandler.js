const letterheadService = require("../services/letterheadService");
const path = require("path");
const fs = require("fs");

const addLetterheadHandler = async (req, res) => {
  try {
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
      place,
    } = req.body;

    if (!letter_type || !body) {
      return res
        .status(400)
        .json({ error: "Required fields (letter_type, body) are missing" });
    }

    const files = req.files || {};
    let attachment = null;
    if (files.letterhead_file) {
      attachment = files.letterhead_file[0].filename;
    }

    const letterheadData = {
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
    };

    const result = await letterheadService.insertLetterhead(letterheadData);
    res
      .status(201)
      .json({ message: "Letterhead added successfully", id: result.insertId });
  } catch (error) {
    console.error("Error in addLetterheadHandler:", error);
    res
      .status(500)
      .json({ error: "Failed to add letterhead", details: error.message });
  }
};

const getAllLetterheadsHandler = async (req, res) => {
  try {
    const letterheads = await letterheadService.getAllLetterheads();
    res.status(200).json({ success: true, data: letterheads });
  } catch (error) {
    console.error("Error in getAllLetterheadsHandler:", error);
    res
      .status(500)
      .json({ error: "Failed to fetch letterheads", details: error.message });
  }
};

const updateLetterheadHandler = async (req, res) => {
  try {
    const id = req.params.id;
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
      place,
    } = req.body;

    if (!letter_type || !body) {
      return res
        .status(400)
        .json({ error: "Required fields (letter_type, body) are missing" });
    }

    const files = req.files || {};
    let attachment = null;

    const existingLetterhead = await letterheadService.getLetterheadById(id);
    if (!existingLetterhead) {
      return res.status(404).json({ error: "Letterhead not found" });
    }

    if (files.letterhead_file) {
      attachment = files.letterhead_file[0].filename;
      if (existingLetterhead.attachment) {
        const oldFilePath = path.join(
          __dirname,
          "..",
          "..",
          "letterheadfiles",
          existingLetterhead.attachment
        );
        if (fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath);
        }
      }
    } else {
      attachment = existingLetterhead.attachment;
    }

    const letterheadData = {
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
    };

    const result = await letterheadService.updateLetterheadById(
      letterheadData,
      id
    );
    res
      .status(200)
      .json({ message: "Letterhead updated successfully", result });
  } catch (error) {
    console.error("Error in updateLetterheadHandler:", error);
    res
      .status(500)
      .json({ error: "Failed to update letterhead", details: error.message });
  }
};

const getLetterheadByIdHandler = async (req, res) => {
  try {
    const id = req.params.id;
    const letterhead = await letterheadService.getLetterheadById(id);
    if (!letterhead) {
      return res.status(404).json({ error: "Letterhead not found" });
    }
    res.status(200).json({ success: true, data: letterhead });
  } catch (error) {
    console.error("Error in getLetterheadByIdHandler:", error);
    res
      .status(500)
      .json({ error: "Failed to fetch letterhead", details: error.message });
  }
};

module.exports = {
  addLetterheadHandler,
  getAllLetterheadsHandler,
  updateLetterheadHandler,
  getLetterheadByIdHandler,
};
