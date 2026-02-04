const { getTenantPoolByOrgId } = require("../db/tenantPoolManager");
const Q = require("../constants/clearanceQueries");

const fs = require('fs');
const path = require('path');


async function getItems(orgId, exitId) {
  const pool = await getTenantPoolByOrgId(orgId);
  const [rows] = await pool.execute(Q.GET_ITEMS, [orgId, exitId]);
  
  console.log("[getItems SERVICE] Raw rows from DB:", rows.length, "rows");
  if (rows.length > 0) {
    console.log("[getItems SERVICE] First row - attached_files type:", typeof rows[0].attached_files, "value:", rows[0].attached_files);
  }
  
  // Parse attached_files JSON for each item
  const processedRows = rows.map((row, idx) => {
    console.log(`[getItems SERVICE] Processing row ${idx}: attached_files type = ${typeof row.attached_files}, value = ${JSON.stringify(row.attached_files)}`);
    
    if (row.attached_files && typeof row.attached_files === 'string') {
      try {
        row.attached_files = JSON.parse(row.attached_files);
        console.log(`[getItems SERVICE] Parsed row ${idx} attached_files to array:`, row.attached_files);
      } catch (err) {
        console.error("[getItems] Failed to parse attached_files for item", row.id, err);
        row.attached_files = [];
      }
    } else if (!row.attached_files) {
      console.log(`[getItems SERVICE] Row ${idx} has no attached_files`);
      row.attached_files = [];
    }
    return row;
  });
  
  console.log("[getItems SERVICE] Returning", processedRows.length, "processed rows");
  return processedRows;
}

async function addItem(data) {
  const pool = await getTenantPoolByOrgId(data.orgId);
  const [res] = await pool.execute(Q.ADD_ITEM, [
    data.orgId,
    data.exitId,
    data.itemType,
    data.title,
    data.description || null,
    data.plannedDate || null,
    'pending',
    data.attachedFiles ? JSON.stringify(data.attachedFiles) : null,
    data.createdBy
  ]);
  return res.insertId;
}

async function updateStatus(orgId, itemId, status) {
  const pool = await getTenantPoolByOrgId(orgId);
  await pool.execute(Q.UPDATE_STATUS, [status, status, itemId, orgId]);
}






async function approveItem(orgId, itemId, approved, approverEmployeeId, approvalAs) {
  try {
    console.log("[DEBUG] approveItem called", {
      orgId,
      itemId,
      approved,
      approverEmployeeId,
      approvalAs,
      timestamp: new Date().toISOString()
    });

    if (!orgId || !itemId || approved === undefined || !approverEmployeeId || !approvalAs) {
      throw new Error("Missing required parameters");
    }

    if (!['supervisor', 'hr'].includes(approvalAs)) {
      throw new Error(`Invalid approvalAs value: ${approvalAs}`);
    }

    const pool = await getTenantPoolByOrgId(orgId);

    // Optional: Verify approver exists (can be removed if trusted)
    const [[approver]] = await pool.execute(
  `SELECT 1 FROM employees WHERE employee_id = ? AND org_id = ?`,
  [approverEmployeeId, orgId]
);

    if (!approver) {
      throw new Error("Approver not found in organization");
    }

    // Get current state for logging
    const [[item]] = await pool.execute(
      `SELECT supervisor_approved, hr_approved 
       FROM employee_exit_clearance_items 
       WHERE id = ? AND org_id = ?`,
      [itemId, orgId]
    );

    if (!item) {
      throw new Error("Clearance item not found");
    }

    console.log("[DEBUG] Current item state", {
      supervisor_approved: item.supervisor_approved,
      hr_approved: item.hr_approved,
      itemId,
      orgId,
      requestedApprovalAs: approvalAs
    });

    const approvedValue = approved ? 1 : 0;
    let query = '';
    let params = [];

    if (approvalAs === 'supervisor') {
      query = `
        UPDATE employee_exit_clearance_items 
        SET 
          supervisor_approved = ?,
          supervisor_approved_at = NOW(),
          updated_at = NOW()
        WHERE id = ? AND org_id = ?
      `;
      params = [approvedValue, itemId, orgId];
    } else if (approvalAs === 'hr') {
      query = `
        UPDATE employee_exit_clearance_items 
        SET 
          hr_approved = ?,
          hr_approved_at = NOW(),
          updated_at = NOW()
        WHERE id = ? AND org_id = ?
      `;
      params = [approvedValue, itemId, orgId];
    }

    console.log("[DEBUG] Executing approval query:", query.trim());
    console.log("[DEBUG] Query params:", params);

    const [result] = await pool.execute(query, params);

    console.log("[DEBUG] Update result", {
      affectedRows: result.affectedRows,
      changedRows: result.changedRows || 0
    });

    if (result.affectedRows === 0) {
      throw new Error("Update failed - item not found or organization mismatch");
    }

    return true;
  } catch (err) {
    console.error("[ERROR] approveItem failed:", err.message, err.stack);
    throw err;
  }
}


async function finalizeExit(orgId, exitId) {
  const pool = await getTenantPoolByOrgId(orgId);

  try {
    // 1. Get the employee_id from the exit request (safety check)
    const [[exit]] = await pool.execute(
      `SELECT employee_id 
       FROM employee_exit_requests1 
       WHERE id = ? AND org_id = ?`,
      [exitId, orgId]
    );

    if (!exit || !exit.employee_id) {
      throw new Error("Exit request not found or missing employee_id");
    }

    const employeeId = exit.employee_id;

    // 2. Mark clearance as completed (your existing logic)
    await pool.execute(
      `UPDATE employee_exit_requests1
       SET clearance_completed_at = NOW()
       WHERE id = ? AND org_id = ?
         AND clearance_completed_at IS NULL
         AND final_outcome = 'RESIGNED'`,
      [exitId, orgId]
    );

    // ───────────────────────────────────────────────────────────────
    // 3. NEW: Mark employee as Inactive
    // ───────────────────────────────────────────────────────────────
    await pool.execute(
      `UPDATE employees
       SET 
         status = 'Inactive',
         updated_at = NOW()
       WHERE employee_id = ? 
         AND org_id = ?`,
      [employeeId, orgId]
    );

    console.log(`[FINALIZE SUCCESS] Employee ${employeeId} marked Inactive for exit ${exitId}`);

    // Optional: Add audit log entry (recommended for compliance)
   

  } catch (err) {
    console.error("[FINALIZE EXIT ERROR]", err);
    throw err; // Let the handler catch and return 500
  }
}

async function updateItem(orgId, itemId, data) {
  const pool = await getTenantPoolByOrgId(orgId);

  const updates = [];
  const values = [];

  if (data.title !== undefined)           { updates.push("title = ?");               values.push(data.title); }
  if (data.description !== undefined)     { updates.push("description = ?");         values.push(data.description); }
  if (data.planned_date !== undefined)    { updates.push("planned_date = ?");        values.push(data.planned_date); }
  if (data.status !== undefined)          { updates.push("status = ?");              values.push(data.status); }
  if (data.actual_completed_date !== undefined) { updates.push("actual_completed_date = ?"); values.push(data.actual_completed_date); }
  if (data.attached_files !== undefined)  { updates.push("attached_files = ?");      values.push(data.attached_files); }

  // REMOVE or COMMENT THIS:
  // if (data.updated_by !== undefined)      { updates.push("updated_by = ?");          values.push(data.updated_by); }

  if (updates.length === 0) {
    console.log("[updateItem] No fields to update for item", itemId);
    return;
  }

  updates.push("updated_at = NOW()");  // MySQL auto-updates this anyway
  values.push(itemId, orgId);

  const query = `
    UPDATE employee_exit_clearance_items
    SET ${updates.join(", ")}
    WHERE id = ? AND org_id = ?
  `;

  await pool.execute(query, values);
}

// Add to exports

module.exports = {
  getItems,
  addItem,
  updateStatus,
  approveItem,
  finalizeExit,
  updateItem
  
};
