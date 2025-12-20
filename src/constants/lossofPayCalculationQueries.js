
module.exports = {
    GET_CURRENT_MONTH_LOP: `
        SELECT 
            employee_id,
            month,
            year,
            SUM(lop) AS total_lop
        FROM 
            employee_monthly_lop
        WHERE 
            computed_at >= DATE_SUB(
                DATE(CONCAT(YEAR(CURRENT_DATE), '-', MONTH(CURRENT_DATE), '-', (SELECT cutoff_date FROM salary_calculation_period WHERE id = 1))), 
                INTERVAL 1 MONTH
            )
            AND computed_at < DATE_ADD(
                DATE(CONCAT(YEAR(CURRENT_DATE), '-', MONTH(CURRENT_DATE), '-', (SELECT cutoff_date FROM salary_calculation_period WHERE id = 1))), 
                INTERVAL 1 DAY
            )
            AND (
                (year < YEAR(CURRENT_DATE) OR (year = YEAR(CURRENT_DATE) AND month < MONTH(CURRENT_DATE)))
                OR (year = YEAR(CURRENT_DATE) AND month = MONTH(CURRENT_DATE) AND DAY(computed_at) <= (SELECT cutoff_date FROM salary_calculation_period WHERE id = 1))
                OR (year > YEAR(CURRENT_DATE) OR (year = YEAR(CURRENT_DATE) AND month > MONTH(CURRENT_DATE)))
            )
        GROUP BY 
            employee_id, month, year
        ORDER BY 
            employee_id, year, month
    `,
    GET_DEFERRED_LOP: `
        SELECT 
            employee_id,
            month,
            year,
            SUM(lop) AS total_lop
        FROM 
            employee_monthly_lop
        WHERE 
            computed_at >= DATE_SUB(
                DATE(CONCAT(YEAR(CURRENT_DATE), '-', MONTH(CURRENT_DATE), '-', (SELECT cutoff_date FROM salary_calculation_period WHERE id = 1))), 
                INTERVAL 1 MONTH
            )
            AND computed_at < DATE_ADD(
                DATE(CONCAT(YEAR(CURRENT_DATE), '-', MONTH(CURRENT_DATE), '-', (SELECT cutoff_date FROM salary_calculation_period WHERE id = 1))), 
                INTERVAL 1 DAY
            )
            AND year = YEAR(CURRENT_DATE)
            AND month = MONTH(CURRENT_DATE)
            AND DAY(computed_at) > (SELECT cutoff_date FROM salary_calculation_period WHERE id = 1)
        GROUP BY 
            employee_id, month, year
        ORDER BY 
            employee_id, year, month
    `,
    GET_NEXT_MONTH_LOP: `
        SELECT 
            employee_id,
            month,
            year,
            SUM(lop) AS total_lop,
            1 AS use_in_next_month
        FROM 
            employee_monthly_lop
        WHERE 
            computed_at >= DATE_SUB(
                DATE(CONCAT(YEAR(CURRENT_DATE), '-', MONTH(CURRENT_DATE), '-', (SELECT cutoff_date FROM salary_calculation_period WHERE id = 1))), 
                INTERVAL 1 MONTH
            )
            AND computed_at < DATE_ADD(
                DATE(CONCAT(YEAR(CURRENT_DATE), '-', MONTH(CURRENT_DATE), '-', (SELECT cutoff_date FROM salary_calculation_period WHERE id = 1))), 
                INTERVAL 1 DAY
            )
            AND (
                (year = YEAR(CURRENT_DATE) AND month = MONTH(CURRENT_DATE) + 1)
                OR (year = YEAR(CURRENT_DATE) + 1 AND month = 1 AND MONTH(CURRENT_DATE) = 12)
            )
        GROUP BY 
            employee_id, month, year
        ORDER BY 
            employee_id, year, month
    `
};