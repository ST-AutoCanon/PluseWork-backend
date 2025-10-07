module.exports = {
  GET_EMPLOYEE_PROJECTS: `
        SELECT 
            e.employee_id,
            CONCAT(e.first_name, ' ', e.last_name) AS employee_name,
            CONCAT(sup.first_name, ' ', sup.last_name) AS supervisor_name,
            GROUP_CONCAT(ap.project_name SEPARATOR ', ') AS project_names
        FROM 
            sukalpadata.employees e
        LEFT JOIN 
            sukalpadata.employee_professional ep ON e.employee_id = ep.employee_id
        LEFT JOIN 
            sukalpadata.employees sup ON ep.supervisor_id = sup.employee_id
        LEFT JOIN 
            sukalpadata.sts_owners so ON e.employee_id = so.sts_owner_id
        LEFT JOIN 
            add_project ap ON so.project_id = ap.id
        GROUP BY 
            e.employee_id, 
            CONCAT(e.first_name, ' ', e.last_name), 
            CONCAT(sup.first_name, ' ', sup.last_name)
    `,
};
