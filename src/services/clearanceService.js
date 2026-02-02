const { getTenantPoolByOrgId } = require("../db/tenantPoolManager");
const Q = require("../constants/clearanceQueries");

const fs = require('fs');
const path = require('path');

// async function addItem(data, files = []) {  // Add files par
// // am
//   const pool = await getTenantPoolByOrgId(data.orgId);
//   const attachedFilesUrls = [];

//   // Create uploads dir if not exists
//   const uploadDir = path.join(__dirname, '../../uploads');  // Adjust path as needed
//   if (!fs.existsSync(uploadDir)) {
//     fs.mkdirSync(uploadDir, { recursive: true });
//   }

//   // Process each file
//   for (const file of files) {
//     const fileName = `${Date.now()}-${file.originalname}`;  // Unique name to avoid conflicts
//     const filePath = path.join(uploadDir, fileName);
//     fs.writeFileSync(filePath, file.buffer);  // Save file
//     const fileUrl = `${process.env.BACKEND_URL}/uploads/${fileName}`;  // e.g., http://localhost:3000/uploads/file.jpg
//     attachedFilesUrls.push(fileUrl);
//   }

//   const [res] = await pool.execute(Q.ADD_ITEM, [
//     data.orgId,
//     data.exitId,
//     data.itemType,
//     data.title,
//     data.description || null,
//     data.plannedDate || null,
//     'pending',
//     attachedFilesUrls.length > 0 ? JSON.stringify(attachedFilesUrls) : null,
//     data.createdBy
//   ]);
//   return res.insertId;
// }
async function getItems(orgId, exitId) {
  const pool = await getTenantPoolByOrgId(orgId);
  const [rows] = await pool.execute(Q.GET_ITEMS, [orgId, exitId]);
  return rows;
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


// async function approveItem(orgId, itemId, approved, approverEmployeeId) {
//   try {
//     console.log("[DEBUG] approveItem called", {
//       orgId,
//       itemId,
//       approved,
//       approverEmployeeId,
//       timestamp: new Date().toISOString()
//     });

//     if (!orgId || !itemId || approved === undefined || !approverEmployeeId) {
//       throw new Error("Missing required parameters");
//     }

//     const approvedValue = approved ? 1 : 0;

//     const pool = await getTenantPoolByOrgId(orgId);

//     // Fetch current state
//     const [[item]] = await pool.execute(
//       `SELECT 
//          supervisor_approved, 
//          hr_approved
//        FROM employee_exit_clearance_items 
//        WHERE id = ? AND org_id = ?`,
//       [itemId, orgId]
//     );

//     if (!item) {
//       throw new Error("Item not found");
//     }

//     console.log("[DEBUG] Current clearance item state", {
//       supervisor_approved: item.supervisor_approved,
//       hr_approved: item.hr_approved,
//       itemId,
//       orgId
//     });

//     let query = '';
//     let params = [approvedValue, itemId, orgId];

//     // For supervisor: always allow updating supervisor_approved (unless already approved)
//     // This ensures supervisor can approve from team tab independently
//     query = 'UPDATE employee_exit_clearance_items SET supervisor_approved = ?, updated_at = NOW() WHERE id = ? AND org_id = ?';
//     console.log("[DEBUG] Executing supervisor approval query:", query, "with params:", params);

//     const [result] = await pool.execute(query, params);

//     console.log("[DEBUG] Update result", {
//       affectedRows: result.affectedRows,
//       changedRows: result.changedRows || 0
//     });

//     if (result.affectedRows === 0) {
//       throw new Error("Update failed - item not found or already approved");
//     }

//     return true;
//   } catch (err) {
//     console.error("[ERROR] approveItem failed:", err.message);
//     throw err;
//   }
// }




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

  // Temporarily skip pending check to test
  // const [[check]] = await pool.execute(Q.COUNT_PENDING_APPROVALS, [exitId, orgId]);
  // if (check.pending > 0) {
  //   throw new Error("Clearance still pending");
  // }

  await pool.execute(Q.FINALIZE_EXIT, [exitId, orgId]);
  console.log("[FINALIZE] Completed for exitId:", exitId);
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
