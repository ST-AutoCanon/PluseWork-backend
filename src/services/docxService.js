// services/docxService.js
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
} = require("docx");
const fs = require("fs");
const path = require("path");
const numberToWords = require("number-to-words");

/**
 * Generate a DOCX for a reimbursement claim.
 * - claim: object containing claim data (id required)
 * - employee: object containing employee details
 * - orgId: string (optional) - used to store temp files under temp/{orgId}
 *
 * Returns absolute path to generated .docx
 */
exports.generateDocx = async (claim, employee, orgId = "unknown") => {
  if (!claim || !claim.id) {
    console.error("Invalid Claim ID:", claim);
    throw new Error("Claim ID is undefined, cannot generate document.");
  }

  const companyHeader = new Paragraph({
    children: [
      new TextRun({
        text: "Sukalpa Tech Solutions Pvt Ltd.",
        bold: true,
        size: 36,
      }),
    ],
    alignment: "center",
    spacing: { after: 300 },
  });

  const formTitle = new Paragraph({
    children: [
      new TextRun({ text: "Reimbursement Form", bold: true, size: 30 }),
      new TextRun({
        text: " - " + (claim.claim_type || ""),
        bold: true,
        size: 30,
      }),
    ],
    alignment: "left",
    spacing: { after: 200 },
  });

  const employeeDetailsGrid = [
    new Paragraph({
      children: [
        new TextRun({ text: "Employee ID: ", bold: true }),
        new TextRun({ text: (claim.employee_id || "") + "    " }),
        new TextRun({ text: "Department: ", bold: true }),
        new TextRun({ text: employee?.department_name || "" }),
      ],
      spacing: { after: 100 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "Employee Name: ", bold: true }),
        new TextRun({ text: (employee?.name || "") + "    " }),
        new TextRun({ text: "Designation: ", bold: true }),
        new TextRun({ text: employee?.position || "" }),
      ],
      spacing: { after: 200 },
    }),
  ];

  if (Array.isArray(claim.invoices) && claim.invoices.length) {
    employeeDetailsGrid.push(
      new Paragraph({
        children: [
          new TextRun({ text: "Invoice Numbers: ", bold: true }),
          new TextRun({ text: claim.invoices.join(", ") }),
        ],
        spacing: { after: 200 },
      })
    );
  }

  const reimbursementTableRows = [
    new TableRow({
      children: [
        new TableCell({
          width: { size: 15, type: WidthType.PERCENTAGE },
          children: [
            new Paragraph({
              children: [new TextRun({ text: "Date", bold: true })],
            }),
          ],
          margins: { top: 100, bottom: 100, left: 100, right: 100 },
        }),
        new TableCell({
          width: { size: 50, type: WidthType.PERCENTAGE },
          children: [
            new Paragraph({
              children: [new TextRun({ text: "Description", bold: true })],
            }),
          ],
          margins: { top: 100, bottom: 100, left: 100, right: 100 },
        }),
        new TableCell({
          width: { size: 10, type: WidthType.PERCENTAGE },
          children: [
            new Paragraph({
              children: [new TextRun({ text: "Unit", bold: true })],
            }),
          ],
          margins: { top: 100, bottom: 100, left: 100, right: 100 },
        }),
        new TableCell({
          width: { size: 12.5, type: WidthType.PERCENTAGE },
          children: [
            new Paragraph({
              children: [new TextRun({ text: "Price", bold: true })],
            }),
          ],
          margins: { top: 100, bottom: 100, left: 100, right: 100 },
        }),
        new TableCell({
          width: { size: 12.5, type: WidthType.PERCENTAGE },
          children: [
            new Paragraph({
              children: [new TextRun({ text: "Amount", bold: true })],
            }),
          ],
          margins: { top: 100, bottom: 100, left: 100, right: 100 },
        }),
      ],
    }),
  ];

  const addClaimRow = (date, description, unit, price, amount) => {
    const safeText = (value) =>
      value !== undefined && value !== null ? value.toString() : "-";

    reimbursementTableRows.push(
      new TableRow({
        children: [
          new TableCell({
            children: [
              new Paragraph({ children: [new TextRun(safeText(date))] }),
            ],
            margins: { top: 100, bottom: 100, left: 100, right: 100 },
          }),
          new TableCell({
            children: [
              new Paragraph({ children: [new TextRun(safeText(description))] }),
            ],
            margins: { top: 100, bottom: 100, left: 100, right: 100 },
          }),
          new TableCell({
            children: [
              new Paragraph({ children: [new TextRun(safeText(unit))] }),
            ],
            margins: { top: 100, bottom: 100, left: 100, right: 100 },
          }),
          new TableCell({
            children: [
              new Paragraph({ children: [new TextRun(safeText(price))] }),
            ],
            margins: { top: 100, bottom: 100, left: 100, right: 100 },
          }),
          new TableCell({
            children: [
              new Paragraph({ children: [new TextRun(safeText(amount))] }),
            ],
            margins: { top: 100, bottom: 100, left: 100, right: 100 },
          }),
        ],
      })
    );
  };

  let formattedDate = claim.display_date
    ? new Date(claim.display_date).toLocaleDateString()
    : "-";

  (claim.lines || []).forEach((line) => {
    const p = line.payload || {};
    addClaimRow(
      formattedDate,
      p.purpose || p.description || "-",
      "1",
      line.total_amount,
      line.total_amount
    );
  });

  // Ensure table length looks nice (pad to 15 rows)
  while (reimbursementTableRows.length < 15) {
    addClaimRow(" ", " ", " ", " ", " ");
  }

  reimbursementTableRows.push(
    new TableRow({
      children: [
        new TableCell({ children: [], columnSpan: 3 }),
        new TableCell({
          children: [
            new Paragraph({
              children: [new TextRun({ text: "Total Amount", bold: true })],
            }),
          ],
          margins: { top: 100, bottom: 100, left: 100, right: 100 },
        }),
        new TableCell({
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: `₹${claim.aggregated_total || "0"}`,
                  bold: true,
                }),
              ],
            }),
          ],
        }),
      ],
    })
  );

  const reimbursementTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: reimbursementTableRows,
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
  });

  // convert aggregated_total to words (safe)
  let aggNum = parseFloat(claim.aggregated_total || 0);
  if (!Number.isFinite(aggNum)) aggNum = 0;
  const amountWordsRaw = numberToWords.toWords(Math.floor(aggNum));
  const formattedAmountWords = amountWordsRaw
    ? amountWordsRaw.charAt(0).toUpperCase() +
      amountWordsRaw.slice(1) +
      " only."
    : "Zero only.";

  const amountInWords = new Paragraph({
    children: [
      new TextRun({
        text: `Amount In Words: ${formattedAmountWords}`,
        bold: true,
      }),
    ],
    spacing: { before: 200, after: 200 },
  });

  const approvedByGrid =
    String(claim.status || "").toLowerCase() === "approved"
      ? [
          new Paragraph({
            children: [new TextRun({ text: "Approved By", bold: true })],
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Name & Designation: ", bold: true }),
              new TextRun({
                text: `${claim.approver_name || ""} - ${
                  claim.approver_designation || ""
                }`,
              }),
            ],
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Approved Date: ", bold: true }),
              new TextRun({
                text: claim.approved_date
                  ? new Date(claim.approved_date).toLocaleDateString()
                  : "",
              }),
            ],
            spacing: { after: 200 },
          }),
        ]
      : [];

  const footerNote = new Paragraph({
    children: [
      new TextRun({
        text: 'Note: "This statement affirms that all provided documents are true and correct."',
        italics: true,
      }),
    ],
    alignment: "center",
    spacing: { before: 400 },
  });

  const outerTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: [
              companyHeader,
              formTitle,
              ...employeeDetailsGrid,
              reimbursementTable,
              amountInWords,
              ...approvedByGrid,
              footerNote,
            ],
            margins: { top: 200, bottom: 200, left: 200, right: 200 },
          }),
        ],
      }),
    ],
    borders: {
      top: { style: "single", size: 6, color: "000000" },
      bottom: { style: "single", size: 6, color: "000000" },
      left: { style: "single", size: 6, color: "000000" },
      right: { style: "single", size: 6, color: "000000" },
    },
  });

  const doc = new Document({
    sections: [
      {
        properties: {
          pageSize: { width: 11906, height: 16838 },
          pageMargins: { top: 50, right: 50, bottom: 50, left: 50 },
        },
        children: [outerTable],
      },
    ],
  });

  // ensure temp dir per org exists
  const tempDir = path.join(__dirname, "../temp", String(orgId || "unknown"));
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const docxPath = path.join(tempDir, `Reimbursement_${claim.id}.docx`);

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(docxPath, buffer);

  return docxPath;
};
