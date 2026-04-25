module.exports = {
  GET_INVOICES_BY_PROJECT: `
SELECT 
  i.id,
  i.projectId,
  i.invoiceType,
  DATE_FORMAT(i.invoiceDate,'%Y-%m-%d') AS invoiceDate,
  i.invoiceNo,
  i.referenceId,
  DATE_FORMAT(i.referenceDate,'%Y-%m-%d') AS referenceDate,
  i.currency,
  i.workDescription,
  i.subTotal,
  i.advance,
  i.totalExcludingTax,
  i.totalIncludingTax,
  i.terms,
  i.lineItems,
  i.gst,
  i.gstAmount,
  i.totalAmount,
  i.createdAt,
  i.updatedAt,
  i.gstPayment,
  i.milestoneId,
  i.status,
  i.round_off AS roundOff,
  i.round_off_amount AS roundOffAmount,
  i.isCancelled,
  p.payment_type,

  COALESCE((
    SELECT JSON_ARRAYAGG(
      JSON_OBJECT(
        'id',               entry_id,
        'milestone_details',entry_label,
        'month_year',       entry_month,
        'source',           entry_source
      )
    )
    FROM (
      SELECT 
        m.id                 AS entry_id,
        m.milestone_details  AS entry_label,
        NULL                 AS entry_month,
        'milestone'          AS entry_source
      FROM milestones m
      JOIN add_project p2 ON p2.id = m.project_id
      WHERE m.project_id = i.projectId
        AND p2.payment_type <> 'Monthly Scheduled'

      UNION ALL

      SELECT
        fd.id                AS entry_id,
        COALESCE(m2.milestone_details, 'Scheduled') AS entry_label,
        fd.month_year        AS entry_month,
        'financial'          AS entry_source
      FROM financial_details fd
      LEFT JOIN milestones m2 ON m2.id = fd.milestone_id
      JOIN add_project p2 ON p2.id = fd.project_id
      WHERE fd.project_id = i.projectId
        AND p2.payment_type = 'Monthly Scheduled'
        AND fd.month_year IS NOT NULL
    ) AS t
  ), JSON_ARRAY()) AS milestones

FROM invoices i
JOIN add_project p ON p.id = i.projectId
WHERE i.projectId = ?
ORDER BY i.createdAt DESC;
`,

  GET_INVOICE_BY_ID: `
SELECT 
  i.id,
  i.projectId,
  i.invoiceType,
  DATE_FORMAT(i.invoiceDate,'%Y-%m-%d') AS invoiceDate,
  i.invoiceNo,
  i.referenceId,
  DATE_FORMAT(i.referenceDate,'%Y-%m-%d') AS referenceDate,
  i.currency,
  i.workDescription,
  i.subTotal,
  i.advance,
  i.totalExcludingTax,
  i.totalIncludingTax,
  i.terms,
  i.lineItems,
  i.gst,
  i.gstAmount,
  i.totalAmount,
  i.createdAt,
  i.updatedAt,
  i.gstPayment,
  i.milestoneId,
  i.status,
  i.round_off AS roundOff,
  i.round_off_amount AS roundOffAmount,
  i.isCancelled,
  p.payment_type,

  (
    SELECT JSON_ARRAYAGG(
      JSON_OBJECT(
        'id',               entry_id,
        'milestone_details',entry_label,
        'month_year',       entry_month,
        'source',           entry_source
      )
    )
    FROM (
      SELECT 
        m.id                 AS entry_id,
        m.milestone_details  AS entry_label,
        NULL                 AS entry_month,
        'milestone'          AS entry_source
      FROM milestones m
      JOIN add_project p2 ON p2.id = m.project_id
      WHERE m.project_id = i.projectId
        AND p2.payment_type <> 'Monthly Scheduled'

      UNION ALL

      SELECT
        fd.id                AS entry_id,
        COALESCE(m2.milestone_details, 'Scheduled') AS entry_label,
        fd.month_year        AS entry_month,
        'financial'          AS entry_source
      FROM financial_details fd
      LEFT JOIN milestones m2 ON m2.id = fd.milestone_id
      JOIN add_project p2 ON p2.id = fd.project_id
      WHERE fd.project_id = i.projectId
        AND p2.payment_type = 'Monthly Scheduled'
        AND fd.month_year IS NOT NULL
    ) AS t
  ) AS milestones

FROM invoices i
JOIN add_project p ON p.id = i.projectId
WHERE i.id = ?;
`,

  GET_INVOICE_COUNT_BY_DATE: `
    SELECT COUNT(*) AS count 
    FROM invoices 
    WHERE invoiceDate BETWEEN ? AND ?;
  `,
  INSERT_INVOICE: `
    INSERT INTO invoices 
      (projectId, invoiceType, invoiceDate, invoiceNo, referenceId, referenceDate, currency, terms, lineItems, workDescription, subTotal, advance, totalExcludingTax, gst, gstAmount, totalAmount, totalIncludingTax, round_off, round_off_amount)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
  `,
  UPDATE_INVOICE_BASIC: `
    UPDATE invoices SET 
      invoiceType = ?,
      invoiceDate = ?,
      invoiceNo = ?,
      referenceId = ?,
      referenceDate = ?,
      currency = ?,
      terms = ?,
      lineItems = ?,
      workDescription = ?,
      subTotal = ?,
      advance = ?,
      totalExcludingTax = ?,
      gst = ?,
      gstAmount = ?,
      totalAmount = ?,
      totalIncludingTax = ?,
      round_off = ?,
      round_off_amount = ?
    WHERE id = ?;
  `,
  UPDATE_INVOICE_EXTRA: `
    UPDATE invoices SET 
      gstPayment = ?,
      milestoneId = ?,
      status = ?
    WHERE id = ?;
  `,

  GET_NEXT_SEQUENCE: `
  SELECT sequence
  FROM invoice_numbers
  WHERE invoice_type = ? AND financial_year = ? AND org_id = ?
`,

  INSERT_INITIAL_SEQUENCE: `
  INSERT INTO invoice_numbers (invoice_type, financial_year, org_id, sequence)
  VALUES (?, ?, ?, 2)
`,

  UPDATE_SEQUENCE: `
  UPDATE invoice_numbers
  SET sequence = ?
  WHERE invoice_type = ? AND financial_year = ? AND org_id = ?
`,

  INSERT_DOWNLOAD_DETAILS: `
    INSERT INTO download_details (
      org_id,
      invoice_type,
      invoice_number,
      to_name,
      address,
      contact,
      company_gst,
      country,
      state,
      currency,
      invoice_date,
      reference_date,
      reference_id,
      place_of_supply,
      with_seal,
      line_items,
      sub_total,
      gst,
      gst_amount,
      advance,
      total_excluding_tax,
      total_including_tax,
      terms,
      round_off,
      round_off_amount
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,

  GET_ALL_DOWNLOAD_DETAILS: `
  SELECT
    id,
    invoice_type         AS invoiceType,
    invoice_number       AS invoiceNumber,
    to_name              AS toName,
    address,
    contact,
    company_gst          AS companyGst,
    country,
    state,
    currency,
    DATE_FORMAT(invoice_date,'%Y-%m-%d') AS invoiceDate,
    DATE_FORMAT(reference_date,'%Y-%m-%d') AS referenceDate,
    reference_id         AS referenceId,
    place_of_supply      AS placeOfSupply,
    with_seal            AS withSeal,
    line_items           AS lineItems,
    sub_total            AS subTotal,
    gst,
    gst_amount           AS gstAmount,
    advance,
    total_excluding_tax  AS totalExcludingTax,
    total_including_tax  AS totalIncludingTax,
    terms,
    round_off            AS roundOff,
    round_off_amount     AS roundOffAmount,
    is_cancelled        AS isCancelled,
    cancelled_at         AS cancelledAt,
    created_at           AS createdAt
  FROM download_details
  WHERE org_id = ?
  ORDER BY created_at DESC
`,

  GET_DOWNLOAD_DETAILS_BY_ID: `
  SELECT
    id,
    invoice_type         AS invoiceType,
    invoice_number       AS invoiceNumber,
    to_name              AS toName,
    address,
    contact,
    company_gst          AS companyGst,
    country,
    state,
    currency,
    DATE_FORMAT(invoice_date,'%Y-%m-%d') AS invoiceDate,
    DATE_FORMAT(reference_date,'%Y-%m-%d') AS referenceDate,
    reference_id         AS referenceId,
    place_of_supply      AS placeOfSupply,
    with_seal            AS withSeal,
    line_items           AS lineItems,
    sub_total            AS subTotal,
    gst,
    gst_amount           AS gstAmount,
    advance,
    total_excluding_tax  AS totalExcludingTax,
    total_including_tax  AS totalIncludingTax,
    terms,
    round_off            AS roundOff,
    round_off_amount     AS roundOffAmount,
    is_cancelled        AS isCancelled,
    cancelled_at         AS cancelledAt,
    created_at           AS createdAt
  FROM download_details
  WHERE org_id = ? AND id = ?
  LIMIT 1
`,

  UPDATE_DOWNLOAD_DETAILS: `
    UPDATE download_details
    SET
      invoice_type = ?,
      invoice_number = ?,
      to_name = ?,
      address = ?,
      contact = ?,
      company_gst = ?,
      country = ?,
      state = ?,
      currency = ?,
      invoice_date = ?,
      reference_date = ?,
      reference_id = ?,
      place_of_supply = ?,
      with_seal = ?,
      line_items = ?,
      sub_total = ?,
      gst = ?,
      gst_amount = ?,
      advance = ?,
      total_excluding_tax = ?,
      total_including_tax = ?,
      terms = ?,
      round_off = ?,
      round_off_amount = ?
    WHERE org_id = ? AND id = ?
  `,

  CANCEL_DOWNLOAD_DETAILS: `
  UPDATE download_details
  SET
    is_cancelled = 1,
    cancelled_at = NOW()
  WHERE org_id = ? AND id = ?
`,
};
