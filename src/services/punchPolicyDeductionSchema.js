const columns = {
  half_day_deduction_basis: "ENUM('percentage','amount') NULL DEFAULT NULL",
  half_day_deduction_value: "DECIMAL(10,2) NULL DEFAULT NULL",
  full_day_deduction_basis: "ENUM('percentage','amount') NULL DEFAULT NULL",
  full_day_deduction_value: "DECIMAL(10,2) NULL DEFAULT NULL",
};

const ensurePromises = new WeakMap();

async function ensurePunchPolicyDeductionSchema(pool) {
  if (ensurePromises.has(pool)) return ensurePromises.get(pool);

  const migration = (async () => {
    const names = Object.keys(columns);
    const [rows] = await pool.execute(
      `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'punch_policies'
         AND COLUMN_NAME IN (${names.map(() => "?").join(", ")})`,
      names,
    );
    const existing = new Set(rows.map((row) => row.COLUMN_NAME));

    for (const [name, definition] of Object.entries(columns)) {
      if (existing.has(name)) continue;
      try {
        await pool.query(
          `ALTER TABLE punch_policies ADD COLUMN ${name} ${definition}`,
        );
      } catch (error) {
        if (error.code !== "ER_DUP_FIELDNAME") throw error;
      }
    }

    await pool.execute(`
      UPDATE punch_policies
      SET
        half_day_deduction_basis = COALESCE(half_day_deduction_basis, deduction_basis),
        half_day_deduction_value = COALESCE(half_day_deduction_value, deduction_value),
        full_day_deduction_basis = COALESCE(full_day_deduction_basis, deduction_basis),
        full_day_deduction_value = COALESCE(full_day_deduction_value, deduction_value)
      WHERE policy_type = 'less_login_hours'
    `);
  })();

  ensurePromises.set(pool, migration);
  migration.catch(() => ensurePromises.delete(pool));
  return migration;
}

module.exports = { ensurePunchPolicyDeductionSchema };
