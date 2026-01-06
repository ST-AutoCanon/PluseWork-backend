// services/letterheadTemplateService.js
const queries = require("../constants/letterheadTemplateQueries");

// create table (runs in tenant DB)
const createLetterheadTemplatesTable = async (tenantPool) => {
  await tenantPool.query(queries.CREATE_LETTERHEAD_TEMPLATES_TABLE);
};

// Insert default templates if tenant has none (idempotent)
const insertDefaultTemplatesIfMissing = async (tenantPool, orgId) => {
  // check if any templates exist for this org
  const [rows] = await tenantPool.query(queries.GET_ALL_TEMPLATES, [orgId]);
  if (rows && rows.length > 0) return;

  const defaults = [
    {
      letter_type: "Offer Letter",
      content:
        "Dear [Recipient Name],\n\nWe are pleased to offer you the position of [Position] at [Company Name]. Your skills and experience align perfectly with our team’s vision. Below are the details of your employment:\n\n- <strong>Position</strong>: [Position]\n- <strong>Start Date</strong>: [Start Date]\n- <strong>Salary</strong>: [Salary Details]\n- <strong>Benefits</strong>: [Benefits Details]\n\nPlease confirm your acceptance by signing and returning a copy of this letter by [Date].\n\nWe look forward to welcoming you to the team!\n\nBest Regards,",
      subject: "Offer of Employment",
      company_name: "Sukalpa Tech Solutions Pvt Ltd",
      company_address:
        "#71, Bauxite Road, Sarathi Nagar, Belagavi -591108, Karnataka, India",
    },
    {
      letter_type: "Relieving Letter",
      content:
        "Dear [Recipient Name],\n\nThis is to certify that [Employee Name] has been relieved from their duties as [Position] at [Company Name], effective [Date]. During their tenure, [Employee Name] demonstrated professionalism and dedication.\n\nWe wish them the very best in their future endeavors.\n\nSincerely,",
      subject: "Relieving Letter",
      company_name: "Sukalpa Tech Solutions Pvt Ltd",
      company_address:
        "#71, Bauxite Road, Sarathi Nagar, Belagavi -591108, Karnataka, India",
    },
    {
      letter_type: "Bank Details Request Letter",
      content:
        "Dear [Recipient Name],\n\nSubject: Request for Bank Details\n\nWe hope this message finds you well. To facilitate [Purpose, e.g., salary processing, vendor payments], kindly provide the following bank details:\n\n- <strong>Bank Name</strong>:\n- <strong>Account Number</strong>:\n- <strong>IFSC Code</strong>:\n- <strong>Branch Name</strong>:\n\nPlease submit these details by [Date] to ensure timely processing.\n\nThank you for your cooperation.\n\nRegards,",
      subject: "Request for Bank Details",
      company_name: "Sukalpa Tech Solutions Pvt Ltd",
      company_address:
        "#71, Bauxite Road, Sarathi Nagar, Belagavi -591108, Karnataka, India",
    },
    {
      letter_type: "Letter",
      content:
        "Dear [Recipient Name],\n\nThis is a general letter template. Please edit the content as needed to suit your requirements.\n\nThank you.\n\nRegards,",
      subject: "General Letter",
      company_name: "Sukalpa Tech Solutions Pvt Ltd",
      company_address:
        "#71, Bauxite Road, Sarathi Nagar, Belagavi -591108, Karnataka, India",
    },
  ];

  for (const t of defaults) {
    try {
      await tenantPool.query(queries.INSERT_TEMPLATE, [
        orgId,
        t.letter_type,
        t.content,
        t.subject,
        t.company_name,
        t.company_address,
      ]);
    } catch (err) {
      // ignore duplicates or other minor issues; log for debugging
      console.warn(
        "insertDefaultTemplatesIfMissing: ",
        err && err.message ? err.message : err
      );
    }
  }
};

const getAllTemplates = async (tenantPool, orgId) => {
  const [rows] = await tenantPool.query(queries.GET_ALL_TEMPLATES, [orgId]);
  return rows;
};

const getTemplateByLetterType = async (tenantPool, orgId, letterType) => {
  const [rows] = await tenantPool.query(queries.GET_TEMPLATE_BY_LETTER_TYPE, [
    orgId,
    letterType,
  ]);
  return (rows && rows[0]) || null;
};

const insertTemplate = async (tenantPool, orgId, templateData) => {
  const { letter_type, content, subject, company_name, company_address } =
    templateData;
  const [result] = await tenantPool.query(queries.INSERT_TEMPLATE, [
    orgId,
    letter_type,
    content,
    subject,
    company_name,
    company_address,
  ]);
  return result;
};

const updateTemplateByLetterType = async (
  tenantPool,
  orgId,
  templateData,
  letterType
) => {
  const { content, subject, company_name, company_address } = templateData;
  const [result] = await tenantPool.query(
    queries.UPDATE_TEMPLATE_BY_LETTER_TYPE,
    [content, subject, company_name, company_address, orgId, letterType]
  );
  return result;
};

module.exports = {
  createLetterheadTemplatesTable,
  insertDefaultTemplatesIfMissing,
  getAllTemplates,
  getTemplateByLetterType,
  insertTemplate,
  updateTemplateByLetterType,
};
