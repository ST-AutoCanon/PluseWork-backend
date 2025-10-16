const db = require("../config");
const queries = require("../constants/reimbursementQueries");
const path = require("path");

const toLocalDateString = (dt) => {
  if (!dt) return null;
  const d = new Date(dt);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

exports.processUploadedFiles = async (files, reimbursementId) => {
  try {
    for (const file of files) {
      const ext = path.extname(file.originalname).toLowerCase();

      if (ext === ".pdf") {
        const imagePaths = await convertPdfToImages(
          file.path,
          path.dirname(file.path)
        );

        for (const imgPath of imagePaths) {
          await saveAttachmentToDB({
            reimbursementId,
            filePath: imgPath,
            fileType: "image/png",
          });
        }
      } else {
        await saveAttachmentToDB({
          reimbursementId,
          filePath: file.path,
          fileType: file.mimetype,
        });
      }
    }
  } catch (error) {
    console.error("Error processing uploaded files:", error);
    throw error;
  }
};
exports.getReimbursementsByEmployee = async (
  employeeId,
  fromDate = null,
  toDate = null,
  orgId = null
) => {
  let query = queries.GET_REIMBURSEMENTS_BY_EMPLOYEE;
  let queryParams = [employeeId, orgId, orgId];

  const [rawRows] = await db.query(query, queryParams);

  if (!rawRows.length) return [];
  const reimbursements = rawRows.map((r) => ({
    ...r,
    from_date: toLocalDateString(r.from_date),
    to_date: toLocalDateString(r.to_date),
    date: toLocalDateString(r.date),
  }));

  const reimbursementIds = reimbursements.map((r) => r.id);
  const [attachments] = await db.query(
    queries.GET_ATTACHMENTS_BY_REIMBURSEMENT_IDS,
    [reimbursementIds]
  );
  return mapAttachmentsToReimbursements(
    reimbursements,
    attachments,
    employeeId
  );
};

const mapAttachmentsToReimbursements = (
  reimbursements,
  attachments,
  employeeId
) => {
  const attachmentMap = {};

  attachments.forEach((attachment) => {
    if (!attachmentMap[attachment.reimbursement_id]) {
      attachmentMap[attachment.reimbursement_id] = [];
    }
    const { file_name, year, month } = attachment;
    attachmentMap[attachment.reimbursement_id].push({
      filename: file_name,
      url: `/reimbursement/${year}/${month}/${employeeId}/${file_name}`,
    });
  });

  reimbursements.forEach((reimbursement) => {
    reimbursement.attachments = attachmentMap[reimbursement.id] || [];
  });

  return reimbursements;
};

exports.updatePaymentStatus = async (id, payment_status, paid_date) => {
  try {
    console.log("Service: Updating payment status...");
    console.log("Reimbursement ID:", id);
    console.log("New Payment Status:", payment_status);
    console.log("Paid Date:", paid_date);

    const result = await db.query(queries.UPDATE_PAYMENT_STATUS, [
      payment_status,
      paid_date,
      id,
    ]);

    console.log("Database update result:", result);

    return { id, payment_status, paid_date };
  } catch (error) {
    console.error("Error in updatePaymentStatus service:", error);
    throw error;
  }
};

exports.getAttachmentsByReimbursementIds = async (reimbursementIds) => {
  if (!reimbursementIds.length) return [];
  const [attachments] = await db.query(
    queries.GET_ATTACHMENTS_BY_REIMBURSEMENT_IDS,
    [reimbursementIds]
  );
  return attachments;
};
exports.getAllReimbursements = async (
  submittedFrom = null,
  submittedFromForBetween = null,
  submittedTo = null,
  orgId = null
) => {
  try {
    console.log("getAllReimbursements params:", {
      submittedFrom,
      submittedFromForBetween,
      submittedTo,
      orgId,
    });

    // query updated SQL expects the last two params to be orgId twice (see queries below)
    const [rawRows] = await db.query(queries.GET_ALL_REIMBURSEMENTS, [
      submittedFrom,
      submittedFromForBetween,
      submittedTo,
      orgId,
      orgId,
    ]);

    if (!rawRows.length) {
      return [];
    }

    const reimbursements = rawRows.map((r) => ({
      ...r,
      from_date: toLocalDateString(r.from_date),
      to_date: toLocalDateString(r.to_date),
      date: toLocalDateString(r.date),
    }));

    const reimbursementIds = reimbursements.map((r) => r.id);
    const safeIds = reimbursementIds.length ? reimbursementIds : [-1];
    const [attachments] = await db.query(
      queries.GET_ATTACHMENTS_BY_REIMBURSEMENT_IDS,
      [safeIds]
    );

    const attachmentMap = {};
    attachments.forEach((att) => {
      const key = att.reimbursement_id;
      if (!attachmentMap[key]) attachmentMap[key] = [];
      // att may or may not have org_id column depending on schema — prefer att.org_id if present
      const orgSeg = att.org_id
        ? att.org_id
        : att.employee_org_id
        ? att.employee_org_id
        : "unknown_org";
      attachmentMap[key].push({
        filename: att.file_name,
        url: `/reimbursement/${orgSeg}/${att.year}/${att.month}/${att.employee_id}/${att.file_name}`,
      });
    });
    reimbursements.forEach((r) => {
      r.attachments = attachmentMap[r.id] || [];
    });

    const grouped = reimbursements.reduce((acc, r) => {
      const eid = r.employee_id;
      if (!acc[eid]) acc[eid] = [];
      acc[eid].push(r);
      return acc;
    }, {});

    return Object.entries(grouped).map(([employee_id, claims]) => ({
      employee_id,
      claims,
    }));
  } catch (err) {
    console.error("Error in getAllReimbursements service:", err);
    throw new Error("Database query failed.");
  }
};

exports.createReimbursement = async (reimbursementData) => {
  try {
    let department_id = parseInt(reimbursementData.department_id, 10);
    if (isNaN(department_id)) department_id = null;

    const reimbursementArray = [
      reimbursementData.employeeId,
      department_id,
      reimbursementData.claim_type,
      reimbursementData.transport_type || null,
      reimbursementData.from_date || null,
      reimbursementData.to_date || null,
      reimbursementData.date || null,
      reimbursementData.travel_from || null,
      reimbursementData.travel_to || null,
      reimbursementData.meals_objective || null,
      reimbursementData.purpose || null,
      reimbursementData.purchasing_item || null,
      reimbursementData.accommodation_fees || null,
      reimbursementData.no_of_days !== undefined
        ? reimbursementData.no_of_days
        : 0,
      reimbursementData.transport_amount &&
      reimbursementData.transport_amount !== "undefined"
        ? reimbursementData.transport_amount
        : 0,
      reimbursementData.da && reimbursementData.da !== "undefined"
        ? reimbursementData.da
        : 0,
      reimbursementData.total_amount !== undefined
        ? reimbursementData.total_amount
        : 0,
      reimbursementData.meal_type || null,
      reimbursementData.stationary || null,
      reimbursementData.service_provider || null,
      reimbursementData.project || null,
    ];

    const orgId = reimbursementData.orgId || null;

    reimbursementArray.push(orgId);

    const [existingClaims] = await db.query(queries.CHECK_EXISTING_CLAIM, [
      reimbursementData.employeeId,
      reimbursementData.claim_type,
      reimbursementData.date || null,
      reimbursementData.from_date || null,
      reimbursementData.to_date || null,
      orgId,
    ]);

    console.log(
      "🚀 createReimbursement: found existing claims with statuses:",
      existingClaims.map((c) => c.status)
    );

    const stillActive = existingClaims.filter(
      (c) => c.status && c.status.toString().toLowerCase().trim() !== "rejected"
    );

    if (stillActive.length > 0) {
      throw {
        statusCode: 400,
        message:
          "A reimbursement with the same claim type and date already exists.",
      };
    }

    const [result] = await db.query(
      queries.CREATE_REIMBURSEMENT,
      reimbursementArray
    );
    const reimbursementId = result.insertId;

    if (reimbursementData.attachments?.length) {
      const attachmentValues = reimbursementData.attachments.map((f) => [
        reimbursementId,
        f.file_name,
        f.file_path,
      ]);
      await db.query(queries.SAVE_ATTACHMENTS, [attachmentValues]);
    }

    return { id: reimbursementId, ...reimbursementData };
  } catch (error) {
    console.error("Error during reimbursement creation:", error);
    throw error;
  }
};

exports.getApproverDetails = async (approver_id) => {
  console.log("Fetching approver details for Approver ID:", approver_id);

  const result = await db.query(queries.GET_APPROVER_DETAILS, [approver_id]);

  console.log("Approver Query Result:", result);

  return result.length ? result[0] : null;
};

exports.updateReimbursementStatus = async (
  id,
  status,
  approver_comments,
  approver_id,
  approver_name,
  approver_designation,
  project,
  orgId
) => {
  if (!["approved", "rejected"].includes(status)) {
    throw new Error("Invalid status. Allowed values: 'approved', 'rejected'");
  }

  console.log("Updating reimbursement status...");
  console.log("Reimbursement ID:", id);
  console.log("Status:", status);
  console.log("Approver ID:", approver_id);
  console.log("Approver Name:", approver_name);
  console.log("Approver Designation:", approver_designation);
  console.log("Project:", project);

  const result = await db.query(queries.UPDATE_REIMBURSEMENT_STATUS, [
    status,
    approver_comments,
    approver_id,
    approver_name,
    approver_designation,
    project,
    new Date(),
    id,
    orgId,
  ]);

  console.log("Update Query Result:", result);

  return {
    id,
    status,
    approver_comments,
    approver_id,
    approver_name,
    approver_designation,
    project,
    approved_date: new Date(),
  };
};

exports.deleteReimbursement = async (id) => {
  await db.query(queries.DELETE_REIMBURSEMENT, [id]);
};

exports.getAttachments = async (reimbursementId) => {
  const [rows] = await db.query(queries.GET_ATTACHMENTS, [reimbursementId]);
  return rows;
};

exports.updateReimbursement = async (reimbursementId, updateData) => {
  try {
    console.log("Received updateData in service:", updateData);

    if (!updateData || Object.keys(updateData).length === 0) {
      throw new Error("updateData is missing or empty.");
    }

    const {
      department_id,
      claim_type,
      transport_type,
      fromDate,
      toDate,
      date,
      travel_from,
      travel_to,
      meals_objective,
      purpose,
      purchasing_item,
      accommodation_fees,
      no_of_days,
      transport_amount,
      da,
      total_amount,
      meal_type,
      stationary,
      service_provider,
      project,
      attachments,
    } = updateData;

    let processedDepartmentId = parseInt(department_id, 10);
    if (isNaN(processedDepartmentId)) {
      processedDepartmentId = null;
    }

    const [result] = await db.query(queries.UPDATE_REIMBURSEMENT, [
      processedDepartmentId,
      claim_type,
      transport_type,
      fromDate,
      toDate,
      date,
      travel_from,
      travel_to,
      meals_objective,
      purpose,
      purchasing_item,
      accommodation_fees,
      no_of_days,
      transport_amount,
      da,
      total_amount,
      meal_type,
      stationary,
      service_provider,
      project,
      reimbursementId,
    ]);

    if (result.affectedRows === 0) {
      throw new Error("No reimbursement found or unauthorized update.");
    }

    if (attachments && attachments.length > 0) {
      await db.query(queries.DELETE_ATTACHMENTS_BY_REIMBURSEMENT_ID, [
        reimbursementId,
      ]);

      const attachmentValues = attachments.map(({ file_name, file_path }) => {
        return [reimbursementId, file_name, file_path];
      });
      await db.query(queries.SAVE_ATTACHMENTS, [attachmentValues]);
    }

    return { success: true, message: "Reimbursement updated successfully." };
  } catch (error) {
    console.error("Error updating reimbursement:", error);
    throw error;
  }
};

exports.getTeamReimbursements = async (
  departmentId,
  submittedFrom,
  submittedFromForBetween,
  submittedTo,
  teamLeadId,
  orgId = null
) => {
  const params = [
    departmentId,
    submittedFrom || null,
    submittedFrom || null,
    submittedTo || null,
    orgId,
    orgId,
  ];

  const [reimbursements] = await db.query(
    queries.GET_TEAM_REIMBURSEMENTS,
    params
  );

  if (!reimbursements.length) return [];

  const filteredReimbursements = reimbursements.filter(
    (r) => r.employee_id !== teamLeadId
  );

  const reimbursementIds = filteredReimbursements.map((r) => r.id);
  const safeIds = reimbursementIds.length ? reimbursementIds : [-1];

  const [attachments] = await db.query(
    queries.GET_ATTACHMENTS_BY_REIMBURSEMENT_IDS,
    [safeIds]
  );

  const attachmentMap = {};
  attachments.forEach((attachment) => {
    if (!attachmentMap[attachment.reimbursement_id]) {
      attachmentMap[attachment.reimbursement_id] = [];
    }
    const orgSeg = attachment.org_id || "unknown_org";
    attachmentMap[attachment.reimbursement_id].push({
      filename: attachment.file_name,
      url: `/reimbursement/${orgSeg}/${attachment.year}/${attachment.month}/${attachment.employee_id}/${attachment.file_name}`,
    });
  });

  filteredReimbursements.forEach((reimbursement) => {
    reimbursement.attachments = attachmentMap[reimbursement.id] || [];
  });

  return filteredReimbursements;
};

exports.getAllProjects = async (orgId) => {
  try {
    if (!orgId) throw new Error("orgId is required");

    const [projects] = await db.query(queries.GET_ALL_PROJECTS, [orgId]);

    if (!projects.length) return [];

    return projects.map((project) => project.project_name);
  } catch (error) {
    console.error("Error fetching projects:", error);
    throw new Error("Database query failed.");
  }
};
