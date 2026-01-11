// src/controllers/letterheadController.js

const letterheadService = require("../services/letterheadService");
const path = require("path");
const fs = require("fs");

const getOrgId = (req) => {
  // Use URL param if available, else headers
  if (req.params.orgId) return req.params.orgId;
  return (
    req.headers.org_id ||
    req.headers["org-id"] ||
    req.headers["x-org-id"] ||
    null
  );
};

const addLetterheadHandler = async (req, res) => {
  const orgId = getOrgId(req);
  if (!orgId) {
    return res.status(400).json({ error: "org_id is required" });
  }

  // ... rest of your existing code (no change needed below)
  try {
    const {
      template_name, letter_type, subject, body, recipient_name,
      title, mobile_number, email, address, date, signature,
      employee_name, position, annual_salary, effective_date,
      date_of_appointment, place,
      company_name, company_address, company_address_line2,
      gstin_number, cin_number,
    } = req.body;

    if (!letter_type || !body) {
      return res.status(400).json({ error: "Required fields missing" });
    }

    const files = req.files || {};
    let attachment = null;
    if (files.letterhead_file) {
      attachment = files.letterhead_file[0].filename;
    }

    const letterheadData = {
      template_name, letter_type, subject, body, recipient_name,
      title, mobile_number, email, address, date, signature,
      employee_name, position, annual_salary, effective_date,
      date_of_appointment, attachment, place,
      company_name, company_address, company_address_line2,
      gstin_number, cin_number,
    };

    const result = await letterheadService.insertLetterhead(orgId, letterheadData);
    res.status(201).json({
      message: "Letterhead created successfully",
      id: result.insertId,
      letterhead_code: result.letterhead_code,
    });
  } catch (error) {
    console.error("Error in addLetterheadHandler:", error);
    res.status(500).json({ error: "Failed to create letterhead", details: error.message });
  }
};

// Apply same getOrgId to all handlers below
const getAllLetterheadsHandler = async (req, res) => {
  const orgId = getOrgId(req);
  if (!orgId) return res.status(400).json({ error: "org_id is required" });

  try {
    const letterheads = await letterheadService.getAllLetterheads(orgId);
    res.status(200).json({ success: true, data: letterheads });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Failed to fetch letterheads" });
  }
};

const updateLetterheadHandler = async (req, res) => {
  const orgId = getOrgId(req);
  if (!orgId) return res.status(400).json({ error: "org_id is required" });
  // ... rest unchanged
};

const getLetterheadByIdHandler = async (req, res) => {
  const orgId = getOrgId(req);
  if (!orgId) return res.status(400).json({ error: "org_id is required" });
  // ... rest unchanged
};

module.exports = {
  addLetterheadHandler,
  getAllLetterheadsHandler,
  updateLetterheadHandler,
  getLetterheadByIdHandler,
};