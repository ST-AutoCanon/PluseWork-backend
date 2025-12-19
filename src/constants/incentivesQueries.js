
module.exports = {
    INSERT_INCENTIVE: `
        INSERT INTO employee_incentives 
            (employee_id, incentive_type, ctc_percentage, sales_amount, applicable_month) 
        VALUES (?, ?, ?, ?, ?)
    `,

    GET_INCENTIVES_BY_EMPLOYEE: `
        SELECT 
            id, 
            employee_id, 
            incentive_type, 
            ctc_percentage, 
            sales_amount, 
            applicable_month, 
            created_at
        FROM 
            employee_incentives
        WHERE 
            employee_id = ?
        ORDER BY 
            applicable_month DESC
    `,

    GET_ALL_INCENTIVES: `
        SELECT 
            id, 
            employee_id, 
            incentive_type, 
            ctc_percentage, 
            sales_amount, 
            applicable_month, 
            created_at
        FROM 
            employee_incentives
        ORDER BY 
            applicable_month DESC
    `
};
