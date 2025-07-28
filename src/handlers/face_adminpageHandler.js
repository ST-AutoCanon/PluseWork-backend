

const moment = require("moment");
const { 
  getAllFaces, 
  insertPunchIn, 
  updatePunchOut, 
  getLastPunchRecordByEmpId 
} = require("../services/face_adminpageServices");
const { compareDescriptors } = require("../utils/compareDescriptors");

exports.handleFacePunch = async (req, res) => {
  try {
    const { descriptor, device, location } = req.body;

    const faces = await getAllFaces();
    let bestMatch = null;
    let bestDistance = Infinity;
    const threshold = 0.28;
    let matchedFace = null; // 👈 hold the matched face record

    for (const face of faces) {
      let storedDescriptors;

      if (typeof face.descriptors === "string") {
        storedDescriptors = JSON.parse(face.descriptors);
      } else {
        storedDescriptors = face.descriptors;
      }

      for (const stored of storedDescriptors) {
        const distance = compareDescriptors(descriptor, stored);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestMatch = face.employee_id;
          matchedFace = face; // 👈 store the whole face record
        }
      }
    }

    if (bestDistance >= threshold || !matchedFace) {
      return res.status(404).json({ message: "Face not recognized" });
    }

    const matchedEmployee = bestMatch;
const employeeName = matchedFace.label; // 👈 because label contains the employee name
    const now = moment().format("YYYY-MM-DD HH:mm:ss");

    const lastPunchRecord = await getLastPunchRecordByEmpId(matchedEmployee);

    if (!lastPunchRecord || lastPunchRecord.punch_status === "Punch Out") {
      await insertPunchIn(matchedEmployee, now, device, location);
      return res.status(200).json({ 
        message: "Punch In successful", 
        employee_id: matchedEmployee,
        employee_name: employeeName 
      });
    } else {
      await updatePunchOut(lastPunchRecord.punch_id, now, device, location);
      return res.status(200).json({ 
        message: "Punch Out successful", 
        employee_id: matchedEmployee,
        employee_name: employeeName 
      });
    }

  } catch (err) {
    console.error("❌ Error in handling face punch:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};
