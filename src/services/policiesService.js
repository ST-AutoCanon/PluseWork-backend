// services/policiesService.js

const fs = require("fs");
const path = require("path");

const {
  getTenantPool,
  sanitizeDbName,
} = require("../db/tenantPoolManager");

const queries = require("../constants/policiesQueries");
const { convertToPdf } = require("../../src/utils/convertToPdf"); // ← NEW


const UPLOAD_BASE_PATH = process.env.POLICY_UPLOAD_PATH
  || path.join(process.cwd(), "uploads", "policies"); // MUST match multer destination

async function getTenantPoolForOrgId(orgId) {
  if (!orgId) {
    const err = new Error("orgId required");
    err.code = "ORG_REQUIRED";
    throw err;
  }

  const dbName = sanitizeDbName(`tenant_${orgId}`);
  return getTenantPool(dbName);
}

function ensureDirectoryExists(folderPath) {
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }
}
/**
 * Replace Policy File (Delete old + Upload new)
 */
/**
 * Replace Policy File (Delete old + Upload new)
 */
/**
 * Replace Policy File (Delete old + Upload new)
 */
/**
 * Replace Policy File (Delete old + Upload new)
 */
async function replacePolicyFile(orgId, fileId, files, body = {}) {
  if (!orgId || !fileId) throw new Error("orgId and fileId required");

  const tenantPool = await getTenantPoolForOrgId(orgId);
  const conn = await tenantPool.getConnection();

  try {
    await conn.beginTransaction();

    // Get old file info
    const [oldFileRows] = await conn.query(queries.GET_POLICY_FILE_BY_ID, [fileId]);
    if (!oldFileRows.length) throw new Error("File not found");

    const oldFile = oldFileRows[0];

    // Delete physical old file
    const oldFilePath = path.join(
      UPLOAD_BASE_PATH,
      String(orgId),
      `policy_${oldFile.policy_id}`,
      oldFile.file_name
    );

    if (fs.existsSync(oldFilePath)) {
      fs.unlinkSync(oldFilePath);
    }

    // Find new uploaded file
    let newFile = null;
    let detectedType = "document";

    for (const type of ["document", "ppt", "video", "image"]) {
      if (files?.[type] && files[type][0]) {
        newFile = files[type][0];
        detectedType = type;
        break;
      }
    }

    if (!newFile) {
      throw new Error("No new file uploaded");
    }

    // ===== CONVERT OFFICE FILES TO PDF =====
    let finalFileName = newFile.filename;
    let finalOriginalName = newFile.originalname;
    let finalFileType = detectedType;

    const { convertToPdf } = require("../utils/convertToPdf");
    const ext = path.extname(newFile.originalname).toLowerCase();

    if ([".doc", ".docx", ".ppt", ".pptx"].includes(ext)) {
      try {
        const pdfPath = await convertToPdf(newFile.path);
        if (pdfPath) {
          finalFileName = path.basename(pdfPath);
          finalOriginalName = newFile.originalname.replace(ext, ".pdf");
          finalFileType = "document";

          // Delete original Office file
          if (fs.existsSync(newFile.path)) {
            fs.unlinkSync(newFile.path);
          }
        }
      } catch (err) {
        console.error("Replace conversion failed:", err.message);
      }
    }

    const acknowledgementRequired = normalizeBoolean(
      body.acknowledgement || body.acknowledgement_0
    );
    const acknowledgementMessage =
      body.acknowledgementMessage || body.acknowledgement_message_0 || "";

    const allowView = normalizeBoolean(body.allow_view || body.allow_view_0);
    const allowDownload = normalizeBoolean(body.allow_download || body.allow_download_0);

    // Update the file record
    await conn.query(queries.UPDATE_POLICY_FILE_REPLACE, [
      finalFileName,
      finalOriginalName,
      acknowledgementRequired,
      acknowledgementMessage,
      allowView,
      allowDownload,
      fileId,
    ]);

    await conn.commit();
    return { success: true };
  } catch (error) {
    await conn.rollback();

    // Cleanup new file if transaction failed
    if (files) {
      Object.values(files).flat().forEach((file) => {
        if (file?.path && fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });
    }
    throw error;
  } finally {
    conn.release();
  }
}
function normalizeBoolean(value) {
  return (
    value === true ||
    value === "true" ||
    value === 1 ||
    value === "1"
  )
    ? 1
    : 0;
}

/**
 * Create Policy
 */
async function createPolicy(orgId, data) {
  if (!orgId) throw new Error("orgId required");
  if (!data.policy_name) throw new Error("Policy name required");

  const employeeIds = Array.isArray(data.employeeIds) ? data.employeeIds : [];
  const departmentIds = Array.isArray(data.departmentIds) ? data.departmentIds : [];
  const assignToAll = normalizeBoolean(data.assign_to_all); // 1 or 0

  const tenantPool = await getTenantPoolForOrgId(orgId);
  const conn = await tenantPool.getConnection();

  try {
    await conn.beginTransaction();

    const [result] = await conn.query(queries.INSERT_POLICY, [
      orgId,
      data.policy_name,
      data.description || null,
      normalizeBoolean(data.allow_view),
      normalizeBoolean(data.allow_download),
      assignToAll,                    // ← new
      data.created_by || null,
    ]);

    const policyId = result.insertId;

    // Only insert specific assignments when NOT "assign to all"
    if (!assignToAll) {
      for (const employeeId of employeeIds) {
        await conn.query(queries.INSERT_POLICY_ASSIGNMENT, [
          policyId,
          employeeId,
          null,
          null,
          null,
          "employee",
        ]);
      }

      for (const departmentId of departmentIds) {
        await conn.query(queries.INSERT_POLICY_ASSIGNMENT, [
          policyId,
          null,
          null,
          departmentId,
          null,
          "department",
        ]);
      }
    }

    await conn.commit();

    return {
      id: policyId,
      policy_name: data.policy_name,
      description: data.description || null,   // ← ADD
      allow_view: normalizeBoolean(data.allow_view),
      allow_download: normalizeBoolean(data.allow_download),
      assign_to_all: assignToAll,
      created_by: data.created_by || null,
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
/**
 * Upload Policy Files
 */
/**
 * Upload Policy Files
 */
async function uploadPolicyFiles(orgId, policyId, files, body = {}) {
  if (!orgId || !policyId) throw new Error("orgId and policyId are required");

  const tenantPool = await getTenantPoolForOrgId(orgId);
  const conn = await tenantPool.getConnection();

  try {
    await conn.beginTransaction();

    const [policyExists] = await conn.query(queries.GET_POLICY_BY_ID, [policyId, orgId]);
    if (policyExists.length === 0) throw new Error("Policy not found");

    const supportedTypes = ["document", "ppt", "video", "image"];
    const { convertToPdf } = require("../utils/convertToPdf");

    // Flatten all files into one array in a stable order
    // and keep the original FormData index that the frontend sent
    const allFiles = [];
    let globalIndex = 0;

    for (const fileType of supportedTypes) {
      const uploadedFiles = files?.[fileType];
      if (!Array.isArray(uploadedFiles) || uploadedFiles.length === 0) continue;

      for (const file of uploadedFiles) {
        allFiles.push({
          file,
          fileType,
          index: globalIndex,   // this matches frontend index
        });
        globalIndex++;
      }
    }

    let totalUploaded = 0;

    for (const item of allFiles) {
      const { file, fileType, index } = item;

      // ===== CONVERT OFFICE FILES TO PDF =====
      let finalFileName = file.filename;
      let finalOriginalName = file.originalname;
      let finalFileType = fileType;

      const ext = path.extname(file.originalname).toLowerCase();

      if ([".doc", ".docx", ".ppt", ".pptx"].includes(ext)) {
        try {
          const pdfPath = await convertToPdf(file.path);
          if (pdfPath) {
            finalFileName = path.basename(pdfPath);
            finalOriginalName = file.originalname.replace(ext, ".pdf");
            finalFileType = "document";

            if (fs.existsSync(file.path)) {
              fs.unlinkSync(file.path);
            }
          }
        } catch (convErr) {
          console.error("Conversion error for", file.originalname, convErr.message);
        }
      }

      // Use the global index that the frontend sent
      const acknowledgementRequired = normalizeBoolean(
        body[`acknowledgement_${index}`]
      );
      const acknowledgementMessage =
        body[`acknowledgement_message_${index}`] || "";

      const allowView = normalizeBoolean(body[`allow_view_${index}`]);
      const allowDownload = normalizeBoolean(body[`allow_download_${index}`]);

      console.log(`File index ${index}: allow_view=${allowView}, allow_download=${allowDownload}`);

      await conn.query(queries.INSERT_POLICY_FILE, [
        policyId,
        finalFileType,
        finalFileName,
        finalOriginalName,
        acknowledgementRequired,
        acknowledgementMessage,
        allowView,
        allowDownload,
      ]);

      totalUploaded++;
      console.log(`✅ Uploaded: ${finalOriginalName} (${finalFileType})`);
    }

    await conn.commit();
    return { success: true, message: `${totalUploaded} file(s) uploaded` };
  } catch (error) {
    await conn.rollback();
    console.error("❌ Upload Error:", error);

    if (files) {
      Object.values(files).flat().forEach((file) => {
        if (file?.path && fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });
    }
    throw error;
  } finally {
    conn.release();
  }
}

/**
 * Update Policy File Acknowledgement
 */
/**
 * Update Policy
 */
/**
 * Update Policy
 */
async function updatePolicy(orgId, policyId, data) {
  if (!orgId) throw new Error("orgId required");
  if (!policyId) throw new Error("policyId required");

  const employeeIds = Array.isArray(data.employeeIds) ? data.employeeIds : [];
  const departmentIds = Array.isArray(data.departmentIds) ? data.departmentIds : [];
  const assignToAll = normalizeBoolean(data.assign_to_all);

  const tenantPool = await getTenantPoolForOrgId(orgId);
  const conn = await tenantPool.getConnection();

  try {
    await conn.beginTransaction();

    const [policy] = await conn.query(queries.GET_POLICY_BY_ID, [policyId, orgId]);
    if (!policy.length) throw new Error("Policy not found");

    // 1. Update policy row
    await conn.query(queries.UPDATE_POLICY, [
      data.policy_name,
      data.description ?? null,
      normalizeBoolean(data.allow_view),
      normalizeBoolean(data.allow_download),
      assignToAll,
      policyId,
      orgId,
    ]);

    // 2. Always clear old assignments
    await conn.query(queries.DELETE_POLICY_ASSIGNMENTS, [policyId]);

    // 3. Re-insert new assignments (only when NOT assign_to_all)
    if (!assignToAll) {
      for (const employeeId of employeeIds) {
        await conn.query(queries.INSERT_POLICY_ASSIGNMENT, [
          policyId,
          employeeId,
          null,
          null,
          null,
          "employee",
        ]);
      }

      for (const departmentId of departmentIds) {
        await conn.query(queries.INSERT_POLICY_ASSIGNMENT, [
          policyId,
          null,
          null,
          departmentId,
          null,
          "department",
        ]);
      }
    }

    await conn.commit();
    return { success: true, message: "Policy updated successfully" };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
async function getPolicyAssignments(orgId, policyId) {
  if (!orgId || !policyId) throw new Error("orgId and policyId required");

  const tenantPool = await getTenantPoolForOrgId(orgId);

  // Optional safety: make sure the policy belongs to this org
  const [policy] = await tenantPool.query(queries.GET_POLICY_BY_ID, [policyId, orgId]);
  if (!policy.length) throw new Error("Policy not found");

  const [rows] = await tenantPool.query(queries.GET_POLICY_ASSIGNMENTS, [policyId]);

  const employees = [];
  const departments = [];
  let assign_to_all = 0;

  for (const row of rows) {
    if (row.assignment_type === "all") {
      assign_to_all = 1;
    } else if (row.employee_id) {
      employees.push({
        employee_id: row.employee_id,
        full_name: row.employee_name || `Employee ${row.employee_id}`,
      });
    } else if (row.department_id) {
      departments.push({
        id: row.department_id,
        name: row.department_name || `Department ${row.department_id}`,
      });
    }
  }

  // Also respect the flag on the policy itself
  if (policy[0].assign_to_all === 1) {
    assign_to_all = 1;
  }

  return { employees, departments, assign_to_all };
}
/**
 * 
 * Get All Policies
 */
async function getPolicies(orgId) {
  if (!orgId) {
    throw new Error("orgId required");
  }

  const tenantPool = await getTenantPoolForOrgId(orgId);

  const [rows] = await tenantPool.query(
    queries.GET_POLICIES,
    [orgId]
  );

  return rows;
}

/**
 * Get Files By Policy
 */
async function getPolicyFiles(orgId, policyId) {

  if (!orgId) {
    throw new Error("orgId required");
  }

  if (!policyId) {
    throw new Error("policyId required");
  }

  const tenantPool = await getTenantPoolForOrgId(orgId);

  const [rows] = await tenantPool.query(
    queries.GET_POLICY_FILES,
    [policyId]
  );

  return rows;
}

/**
 * Download Policy File
 */
async function downloadPolicyFile(orgId, fileId) {

  if (!orgId) {
    throw new Error("orgId required");
  }

  if (!fileId) {
    throw new Error("fileId required");
  }

  const tenantPool = await getTenantPoolForOrgId(orgId);

  const [rows] = await tenantPool.query(
    queries.GET_POLICY_FILE_BY_ID,
    [fileId]
  );

  if (!rows.length) {
    throw new Error("File not found");
  }

  const file = rows[0];

  const absolutePath = path.join(
    UPLOAD_BASE_PATH,
    String(orgId),
    `policy_${file.policy_id}`,
    file.file_name
  );

  if (!fs.existsSync(absolutePath)) {
    throw new Error("Physical file not found");
  }

  return {
    id: file.id,
    policyId: file.policy_id,
    fileType: file.file_type,
    originalFileName: file.original_file_name,
    storedFileName: file.file_name,
    acknowledgementRequired: file.acknowledgement_required,
    acknowledgementMessage: file.acknowledgement_message,
    uploadedAt: file.uploaded_at,
    filePath: absolutePath
  };
}
/**
 * Delete Policy File
 */
async function deletePolicyFile(orgId, fileId) {
  if (!orgId) {
    throw new Error("orgId required");
  }

  if (!fileId) {
    throw new Error("fileId required");
  }

  const tenantPool = await getTenantPoolForOrgId(orgId);

  const conn = await tenantPool.getConnection();

  try {
    await conn.beginTransaction();

    const [rows] = await conn.query(
      queries.GET_POLICY_FILE_BY_ID,
      [fileId]
    );

    if (!rows.length) {
      throw new Error("File not found");
    }

    const file = rows[0];

    const physicalPath = path.join(
      UPLOAD_BASE_PATH,
      String(orgId),
      `policy_${file.policy_id}`,
      file.file_name
    );

    if (fs.existsSync(physicalPath)) {
      fs.unlinkSync(physicalPath);
    }

    await conn.query(
      queries.DELETE_POLICY_FILE,
      [fileId]
    );

    await conn.commit();

    return {
      success: true,
      message: "Policy file deleted successfully",
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * Delete Policy
 */
async function deletePolicy(orgId, policyId) {
  if (!orgId) {
    throw new Error("orgId required");
  }

  if (!policyId) {
    throw new Error("policyId required");
  }

  const tenantPool = await getTenantPoolForOrgId(orgId);

  const conn = await tenantPool.getConnection();

  try {
    await conn.beginTransaction();

    const [policy] = await conn.query(
      queries.GET_POLICY_BY_ID,
      [policyId, orgId]
    );

    if (!policy.length) {
      throw new Error("Policy not found");
    }

    const [files] = await conn.query(
      queries.GET_POLICY_FILES,
      [policyId]
    );

    for (const file of files) {
      const filePath = path.join(
        UPLOAD_BASE_PATH,
        String(orgId),
        `policy_${policyId}`,
        file.file_name
      );

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await conn.query(
      queries.DELETE_POLICY_FILES_BY_POLICY,
      [policyId]
    );

    await conn.query(
      queries.DELETE_POLICY,
      [policyId, orgId]
    );

    await conn.commit();

    return {
      success: true,
      message: "Policy deleted successfully",
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
/**
 * Update Policy File Acknowledgement
 */
async function updatePolicyFileAcknowledgement(orgId, fileId, data) {
  if (!orgId) throw new Error("orgId required");
  if (!fileId) throw new Error("fileId required");

  const tenantPool = await getTenantPoolForOrgId(orgId);
  const conn = await tenantPool.getConnection();

  try {
    await conn.beginTransaction();

    const [fileRows] = await conn.query(
      queries.GET_POLICY_FILE_BY_ID,
      [fileId]
    );

    if (!fileRows.length) throw new Error("File not found");

    await conn.query(queries.UPDATE_POLICY_FILE_ACKNOWLEDGEMENT, [
      normalizeBoolean(data.acknowledgement_required),
      data.acknowledgement_message || "",
      normalizeBoolean(data.allow_view),
      normalizeBoolean(data.allow_download),
      fileId,
    ]);

    await conn.commit();

    return { success: true, message: "File acknowledgement updated" };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
module.exports = {
  createPolicy,
  uploadPolicyFiles,
  getPolicies,
  getPolicyFiles,
  downloadPolicyFile,
  updatePolicy,
  deletePolicyFile,
  deletePolicy,
  updatePolicyFileAcknowledgement,replacePolicyFile,getPolicyAssignments,   // ← NEW
};