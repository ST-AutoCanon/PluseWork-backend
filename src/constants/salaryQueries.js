const checkIfTableExists = (tableName) => `
  SELECT COUNT(*) AS count FROM information_schema.tables 
  WHERE table_schema = DATABASE() AND table_name = '${tableName}';
`;

const createTableQuery = (tableName, columns) => {
  const columnDefinitions = columns.map((col) => `\`${col}\` TEXT`).join(", ");

  return `
    CREATE TABLE IF NOT EXISTS \`${tableName}\` (
     
      ${columnDefinitions}
    );
  `;
};

const deleteExistingData = (tableName) => `DELETE FROM \`${tableName}\`;`;

const insertSalaryData = (tableName, row) => {
  const columns = Object.keys(row)
    .map((col) => `\`${col}\``)
    .join(", ");
  const placeholders = Object.keys(row)
    .map(() => "?")
    .join(", ");
  const values = Object.values(row);

  return {
    query: `INSERT INTO \`${tableName}\` (${columns}) VALUES (${placeholders});`,
    values: values,
  };
};

const generateEmployeeId = () => {
  return `EMP${Math.floor(10000 + Math.random() * 90000)}`;
};

module.exports = {
  checkIfTableExists,
  createTableQuery,
  deleteExistingData,
  insertSalaryData,
};
