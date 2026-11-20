const SYSTEM_ACCOUNT_ROLES = new Set([
  "admin",
  "hr",
  "humanresources",
  "support",
]);

function normalizeRole(role) {
  return String(role || "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

function isSystemAccountRole(role) {
  return SYSTEM_ACCOUNT_ROLES.has(normalizeRole(role));
}

function formatSystemAccountId(employeePrefix, sequence) {
  const prefix = String(employeePrefix || "").trim().toUpperCase();
  const value = Number(sequence);

  if (!prefix) {
    throw new Error("Organization employee_prefix missing; cannot generate employee_id");
  }
  if (!Number.isInteger(value) || value < 1 || value > 99999) {
    throw new Error("System account ID sequence is out of range.");
  }

  return `${prefix}-S${String(value).padStart(5, "0")}`;
}

module.exports = {
  formatSystemAccountId,
  isSystemAccountRole,
};
