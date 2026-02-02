// const moment = require("moment");
// const {
//   getAllFaces,
//   getLastPunchRecordByEmpId,
//   insertPunchIn,
//   updatePunchOut,
// } = require("../services/face_adminpageServices");
// const { compareDescriptors } = require("../utils/compareDescriptors");
// const ErrorHandler = require("../utils/errorHandler");

// const resolveOrgId = (req) =>
//   req.headers?.["x-org-id"] ||
//   req.headers?.["x_org_id"] ||
//   req.query?.orgId ||
//   req.query?.org_id ||
//   req.body?.orgId ||
//   req.body?.org_id ||
//   (req.user && (req.user.orgId || req.user.org_id)) ||
//   null;

// const handleFacePunch = async (req, res) => {
//   try {
//     const { descriptor, device, location } = req.body;
//     const orgId = resolveOrgId(req);

//     if (!orgId) {
//       return res
//         .status(400)
//         .json(
//           ErrorHandler.generateErrorResponse(
//             400,
//             "Missing orgId (x-org-id header or orgId in body/query)."
//           )
//         );
//     }

//     if (!descriptor || !Array.isArray(descriptor)) {
//       return res
//         .status(400)
//         .json(
//           ErrorHandler.generateErrorResponse(400, "Invalid face descriptor")
//         );
//     }

//     const faces = await getAllFaces(orgId);

//     let bestDistance = Infinity;
//     let matchedFace = null;
//     const threshold = 0.35;

//     for (const face of faces) {
//       if (!face.descriptors) continue;

//       const descriptorList =
//         typeof face.descriptors === "string"
//           ? JSON.parse(face.descriptors)
//           : face.descriptors;

//       if (!Array.isArray(descriptorList)) continue;

//       for (const stored of descriptorList) {
//         const storedDescriptor = Array.isArray(stored)
//           ? stored
//           : Object.values(stored);

//         if (storedDescriptor.length !== 128) continue;

//         const distance = compareDescriptors(descriptor, storedDescriptor);

//         if (distance < bestDistance) {
//           bestDistance = distance;
//           matchedFace = face;
//         }
//       }
//     }

//     if (!matchedFace || bestDistance >= threshold) {
//       return res.status(404).json({ message: "Face not recognized" });
//     }

//     const employeeId = matchedFace.employee_id;
//     const employeeName = matchedFace.label;
//     const now = moment().format("YYYY-MM-DD HH:mm:ss");

//     const lastPunch = await getLastPunchRecordByEmpId(employeeId, orgId);

//     if (!lastPunch || lastPunch.punch_status === "Punch Out") {
//       await insertPunchIn(employeeId, now, device, location, orgId);
//       return res.json({
//         message: "Punch In successful",
//         employee_id: employeeId,
//         employee_name: employeeName,
//         punchType: "punch-in",
//       });
//     }

//     await updatePunchOut(lastPunch.punch_id, now, device, location, orgId);

//     return res.json({
//       message: "Punch Out successful",
//       employee_id: employeeId,
//       employee_name: employeeName,
//       punchType: "punch-out",
//     });
//   } catch (error) {
//     console.error("❌ Face punch error:", error);
//     return res.status(500).json({ message: "Internal server error" });
//   }
// };

// module.exports = {
//   handleFacePunch,
// };

const moment = require("moment");
const {
  getAllFaces,
  getLastPunchRecordByEmpId,
  insertPunchIn,
  updatePunchOut,
} = require("../services/face_adminpageServices");
const { compareDescriptors } = require("../utils/compareDescriptors");
const ErrorHandler = require("../utils/errorHandler");

const resolveOrgId = (req) =>
  req.headers?.["x-org-id"] ||
  req.headers?.["x_org_id"] ||
  req.query?.orgId ||
  req.query?.org_id ||
  req.body?.orgId ||
  req.body?.org_id ||
  (req.user && (req.user.orgId || req.user.org_id)) ||
  null;

// POST /face-punch
const handleFacePunch = async (req, res) => {
  try {
    const { descriptor, device, location } = req.body;
    const orgId = resolveOrgId(req);

    if (!orgId) {
      return res
        .status(400)
        .json(ErrorHandler.generateErrorResponse(400, "Missing orgId."));
    }

    if (!descriptor || !Array.isArray(descriptor)) {
      return res
        .status(400)
        .json(ErrorHandler.generateErrorResponse(400, "Invalid face descriptor"));
    }

    const faces = await getAllFaces(orgId);

    let bestDistance = Infinity;
    let matchedFace = null;
    const threshold = 0.35;

    for (const face of faces) {
      if (!face.descriptors) continue;

      const descriptorList =
        typeof face.descriptors === "string"
          ? JSON.parse(face.descriptors)
          : face.descriptors;

      if (!Array.isArray(descriptorList)) continue;

      for (const stored of descriptorList) {
        const storedDescriptor = Array.isArray(stored) ? stored : Object.values(stored);
        if (storedDescriptor.length !== 128) continue;

        const distance = compareDescriptors(descriptor, storedDescriptor);
        if (distance < bestDistance) {
          bestDistance = distance;
          matchedFace = face;
        }
      }
    }

    if (!matchedFace || bestDistance >= threshold) {
      return res.status(404).json({ message: "Face not recognized" });
    }

    const employeeId = matchedFace.employee_id;
    const employeeName = matchedFace.label;
    const now = moment().format("YYYY-MM-DD HH:mm:ss");

    const lastPunch = await getLastPunchRecordByEmpId(employeeId, orgId);

    if (!lastPunch || lastPunch.punch_status === "Punch Out") {
      await insertPunchIn(employeeId, now, device, location, orgId);
      return res.json({
        message: "Punch In successful",
        employee_id: employeeId,
        employee_name: employeeName,
        punchType: "punch-in",
      });
    }

    await updatePunchOut(lastPunch.punch_id, now, device, location, orgId);
    return res.json({
      message: "Punch Out successful",
      employee_id: employeeId,
      employee_name: employeeName,
      punchType: "punch-out",
    });
  } catch (error) {
    console.error("❌ Face punch error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// GET /face-punch/face-data
const getFaceData = async (req, res) => {
  try {
    const orgId = resolveOrgId(req);
    if (!orgId) return res.status(400).json({ message: "Missing orgId" });

    const faces = await getAllFaces(orgId);
    return res.json({ faces });
  } catch (err) {
    console.error("❌ Get face data error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = {
  handleFacePunch,
  getFaceData,
};
