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

exports.generateDocx = async (claim, employee) => {
  if (!claim || !claim.id) {
    console.error("Invalid Claim ID:", claim);
    throw new Error("Claim ID is undefined, cannot generate document.");
  }

  const safeString = (v, fallback = "") =>
    v === null || v === undefined ? String(fallback) : String(v);

  const TR = (textOrOpts, opts = {}) => {
    if (
      typeof textOrOpts === "object" &&
      textOrOpts !== null &&
      !Array.isArray(textOrOpts)
    ) {
      return new TextRun({
        ...textOrOpts,
        text: safeString(textOrOpts.text, ""),
      });
    }
    return new TextRun({ text: safeString(textOrOpts, ""), ...opts });
  };

  const P = (textOrOpts, opts = {}) =>
    new Paragraph({ children: [TR(textOrOpts, opts)] });

  const formTitle = new Paragraph({
    children: [
      TR({ text: "Reimbursement Form", bold: true, size: 30 }),
      TR({
        text: " - " + safeString(claim.claim_type, ""),
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
        TR({ text: "Employee ID: ", bold: true }),
        TR(safeString(claim.employee_id, "")),
        TR({ text: "    Department: ", bold: true }),
        TR(safeString(employee?.department_name, "")),
      ],
      spacing: { after: 100 },
    }),
    new Paragraph({
      children: [
        TR({ text: "Employee Name: ", bold: true }),
        TR(safeString(employee?.name, "")),
        TR({ text: "    Designation: ", bold: true }),
        TR(safeString(employee?.position, "")),
      ],
      spacing: { after: 200 },
    }),
  ];

  const reimbursementTableRows = [
    new TableRow({
      children: [
        new TableCell({
          width: { size: 15, type: WidthType.PERCENTAGE },
          children: [P({ text: "Date", bold: true })],
          margins: { top: 100, bottom: 100, left: 100, right: 100 },
        }),
        new TableCell({
          width: { size: 50, type: WidthType.PERCENTAGE },
          children: [P({ text: "Description", bold: true })],
          margins: { top: 100, bottom: 100, left: 100, right: 100 },
        }),
        new TableCell({
          width: { size: 10, type: WidthType.PERCENTAGE },
          children: [P({ text: "Unit", bold: true })],
          margins: { top: 100, bottom: 100, left: 100, right: 100 },
        }),
        new TableCell({
          width: { size: 12.5, type: WidthType.PERCENTAGE },
          children: [P({ text: "Price", bold: true })],
          margins: { top: 100, bottom: 100, left: 100, right: 100 },
        }),
        new TableCell({
          width: { size: 12.5, type: WidthType.PERCENTAGE },
          children: [P({ text: "Amount", bold: true })],
          margins: { top: 100, bottom: 100, left: 100, right: 100 },
        }),
      ],
    }),
  ];

  const addClaimRow = (date, description, unit, price, amount) => {
    const safeText = (value) => safeString(value, "-");

    reimbursementTableRows.push(
      new TableRow({
        children: [
          new TableCell({
            children: [P(safeText(date))],
            margins: { top: 100, bottom: 100, left: 100, right: 100 },
          }),
          new TableCell({
            children: [P(safeText(description))],
            margins: { top: 100, bottom: 100, left: 100, right: 100 },
          }),
          new TableCell({
            children: [P(safeText(unit))],
            margins: { top: 100, bottom: 100, left: 100, right: 100 },
          }),
          new TableCell({
            children: [P(safeText(price))],
            margins: { top: 100, bottom: 100, left: 100, right: 100 },
          }),
          new TableCell({
            children: [P(safeText(amount))],
            margins: { top: 100, bottom: 100, left: 100, right: 100 },
          }),
        ],
      })
    );
  };

  let formattedDate = "-";
  if (claim.from_date && claim.to_date) {
    formattedDate = `${new Date(
      claim.from_date
    ).toLocaleDateString()} - ${new Date(claim.to_date).toLocaleDateString()}`;
  } else if (claim.date) {
    formattedDate = new Date(claim.date).toLocaleDateString();
  }

  const getClaimDetails = (claim) => {
    const claimDetails = [];
    switch (claim.claim_type) {
      case "Transportation":
        claimDetails.push(
          {
            description: "Transport Amount",
            value: claim.transport_amount || 0,
          },
          {
            description: "Accomodation Fees",
            value: claim.accommodation_fees || 0,
          },
          { description: "DA", value: claim.da || 0 }
        );
        break;
      case "Telecommunication":
        claimDetails.push({
          description: claim.service_provider || "Unknown Provider",
          value: claim.total_amount || 0,
        });
        break;
      case "Meals":
        claimDetails.push({
          description: claim.meal_type || "Meal",
          value: claim.total_amount || 0,
        });
        break;
      case "Stationary":
        claimDetails.push(
          {
            description: claim.purpose || "Stationary Purchase",
            value: claim.stationary || 0,
          },
          {
            description: claim.purchasing_item || "Item",
            value: claim.total_amount || 0,
          }
        );
        break;
      case "Miscellaneous":
        claimDetails.push({
          description: claim.purpose || "Miscellaneous",
          value: claim.total_amount || 0,
        });
        break;
      default:
        claimDetails.push({
          description: claim.purpose || "Unknown",
          value: claim.total_amount || 0,
        });
        break;
    }
    return claimDetails;
  };

  const claimDetails = getClaimDetails(claim);
  claimDetails.forEach(({ description, value }) => {
    addClaimRow(formattedDate, description, "1", value, value);
  });

  while (reimbursementTableRows.length < 15) {
    addClaimRow(" ", " ", " ", " ", " ");
  }

  reimbursementTableRows.push(
    new TableRow({
      children: [
        new TableCell({
          children: [P("")],
          columnSpan: 3,
          margins: { top: 100, bottom: 100, left: 100, right: 100 },
        }),
        new TableCell({
          children: [P({ text: "Total Amount", bold: true })],
          margins: { top: 100, bottom: 100, left: 100, right: 100 },
        }),
        new TableCell({
          children: [
            P({ text: `₹${safeString(claim.total_amount || 0)}`, bold: true }),
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

  const totalAmountNumber = Number(claim.total_amount) || 0;
  const amountWords = numberToWords.toWords(totalAmountNumber);
  const formattedAmountWords =
    amountWords.charAt(0).toUpperCase() + amountWords.slice(1) + " only.";

  const amountInWords = new Paragraph({
    children: [
      TR({ text: `Amount In Words: ${formattedAmountWords}`, bold: true }),
    ],
    spacing: { before: 200, after: 200 },
  });

  const approvedByGrid =
    claim.status === "approved"
      ? [
          new Paragraph({
            children: [TR({ text: "Approved By", bold: true })],
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [
              TR({ text: "Name & Designation: ", bold: true }),
              TR(
                `${safeString(claim.approver_name)} - ${safeString(
                  claim.approver_designation
                )}`
              ),
            ],
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [
              TR({ text: "Approved Date: ", bold: true }),
              TR(
                safeString(
                  claim.approved_date
                    ? new Date(claim.approved_date).toLocaleDateString()
                    : ""
                )
              ),
            ],
            spacing: { after: 200 },
          }),
        ]
      : [];

  const footerNote = new Paragraph({
    children: [
      TR({
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

  const docxPath = path.join(
    __dirname,
    `../temp/Reimbursement_${claim.id}.docx`
  );
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(docxPath, buffer);
  return docxPath;
};
