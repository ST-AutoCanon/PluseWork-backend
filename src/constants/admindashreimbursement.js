module.exports = {
  GET_APPROVED_REIMBURSEMENT_LAST_MONTH: `
        SELECT SUM(aggregated_total) AS total_approved_reimbursement_last_month
        FROM reimbursement
        WHERE YEAR(approved_date) = YEAR(CURRENT_DATE - INTERVAL 1 MONTH) 
        AND MONTH(approved_date) = MONTH(CURRENT_DATE - INTERVAL 1 MONTH)
        AND status = 'approved'
    `,
};
