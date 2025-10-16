const INSERT_VENDOR = `
  INSERT INTO vendors (
    org_id,
    company_name, registered_address, city, state, pin_code, gst_number, pan_number, company_type,
    contact1_name, contact1_designation, contact1_mobile, contact1_email,
    contact2_name, contact2_designation, contact2_mobile, contact2_email,
    contact3_name, contact3_designation, contact3_mobile, contact3_email,
    bank_name, branch, branch_address, account_number, ifsc_code,
    nature_of_business, product_category, years_of_experience,
    gst_certificate, pan_card, cancelled_cheque, msme_certificate, msme_status, incorporation_certificate
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 
          ?, ?, ?, ?, ?);
`;

const UPDATE_VENDOR_BY_ID = `
 UPDATE vendors SET
    company_name = ?, registered_address = ?, city = ?, state = ?, pin_code = ?, gst_number = ?, pan_number = ?, company_type = ?,
    contact1_name = ?, contact1_designation = ?, contact1_mobile = ?, contact1_email = ?,
    contact2_name = ?, contact2_designation = ?, contact2_mobile = ?, contact2_email = ?,
    contact3_name = ?, contact3_designation = ?, contact3_mobile = ?, contact3_email = ?,
    bank_name = ?, branch = ?, branch_address = ?, account_number = ?, ifsc_code = ?,
    nature_of_business = ?, product_category = ?, years_of_experience = ?,
    gst_certificate = ?, pan_card = ?, cancelled_cheque = ?, msme_certificate = ?, msme_status = ?, incorporation_certificate = ?, updated_at = NOW()
  WHERE vendor_id = ? AND org_id = ?;
`;

const GET_VENDORS_BY_ORGID = `
  SELECT * FROM vendors WHERE org_id = ?;
`;

module.exports = {
  INSERT_VENDOR,
  UPDATE_VENDOR_BY_ID,
  GET_VENDORS_BY_ORGID,
};
