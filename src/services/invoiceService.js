const db = require("../config");
const invoiceQueries = require("../constants/invoiceQueries");
const projectService = require("./projectService");

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

async function getOrgName(connection, orgId) {
  if (!orgId) return null;

  const candidates = [
    {
      q: "SELECT Name AS name FROM Organizations WHERE id = ?",
      params: [orgId],
    },
  ];

  for (const c of candidates) {
    try {
      const [rows] = await connection.execute(c.q, c.params);
      if (rows && rows.length > 0 && rows[0].name) {
        return String(rows[0].name).trim();
      }
    } catch (err) {}
  }

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
  return single.slice(0, 3).toUpperCase() || "STS";
}

const getInvoicesByProject = async (projectId) => {
  try {
    const [results] = await db.execute(invoiceQueries.GET_INVOICES_BY_PROJECT, [
      projectId,
    ]);

    const parsedResults = results.map((invoice) => {
      if (invoice.lineItems && typeof invoice.lineItems === "string") {
        try {
          invoice.lineItems = JSON.parse(invoice.lineItems);
        } catch (err) {
          console.warn(
            `Error parsing lineItems for invoice ${invoice.id}:`,
            err
          );
          invoice.lineItems = [];
        }
      }
      return invoice;
    });

    return parsedResults;
  } catch (err) {
    throw err;
  }
};

const getInvoiceById = async (id) => {
  try {
    const [results] = await db.execute(invoiceQueries.GET_INVOICE_BY_ID, [id]);
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
      } catch (error) {
        console.warn("Error parsing lineItems JSON:", error);
        invoice.lineItems = [];
      }
    }

    return invoice;
  } catch (err) {
    throw err;
  }
};

// at top: ensure invoiceQueries is required as you already have
// const invoiceQueries = require("../constants/invoiceQueries");

const generateTemplateInvoiceNo = async (invoiceType, orgId = null) => {
  const today = new Date();
  const financialYear = getFinancialYear(today);

  const connection = await db.getConnection();
  try {
    const orgName = await getOrgName(connection, orgId);
    const acronym = makeOrgAcronym(orgName);

    const [rows] = await connection.execute(invoiceQueries.GET_NEXT_SEQUENCE, [
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
    connection.release();
  }
};

const generateInvoiceNo = async (invoiceDate, invoiceType, orgId) => {
  const financialYear = getFinancialYear(invoiceDate);
  const connection = await db.getConnection();

  try {
    const orgName = await getOrgName(connection, orgId);
    const acronym = makeOrgAcronym(orgName);

    // read existing row for this org/type/fy
    const [rows] = await connection.execute(invoiceQueries.GET_NEXT_SEQUENCE, [
      invoiceType,
      financialYear,
      orgId,
    ]);

    let sequenceForInvoice;
    if (!rows || rows.length === 0) {
      // No row exists yet: use 1 for this invoice, and insert a row with sequence = 2 (next will be 2)
      sequenceForInvoice = 1;
      await connection.execute(invoiceQueries.INSERT_INITIAL_SEQUENCE, [
        invoiceType,
        financialYear,
        orgId,
        2, // next available sequence after we return 1
      ]);
    } else {
      // row exists and holds the next sequence to use
      const currentSeq = Number(rows[0].sequence) || 1;
      sequenceForInvoice = currentSeq;
      // update to next sequence
      await connection.execute(invoiceQueries.UPDATE_SEQUENCE, [
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
    connection.release();
  }
};

const createInvoice = async (invoiceData, orgId) => {
  const connection = await db.getConnection();

  try {
    const invoiceNo = await generateInvoiceNo(
      invoiceData.invoiceDate,
      invoiceData.invoiceType,
      orgId
    );

    const [results] = await connection.execute(invoiceQueries.INSERT_INVOICE, [
      invoiceData.projectId,
      invoiceData.invoiceType,
      invoiceData.invoiceDate,
      invoiceNo,
      invoiceData.referenceId,
      invoiceData.referenceDate,
      invoiceData.terms,
      JSON.stringify(invoiceData.lineItems),
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
      throw new Error("No insertId returned! Possible issue with the query.");
    }

    const invoice = await getInvoiceById(results.insertId);
    return invoice;
  } catch (err) {
    console.error("createInvoice error:", err);
    throw err;
  } finally {
    connection.release();
  }
};

const updateInvoice = async (id, invoiceData) => {
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
    JSON.stringify(invoiceData.lineItems),
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

  const [basicResults] = await db.execute(
    invoiceQueries.UPDATE_INVOICE_BASIC,
    basicValues
  );

  return await getInvoiceById(id);
};

const updateInvoiceExtra = async (id, invoiceData) => {
  const formattedInvoiceDate = invoiceData.invoiceDate
    ? new Date(invoiceData.invoiceDate).toISOString().slice(0, 10)
    : null;
  const formattedReferenceDate = invoiceData.referenceDate
    ? new Date(invoiceData.referenceDate).toISOString().slice(0, 10)
    : null;

  await db.execute(invoiceQueries.UPDATE_INVOICE_BASIC, [
    invoiceData.invoiceType,
    formattedInvoiceDate,
    invoiceData.invoiceNo,
    invoiceData.referenceId,
    formattedReferenceDate,
    invoiceData.terms,
    JSON.stringify(invoiceData.lineItems),
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

  console.log(
    invoiceData.gstPayment,
    invoiceData.milestoneId,
    invoiceData.status,
    id
  );

  await db.execute(invoiceQueries.UPDATE_INVOICE_EXTRA, [
    invoiceData.gstPayment,
    invoiceData.milestoneId,
    invoiceData.status,
    id,
  ]);

  const [[{ payment_type }]] = await db.query(
    `SELECT payment_type FROM add_project WHERE id = ?`,
    [invoiceData.projectId]
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
      await projectService.updateFinancialDetailsById({
        financial_id: Number(invoiceData.milestoneId),
        ...common,
      });
    } else {
      await projectService.updateFinancialDetailsForInvoice({
        project_id: Number(invoiceData.projectId),
        milestone_id: Number(invoiceData.milestoneId),
        ...common,
      });
    }
  }

  return await getInvoiceById(id);
};

const updateSequence = async (invoiceType, orgId) => {
  const connection = await db.getConnection();
  try {
    const today = new Date();
    const financialYear = getFinancialYear(today);
    const cleanedFinancialYear = financialYear.trim();
    const cleanInvoiceType = invoiceType.toString().trim().toLowerCase();

    const [rows] = await connection.execute(invoiceQueries.GET_NEXT_SEQUENCE, [
      cleanInvoiceType,
      cleanedFinancialYear,
      orgId,
    ]);

    const nextSequence = rows && rows.length > 0 ? Number(rows[0].sequence) : 1;

    const [updateResult] = await connection.execute(
      invoiceQueries.UPDATE_SEQUENCE,
      [nextSequence, cleanInvoiceType, cleanedFinancialYear, orgId]
    );

    if (updateResult.affectedRows === 0) {
      await connection.execute(invoiceQueries.INSERT_INITIAL_SEQUENCE, [
        cleanInvoiceType,
        cleanedFinancialYear,
        orgId,
        nextSequence,
      ]);
    }

    return { updatedSequence: nextSequence };
  } catch (err) {
    console.error("[updateSequence] Error:", err);
    throw new Error("Failed to update sequence: " + err.message);
  } finally {
    connection.release();
  }
};

async function parseSequenceFromInvoiceNumber(invoiceNumber) {
  if (!invoiceNumber || typeof invoiceNumber !== "string") return null;
  const m = invoiceNumber.trim().match(/(\d+)\s*$/);
  if (!m) return null;
  return parseInt(m[1], 10);
}

async function recordDownloadDetails(
  invoiceType,
  invoiceNumber,
  details,
  orgId
) {
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

  const params = [
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
    JSON.stringify(lineItems),
    subTotal,
    gst,
    gstAmount,
    advance,
    totalExcludingTax,
    totalIncludingTax,
    terms,
  ];

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [res] = await connection.execute(
      invoiceQueries.INSERT_DOWNLOAD_DETAILS,
      params
    );

    const usedSeq = parseSequenceFromInvoiceNumber(invoiceNumber);
    const fy = getFinancialYear(invoiceDate || new Date());

    if (usedSeq != null && orgId) {
      const [rows] = await connection.execute(
        invoiceQueries.GET_NEXT_SEQUENCE,
        [invoiceType, fy, orgId]
      );

      if (!rows || rows.length === 0) {
        await connection.execute(invoiceQueries.INSERT_INITIAL_SEQUENCE, [
          invoiceType,
          fy,
          orgId,
        ]);
      } else {
        const currentSeq = Number(rows[0].sequence) || 1;
        if (currentSeq <= usedSeq) {
          await connection.execute(invoiceQueries.UPDATE_SEQUENCE, [
            usedSeq + 1,
            invoiceType,
            fy,
            orgId,
          ]);
        }
      }
    } else {
      // no orgId or couldn't parse sequence — we won't touch invoice_numbers
    }

    await connection.commit();
    return { id: res.insertId };
  } catch (err) {
    try {
      await connection.rollback();
    } catch (e) {}
    console.error("recordDownloadDetails error:", err);
    throw err;
  } finally {
    connection.release();
  }
}

async function getAllDownloadDetails(orgId) {
  const [rows] = await db.execute(invoiceQueries.GET_ALL_DOWNLOAD_DETAILS, [
    orgId,
  ]);
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
}

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
};
