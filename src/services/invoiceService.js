const db = require("../config");
const invoiceQueries = require("../constants/invoiceQueries");
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

const getFinancialYear = (invoiceDate) => {
  const dateObj = new Date(invoiceDate);
  const year = dateObj.getFullYear();
  const month = dateObj.getMonth() + 1;

  const startYear = month >= 4 ? year : year - 1;
  const endYear = startYear + 1;

  const fy = `${String(startYear).slice(2)}-${String(endYear).slice(2)}`;
  return fy
    .normalize("NFKD")
    .replace(/[^\d-]/g, "")
    .trim();
};

async function getOrgNameMaster(connection, orgId) {
  if (!orgId) return null;
  try {
    const [rows] = await connection.execute(
      `SELECT Name AS name FROM Organizations WHERE id = ? LIMIT 1`,
      [orgId],
    );
    if (rows && rows.length > 0) return String(rows[0].name).trim();
  } catch (e) {}
  return null;
}

function makeOrgAcronym(orgName) {
  if (!orgName || typeof orgName !== "string") return "STS";

  const cleaned = orgName
    .replace(/[^A-Za-z0-9\s]/g, " ")
    .trim()
    .replace(/\s+/g, " ");

  if (!cleaned) return "STS";

  const words = cleaned.split(" ").filter(Boolean);

  if (words.length >= 2) {
    const letters = words.slice(0, 3).map((w) => w[0].toUpperCase());
    return letters.join("");
  }

  const single = words[0];
  return (single && single.slice(0, 3).toUpperCase()) || "STS";
}

const getNextSequenceMaster = async (invoiceType, financialYear, orgId) => {
  const tenantPool = await getTenantPoolForOrgId(orgId);
  const conn = await tenantPool.getConnection();
  try {
    const [rows] = await conn.execute(invoiceQueries.GET_NEXT_SEQUENCE, [
      invoiceType,
      financialYear,
      orgId,
    ]);
    return rows && rows.length ? rows[0].sequence : undefined;
  } finally {
    conn.release();
  }
};

const insertInitialSequenceMaster = async (
  invoiceType,
  financialYear,
  orgId,
  initial = 2,
) => {
  const tenantPool = await getTenantPoolForOrgId(orgId);
  const conn = await tenantPool.getConnection();
  try {
    await conn.execute(invoiceQueries.INSERT_INITIAL_SEQUENCE, [
      invoiceType,
      financialYear,
      orgId,
      initial,
    ]);
  } finally {
    conn.release();
  }
};

const updateSequenceMaster = async (
  nextSeq,
  invoiceType,
  financialYear,
  orgId,
) => {
  const tenantPool = await getTenantPoolForOrgId(orgId);
  const conn = await tenantPool.getConnection();
  try {
    await conn.execute(invoiceQueries.UPDATE_SEQUENCE, [
      nextSeq,
      invoiceType,
      financialYear,
      orgId,
    ]);
  } finally {
    conn.release();
  }
};

const generateTemplateInvoiceNo = async (invoiceType, orgId = null) => {
  const today = new Date();
  const financialYear = getFinancialYear(today);
  const tenantPool = await getTenantPoolForOrgId(orgId);
  const conn = await tenantPool.getConnection();
  try {
    const orgName = await getOrgNameMaster(conn, orgId);
    const acronym = makeOrgAcronym(orgName);

    const [rows] = await conn.execute(invoiceQueries.GET_NEXT_SEQUENCE, [
      invoiceType,
      financialYear,
      orgId,
    ]);
    const sequence =
      rows && rows.length > 0 && typeof rows[0].sequence !== "undefined"
        ? Number(rows[0].sequence)
        : 1;
    const paddedSeq = String(sequence).padStart(4, "0");

    if (invoiceType === "tax") {
      return `${acronym}/${financialYear}/${paddedSeq}`;
    } else if (invoiceType === "proforma") {
      return `${acronym}/${financialYear}/PI/${paddedSeq}`;
    } else if (invoiceType === "quotation") {
      return `${acronym}-Q-${paddedSeq}`;
    } else {
      throw new Error("Unknown invoice type");
    }
  } finally {
    conn.release();
  }
};

const generateInvoiceNo = async (invoiceDate, invoiceType, orgId) => {
  const financialYear = getFinancialYear(invoiceDate);
  const tenantPool = await getTenantPoolForOrgId(orgId);
  const conn = await tenantPool.getConnection();
  try {
    const orgName = await getOrgNameMaster(conn, orgId);
    const acronym = makeOrgAcronym(orgName);

    const [rows] = await conn.execute(invoiceQueries.GET_NEXT_SEQUENCE, [
      invoiceType,
      financialYear,
      orgId,
    ]);

    let sequenceForInvoice;
    if (!rows || rows.length === 0) {
      sequenceForInvoice = 1;
      await conn.execute(invoiceQueries.INSERT_INITIAL_SEQUENCE, [
        invoiceType,
        financialYear,
        orgId,
        2,
      ]);
    } else {
      const currentSeq = Number(rows[0].sequence) || 1;
      sequenceForInvoice = currentSeq;
      await conn.execute(invoiceQueries.UPDATE_SEQUENCE, [
        currentSeq + 1,
        invoiceType,
        financialYear,
        orgId,
      ]);
    }

    const paddedSeq = String(sequenceForInvoice).padStart(4, "0");

    if (invoiceType === "tax") {
      return `${acronym}/${financialYear}/${paddedSeq}`;
    } else if (invoiceType === "proforma") {
      return `${acronym}/${financialYear}/PI/${paddedSeq}`;
    } else if (invoiceType === "quotation") {
      return `${acronym}-Q-${paddedSeq}`;
    } else {
      throw new Error("Unknown invoice type");
    }
  } finally {
    conn.release();
  }
};

const getInvoicesByProject = async (orgId, projectId) => {
  if (!orgId) throw new Error("orgId required");
  const tenantPool = await getTenantPoolForOrgId(orgId);
  try {
    const [results] = await tenantPool.query(
      invoiceQueries.GET_INVOICES_BY_PROJECT,
      [projectId],
    );

    return results.map((invoice) => {
      if (invoice.lineItems && typeof invoice.lineItems === "string") {
        try {
          invoice.lineItems = JSON.parse(invoice.lineItems);
        } catch {
          invoice.lineItems = [];
        }
      }
      return invoice;
    });
  } catch (err) {
    throw err;
  }
};

const getInvoiceById = async (orgId, id) => {
  if (!orgId) throw new Error("orgId required");
  const tenantPool = await getTenantPoolForOrgId(orgId);
  try {
    const [results] = await tenantPool.query(invoiceQueries.GET_INVOICE_BY_ID, [
      id,
    ]);
    if (!results || results.length === 0) {
      throw new Error(`Invoice with ID ${id} not found`);
    }
    const invoice = results[0];

    if (invoice.invoiceDate) {
      invoice.invoiceDate = new Date(invoice.invoiceDate)
        .toISOString()
        .split("T")[0];
    }
    if (invoice.lineItems && typeof invoice.lineItems === "string") {
      try {
        invoice.lineItems = JSON.parse(invoice.lineItems);
      } catch {
        invoice.lineItems = [];
      }
    }
    return invoice;
  } catch (err) {
    throw err;
  }
};

const createInvoice = async (invoiceData, orgId) => {
  if (!orgId) throw new Error("orgId required to create invoice");
  const tenantPool = await getTenantPoolForOrgId(orgId);

  const invoiceNo = await generateInvoiceNo(
    invoiceData.invoiceDate,
    invoiceData.invoiceType,
    orgId,
  );

  const conn = await tenantPool.getConnection();
  try {
    const [results] = await conn.execute(invoiceQueries.INSERT_INVOICE, [
      invoiceData.projectId,
      invoiceData.invoiceType,
      invoiceData.invoiceDate,
      invoiceNo,
      invoiceData.referenceId,
      invoiceData.referenceDate,
      invoiceData.terms,
      JSON.stringify(invoiceData.lineItems || []),
      invoiceData.workDescription,
      invoiceData.subTotal,
      invoiceData.advance,
      invoiceData.totalExcludingTax,
      invoiceData.gst,
      invoiceData.gstAmount,
      invoiceData.totalAmount,
      invoiceData.totalIncludingTax,
    ]);

    if (!results.insertId) {
      throw new Error("Failed to insert invoice");
    }

    const invoice = await getInvoiceById(orgId, results.insertId);
    return invoice;
  } finally {
    try {
      conn.release();
    } catch (e) {}
  }
};

const updateInvoice = async (orgId, id, invoiceData) => {
  if (!orgId) throw new Error("orgId required");
  const tenantPool = await getTenantPoolForOrgId(orgId);

  const formattedInvoiceDate = invoiceData.invoiceDate
    ? new Date(invoiceData.invoiceDate).toISOString().split("T")[0]
    : null;
  const formattedReferenceDate = invoiceData.referenceDate
    ? new Date(invoiceData.referenceDate).toISOString().split("T")[0]
    : null;

  const basicValues = [
    invoiceData.invoiceType,
    formattedInvoiceDate,
    invoiceData.invoiceNo,
    invoiceData.referenceId,
    formattedReferenceDate,
    invoiceData.terms,
    JSON.stringify(invoiceData.lineItems || []),
    invoiceData.workDescription,
    invoiceData.subTotal,
    invoiceData.advance,
    invoiceData.totalExcludingTax,
    invoiceData.gst,
    invoiceData.gstAmount,
    invoiceData.totalAmount,
    invoiceData.totalIncludingTax,
    id,
  ];

  const conn = await tenantPool.getConnection();
  try {
    await conn.execute(invoiceQueries.UPDATE_INVOICE_BASIC, basicValues);
    return await getInvoiceById(orgId, id);
  } finally {
    try {
      conn.release();
    } catch (e) {}
  }
};

const updateInvoiceExtra = async (orgId, id, invoiceData) => {
  if (!orgId) throw new Error("orgId required");
  const tenantPool = await getTenantPoolForOrgId(orgId);

  const formattedInvoiceDate = invoiceData.invoiceDate
    ? new Date(invoiceData.invoiceDate).toISOString().slice(0, 10)
    : null;
  const formattedReferenceDate = invoiceData.referenceDate
    ? new Date(invoiceData.referenceDate).toISOString().slice(0, 10)
    : null;

  const conn = await tenantPool.getConnection();
  try {
    await conn.execute(invoiceQueries.UPDATE_INVOICE_BASIC, [
      invoiceData.invoiceType,
      formattedInvoiceDate,
      invoiceData.invoiceNo,
      invoiceData.referenceId,
      formattedReferenceDate,
      invoiceData.terms,
      JSON.stringify(invoiceData.lineItems || []),
      invoiceData.workDescription,
      invoiceData.subTotal,
      invoiceData.advance,
      invoiceData.totalExcludingTax,
      invoiceData.gst,
      invoiceData.gstAmount,
      invoiceData.totalAmount,
      invoiceData.totalIncludingTax,
      id,
    ]);

    await conn.execute(invoiceQueries.UPDATE_INVOICE_EXTRA, [
      invoiceData.gstPayment,
      invoiceData.milestoneId,
      invoiceData.status,
      id,
    ]);

    const [[{ payment_type }]] = await conn.query(
      `SELECT payment_type FROM add_project WHERE id = ?`,
      [invoiceData.projectId],
    );

    if (invoiceData.gstPayment === "Completed" && invoiceData.milestoneId) {
      const common = {
        m_actual_amount: invoiceData.totalExcludingTax,
        m_tds_percentage: null,
        m_tds_amount: invoiceData.tdsAmount || 0,
        m_gst_percentage: invoiceData.gst,
        m_gst_amount: invoiceData.gstAmount,
        m_total_amount: invoiceData.totalIncludingTax,
      };

      if (payment_type === "Monthly Scheduled") {
        await require("./projectService").updateFinancialDetailsById(orgId, {
          id: Number(invoiceData.milestoneId),
          m_actual_amount: common.m_actual_amount,
          m_tds_percentage: common.m_tds_percentage,
          m_tds_amount: common.m_tds_amount,
          m_gst_percentage: common.m_gst_percentage,
          m_gst_amount: common.m_gst_amount,
          m_total_amount: common.m_total_amount,
          status: "Received",
          completed_date: new Date().toISOString().split("T")[0],
        });
      } else {
        await require("./projectService").updateFinancialDetailsForInvoice(
          orgId,
          {
            project_id: Number(invoiceData.projectId),
            milestone_id: Number(invoiceData.milestoneId),
            m_actual_amount: common.m_actual_amount,
            m_tds_percentage: common.m_tds_percentage,
            m_tds_amount: common.m_tds_amount,
            m_gst_percentage: common.m_gst_percentage,
            m_gst_amount: common.m_gst_amount,
            m_total_amount: common.m_total_amount,
            status: "Received",
            completed_date: new Date().toISOString().split("T")[0],
          },
        );
      }
    }

    return await getInvoiceById(orgId, id);
  } finally {
    try {
      conn.release();
    } catch (e) {}
  }
};

const updateSequence = async (invoiceType, orgId) => {
  const today = new Date();
  const financialYear = getFinancialYear(today);
  const cleanedFinancialYear = financialYear.trim();
  const cleanInvoiceType = invoiceType.toString().trim().toLowerCase();
  const tenantPool = await getTenantPoolForOrgId(orgId);
  const conn = await tenantPool.getConnection();
  try {
    const [rows] = await conn.execute(invoiceQueries.GET_NEXT_SEQUENCE, [
      cleanInvoiceType,
      cleanedFinancialYear,
      orgId,
    ]);

    const nextSequence = rows && rows.length > 0 ? Number(rows[0].sequence) : 1;

    const [updateResult] = await conn.execute(invoiceQueries.UPDATE_SEQUENCE, [
      nextSequence,
      cleanInvoiceType,
      cleanedFinancialYear,
      orgId,
    ]);

    if (updateResult.affectedRows === 0) {
      await conn.execute(invoiceQueries.INSERT_INITIAL_SEQUENCE, [
        cleanInvoiceType,
        cleanedFinancialYear,
        orgId,
        nextSequence,
      ]);
    }

    return { updatedSequence: nextSequence };
  } finally {
    conn.release();
  }
};

function parseSequenceFromInvoiceNumber(invoiceNumber) {
  if (!invoiceNumber || typeof invoiceNumber !== "string") return null;
  const m = invoiceNumber.trim().match(/(\d+)\s*$/);
  if (!m) return null;
  return parseInt(m[1], 10);
}

const recordDownloadDetails = async (
  invoiceType,
  invoiceNumber,
  details,
  orgId,
) => {
  if (!orgId) throw new Error("orgId required");
  const tenantPool = await getTenantPoolForOrgId(orgId);

  const {
    to,
    address,
    contact,
    companyGst,
    state,
    invoiceDate,
    referenceDate,
    referenceId,
    placeOfSupply,
    withSeal,
    lineItems,
    subTotal,
    gst,
    gstAmount,
    advance,
    totalExcludingTax,
    totalIncludingTax,
    terms,
  } = details;

  const tenantConn = await tenantPool.getConnection();
  const masterConn = await db.getConnection();

  try {
    await tenantConn.beginTransaction();
    await masterConn.beginTransaction();

    const [res] = await tenantConn.execute(
      invoiceQueries.INSERT_DOWNLOAD_DETAILS,
      [
        orgId,
        invoiceType,
        invoiceNumber,
        to,
        address,
        contact,
        companyGst,
        state,
        invoiceDate,
        referenceDate,
        referenceId,
        placeOfSupply,
        withSeal ? 1 : 0,
        JSON.stringify(lineItems || []),
        subTotal,
        gst,
        gstAmount,
        advance,
        totalExcludingTax,
        totalIncludingTax,
        terms,
      ],
    );

    const usedSeq = parseSequenceFromInvoiceNumber(invoiceNumber);
    const fy = getFinancialYear(invoiceDate || new Date());
    if (usedSeq != null && orgId) {
      const [rows] = await tenantConn.execute(
        invoiceQueries.GET_NEXT_SEQUENCE,
        [invoiceType, fy, orgId],
      );

      if (!rows || rows.length === 0) {
        await tenantConn.execute(invoiceQueries.INSERT_INITIAL_SEQUENCE, [
          invoiceType,
          fy,
          orgId,
          usedSeq + 1,
        ]);
      } else {
        const currentSeq = Number(rows[0].sequence) || 1;
        if (currentSeq <= usedSeq) {
          await tenantConn.execute(invoiceQueries.UPDATE_SEQUENCE, [
            usedSeq + 1,
            invoiceType,
            fy,
            orgId,
          ]);
        }
      }
    }

    await tenantConn.commit();
    await masterConn.commit();

    return { id: res.insertId };
  } catch (err) {
    try {
      await tenantConn.rollback();
    } catch (e) {}
    try {
      await masterConn.rollback();
    } catch (e) {}
    throw err;
  } finally {
    try {
      tenantConn.release();
    } catch (e) {}
    try {
      masterConn.release();
    } catch (e) {}
  }
};

const getAllDownloadDetails = async (orgId) => {
  if (!orgId) throw new Error("orgId required");
  const tenantPool = await getTenantPoolForOrgId(orgId);
  try {
    const [rows] = await tenantPool.query(
      invoiceQueries.GET_ALL_DOWNLOAD_DETAILS,
      [orgId],
    );
    return rows.map((r) => {
      if (r.lineItems && typeof r.lineItems === "string") {
        try {
          r.lineItems = JSON.parse(r.lineItems);
        } catch {
          r.lineItems = [];
        }
      }
      return r;
    });
  } catch (err) {
    throw err;
  }
};

module.exports = {
  getInvoicesByProject,
  createInvoice,
  updateInvoice,
  getInvoiceById,
  generateTemplateInvoiceNo,
  updateSequence,
  updateInvoiceExtra,
  recordDownloadDetails,
  getAllDownloadDetails,
  generateInvoiceNo,
};
